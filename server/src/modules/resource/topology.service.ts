import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'
import type { PvGridTopology, TopoNode, TopoEdge } from '@new-energy/shared'

/** 确保存在有效母线ID，无则使用已有母线或创建默认母线 */
async function ensureBusId(busId?: string | null): Promise<string> {
  if (busId) {
    const exists = await db('grid_buses').where('id', busId).select('id').first()
    if (exists) return busId
  }
  const first = await db('grid_buses').select('id').first()
  if (first) return first.id
  const id = uuid()
  await db('grid_buses').insert({
    id, name: '默认母线', zone: '', voltage_level: '10', bus_type: 'pq', base_kv: 10,
  })
  return id
}

// 根据 node_type + node_id 解析显示名称
async function resolveNodeName(nodeType: string, nodeId: string): Promise<string> {
  switch (nodeType) {
    case 'SOURCE': {
      const pv = await db('solar_pv_stations').where('id', nodeId).select('station_name').first()
      return (pv as any)?.station_name || nodeId
    }
    case 'GRID': {
      const bus = await db('grid_buses').where('id', nodeId).select('name').first()
      return (bus as any)?.name || nodeId
    }
    case 'LOAD': {
      const load = await db('load_entities').where('id', nodeId).select('name').first()
      return (load as any)?.name || nodeId
    }
    case 'STORAGE': {
      const storage = await db('storage_entities').where('id', nodeId).select('name').first()
      return (storage as any)?.name || nodeId
    }
    default:
      return nodeId
  }
}

export class TopologyService {
  async getPvGridTopology(): Promise<PvGridTopology> {
    const nodes: TopoNode[] = []
    const edges: TopoEdge[] = []

    // 1. SOURCE 节点：光伏电站
    const pvRows = await db('solar_pv_stations')
      .select(
        'id as station_id',
        'station_name as plant_name',
        'bus_id',
        'installed_capacity_mw',
        'grid_connection_voltage_kv',
        'longitude',
        'latitude',
      )
    const pvBusIds = pvRows.map((r: any) => r.bus_id)
    for (const r of pvRows as any[]) {
      nodes.push({
        id: `NODE_SOURCE_${r.station_id}`,
        name: r.plant_name,
        nodeType: 'SOURCE',
        plantId: r.station_id,
        busId: r.bus_id,
        voltageLevel: r.grid_connection_voltage_kv ? `${r.grid_connection_voltage_kv}kV` : undefined,
        posX: r.longitude,
        posY: r.latitude,
        capacityKw: r.installed_capacity_mw * 1000,
      })
    }

    // 2. GRID 节点：与连接相关的母线
    const linkedBusIds = new Set<string>(pvBusIds)
    // 从 connection_attrs 中找出关联的母线
    const connBusIds = await db('resource_connection_attrs')
      .where(function () { this.where('source_node_type', 'GRID').orWhere('target_node_type', 'GRID') })
      .select('source_node_id', 'target_node_id')
    for (const r of connBusIds as any[]) {
      if (r.source_node_id) linkedBusIds.add(r.source_node_id)
      if (r.target_node_id) linkedBusIds.add(r.target_node_id)
    }
    // 通过 grid_branches 扩展关联母线
    if (pvBusIds.length > 0) {
      const branches = await db('grid_branches')
        .whereIn('from_bus_id', Array.from(linkedBusIds))
        .orWhereIn('to_bus_id', Array.from(linkedBusIds))
        .select('from_bus_id', 'to_bus_id')
      for (const br of branches as any[]) {
        linkedBusIds.add(br.from_bus_id)
        linkedBusIds.add(br.to_bus_id)
      }
    }
    const busRows = await db('grid_buses')
      .whereIn('id', Array.from(linkedBusIds))
      .select('id', 'name', 'voltage_level', 'zone', 'longitude', 'latitude')
    for (const b of busRows as any[]) {
      nodes.push({
        id: `NODE_GRID_${b.id}`,
        name: b.name,
        nodeType: 'GRID',
        busId: b.id,
        voltageLevel: b.voltage_level,
        zone: b.zone,
        posX: b.longitude,
        posY: b.latitude,
      })
    }

    // 3. LOAD 节点：负荷实体
    const loadRows = await db('load_entities')
      .whereIn('bus_id', Array.from(linkedBusIds))
      .select('id', 'name', 'load_type', 'bus_id', 'voltage_level', 'peak_load_kw', 'zone', 'longitude', 'latitude')
    for (const l of loadRows as any[]) {
      nodes.push({
        id: `NODE_LOAD_${l.id}`,
        name: l.name,
        nodeType: 'LOAD',
        busId: l.bus_id,
        voltageLevel: l.voltage_level,
        zone: l.zone,
        posX: l.longitude,
        posY: l.latitude,
        capacityKw: l.peak_load_kw,
      })
    }

    // 4. STORAGE 节点：储能实体
    const storageRows = await db('storage_entities')
      .whereIn('bus_id', Array.from(linkedBusIds))
      .select('id', 'name', 'storage_type', 'bus_id', 'voltage_level', 'rated_power_kw', 'zone', 'longitude', 'latitude')
    for (const s of storageRows as any[]) {
      nodes.push({
        id: `NODE_STORAGE_${s.id}`,
        name: s.name,
        nodeType: 'STORAGE',
        busId: s.bus_id,
        voltageLevel: s.voltage_level,
        zone: s.zone,
        posX: s.longitude,
        posY: s.latitude,
        capacityKw: s.rated_power_kw,
      })
    }

    // 5. 边：resource_connection_attrs（通用连接）
    const connRows = await db('resource_connection_attrs')
      .select('id', 'source_node_type', 'source_node_id', 'target_node_type', 'target_node_id',
        'topology_type', 'flow_direction', 'max_capacity_kw', 'control_logic')
    for (const c of connRows as any[]) {
      const sourceNodeId = `NODE_${c.source_node_type}_${c.source_node_id}`
      const targetNodeId = `NODE_${c.target_node_type}_${c.target_node_id}`
      // 只添加两端节点都存在的边
      if (!nodes.find(n => n.id === sourceNodeId) || !nodes.find(n => n.id === targetNodeId)) continue
      const srcName = nodes.find(n => n.id === sourceNodeId)?.name || c.source_node_id
      const tgtName = nodes.find(n => n.id === targetNodeId)?.name || c.target_node_id
      edges.push({
        id: `EDGE_CONN_${c.id}`,
        sourceNodeId,
        targetNodeId,
        edgeType: 'PHYSICAL',
        flowDirection: c.flow_direction || 'FORWARD',
        maxCapacityKw: c.max_capacity_kw,
        controlLogic: c.control_logic,
        sourceName: srcName,
        targetName: tgtName,
      })
    }

    // 6. 边：母线联络线
    if (linkedBusIds.size > 0) {
      const relatedBranches = await db('grid_branches')
        .whereIn('from_bus_id', Array.from(linkedBusIds))
        .whereIn('to_bus_id', Array.from(linkedBusIds))
        .select('id', 'from_bus_id', 'to_bus_id', 'ampacity_mva')
      for (const br of relatedBranches as any[]) {
        const fromBus = busRows.find((b: any) => b.id === br.from_bus_id)
        const toBus = busRows.find((b: any) => b.id === br.to_bus_id)
        edges.push({
          id: `EDGE_BR_${br.id}`,
          sourceNodeId: `NODE_GRID_${br.from_bus_id}`,
          targetNodeId: `NODE_GRID_${br.to_bus_id}`,
          edgeType: 'PHYSICAL',
          flowDirection: 'BIDIRECTIONAL',
          maxCapacityKw: br.ampacity_mva ? br.ampacity_mva * 1000 : undefined,
          sourceName: fromBus?.name || br.from_bus_id,
          targetName: toBus?.name || br.to_bus_id,
        })
      }
    }

    return { nodes, edges }
  }

