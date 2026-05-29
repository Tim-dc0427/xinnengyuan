<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, ToolboxComponent } from 'echarts/components'
import {
  fetchPvGridTopology, fetchConnectionAttrs, createConnectionAttr, updateConnectionAttr, deleteConnectionAttr,
  fetchNodesByType, createSourceNode, createGridNode,
  fetchLoadEntities, createLoadEntity, updateLoadEntity, deleteLoadEntity,
  fetchStorageEntities, createStorageEntity, updateStorageEntity, deleteStorageEntity,
  fetchPowerPlants,
} from '@/api/resource'
import type { PvGridTopology, TopoNode, TopoEdge, TopoNodeType } from '@new-energy/shared'

use([CanvasRenderer, GraphChart, TitleComponent, TooltipComponent, LegendComponent, ToolboxComponent])

// ==================== 节点类型/颜色 ====================
const tabTypes: { type: TopoNodeType; label: string }[] = [
  { type: 'SOURCE', label: '源' },
  { type: 'GRID', label: '网' },
  { type: 'LOAD', label: '荷' },
  { type: 'STORAGE', label: '储' },
]
const nodeTypeLabel: Record<string, string> = { SOURCE: '源(光伏电站)', GRID: '网(母线)', LOAD: '荷(负荷)', STORAGE: '储(储能)' }
const nodeTypeColor: Record<string, string> = { SOURCE: '#67C23A', GRID: '#267F7B', LOAD: '#F56C6C', STORAGE: '#E6A23C' }
const edgeTypeLabel: Record<string, string> = { PHYSICAL: '物理连接', LOGICAL: '逻辑关联', CONTROL: '控制调度' }
const flowLabel: Record<string, string> = { FORWARD: '正向', REVERSE: '反向', BIDIRECTIONAL: '双向' }
const topologyTypeLabel: Record<string, string> = {
  DIRECT_PARALLEL: '直接并联', SERIES_RELAY: '串联转接', STAR_NETWORK: '星形组网',
  RING_NETWORK: '环网连接', POINT_TO_POINT: '点对点专线', UNIFIED_POC: '统一并网点', ZONE_ISOLATION: '分区隔离',
}
const operationModeLabel: Record<string, string> = { GRID_CONNECTED: '联网运行', ISLAND: '孤岛运行', SWITCHABLE: '可切换' }
const controlTypeLabel: Record<string, string> = {
  LOCAL_PROTECTION: '就地保护', OUTPUT_REGULATION: '出力调节', SWITCH_CONTROL: '开关控制',
  COORDINATED_LINKAGE: '协同联动', DEMAND_RESPONSE: '需求响应',
}

// ==================== 顶层 Tab ====================
const mainTab = ref('relation')

// ==================== Tab & 实体数据 ====================
const activeTab = ref<TopoNodeType>('SOURCE')
const sourceList = ref<any[]>([])
const gridList = ref<any[]>([])
const loadList = ref<any[]>([])
const storageList = ref<any[]>([])
const loadingTab = ref(false)

const entityTabTypes = computed(() => {
  return tabTypes.filter(t => t.type === 'SOURCE' || t.type === 'GRID' || t.type === 'LOAD' || t.type === 'STORAGE')
})

const currentEntities = computed(() => {
  switch (activeTab.value) {
    case 'SOURCE': return sourceList.value
    case 'GRID': return gridList.value
    case 'LOAD': return loadList.value
    case 'STORAGE': return storageList.value
  }
})

// ==================== 实体编辑弹窗 ====================
const entityDialogVisible = ref(false)
const entityDialogTitle = ref('')
const entityForm = ref<Record<string, any>>({})
const entitySaving = ref(false)
const isEntityEdit = ref(false)
const editingEntityId = ref('')

function openEntityCreate() {
  isEntityEdit.value = false
  editingEntityId.value = ''
  entityDialogTitle.value = `新建${nodeTypeLabel[activeTab.value]}`
  entityForm.value = getDefaultEntityForm(activeTab.value)
  entityDialogVisible.value = true
}

function openEntityEdit(row: any) {
  isEntityEdit.value = true
  editingEntityId.value = row.id
  entityDialogTitle.value = `编辑${nodeTypeLabel[activeTab.value]}`
  entityForm.value = mapEntityToForm(activeTab.value, row)
  entityDialogVisible.value = true
}

function getDefaultEntityForm(type: TopoNodeType): Record<string, any> {
  switch (type) {
    case 'SOURCE': return { name: '', capacityKw: 0, voltageLevel: '', zone: '', longitude: 0, latitude: 0 }
    case 'GRID': return { name: '', voltageLevel: '', zone: '', longitude: 0, latitude: 0 }
    case 'LOAD': return { name: '', loadType: 'INDUSTRIAL', busId: '', voltageLevel: '', peakLoadKw: 0, annualConsumptionMwh: 0, zone: '', address: '', longitude: 0, latitude: 0 }
    case 'STORAGE': return { name: '', storageType: 'BATTERY', busId: '', ratedPowerKw: 0, ratedCapacityKwh: 0, efficiencyPct: 90, chargeMode: 'PEAK_SHAVING', voltageLevel: '', zone: '', longitude: 0, latitude: 0 }
    default: return {}
  }
}

