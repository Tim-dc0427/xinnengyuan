import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

export class ResourceService {
  /** 确保存在有效母线ID，无则创建默认母线 */
  private async ensureBusId(busId?: string | null): Promise<string> {
    if (busId) {
      const exists = await db('grid_buses').where('id', busId).select('id').first()
      if (exists) return busId
    }
    // 查找第一个已有母线
    const first = await db('grid_buses').select('id').first()
    if (first) return first.id
    // 创建默认母线
    const id = uuid()
    await db('grid_buses').insert({
      id,
      name: '默认母线',
      zone: '',
      voltage_level: '10',
      bus_type: 'pq',
      base_kv: 10,
    })
    return id
  }

  // ==================== Models ====================
  async listModels(query: any) {
    return db('resource_models').modify((qb) => {
      if (query.modelType) qb.where('model_type', query.modelType)
      qb.where('is_active', query.isActive !== undefined ? query.isActive : true)
    }).orderBy('created_at', 'desc')
  }

  async createModel(data: any, userId: string) {
    const id = uuid()
    let stationId = data.stationId || data.plantId || null
    if (stationId) {
      const station = await db('solar_pv_stations').where('id', stationId).select('id').first()
      if (!station) stationId = null
    }
    let createdBy = userId || null
    if (createdBy) {
      const user = await db('users').where('id', createdBy).select('id').first()
      if (!user) createdBy = null
    }
    const now = new Date().toISOString()
    await db('resource_models').insert({
      id,
      model_name: data.modelName,
      model_type: data.modelType,
      model_parameters: typeof data.parameters === 'string' ? data.parameters : JSON.stringify(data.parameters),
      station_id: stationId,
      description: data.description || null,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    })
    return db('resource_models').where('id', id).first()
  }