  // ==================== 通用节点查询 ====================
  async listAvailableNodesByType(nodeType: string) {
    switch (nodeType) {
      case 'SOURCE':
        return db('solar_pv_stations')
          .select(
            'id as node_id',
            'station_name as node_name',
            'installed_capacity_mw',
            'grid_connection_voltage_kv',
          )
          .orderBy('station_name')
      case 'GRID':
        return db('grid_buses')
          .select('id as node_id', 'name as node_name', 'voltage_level', 'zone')
          .orderBy('name')
      case 'LOAD':
        return db('load_entities')
          .select('id as node_id', 'name as node_name', 'peak_load_kw', 'voltage_level')
          .orderBy('name')
      case 'STORAGE':
        return db('storage_entities')
          .select('id as node_id', 'name as node_name', 'rated_power_kw', 'voltage_level')
          .orderBy('name')
      default:
        return []
    }
  }

  /** 批量查询多种节点类型 — 1 次请求替代 N 次，避免前端 429 */
  async listAvailableNodesByTypeBatch(types: string[]) {
    const result: Record<string, any[]> = {}
    await Promise.all(types.map(async (type) => {
      result[type] = await this.listAvailableNodesByType(type)
    }))
    return result
  }

  // ==================== 源(SOURCE)节点创建 ====================
  async createSourceNode(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    const busId = await ensureBusId(data.busId)
    await db('solar_pv_stations').insert({
      id,
      station_name: data.name,
      bus_id: busId,
      installed_capacity_mw: (data.capacityKw || 0) / 1000,
      grid_connection_voltage_kv: data.voltageLevel ? parseFloat(data.voltageLevel) : null,
      longitude: data.longitude || null,
      latitude: data.latitude || null,
      status: 'active',
      created_at: now,
    })
    return db('solar_pv_stations').where('id', id).first()
  }