function mapEntityToForm(type: TopoNodeType, row: any): Record<string, any> {
  switch (type) {
    case 'SOURCE':
      return { name: row.plant_name || row.name || '', capacityKw: row.capacity_kw || 0, voltageLevel: row.voltage_level || row.grid_connection_voltage_kv ? `${row.grid_connection_voltage_kv}kV` : '', zone: row.zone || '', longitude: row.longitude || 0, latitude: row.latitude || 0 }
    case 'GRID':
      return { name: row.node_name || row.name || '', voltageLevel: row.voltage_level || '', zone: row.zone || '', longitude: row.longitude || 0, latitude: row.latitude || 0 }
    case 'LOAD':
      return { name: row.name || '', loadType: row.load_type || 'INDUSTRIAL', busId: row.bus_id || '', voltageLevel: row.voltage_level || '', peakLoadKw: row.peak_load_kw || 0, annualConsumptionMwh: row.annual_consumption_mwh || 0, zone: row.zone || '', address: row.address || '', longitude: row.longitude || 0, latitude: row.latitude || 0 }
    case 'STORAGE':
      return { name: row.name || '', storageType: row.storage_type || 'BATTERY', busId: row.bus_id || '', ratedPowerKw: row.rated_power_kw || 0, ratedCapacityKwh: row.rated_capacity_kwh || 0, efficiencyPct: row.efficiency_pct ?? 90, chargeMode: row.charge_mode || 'PEAK_SHAVING', voltageLevel: row.voltage_level || '', zone: row.zone || '', longitude: row.longitude || 0, latitude: row.latitude || 0 }
    default: return {}
  }
}

async function handleEntitySave() {
  entitySaving.value = true
  try {
    const f = entityForm.value
    if (activeTab.value === 'SOURCE') {
      await createSourceNode(f as any)
    }
    if (activeTab.value === 'GRID') {
      await createGridNode(f as any)
    }
    if (activeTab.value === 'LOAD') {
      if (isEntityEdit.value) { await updateLoadEntity(editingEntityId.value, f) }
      else { await createLoadEntity(f as any) }
    }
    if (activeTab.value === 'STORAGE') {
      if (isEntityEdit.value) { await updateStorageEntity(editingEntityId.value, f) }
      else { await createStorageEntity(f as any) }
    }
    ElMessage.success(isEntityEdit.value ? '更新成功' : '创建成功')
    entityDialogVisible.value = false
    await loadEntityData(activeTab.value)
  } catch (e: any) { ElMessage.error(e?.message || '保存失败') }
  finally { entitySaving.value = false }
}