  async updateModel(id: string, data: any) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      version: db.raw('version + 1'),
    }
    if (data.modelName !== undefined) updateData.model_name = data.modelName
    if (data.parameters !== undefined) {
      updateData.model_parameters = typeof data.parameters === 'string' ? data.parameters : JSON.stringify(data.parameters)
    }
    if (data.description !== undefined) updateData.description = data.description
    const [model] = await db('resource_models').where('id', id).update(updateData).returning('*')
    return model
  }

  async deleteModel(id: string) {
    await db('resource_models').where('id', id).update({ is_active: false })
    return { deleted: true }
  }

  async getHealth(modelId: string) {
    return {
      modelId,
      healthScore: 85 + Math.random() * 10,
      status: 'healthy' as const,
      anomalyList: [],
      lastUpdated: new Date().toISOString(),
    }
  }

  async getStorageLife(modelId: string) {
    return {
      modelId,
      currentSoh: 92,
      remainingCycleLife: 3500,
      remainingCalendarLifeYears: 8.5,
      degradationRatePerCycle: 0.002,
      recommendedReplacementDate: new Date(Date.now() + 8.5 * 365.25 * 86400000).toISOString().split('T')[0],
    }
  }

  // ==================== 集中式光伏电站 CRUD（唯一数据源：solar_pv_stations） ====================
  async listPowerPlants() {
    const plants = await db('solar_pv_stations')
      .leftJoin('equipment', 'solar_pv_stations.id', 'equipment.station_id')
      .leftJoin('resource_models', function () {
        this.on('solar_pv_stations.id', 'resource_models.station_id').andOn('resource_models.is_active', db.raw('1'))
      })
      .select(
        'solar_pv_stations.id',
        'solar_pv_stations.station_name as name',
        db.raw('solar_pv_stations.installed_capacity_mw * 1000 as capacity_kw'),
        'solar_pv_stations.bus_id',
        'solar_pv_stations.installed_date',
        'solar_pv_stations.longitude',
        'solar_pv_stations.latitude',
        'solar_pv_stations.address',
        'solar_pv_stations.status',
        'solar_pv_stations.created_at',
        'solar_pv_stations.land_type',
        'solar_pv_stations.land_area_mu',
        'solar_pv_stations.electrical_params',
        db.raw('COUNT(DISTINCT equipment.id) as equipment_count'),
        db.raw('COUNT(DISTINCT resource_models.id) as bound_model_count'),
      )
      .groupBy('solar_pv_stations.id')
      .orderBy('solar_pv_stations.installed_date', 'desc')
    return plants
  }

  async getPowerPlant(id: string) {
    const station = await db('solar_pv_stations').where('id', id).first()
    if (!station) return null
    const equipment = await db('equipment').where('station_id', id)
    const boundModels = await db('resource_models')
      .where('station_id', id)
      .where('is_active', 1)
      .select('id', 'model_name', 'model_type', 'version')
    return { ...station, equipment, boundModels }
  }

  async getPowerPlantVersions(stationId: string) {
    const rows = await db('station_versions')
      .where('station_id', stationId)
      .orderBy('version', 'desc')
    // 映射字段名，匹配前端期望的 name / capacity_kw
    return rows.map((r: any) => ({
      ...r,
      name: r.station_name,
      capacity_kw: r.installed_capacity_mw ? r.installed_capacity_mw * 1000 : 0,
    }))
  }

  async bindModelsToPlant(stationId: string, modelIds: string[]) {
    // 先解绑该电站所有已关联的模型
    await db('resource_models').where('station_id', stationId).update({ station_id: null })
    // 再绑定新选中的模型
    if (modelIds.length > 0) {
      await db('resource_models').whereIn('id', modelIds).update({ station_id: stationId })
    }
    return db('resource_models').where('station_id', stationId).select('id', 'model_name', 'model_type')
  }

  async createPowerPlant(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    const busId = await this.ensureBusId(data.busId)
    const capacityMw = data.capacityMw ?? (data.capacityKw ? data.capacityKw / 1000 : 0)
    await db('solar_pv_stations').insert({
      id,
      station_name: data.name,
      bus_id: busId,
      installed_capacity_mw: capacityMw,
      grid_connection_voltage_kv: data.voltageLevel ? parseFloat(data.voltageLevel) : null,
      installed_date: data.installedDate || null,
      longitude: data.longitude || null,
      latitude: data.latitude || null,
      address: data.address || null,
      status: data.status || 'active',
      created_at: now,
    })
    // 保存初始版本快照
    await db('station_versions').insert({
      id: uuid(),
      station_id: id,
      version: 1,
      station_name: data.name,
      installed_capacity_mw: capacityMw,
      installed_date: data.installedDate || null,
      longitude: data.longitude || null,
      latitude: data.latitude || null,
      address: data.address || null,
      status: data.status || 'active',
      created_at: now,
    })
    return db('solar_pv_stations').where('id', id).first()
  }

  async batchImportPowerPlants(plants: any[]) {
    const now = new Date().toISOString()
    const defaultBusId = await this.ensureBusId()
    const rows = plants.map((p) => ({
      id: uuid(),
      station_name: p.name,
      bus_id: p.busId ? p.busId : defaultBusId,
      installed_capacity_mw: p.capacityMw ?? (p.capacityKw ? p.capacityKw / 1000 : 0),
      grid_connection_voltage_kv: p.voltageLevel ? parseFloat(p.voltageLevel) : null,
      installed_date: p.installedDate || null,
      longitude: p.longitude || null,
      latitude: p.latitude || null,
      address: p.address || null,
      status: p.status || 'active',
      created_at: now,
    }))
    if (rows.length > 0) {
      await db('solar_pv_stations').insert(rows)
    }
    return { imported: rows.length }
  }

  async updatePowerPlant(id: string, data: any) {
    const current = await db('solar_pv_stations').where('id', id).first()
    if (!current) return null

    // 保存旧版本快照
    const now = new Date().toISOString()
    const maxVer = await db('station_versions')
      .where('station_id', id)
      .max('version as max_version')
      .first()
    const nextVersion = (maxVer?.max_version ?? 0) + 1
    await db('station_versions').insert({
      id: uuid(),
      station_id: id,
      version: nextVersion,
      station_name: current.station_name,
      installed_capacity_mw: current.installed_capacity_mw,
      installed_date: current.installed_date,
      longitude: current.longitude,
      latitude: current.latitude,
      address: current.address,
      status: current.status,
      created_at: now,
    })

    const updateData: Record<string, any> = {
      updated_at: now,
    }
    if (data.name !== undefined) updateData.station_name = data.name
    if (data.capacityMw !== undefined) updateData.installed_capacity_mw = data.capacityMw
    else if (data.capacityKw !== undefined) updateData.installed_capacity_mw = data.capacityKw / 1000
    if (data.installedDate !== undefined) updateData.installed_date = data.installedDate
    if (data.address !== undefined) updateData.address = data.address
    if (data.longitude !== undefined) updateData.longitude = data.longitude
    if (data.latitude !== undefined) updateData.latitude = data.latitude
    if (data.status !== undefined) updateData.status = data.status
    if (Object.keys(updateData).length <= 1) return null
    await db('solar_pv_stations').where('id', id).update(updateData)
    return db('solar_pv_stations').where('id', id).first()
  }

  async deletePowerPlant(id: string) {
    await db('solar_pv_stations').where('id', id).update({ status: 'inactive' })
    return { deleted: true }
  }

  // ==================== Equipment (层2实体数据) ====================
  async listEquipment(query: any) {
    return db('equipment').modify((qb) => {
      if (query.stationId) qb.where('station_id', query.stationId)
      if (query.equipmentType) qb.where('equipment_type', query.equipmentType)
    }).orderBy('installation_date', 'desc')
  }

  async getEquipment(id: string) {
    const eq = await db('equipment').where('id', id).first()
    if (!eq) return null
    const lifecycle = await db('equipment_lifecycle').where('equipment_id', id).orderBy('event_date', 'desc')
    let plant: any = null
    if (eq.station_id) {
      plant = await db('solar_pv_stations').where('id', eq.station_id).select('id', 'station_name as name').first()
    }
    return { ...eq, lifecycle, plant }
  }

  async updateEquipment(id: string, data: any) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (data.modelNumber !== undefined) updateData.model_number = data.modelNumber
    if (data.ratedCapacityKva !== undefined) updateData.rated_capacity_kva = data.ratedCapacityKva
    if (data.ratedVoltageKv !== undefined) updateData.rated_voltage_kv = data.ratedVoltageKv
    if (data.ratedCurrentA !== undefined) updateData.rated_current_a = data.ratedCurrentA
    if (data.installationDate !== undefined) updateData.installation_date = data.installationDate
    if (data.status !== undefined) updateData.status = data.status
    if (data.grade !== undefined) updateData.grade = data.grade
    const [eq] = await db('equipment').where('id', id).update(updateData).returning('*')
    return eq
  }

  async createEquipment(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    await db('equipment').insert({
      id,
      plant_id: data.plantId || null,
      station_id: data.stationId || null,
      equipment_type: data.equipmentType || 'TRANSFORMER',
      model_number: data.modelNumber || null,
      manufacturer: data.manufacturer || null,
      rated_capacity_kva: data.ratedCapacityKva || null,
      rated_voltage_kv: data.ratedVoltageKv || null,
      rated_current_a: data.ratedCurrentA || null,
      installation_date: data.installationDate || null,
      design_life_years: data.designLifeYears || null,
      grade: data.grade || 'A',
      status: data.status || 'operational',
      created_at: now,
      updated_at: now,
    })
    return db('equipment').where('id', id).first()
  }

  // ==================== Relationships ====================
  async listRelationships(query: any) {
    return db('resource_relationships').modify((qb) => {
      if (query.sourceId) qb.where('source_model_id', query.sourceId)
      if (query.relationshipType) qb.where('relationship_type', query.relationshipType)
    })
  }

  async createRelationship(data: any) {
    const [rel] = await db('resource_relationships').insert({
      source_model_id: data.sourceModelId,
      target_model_id: data.targetModelId,
      relationship_type: data.relationshipType,
      topology_edge_data: data.topologyEdgeData,
    }).returning('*')
    return rel
  }

  // ==================== Scenarios ====================
  async listScenarios(query: any) {
    return db('scenarios').modify((qb) => {
      if (query.scenarioType) qb.where('scenario_type', query.scenarioType)
      if (query.status) qb.where('status', query.status)
    }).orderBy('created_at', 'desc')
  }

  async createScenario(data: any, userId: string) {
    const [scenario] = await db('scenarios').insert({
      scenario_name: data.scenarioName,
      description: data.description,
      scenario_type: data.scenarioType,
      created_by: userId,
    }).returning('*')
    return scenario
  }

  async updateScenario(id: string, data: any) {
    const [scenario] = await db('scenarios').where('id', id).update({
      scenario_name: data.scenarioName,
      description: data.description,
      status: data.status,
      updated_at: new Date().toISOString(),
    }).returning('*')
    return scenario
  }

  async deleteScenario(id: string) {
    await db('scenarios').where('id', id).update({ status: 'archived' })
    return { deleted: true }
  }

  async assignResources(scenarioId: string, data: { resources: Array<{ resourceModelId: string; overrideParameters?: any }> }) {
    await db('scenario_resources').where('scenario_id', scenarioId).delete()
    if (data.resources.length > 0) {
      await db('scenario_resources').insert(
        data.resources.map((r) => ({ scenario_id: scenarioId, resource_model_id: r.resourceModelId, override_parameters: r.overrideParameters })),
      )
    }
    return db('scenario_resources').where('scenario_id', scenarioId)
  }

  // ==================== Strategies ====================
  async generateStrategy(scenarioId: string, config: any) {
    const strategyId = uuid()
    const mockRules = [
      { deviceId: 'pv-001', condition: 'voltage > 1.05', action: 'reduce_output', priority: 1 },
      { deviceId: 'storage-001', condition: 'load < pv_output', action: 'charge', priority: 2 },
      { deviceId: 'storage-001', condition: 'load > pv_output', action: 'discharge', priority: 2 },
    ]
    await db('strategies').insert({
      id: strategyId, scenario_id: scenarioId, strategy_name: `Auto Strategy ${Date.now()}`,
      strategy_type: 'AUTO', generation_algorithm: config.algorithm || 'OPTIMIZATION',
      strategy_data: { rules: mockRules, constraints: [], optimizationTarget: 'max_absorption' },
      created_by: 'system',
    })
    return { strategyId, rules: mockRules }
  }

  async createStrategy(scenarioId: string, data: any, userId: string) {
    const [strategy] = await db('strategies').insert({
      scenario_id: scenarioId, strategy_name: data.strategyName,
      strategy_type: 'MANUAL', strategy_data: data.strategyData, created_by: userId,
    }).returning('*')
    return strategy
  }

  // ==================== Simulation ====================
  async runSimulation(scenarioId: string, config: any, userId: string) {
    const simId = uuid()
    await db('simulation_runs').insert({
      id: simId, scenario_id: scenarioId, strategy_id: config.strategyId,
      status: 'running', input_summary: config, created_by: userId, started_at: new Date().toISOString(),
    })

    // Simulate completion
    const resultData = {
      absorptionRate: 85 + Math.random() * 10,
      voltageStability: 0.97 + Math.random() * 0.02,
      networkEfficiency: 0.95 + Math.random() * 0.03,
      economicScore: 75 + Math.random() * 15,
      timeSeriesData: Array.from({ length: 24 }, (_, i) => ({
        time: `${i.toString().padStart(2, '0')}:00`,
        pvOutput: i >= 6 && i <= 18 ? Math.sin((i - 6) / 12 * Math.PI) * 800 : 0,
        load: 500 + Math.random() * 200,
        storageCharge: i >= 10 && i <= 14 ? 200 : 0,
        storageDischarge: (i >= 18 && i <= 22) || (i >= 0 && i <= 5) ? 200 : 0,
        gridImport: i >= 18 ? 300 : 0,
        gridExport: i >= 10 && i <= 14 ? 100 : 0,
      })),
    }

    await db('simulation_runs').where('id', simId).update({
      status: 'completed', result_data: resultData, execution_score: 82, completed_at: new Date().toISOString(),
    })

    return { simulationId: simId, status: 'completed', resultData }
  }

  async getSimulation(simId: string) {
    return db('simulation_runs').where('id', simId).first()
  }

  async evaluateSimulation(simId: string, data: any) {
    const [evaluation] = await db('execution_evaluations').insert({
      simulation_id: simId,
      absorption_rate_pct: data.absorptionRatePct,
      voltage_stability_score: data.voltageStabilityScore,
      economic_score: data.economicScore,
      reliability_score: data.reliabilityScore,
      comprehensive_score: data.comprehensiveScore,
      recommendation: data.recommendation,
    }).onConflict('simulation_id').merge().returning('*')
    return evaluation
  }

  async intervene(simId: string, data: any, userId: string) {
    const [record] = await db('manual_intervention_log').insert({
      simulation_id: simId, operator_id: userId,
      action_type: data.actionType, parameter_changes: data.parameterChanges, reason: data.reason,
    }).returning('*')
    return record
  }
}