  // ==================== 网(GRID)节点创建 ====================
  async createGridNode(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    await db('grid_buses').insert({
      id,
      name: data.name,
      zone: data.zone || '',
      voltage_level: data.voltageLevel || '',
      bus_type: data.busType || 'pq',
      base_kv: data.voltageLevel ? parseFloat(data.voltageLevel) : 10,
      longitude: data.longitude || null,
      latitude: data.latitude || null,
    })
    return db('grid_buses').where('id', id).first()
  }

  // ==================== 连接关系 CRUD ====================
  async listConnectionAttrs(query: { sourceNodeType?: string; targetNodeType?: string; page?: number; pageSize?: number }) {
    const baseQb = db('resource_connection_attrs')
    if (query.sourceNodeType) baseQb.where('source_node_type', query.sourceNodeType)
    if (query.targetNodeType) baseQb.where('target_node_type', query.targetNodeType)

    const [{ count: total }] = await baseQb.clone().count('* as count')
    const page = Math.max(1, query.page || 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20))

    const rows = await baseQb.clone().orderBy('created_at', 'desc').offset((page - 1) * pageSize).limit(pageSize)

    const list = []
    for (const r of rows as any[]) {
      const [sourceName, targetName] = await Promise.all([
        resolveNodeName(r.source_node_type, r.source_node_id),
        resolveNodeName(r.target_node_type, r.target_node_id),
      ])
      list.push({ ...r, source_name: sourceName, target_name: targetName })
    }
    return { list, total: Number(total), page, pageSize }
  }

  async createConnectionAttr(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    await db('resource_connection_attrs').insert({
      id,
      source_node_type: data.sourceNodeType,
      source_node_id: data.sourceNodeId,
      target_node_type: data.targetNodeType,
      target_node_id: data.targetNodeId,
      topology_type: data.topologyType || 'STAR_NETWORK',
      voltage_level_hierarchy: data.voltageLevelHierarchy || null,
      operation_mode: data.operationMode || 'GRID_CONNECTED',
      intermediate_equipment: data.intermediateEquipment || null,
      topology_desc: data.topologyDesc || null,
      flow_direction: data.flowDirection || 'FORWARD',
      forward_power_max_kw: data.forwardPowerMaxKw || null,
      reverse_power_max_kw: data.reversePowerMaxKw || null,
      flow_desc: data.flowDesc || null,
      max_capacity_kw: data.maxCapacityKw || null,
      control_logic: data.controlLogic ? (typeof data.controlLogic === 'string' ? data.controlLogic : JSON.stringify(data.controlLogic)) : null,
      control_subject: data.controlSubject || null,
      control_type: data.controlType || null,
      trigger_condition: data.triggerCondition || null,
      execute_action: data.executeAction || null,
      sync_objects: data.syncObjects || null,
      data_interaction: data.dataInteraction || null,
      status_sync_rule: data.statusSyncRule || null,
      status: 'active',
      created_at: now,
    })
    return db('resource_connection_attrs').where('id', id).first()
  }

  async updateConnectionAttr(id: string, data: any) {
    const updateData: Record<string, any> = {}
    const map: Record<string, string> = {
      topologyType: 'topology_type', voltageLevelHierarchy: 'voltage_level_hierarchy',
      operationMode: 'operation_mode', intermediateEquipment: 'intermediate_equipment',
      topologyDesc: 'topology_desc', flowDirection: 'flow_direction',
      forwardPowerMaxKw: 'forward_power_max_kw', reversePowerMaxKw: 'reverse_power_max_kw',
      flowDesc: 'flow_desc', maxCapacityKw: 'max_capacity_kw',
      controlSubject: 'control_subject', controlType: 'control_type',
      triggerCondition: 'trigger_condition', executeAction: 'execute_action',
      syncObjects: 'sync_objects', dataInteraction: 'data_interaction',
      statusSyncRule: 'status_sync_rule',
    }
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) updateData[col] = data[key]
    }
    if (data.controlLogic !== undefined) {
      updateData.control_logic = typeof data.controlLogic === 'string' ? data.controlLogic : JSON.stringify(data.controlLogic)
    }
    const [row] = await db('resource_connection_attrs').where('id', id).update(updateData).returning('*')
    return row
  }

  async deleteConnectionAttr(id: string) {
    return db('resource_connection_attrs').where('id', id).del()
  }

  // ==================== 负荷实体 CRUD ====================
  async listLoadEntities(query?: { loadType?: string; zone?: string }) {
    const qb = db('load_entities')
    if (query?.loadType) qb.where('load_type', query.loadType)
    if (query?.zone) qb.where('zone', query.zone)
    return qb.orderBy('created_at', 'desc')
  }

  async getLoadEntity(id: string) {
    return db('load_entities').where('id', id).first()
  }

  async createLoadEntity(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    await db('load_entities').insert({
      id,
      name: data.name,
      load_type: data.loadType || 'INDUSTRIAL',
      bus_id: data.busId || null,
      voltage_level: data.voltageLevel,
      peak_load_kw: data.peakLoadKw,
      annual_consumption_mwh: data.annualConsumptionMwh,
      zone: data.zone,
      address: data.address,
      longitude: data.longitude,
      latitude: data.latitude,
      status: 'active',
      description: data.description,
      created_at: now,
    })
    return db('load_entities').where('id', id).first()
  }

  async updateLoadEntity(id: string, data: any) {
    const ud: Record<string, any> = {}
    if (data.name !== undefined) ud.name = data.name
    if (data.loadType !== undefined) ud.load_type = data.loadType
    if (data.busId !== undefined) ud.bus_id = data.busId
    if (data.voltageLevel !== undefined) ud.voltage_level = data.voltageLevel
    if (data.peakLoadKw !== undefined) ud.peak_load_kw = data.peakLoadKw
    if (data.annualConsumptionMwh !== undefined) ud.annual_consumption_mwh = data.annualConsumptionMwh
    if (data.zone !== undefined) ud.zone = data.zone
    if (data.address !== undefined) ud.address = data.address
    if (data.longitude !== undefined) ud.longitude = data.longitude
    if (data.latitude !== undefined) ud.latitude = data.latitude
    if (data.status !== undefined) ud.status = data.status
    if (data.description !== undefined) ud.description = data.description
    const [row] = await db('load_entities').where('id', id).update(ud).returning('*')
    return row
  }

  async deleteLoadEntity(id: string) {
    await db('resource_connection_attrs').where('source_node_type', 'LOAD').where('source_node_id', id).del()
    await db('resource_connection_attrs').where('target_node_type', 'LOAD').where('target_node_id', id).del()
    return db('load_entities').where('id', id).del()
  }

  // ==================== 储能实体 CRUD ====================
  async listStorageEntities(query?: { storageType?: string; zone?: string }) {
    const qb = db('storage_entities')
    if (query?.storageType) qb.where('storage_type', query.storageType)
    if (query?.zone) qb.where('zone', query.zone)
    return qb.orderBy('created_at', 'desc')
  }

  async getStorageEntity(id: string) {
    return db('storage_entities').where('id', id).first()
  }

  async createStorageEntity(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    await db('storage_entities').insert({
      id,
      name: data.name,
      storage_type: data.storageType || 'BATTERY',
      bus_id: data.busId || null,
      rated_power_kw: data.ratedPowerKw,
      rated_capacity_kwh: data.ratedCapacityKwh,
      efficiency_pct: data.efficiencyPct ?? 90,
      charge_mode: data.chargeMode || 'PEAK_SHAVING',
      voltage_level: data.voltageLevel,
      zone: data.zone,
      longitude: data.longitude,
      latitude: data.latitude,
      status: 'active',
      description: data.description,
      created_at: now,
    })
    return db('storage_entities').where('id', id).first()
  }

  async updateStorageEntity(id: string, data: any) {
    const ud: Record<string, any> = {}
    if (data.name !== undefined) ud.name = data.name
    if (data.storageType !== undefined) ud.storage_type = data.storageType
    if (data.busId !== undefined) ud.bus_id = data.busId
    if (data.ratedPowerKw !== undefined) ud.rated_power_kw = data.ratedPowerKw
    if (data.ratedCapacityKwh !== undefined) ud.rated_capacity_kwh = data.ratedCapacityKwh
    if (data.efficiencyPct !== undefined) ud.efficiency_pct = data.efficiencyPct
    if (data.chargeMode !== undefined) ud.charge_mode = data.chargeMode
    if (data.voltageLevel !== undefined) ud.voltage_level = data.voltageLevel
    if (data.zone !== undefined) ud.zone = data.zone
    if (data.longitude !== undefined) ud.longitude = data.longitude
    if (data.latitude !== undefined) ud.latitude = data.latitude
    if (data.status !== undefined) ud.status = data.status
    if (data.description !== undefined) ud.description = data.description
    const [row] = await db('storage_entities').where('id', id).update(ud).returning('*')
    return row
  }

  async deleteStorageEntity(id: string) {
    await db('resource_connection_attrs').where('source_node_type', 'STORAGE').where('source_node_id', id).del()
    await db('resource_connection_attrs').where('target_node_type', 'STORAGE').where('target_node_id', id).del()
    return db('storage_entities').where('id', id).del()
  }
}