async function handleEntityDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除"${row.name}"？`, '确认删除', { type: 'warning' })
    if (activeTab.value === 'LOAD') await deleteLoadEntity(row.id)
    if (activeTab.value === 'STORAGE') await deleteStorageEntity(row.id)
    ElMessage.success('已删除')
    await loadEntityData(activeTab.value)
  } catch { /* cancelled */ }
}

// ==================== 拓扑图 ====================
const topology = ref<PvGridTopology>({ nodes: [], edges: [] })
const topologyGenerated = ref(false)
const topologyLoading = ref(false)
const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const VOLTAGE_ORDER = ['220kV', '110kV', '35kV', '10kV']

function buildLayout(nodes: TopoNode[]) {
  const coords: Record<string, { x: number; y: number }> = {}
  if (nodes.length === 0) return coords

  const byVoltage: Record<string, TopoNode[]> = {}
  const otherNodes: TopoNode[] = []
  for (const n of nodes) {
    if (n.nodeType === 'GRID') {
      const vl = n.voltageLevel || '10kV'
      if (!byVoltage[vl]) byVoltage[vl] = []
      byVoltage[vl].push(n)
    } else {
      otherNodes.push(n)
    }
  }

  const levels = VOLTAGE_ORDER.filter(l => byVoltage[l])
  for (const l of Object.keys(byVoltage)) {
    if (!VOLTAGE_ORDER.includes(l)) levels.push(l)
  }

  const canvasW = Math.max(900, nodes.length * 80)
  const canvasH = Math.max(500, levels.length * 180 + 120)

  // 母线按电压等级纵向分层
  for (let li = 0; li < levels.length; li++) {
    const level = levels[li]
    const levelNodes = byVoltage[level]
    const y = 60 + (li / Math.max(levels.length - 1, 1)) * (canvasH - 120)
    const stepX = canvasW / Math.max(levelNodes.length + 1, 2)
    for (let ni = 0; ni < levelNodes.length; ni++) {
      coords[levelNodes[ni].id] = { x: Math.round(canvasW * 0.3 + stepX * ni), y: Math.round(y) }
    }
  }

  // 其他节点放到关联母线旁边
  for (const n of otherNodes) {
    const edge = topology.value.edges.find((e: any) => e.sourceNodeId === n.id || e.targetNodeId === n.id)
    const busNodeId = edge ? (edge.sourceNodeId === n.id ? edge.targetNodeId : edge.sourceNodeId) : null
    const busCoord = busNodeId ? coords[busNodeId] : null
    if (busCoord) {
      if (n.nodeType === 'SOURCE') coords[n.id] = { x: Math.max(30, busCoord.x - 160), y: busCoord.y }
      else if (n.nodeType === 'LOAD') coords[n.id] = { x: Math.min(canvasW - 30, busCoord.x + 160), y: busCoord.y }
      else coords[n.id] = { x: busCoord.x, y: busCoord.y + 100 }
    } else {
      coords[n.id] = { x: canvasW / 2, y: 40 + otherNodes.indexOf(n) * 70 }
    }
  }
  return coords
}

const chartOption = computed(() => {
  const nodes = topology.value.nodes
  const edges = topology.value.edges
  if (!nodes.length) return {}

  const coords = buildLayout(nodes)

  const graphData = nodes.map(n => ({
    id: n.id,
    name: n.name,
    x: coords[n.id]?.x ?? (n.posX || 0) * 5,
    y: coords[n.id]?.y ?? (n.posY || 0) * 5,
    symbolSize: n.nodeType === 'SOURCE' ? 28 : n.nodeType === 'STORAGE' ? 24 : 20,
    symbol: n.nodeType === 'SOURCE' ? 'roundRect' : n.nodeType === 'STORAGE' ? 'diamond' : 'circle',
    itemStyle: { color: nodeTypeColor[n.nodeType] || '#909399' },
    category: (['SOURCE', 'GRID', 'LOAD', 'STORAGE'] as string[]).indexOf(n.nodeType),
    label: { show: true, fontSize: 9, formatter: (p: any) => p.name.length > 6 ? p.name.slice(0, 6) + '..' : p.name },
    _raw: n,
  }))

  const graphLinks = edges.map(e => ({
    source: e.sourceNodeId,
    target: e.targetNodeId,
    lineStyle: {
      color: e.flowDirection === 'REVERSE' ? '#F56C6C' : e.edgeType === 'CONTROL' ? '#E6A23C' : '#a0a0a0',
      type: e.edgeType === 'LOGICAL' ? 'dashed' : e.edgeType === 'CONTROL' ? 'dotted' : 'solid',
      width: 1.5,
    },
    label: { show: false },
    _raw: e,
  }))

  return {
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const n = params.data._raw as TopoNode
          return `<b>${n.name}</b><br/>类型：${nodeTypeLabel[n.nodeType] || n.nodeType}<br/>电压：${n.voltageLevel || '-'}<br/>容量：${n.capacityKw ? (n.capacityKw >= 1000 ? (n.capacityKw / 1000).toFixed(0) + 'MW' : n.capacityKw + 'kW') : '-'}`
        }
        const e = params.data._raw as TopoEdge
        return `<b>${e.sourceName || e.sourceNodeId}</b> → <b>${e.targetName || e.targetNodeId}</b><br/>类型：${edgeTypeLabel[e.edgeType] || e.edgeType}<br/>方向：${flowLabel[e.flowDirection] || e.flowDirection}<br/>容量：${e.maxCapacityKw ? (e.maxCapacityKw >= 1000 ? (e.maxCapacityKw / 1000).toFixed(0) + 'MW' : e.maxCapacityKw + 'kW') : '-'}`
      },
    },
    legend: { data: ['源(光伏)', '网(母线)', '荷(负荷)', '储(储能)'], bottom: 4 },
    series: [{
      type: 'graph',
      layout: 'none',
      roam: true,
      draggable: true,
      data: graphData,
      links: graphLinks,
      categories: [
        { name: '源(光伏)', itemStyle: { color: '#67C23A' } },
        { name: '网(母线)', itemStyle: { color: '#267F7B' } },
        { name: '荷(负荷)', itemStyle: { color: '#F56C6C' } },
        { name: '储(储能)', itemStyle: { color: '#E6A23C' } },
      ],
      emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
      scaleLimit: { min: 0.3, max: 3 },
    }],
  }
})

const detailVisible = ref(false)
const detailItem = ref<any>(null)
const detailType = ref<'node' | 'edge'>('node')

function handleChartClick(params: any) {
  if (params.dataType === 'node') {
    detailType.value = 'node'
    detailItem.value = params.data._raw as TopoNode
    detailVisible.value = true
  } else if (params.dataType === 'edge') {
    detailType.value = 'edge'
    detailItem.value = params.data._raw as TopoEdge
    detailVisible.value = true
  }
}

// ==================== 接入关系 ====================
const connections = ref<any[]>([])
const connLoading = ref(false)
const connFilter = ref({ sourceType: '', targetType: '' })
const connPage = ref(1)
const connPageSize = ref(20)
const connTotal = ref(0)

const connDialogVisible = ref(false)
const connDialogTitle = ref('')
const connForm = ref({
  id: '',
  sourceNodeType: 'SOURCE' as string,
  sourceNodeId: '',
  targetNodeType: 'GRID' as string,
  targetNodeId: '',
  topologyType: 'STAR_NETWORK' as string,
  voltageLevelHierarchy: '' as string,
  operationMode: 'GRID_CONNECTED' as string,
  intermediateEquipment: '',
  topologyDesc: '',
  flowDirection: 'FORWARD',
  forwardPowerMaxKw: 0,
  reversePowerMaxKw: 0,
  flowDesc: '',
  maxCapacityKw: 0,
  controlLogic: '',
  controlSubject: '' as string,
  controlType: '' as string,
  triggerCondition: '',
  executeAction: '' as string,
  syncObjects: '',
  dataInteraction: '',
  statusSyncRule: '',
})
const connSaving = ref(false)
const isConnEdit = ref(false)
const sourceNodeOptions = ref<any[]>([])
const targetNodeOptions = ref<any[]>([])

async function loadSourceNodeOptions() {
  sourceNodeOptions.value = await fetchNodesByType(connForm.value.sourceNodeType)
}
async function loadTargetNodeOptions() {
  targetNodeOptions.value = await fetchNodesByType(connForm.value.targetNodeType)
}
watch(() => connForm.value.sourceNodeType, () => { connForm.value.sourceNodeId = ''; loadSourceNodeOptions() })
watch(() => connForm.value.targetNodeType, () => { connForm.value.targetNodeId = ''; loadTargetNodeOptions() })

function openConnCreate() {
  isConnEdit.value = false
  connDialogTitle.value = '新增接入关系'
  connForm.value = { id: '', sourceNodeType: 'SOURCE', sourceNodeId: '', targetNodeType: 'GRID', targetNodeId: '', topologyType: 'STAR_NETWORK', voltageLevelHierarchy: '', operationMode: 'GRID_CONNECTED', intermediateEquipment: '', topologyDesc: '', flowDirection: 'FORWARD', forwardPowerMaxKw: 0, reversePowerMaxKw: 0, flowDesc: '', maxCapacityKw: 0, controlLogic: '', controlSubject: '', controlType: '', triggerCondition: '', executeAction: '', syncObjects: '', dataInteraction: '', statusSyncRule: '' }
  connDialogVisible.value = true
  loadSourceNodeOptions()
  loadTargetNodeOptions()
}

function openConnEdit(row: any) {
  isConnEdit.value = true
  connDialogTitle.value = '编辑接入属性'
  connForm.value = {
    id: row.id,
    sourceNodeType: row.source_node_type,
    sourceNodeId: row.source_node_id,
    targetNodeType: row.target_node_type,
    targetNodeId: row.target_node_id,
    topologyType: row.topology_type || 'STAR_NETWORK',
    voltageLevelHierarchy: row.voltage_level_hierarchy || '',
    operationMode: row.operation_mode || 'GRID_CONNECTED',
    intermediateEquipment: row.intermediate_equipment || '',
    topologyDesc: row.topology_desc || '',
    flowDirection: row.flow_direction || 'FORWARD',
    forwardPowerMaxKw: row.forward_power_max_kw || 0,
    reversePowerMaxKw: row.reverse_power_max_kw || 0,
    flowDesc: row.flow_desc || '',
    maxCapacityKw: row.max_capacity_kw || 0,
    controlLogic: row.control_logic ? (typeof row.control_logic === 'string' ? row.control_logic : JSON.stringify(row.control_logic, null, 2)) : '',
    controlSubject: row.control_subject || '',
    controlType: row.control_type || '',
    triggerCondition: row.trigger_condition || '',
    executeAction: row.execute_action || '',
    syncObjects: row.sync_objects || '',
    dataInteraction: row.data_interaction || '',
    statusSyncRule: row.status_sync_rule || '',
  }
  connDialogVisible.value = true
  loadSourceNodeOptions()
  loadTargetNodeOptions()
}

async function handleConnSave() {
  if (!connForm.value.sourceNodeId || !connForm.value.targetNodeId) { ElMessage.warning('请选择源节点和目标节点'); return }
  connSaving.value = true
  try {
    let controlLogic = null as any
    if (connForm.value.controlLogic.trim()) {
      try { controlLogic = JSON.parse(connForm.value.controlLogic) } catch { controlLogic = connForm.value.controlLogic }
    }
    if (isConnEdit.value) {
      await updateConnectionAttr(connForm.value.id, {
        topologyType: connForm.value.topologyType,
        voltageLevelHierarchy: connForm.value.voltageLevelHierarchy,
        operationMode: connForm.value.operationMode,
        intermediateEquipment: connForm.value.intermediateEquipment,
        topologyDesc: connForm.value.topologyDesc,
        flowDirection: connForm.value.flowDirection,
        forwardPowerMaxKw: connForm.value.forwardPowerMaxKw,
        reversePowerMaxKw: connForm.value.reversePowerMaxKw,
        flowDesc: connForm.value.flowDesc,
        maxCapacityKw: connForm.value.maxCapacityKw,
        controlLogic,
        controlSubject: connForm.value.controlSubject,
        controlType: connForm.value.controlType,
        triggerCondition: connForm.value.triggerCondition,
        executeAction: connForm.value.executeAction,
        syncObjects: connForm.value.syncObjects,
        dataInteraction: connForm.value.dataInteraction,
        statusSyncRule: connForm.value.statusSyncRule,
      })
    } else {
      await createConnectionAttr({
        sourceNodeType: connForm.value.sourceNodeType,
        sourceNodeId: connForm.value.sourceNodeId,
        targetNodeType: connForm.value.targetNodeType,
        targetNodeId: connForm.value.targetNodeId,
        topologyType: connForm.value.topologyType,
        voltageLevelHierarchy: connForm.value.voltageLevelHierarchy,
        operationMode: connForm.value.operationMode,
        intermediateEquipment: connForm.value.intermediateEquipment,
        topologyDesc: connForm.value.topologyDesc,
        flowDirection: connForm.value.flowDirection,
        forwardPowerMaxKw: connForm.value.forwardPowerMaxKw,
        reversePowerMaxKw: connForm.value.reversePowerMaxKw,
        flowDesc: connForm.value.flowDesc,
        maxCapacityKw: connForm.value.maxCapacityKw,
        controlLogic,
        controlSubject: connForm.value.controlSubject,
        controlType: connForm.value.controlType,
        triggerCondition: connForm.value.triggerCondition,
        executeAction: connForm.value.executeAction,
        syncObjects: connForm.value.syncObjects,
        dataInteraction: connForm.value.dataInteraction,
        statusSyncRule: connForm.value.statusSyncRule,
      })
    }
    ElMessage.success(isConnEdit.value ? '接入属性已更新' : '接入关系已创建')
    connDialogVisible.value = false
    await loadConnections()
  } catch (e: any) { ElMessage.error(e?.message || '保存失败') }
  finally { connSaving.value = false }
}

async function handleConnDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除此接入关系？', '确认删除', { type: 'warning' })
    await deleteConnectionAttr(row.id)
    ElMessage.success('已删除')
    await loadConnections()
  } catch { /* cancelled */ }
}

// ==================== 加载数据 ====================
async function loadEntityData(type: TopoNodeType) {
  loadingTab.value = true
  try {
    switch (type) {
      case 'SOURCE': {
        const plants = await fetchPowerPlants()
        // 只取有 solar_pv_stations 的
        sourceList.value = plants.filter((p: any) => p.plant_type === 'solar' || p.capacity_kw > 0)
        break
      }
      case 'GRID': { gridList.value = await fetchNodesByType('GRID'); break }
      case 'LOAD': { loadList.value = await fetchLoadEntities(); break }
      case 'STORAGE': { storageList.value = await fetchStorageEntities(); break }
    }
  } catch (e: any) { ElMessage.error(e?.message || '加载失败') }
  finally { loadingTab.value = false }
}

async function loadConnections() {
  connLoading.value = true
  try {
    const params: Record<string, any> = { page: connPage.value, pageSize: connPageSize.value }
    if (connFilter.value.sourceType) params.sourceNodeType = connFilter.value.sourceType
    if (connFilter.value.targetType) params.targetNodeType = connFilter.value.targetType
    const res = await fetchConnectionAttrs(params)
    connections.value = res.list
    connTotal.value = res.total
  }
  catch (e: any) { ElMessage.error(e?.message || '加载接入关系失败') }
  finally { connLoading.value = false }
}

function handleConnPageChange(page: number) {
  connPage.value = page
  loadConnections()
}

function handleConnPageSizeChange(size: number) {
  connPageSize.value = size
  connPage.value = 1
  loadConnections()
}

function handleConnFilterChange() {
  connPage.value = 1
  loadConnections()
}

async function generateTopology() {
  topologyLoading.value = true
  try {
    const topo = await fetchPvGridTopology()
    topology.value = topo
    topologyGenerated.value = true
  } catch (e: any) { ElMessage.error(e?.message || '生成拓扑图失败') }
  finally { topologyLoading.value = false }
}

function formatLogic(v: any): string {
  if (!v) return '-'
  if (typeof v === 'string') { try { return JSON.stringify(JSON.parse(v)) } catch { return v } }
  return JSON.stringify(v)
}

onMounted(async () => {
  await loadConnections()
})

watch(mainTab, async (t) => {
  if (t === 'model') await loadEntityData(activeTab.value)
})
</script>

<template>
  <div class="page-container" style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 100px)">
    <div class="chart-panel-title">资源关联关系</div>
    <el-tabs v-model="mainTab" style="margin-bottom:-8px">
      <el-tab-pane label="接入关系" name="relation" />
      <el-tab-pane label="模型管理" name="model" />
    </el-tabs>

    <!-- ========== 接入关系 Tab ========== -->
    <template v-if="mainTab === 'relation'">
      <div class="chart-panel" style="display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <el-select v-model="connFilter.sourceType" size="small" placeholder="源类型" clearable style="width:100px" @change="handleConnFilterChange">
              <el-option v-for="t in tabTypes" :key="t.type" :label="t.label" :value="t.type" />
            </el-select>
            <el-select v-model="connFilter.targetType" size="small" placeholder="目标类型" clearable style="width:100px" @change="handleConnFilterChange">
              <el-option v-for="t in tabTypes" :key="t.type" :label="t.label" :value="t.type" />
            </el-select>
          </div>
          <div style="display:flex;gap:8px">
            <el-button size="small" @click="openConnCreate">新增关系</el-button>
            <el-button type="primary" size="small" :loading="topologyLoading" @click="generateTopology">生成拓扑图</el-button>
          </div>
        </div>
        <el-table :data="connections" stripe size="small" max-height="280" v-loading="connLoading">
          <el-table-column label="源" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tag size="small" :color="nodeTypeColor[row.source_node_type]" style="color:#fff;border:none;margin-right:4px">
                {{ tabTypes.find(t => t.type === row.source_node_type)?.label || row.source_node_type }}
              </el-tag>
              {{ row.source_name || row.source_node_id }}
            </template>
          </el-table-column>
          <el-table-column label="目标" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tag size="small" :color="nodeTypeColor[row.target_node_type]" style="color:#fff;border:none;margin-right:4px">
                {{ tabTypes.find(t => t.type === row.target_node_type)?.label || row.target_node_type }}
              </el-tag>
              {{ row.target_name || row.target_node_id }}
            </template>
          </el-table-column>
          <el-table-column label="拓扑类型" min-width="110" show-overflow-tooltip>
            <template #default="{ row }">
              <span style="font-size:12px">{{ topologyTypeLabel[row.topology_type] || row.topology_type || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="运行模式" min-width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="row.operation_mode === 'ISLAND' ? 'warning' : row.operation_mode === 'SWITCHABLE' ? 'success' : ''">
                {{ operationModeLabel[row.operation_mode] || row.operation_mode || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="方向" min-width="60">
            <template #default="{ row }">
              <el-tag size="small" :type="row.flow_direction === 'BIDIRECTIONAL' ? 'success' : 'primary'">
                {{ flowLabel[row.flow_direction] || row.flow_direction }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="容量" min-width="90">
            <template #default="{ row }">
              {{ row.max_capacity_kw ? (row.max_capacity_kw >= 1000 ? (row.max_capacity_kw / 1000).toFixed(0) + 'MW' : row.max_capacity_kw + 'kW') : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="控制类型" min-width="80" show-overflow-tooltip>
            <template #default="{ row }"><span style="font-size:12px">{{ controlTypeLabel[row.control_type] || row.control_type || '-' }}</span></template>
          </el-table-column>
          <el-table-column label="控制策略" min-width="140" show-overflow-tooltip>
            <template #default="{ row }"><span style="font-size:12px">{{ formatLogic(row.control_logic) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" min-width="100" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openConnEdit(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="handleConnDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!connections.length && !connLoading" style="text-align:center;padding:15px;color:#909399">暂无接入数据</div>
        <div v-if="connTotal > 0" style="display:flex;justify-content:flex-end;padding-top:8px">
          <el-pagination
            v-model:current-page="connPage"
            v-model:page-size="connPageSize"
            :page-sizes="[10, 20, 50]"
            :total="connTotal"
            layout="total, sizes, prev, pager, next"
            small
            @size-change="handleConnPageSizeChange"
            @current-change="handleConnPageChange"
          />
        </div>
      </div>

      <!-- 拓扑图 -->
      <div v-if="topologyGenerated" class="chart-panel" style="flex:1;min-height:350px;display:flex;flex-direction:column">
        <div class="chart-panel-title">光伏接入拓扑</div>
        <div style="flex:1;min-height:300px;position:relative">
          <VChart ref="chartRef" :option="chartOption" style="width:100%;height:100%" autoresize @click="handleChartClick" />
        </div>
      </div>
    </template>

    <!-- ========== 模型管理 Tab ========== -->
    <template v-if="mainTab === 'model'">
      <div class="chart-panel" style="display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <el-tabs v-model="activeTab" style="margin-bottom:-16px" @tab-change="loadEntityData">
            <el-tab-pane v-for="t in entityTabTypes" :key="t.type" :label="t.label" :name="t.type" />
          </el-tabs>
          <el-button size="small" @click="openEntityCreate">新建</el-button>
        </div>
        <el-table :data="currentEntities" stripe size="small" max-height="350" v-loading="loadingTab">
          <template v-if="activeTab === 'SOURCE'">
            <el-table-column label="名称" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="类型" min-width="70">
              <template #default="{ row }">{{ row.plant_type || '-' }}</template>
            </el-table-column>
            <el-table-column label="容量(kW)" min-width="90">
              <template #default="{ row }">{{ row.capacity_kw || '-' }}</template>
            </el-table-column>
            <el-table-column label="电压等级" min-width="80">
              <template #default="{ row }">{{ row.voltage_level || '-' }}</template>
            </el-table-column>
            <el-table-column label="区域" min-width="80" show-overflow-tooltip>
              <template #default="{ row }">{{ row.zone || '-' }}</template>
            </el-table-column>
          </template>
          <template v-if="activeTab === 'GRID'">
            <el-table-column label="名称" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.node_name || row.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="电压等级" min-width="80">
              <template #default="{ row }">{{ row.voltage_level || '-' }}</template>
            </el-table-column>
            <el-table-column label="区域" min-width="80" show-overflow-tooltip>
              <template #default="{ row }">{{ row.zone || '-' }}</template>
            </el-table-column>
          </template>
          <template v-if="activeTab === 'LOAD'">
            <el-table-column label="名称" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="类型" min-width="70">
              <template #default="{ row }">{{ row.load_type || '-' }}</template>
            </el-table-column>
            <el-table-column label="峰值(kW)" min-width="90">
              <template #default="{ row }">{{ row.peak_load_kw ? (row.peak_load_kw >= 1000 ? (row.peak_load_kw / 1000).toFixed(0) + 'MW' : row.peak_load_kw + 'kW') : '-' }}</template>
            </el-table-column>
            <el-table-column label="电压等级" min-width="80">
              <template #default="{ row }">{{ row.voltage_level || '-' }}</template>
            </el-table-column>
            <el-table-column label="区域" min-width="80" show-overflow-tooltip>
              <template #default="{ row }">{{ row.zone || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="100" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openEntityEdit(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="handleEntityDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </template>
          <template v-if="activeTab === 'STORAGE'">
            <el-table-column label="名称" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="类型" min-width="70">
              <template #default="{ row }">{{ row.storage_type || '-' }}</template>
            </el-table-column>
            <el-table-column label="功率(kW)" min-width="90">
              <template #default="{ row }">{{ row.rated_power_kw || '-' }}</template>
            </el-table-column>
            <el-table-column label="容量(kWh)" min-width="90">
              <template #default="{ row }">{{ row.rated_capacity_kwh || '-' }}</template>
            </el-table-column>
            <el-table-column label="区域" min-width="80" show-overflow-tooltip>
              <template #default="{ row }">{{ row.zone || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="100" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openEntityEdit(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="handleEntityDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </template>
        </el-table>
        <div v-if="!currentEntities.length && !loadingTab" style="text-align:center;padding:20px;color:#909399">暂无数据</div>
      </div>
    </template>

    <!-- 实体新建/编辑弹窗 -->
    <el-dialog v-model="entityDialogVisible" :title="entityDialogTitle" width="500px">
      <el-form label-width="110px">
        <el-form-item label="名称">
          <el-input v-model="entityForm.name" />
        </el-form-item>
        <template v-if="activeTab === 'SOURCE'">
          <el-form-item label="装机容量(kW)">
            <el-input-number v-model="entityForm.capacityKw" :min="0" :step="100" controls-position="right" style="width:100%" />
          </el-form-item>
        </template>
        <template v-if="activeTab === 'GRID'">
          <el-form-item label="电压等级">
            <el-input v-model="entityForm.voltageLevel" placeholder="如 220kV" />
          </el-form-item>
        </template>
        <template v-if="activeTab === 'LOAD'">
          <el-form-item label="负荷类型">
            <el-select v-model="entityForm.loadType" style="width:100%">
              <el-option label="工业" value="INDUSTRIAL" />
              <el-option label="商业" value="COMMERCIAL" />
              <el-option label="居民" value="RESIDENTIAL" />
              <el-option label="农业" value="AGRICULTURAL" />
              <el-option label="市政" value="MUNICIPAL" />
            </el-select>
          </el-form-item>
          <el-form-item label="峰值负荷(kW)">
            <el-input-number v-model="entityForm.peakLoadKw" :min="0" :step="100" controls-position="right" style="width:100%" />
          </el-form-item>
          <el-form-item label="年用电量(MWh)">
            <el-input-number v-model="entityForm.annualConsumptionMwh" :min="0" :step="100" controls-position="right" style="width:100%" />
          </el-form-item>
        </template>
        <template v-if="activeTab === 'STORAGE'">
          <el-form-item label="储能类型">
            <el-select v-model="entityForm.storageType" style="width:100%">
              <el-option label="电池储能" value="BATTERY" />
              <el-option label="抽水蓄能" value="PUMPED_HYDRO" />
              <el-option label="飞轮储能" value="FLYWHEEL" />
            </el-select>
          </el-form-item>
          <el-form-item label="额定功率(kW)">
            <el-input-number v-model="entityForm.ratedPowerKw" :min="0" :step="100" controls-position="right" style="width:100%" />
          </el-form-item>
          <el-form-item label="额定容量(kWh)">
            <el-input-number v-model="entityForm.ratedCapacityKwh" :min="0" :step="100" controls-position="right" style="width:100%" />
          </el-form-item>
          <el-form-item label="效率(%)">
            <el-input-number v-model="entityForm.efficiencyPct" :min="0" :max="100" controls-position="right" style="width:100%" />
          </el-form-item>
          <el-form-item label="充放电模式">
            <el-select v-model="entityForm.chargeMode" style="width:100%">
              <el-option label="削峰填谷" value="PEAK_SHAVING" />
              <el-option label="频率调节" value="FREQ_REGULATION" />
              <el-option label="备用电源" value="BACKUP" />
              <el-option label="市场套利" value="ARBITRAGE" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item label="电压等级">
          <el-input v-model="entityForm.voltageLevel" placeholder="如 10kV" />
        </el-form-item>
        <el-form-item label="区域">
          <el-input v-model="entityForm.zone" />
        </el-form-item>
        <el-form-item label="经度">
          <el-input-number v-model="entityForm.longitude" :precision="4" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="纬度">
          <el-input-number v-model="entityForm.latitude" :precision="4" controls-position="right" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="entityDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="entitySaving" @click="handleEntitySave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 接入关系新增/编辑弹窗 -->
    <el-dialog v-model="connDialogVisible" :title="connDialogTitle" width="680px">
      <el-form label-width="100px" style="max-height:60vh;overflow-y:auto">
        <!-- 关联对象 -->
        <el-divider content-position="left">关联对象</el-divider>
        <el-form-item label="源类型">
          <el-select v-model="connForm.sourceNodeType" style="width:100%" :disabled="isConnEdit">
            <el-option v-for="t in tabTypes" :key="t.type" :label="nodeTypeLabel[t.type]" :value="t.type" />
          </el-select>
        </el-form-item>
        <el-form-item label="源节点">
          <el-select v-model="connForm.sourceNodeId" style="width:100%" placeholder="请选择节点" :disabled="isConnEdit">
            <el-option v-for="n in sourceNodeOptions" :key="n.node_id" :label="n.node_name" :value="n.node_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-select v-model="connForm.targetNodeType" style="width:100%" :disabled="isConnEdit">
            <el-option v-for="t in tabTypes" :key="t.type" :label="nodeTypeLabel[t.type]" :value="t.type" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标节点">
          <el-select v-model="connForm.targetNodeId" style="width:100%" placeholder="请选择节点" :disabled="isConnEdit">
            <el-option v-for="n in targetNodeOptions" :key="n.node_id" :label="n.node_name" :value="n.node_id" />
          </el-select>
        </el-form-item>

        <!-- 连接方式 -->
        <el-divider content-position="left">连接方式（物理拓扑）</el-divider>
        <el-form-item label="拓扑类型">
          <el-select v-model="connForm.topologyType" style="width:100%">
            <el-option label="直接并联" value="DIRECT_PARALLEL" />
            <el-option label="串联转接" value="SERIES_RELAY" />
            <el-option label="星形组网" value="STAR_NETWORK" />
            <el-option label="环网连接" value="RING_NETWORK" />
            <el-option label="点对点专线" value="POINT_TO_POINT" />
            <el-option label="并网点统一接入" value="UNIFIED_POC" />
            <el-option label="分区隔离连接" value="ZONE_ISOLATION" />
          </el-select>
        </el-form-item>
        <el-form-item label="电气层级">
          <el-select v-model="connForm.voltageLevelHierarchy" style="width:100%" clearable>
            <el-option label="500kV" value="500kV" />
            <el-option label="220kV" value="220kV" />
            <el-option label="110kV" value="110kV" />
            <el-option label="35kV" value="35kV" />
            <el-option label="10kV" value="10kV" />
            <el-option label="0.4kV" value="0.4kV" />
          </el-select>
        </el-form-item>
        <el-form-item label="运行模式">
          <el-select v-model="connForm.operationMode" style="width:100%">
            <el-option label="联网运行" value="GRID_CONNECTED" />
            <el-option label="孤岛运行" value="ISLAND" />
            <el-option label="可切换" value="SWITCHABLE" />
          </el-select>
        </el-form-item>
        <el-form-item label="中间设备">
          <el-input v-model="connForm.intermediateEquipment" placeholder="如：变压器、逆变器、开关柜" />
        </el-form-item>

        <!-- 功率流方向 -->
        <el-divider content-position="left">功率流方向</el-divider>
        <el-form-item label="流向属性">
          <el-select v-model="connForm.flowDirection" style="width:100%">
            <el-option label="单向(源→目标)" value="FORWARD" />
            <el-option label="单向(目标→源)" value="REVERSE" />
            <el-option label="双向" value="BIDIRECTIONAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="正向功率上限">
          <el-input-number v-model="connForm.forwardPowerMaxKw" :min="0" :step="100" controls-position="right" style="width:100%" />
          <span style="font-size:11px;color:#909399">kW，正常运行下默认方向的功率上限</span>
        </el-form-item>
        <el-form-item v-if="connForm.flowDirection === 'BIDIRECTIONAL'" label="反向功率上限">
          <el-input-number v-model="connForm.reversePowerMaxKw" :min="0" :step="100" controls-position="right" style="width:100%" />
          <span style="font-size:11px;color:#909399">kW，双向时填写反向功率上限</span>
        </el-form-item>

        <!-- 控制逻辑 -->
        <el-divider content-position="left">控制逻辑（运行策略）</el-divider>
        <el-form-item label="控制主体">
          <el-select v-model="connForm.controlSubject" style="width:100%" clearable>
            <el-option label="就地控制器" value="LOCAL_CONTROLLER" />
            <el-option label="区域EMS" value="REGIONAL_EMS" />
            <el-option label="省级调度" value="PROVINCIAL_DISPATCH" />
          </el-select>
        </el-form-item>
        <el-form-item label="控制类型">
          <el-select v-model="connForm.controlType" style="width:100%" clearable>
            <el-option label="就地保护" value="LOCAL_PROTECTION" />
            <el-option label="出力调节" value="OUTPUT_REGULATION" />
            <el-option label="开关控制" value="SWITCH_CONTROL" />
            <el-option label="协同联动" value="COORDINATED_LINKAGE" />
            <el-option label="需求响应" value="DEMAND_RESPONSE" />
          </el-select>
        </el-form-item>
        <el-form-item label="触发条件">
          <el-input v-model="connForm.triggerCondition" placeholder="如：电网频率<49.8Hz、SOC<20%" />
        </el-form-item>
        <el-form-item label="执行动作">
          <el-select v-model="connForm.executeAction" style="width:100%" clearable>
            <el-option label="充电" value="CHARGE" />
            <el-option label="放电" value="DISCHARGE" />
            <el-option label="升出力" value="INCREASE_OUTPUT" />
            <el-option label="降出力" value="DECREASE_OUTPUT" />
            <el-option label="分闸" value="OPEN_BREAKER" />
            <el-option label="合闸" value="CLOSE_BREAKER" />
            <el-option label="负荷调节" value="LOAD_ADJUST" />
          </el-select>
        </el-form-item>
        <el-form-item label="协同对象">
          <el-input v-model="connForm.syncObjects" placeholder="联动的其他资源标识" />
        </el-form-item>
        <el-form-item label="数据交互">
          <el-input v-model="connForm.dataInteraction" placeholder="如：遥测,遥信,指令,告警" />
        </el-form-item>
        <el-form-item label="状态同步规则">
          <el-input v-model="connForm.statusSyncRule" type="textarea" :rows="2" placeholder="同步周期、异常处理机制等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="connDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="connSaving" @click="handleConnSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 节点/边详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detailType === 'node' ? '节点详情' : '连接详情'" size="400px">
      <template v-if="detailType === 'node' && detailItem">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="名称">{{ detailItem.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag size="small" :color="nodeTypeColor[detailItem.nodeType]" style="color:#fff;border:none">
              {{ nodeTypeLabel[detailItem.nodeType] || detailItem.nodeType }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="电压等级">{{ detailItem.voltageLevel || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="detailItem.capacityKw" label="容量">
            {{ detailItem.capacityKw >= 1000 ? (detailItem.capacityKw / 1000).toFixed(0) + 'MW' : detailItem.capacityKw + 'kW' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="detailItem.zone" label="区域">{{ detailItem.zone }}</el-descriptions-item>
        </el-descriptions>
      </template>
      <template v-if="detailType === 'edge' && detailItem">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="源">{{ detailItem.sourceName || detailItem.sourceNodeId }}</el-descriptions-item>
          <el-descriptions-item label="目标">{{ detailItem.targetName || detailItem.targetNodeId }}</el-descriptions-item>
          <el-descriptions-item label="拓扑类型">
            {{ topologyTypeLabel[detailItem.topologyType] || detailItem.topologyType || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="功率流方向">
            <el-tag size="small" :type="detailItem.flowDirection === 'BIDIRECTIONAL' ? 'success' : 'primary'">
              {{ flowLabel[detailItem.flowDirection] || detailItem.flowDirection }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="detailItem.maxCapacityKw" label="最大容量">
            {{ detailItem.maxCapacityKw >= 1000 ? (detailItem.maxCapacityKw / 1000).toFixed(0) + 'MW' : detailItem.maxCapacityKw + 'kW' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="detailItem.controlLogic" label="控制逻辑">{{ formatLogic(detailItem.controlLogic) }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>
