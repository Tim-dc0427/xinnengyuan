<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  fetchScenarios, createScenario, updateScenario, deleteScenario,
  batchDeleteScenarios, copyScenario, fetchScenarioVersions, restoreVersion, exportScenarios,
  previewScenario as callPreviewScenario, batchCopyScenarios,
} from '@/api/scenario'
import { fetchNodesByType } from '@/api/resource'
import type { ScenarioTopology } from '@new-energy/shared'
import GridEditorTab from './components/GridEditorTab.vue'
import PreviewTopology from './components/PreviewTopology.vue'

const NODE_TYPE_OPTIONS = [
  { value: 'SOURCE', label: '源(光伏电站)' },
  { value: 'GRID', label: '网(母线)' },
  { value: 'LOAD', label: '荷(负荷)' },
  { value: 'STORAGE', label: '储(储能)' },
]

const tableData = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

// 筛选
const filterName = ref('')
const filterType = ref('')
const filterStatus = ref('')
const filterDevice = ref('')
const filterDateStart = ref('')
const filterDateEnd = ref('')
const filterTag = ref('')
const selectedIds = ref<string[]>([])

// 独立预览弹窗
const previewVisible = ref(false)
const previewing = ref(false)
const previewData = ref<any>(null)
const previewScenario = ref<any>(null)

// 编辑面板内实时预览
const editPreviewData = ref<any>(null)
const editPreviewing = ref(false)
let previewTimer: ReturnType<typeof setTimeout> | null = null

function debouncedPreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    if (!dialogVisible.value) return
    editPreviewing.value = true
    try {
      const data = await callPreviewScenario(buildConfig())
      editPreviewData.value = data
    } catch {
      editPreviewData.value = null
    } finally {
      editPreviewing.value = false
    }
  }, 500)
}

// 源网荷储节点(按类型缓存)
const nodesByType = ref<Record<string, any[]>>({})
async function loadNodesByType(nodeType: string) {
  if (!nodesByType.value[nodeType]) {
    nodesByType.value[nodeType] = await fetchNodesByType(nodeType)
  }
}
function getNodesByType(nodeType: string) {
  return nodesByType.value[nodeType] || []
}

// 对话框
const dialogVisible = ref(false)
const editingId = ref('')
const activeTab = ref('basic')
const saving = ref(false)
const detailVisible = ref(false)
const detail = ref<any>(null)
const versionsVisible = ref(false)
const versions = ref<any[]>([])
const versionsScenarioId = ref('')
const versionsScenarioData = ref<any>(null)

const typeOptions = [
  { value: 'industrial_park', label: '工业园区' },
  { value: 'residential', label: '居民小区' },
  { value: 'commercial', label: '商业综合体' },
  { value: 'custom', label: '自定义' },
]

const scenarioConditionOptions = [
  { value: 'peak_load', label: '高峰负荷' },
  { value: 'extreme_weather', label: '极端天气' },
  { value: 'maintenance', label: '线路检修' },
  { value: 'solar_high', label: '光伏高发' },
  { value: 'normal', label: '常规' },
]

// 表单
interface AccessPoint { nodeType: string; nodeId: string; nodeName: string; connectedCapacity: number; voltageLevel: number; connectionType: string; params: Record<string, any> }
interface ControlRule { name: string; condition: string; action: string; priority: number }

function defaultDeviceParams(nodeType: string) {
  switch (nodeType) {
    case 'SOURCE': return { outputUpperLimit: 95, outputLowerLimit: 10, powerFactor: 0.95, regulationDelay: 30 }
    case 'GRID': return { tapRegulation: true, reactiveCompensation: true }
    case 'LOAD': return { peakClippingRate: 15, valleyFillingRate: 12, interruptibleLoadRatio: 5 }
    case 'STORAGE': return { chargeSchedule: '00:00-06:00', dischargeSchedule: '10:00-12:00,18:00-21:00', socUpper: 90, socLower: 20, ratedPowerKw: 5000, ratedCapacityKwh: 10000 }
    default: return {}
  }
}

const formBasic = ref({ name: '', type: 'custom', description: '', tags: [] as string[], status: 'draft', scenario_condition: 'normal', version_limit: 10 })
const formAccessPoints = ref<AccessPoint[]>([])
const formControlRules = ref<ControlRule[]>([])
const formDataSource = ref({ type: 'realtime', dataTypes: [] as string[] })
const gridTopology = ref<ScenarioTopology>({ nodes: [], edges: [] })
const topologyTabSeen = ref(false)
const tagInput = ref('')

function buildConfig() {
  // 拓扑编辑器优先：有拓扑节点时从拓扑派生 accessPoints
  const accessPoints = gridTopology.value.nodes.length > 0
    ? gridTopology.value.nodes.map(n => ({
        nodeType: n.nodeType,
        nodeId: n.nodeId || '',
        nodeName: n.nodeName,
        connectedCapacity: n.connectedCapacity || 0,
        voltageLevel: parseInt((n.voltageLevel || '110').replace('kV', ''), 10) || 110,
        connectionType: 'AC',
        params: n.params || defaultDeviceParams(n.nodeType),
      }))
    : formAccessPoints.value
  return {
    accessPoints,
    controlRules: formControlRules.value,
    dataSource: formDataSource.value,
    topology: gridTopology.value,
  }
}

function loadConfig(config: any) {
  if (!config) return
  if (config.accessPoints) formAccessPoints.value = config.accessPoints.map((ap: any) => ({
    ...ap, params: ap.params || defaultDeviceParams(ap.nodeType),
  }))
  if (config.controlRules) formControlRules.value = config.controlRules
  if (config.dataSource) {
    formDataSource.value = {
      type: config.dataSource.type || 'realtime',
      dataTypes: config.dataSource.dataTypes || [],
    }
  }
  if (config.topology) {
    gridTopology.value = config.topology
  } else if (config.accessPoints?.length) {
    gridTopology.value = { nodes: [], edges: [] }
  } else {
    gridTopology.value = { nodes: [], edges: [] }
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterName.value) params.name = filterName.value
    if (filterType.value) params.type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterDevice.value) params.device = filterDevice.value
    if (filterTag.value) params.tag = filterTag.value
    if (filterDateStart.value) params.date_start = filterDateStart.value
    if (filterDateEnd.value) params.date_end = filterDateEnd.value
    const res = await fetchScenarios(params)
    tableData.value = res.list || []
    total.value = res.total || 0
  } finally { loading.value = false }
}

async function loadResources() {
  await Promise.all([
    loadNodesByType('SOURCE'),
    loadNodesByType('GRID'),
    loadNodesByType('LOAD'),
    loadNodesByType('STORAGE'),
  ])
}

function addAccessPoint() {
  formAccessPoints.value.push({ nodeType: 'SOURCE', nodeId: '', nodeName: '', connectedCapacity: 0, voltageLevel: 110, connectionType: 'AC', params: defaultDeviceParams('SOURCE') })
}

function removeAccessPoint(index: number) {
  formAccessPoints.value.splice(index, 1)
}

async function onAccessNodeTypeChange(index: number, nodeType: string) {
  formAccessPoints.value[index].nodeType = nodeType
  formAccessPoints.value[index].nodeId = ''
  formAccessPoints.value[index].nodeName = ''
  formAccessPoints.value[index].params = defaultDeviceParams(nodeType)
  await loadNodesByType(nodeType)
}

function onAccessNodeChange(index: number, nodeId: string) {
  const nodes = getNodesByType(formAccessPoints.value[index].nodeType)
  const node = nodes.find(n => n.node_id === nodeId)
  formAccessPoints.value[index].nodeId = nodeId
  formAccessPoints.value[index].nodeName = node?.node_name || ''
}

function addTag() {
  if (tagInput.value && !formBasic.value.tags.includes(tagInput.value)) {
    formBasic.value.tags.push(tagInput.value)
    tagInput.value = ''
  }
}
function removeTag(tag: string) {
  formBasic.value.tags = formBasic.value.tags.filter(t => t !== tag)
}

function openCreate() {
  editingId.value = ''
  formBasic.value = { name: '', type: 'custom', description: '', tags: [], status: 'draft', scenario_condition: 'normal', version_limit: 10 }
  formAccessPoints.value = []
  formControlRules.value = []
  formDataSource.value = { type: 'realtime', dataTypes: [] }
  gridTopology.value = { nodes: [], edges: [] }
  topologyTabSeen.value = false
  activeTab.value = 'basic'
  dialogVisible.value = true
}

function onTopologyUpdate(topology: ScenarioTopology) {
  gridTopology.value = topology
}

function openEdit(row: any) {
  editingId.value = row.id
  formBasic.value = {
    name: row.name, type: row.type, description: row.description || '',
    tags: row.tags || [], status: row.status || 'draft',
    scenario_condition: row.scenario_condition || 'normal',
    version_limit: row.version_limit ?? 10,
  }
  loadConfig(row.config)
  if (!formAccessPoints.value.length) formAccessPoints.value = []
  activeTab.value = 'basic'
  previewData.value = null
  dialogVisible.value = true
}

async function save() {
  if (!formBasic.value.name) return
  saving.value = true
  try {
    const payload = {
      ...formBasic.value,
      config: buildConfig(),
    }
    if (editingId.value) {
      await updateScenario(editingId.value, payload)
    } else {
      await createScenario(payload)
    }
    dialogVisible.value = false
    await loadData()
  } finally { saving.value = false }
}

function openPreview(row: any) {
  previewScenario.value = row
  previewData.value = null
  previewVisible.value = true
}

async function runPreview() {
  previewing.value = true
  previewData.value = null
  try {
    const data = await callPreviewScenario(previewScenario.value.config || {})
    previewData.value = data
  } finally { previewing.value = false }
}

async function remove(id: string) {
  await deleteScenario(id)
  await loadData()
}

async function batchDelete() {
  if (!selectedIds.value.length) return
  await batchDeleteScenarios(selectedIds.value)
  selectedIds.value = []
  await loadData()
}

async function batchCopy() {
  if (!selectedIds.value.length) return
  await batchCopyScenarios(selectedIds.value)
  selectedIds.value = []
  await loadData()
}

async function copy(id: string) {
  await copyScenario(id)
  await loadData()
}

async function batchExport() {
  const ids = selectedIds.value.length ? selectedIds.value : []
  if (!ids.length) return
  const data = await exportScenarios(ids)
  if (!data?.length) return
  const csv = [Object.keys(data[0]).join(','), ...data.map((r: any) => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `场景导出_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function showDetail(row: any) {
  detail.value = row
  detailVisible.value = true
}

async function showVersions(row: any) {
  versionsScenarioId.value = row.id
  versionsScenarioData.value = row
  versions.value = await fetchScenarioVersions(row.id)
  versionsVisible.value = true
}

async function restore(scenarioId: string, versionId: string) {
  await restoreVersion(scenarioId, versionId)
  await loadData()
  versions.value = await fetchScenarioVersions(scenarioId)
}

function resetSearch() {
  filterName.value = ''; filterType.value = ''; filterStatus.value = ''
  filterDevice.value = ''; filterDateStart.value = ''; filterDateEnd.value = ''
  filterTag.value = ''
  page.value = 1
  loadData()
}

// 编辑面板实时预览：监听接入点变化
watch(
  () => formAccessPoints.value,
  () => {
    if (dialogVisible.value && formAccessPoints.value.length > 0) {
      debouncedPreview()
    }
  },
  { deep: true },
)

// 关闭对话框时清理预览
watch(dialogVisible, (val) => {
  if (!val) {
    editPreviewData.value = null
    if (previewTimer) {
      clearTimeout(previewTimer)
      previewTimer = null
    }
  }
})

onMounted(() => {
  loadData()
  loadResources()
})
</script>

<template>
  <div>
    <div class="chart-panel-title">互动场景管理</div>
    <!-- 搜索 -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <el-input v-model="filterName" placeholder="名称" clearable style="width:150px" size="small" @clear="loadData" />
        <el-select v-model="filterType" placeholder="类型" clearable style="width:120px" size="small" @change="loadData">
          <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:100px" size="small" @change="loadData">
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="active" />
          <el-option label="已归档" value="archived" />
        </el-select>
        <el-input v-model="filterDevice" placeholder="关联节点名称" clearable style="width:150px" size="small" @clear="loadData" @keyup.enter="loadData" />
        <el-input v-model="filterTag" placeholder="标签" clearable style="width:100px" size="small" @clear="loadData" @keyup.enter="loadData" />
        <el-date-picker v-model="filterDateStart" type="date" placeholder="开始日期" size="small" style="width:130px" value-format="YYYY-MM-DD" @change="loadData" />
        <el-date-picker v-model="filterDateEnd" type="date" placeholder="结束日期" size="small" style="width:130px" value-format="YYYY-MM-DD" @change="loadData" />
        <el-button size="small" @click="resetSearch">重置</el-button>
      </div>
      <div style="display:flex;gap:6px">
        <el-button v-if="selectedIds.length" size="small" @click="batchExport">导出({{ selectedIds.length }})</el-button>
        <el-button v-if="selectedIds.length" size="small" @click="batchCopy">批量复制({{ selectedIds.length }})</el-button>
        <el-button v-if="selectedIds.length" size="small" type="danger" @click="batchDelete">批量删除({{ selectedIds.length }})</el-button>
        <el-button type="primary" size="small" @click="openCreate">创建场景</el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table :data="tableData" stripe size="small" v-loading="loading" @selection-change="(val:any[]) => selectedIds = val.map(v => v.id)">
      <el-table-column type="selection" width="40" />
      <el-table-column prop="name" label="场景名称" min-width="140" show-overflow-tooltip />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">{{ typeOptions.find(t => t.value === row.type)?.label || row.type }}</template>
      </el-table-column>
      <el-table-column label="接入点" width="80" align="center">
        <template #default="{ row }">{{ row.config?.accessPoints?.length || 0 }}个</template>
      </el-table-column>
      <el-table-column label="标签" width="160">
        <template #default="{ row }">
          <el-tag v-for="tag in (row.tags || [])" :key="tag" size="small" style="margin-right:4px">{{ tag }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : row.status === 'archived' ? 'info' : 'warning'" size="small">
            {{ row.status === 'active' ? '已发布' : row.status === 'archived' ? '已归档' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="150" />
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="showDetail(row)">详情</el-button>
          <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" link @click="showVersions(row)">版本</el-button>
          <el-button size="small" link @click="copy(row.id)">复制</el-button>
          <el-button size="small" link @click="openPreview(row)">预览</el-button>
          <el-button size="small" link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display:flex;justify-content:flex-end;margin-top:12px">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total,prev,pager,next" small @current-change="loadData" />
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑场景' : '搭建互动场景'" width="860px" @close="activeTab='basic'">
      <el-tabs v-model="activeTab" @tab-change="(name: string) => { if (name === 'topology') topologyTabSeen = true }">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="formBasic" label-position="top" size="small">
            <el-row :gutter="16">
              <el-col :span="14"><el-form-item label="场景名称"><el-input v-model="formBasic.name" /></el-form-item></el-col>
              <el-col :span="5">
                <el-form-item label="场景类型">
                  <el-select v-model="formBasic.type"><el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" /></el-select>
                </el-form-item>
              </el-col>
              <el-col :span="5">
                <el-form-item label="状态">
                  <el-select v-model="formBasic.status"><el-option label="草稿" value="draft" /><el-option label="已发布" value="active" /></el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="场景条件">
                  <el-select v-model="formBasic.scenario_condition">
                    <el-option v-for="c in scenarioConditionOptions" :key="c.value" :label="c.label" :value="c.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="版本保留上限">
                  <el-input-number v-model="formBasic.version_limit" :min="1" :max="100" size="small" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="描述"><el-input v-model="formBasic.description" type="textarea" :rows="2" /></el-form-item>
            <el-form-item label="标签">
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
                <el-tag v-for="tag in formBasic.tags" :key="tag" closable size="small" @close="removeTag(tag)">{{ tag }}</el-tag>
              </div>
              <div style="display:flex;gap:8px">
                <el-input v-model="tagInput" placeholder="输入标签" size="small" style="width:160px" @keyup.enter="addTag" />
                <el-button size="small" @click="addTag">添加</el-button>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="接入点配置" name="access">
          <div style="margin-bottom:12px">
            <el-button size="small" type="primary" @click="addAccessPoint">添加接入点</el-button>
          </div>
          <div v-for="(ap, idx) in formAccessPoints" :key="idx" style="padding:12px;margin-bottom:8px;background:#fafafa;border-radius:4px;border:1px solid #f0f0f0">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-weight:600;font-size:13px">接入点 {{ idx + 1 }}</span>
              <el-button size="small" link type="danger" @click="removeAccessPoint(idx)">移除</el-button>
            </div>
            <el-row :gutter="12">
              <el-col :span="5">
                <span style="font-size:12px;color:#606266">节点类型</span>
                <el-select v-model="ap.nodeType" size="small" @change="onAccessNodeTypeChange(idx, ap.nodeType)" style="width:100%">
                  <el-option v-for="nt in NODE_TYPE_OPTIONS" :key="nt.value" :label="nt.label" :value="nt.value" />
                </el-select>
              </el-col>
              <el-col :span="9">
                <span style="font-size:12px;color:#606266">选择节点</span>
                <el-select v-model="ap.nodeId" size="small" filterable @change="onAccessNodeChange(idx, ap.nodeId)" style="width:100%">
                  <el-option v-for="n in getNodesByType(ap.nodeType)" :key="n.node_id" :label="n.node_name" :value="n.node_id" />
                </el-select>
              </el-col>
              <el-col :span="5">
                <span style="font-size:12px;color:#606266">接入容量(kW)</span>
                <el-input-number v-model="ap.connectedCapacity" :min="0" size="small" style="width:100%" />
              </el-col>
              <el-col :span="5">
                <span style="font-size:12px;color:#606266">电压等级(kV)</span>
                <el-input-number v-model="ap.voltageLevel" :min="0" size="small" style="width:100%" />
              </el-col>
            </el-row>
            <!-- 设备参数(按类型) -->
            <div v-if="ap.nodeId" style="margin-top:8px;padding:10px;background:#f5f7fa;border-radius:4px">
              <span style="font-size:12px;font-weight:600;color:#267F7B">{{ NODE_TYPE_OPTIONS.find(nt=>nt.value===ap.nodeType)?.label }}参数</span>
              <el-row :gutter="10" style="margin-top:4px">
                <template v-if="ap.nodeType === 'SOURCE'">
                  <el-col :span="6"><span style="font-size:11px;color:#909399">出力上限(%)</span><el-input-number v-model="ap.params.outputUpperLimit" :min="0" :max="100" size="small" style="width:100%" /></el-col>
                  <el-col :span="6"><span style="font-size:11px;color:#909399">出力下限(%)</span><el-input-number v-model="ap.params.outputLowerLimit" :min="0" :max="100" size="small" style="width:100%" /></el-col>
                  <el-col :span="6"><span style="font-size:11px;color:#909399">功率因数</span><el-input-number v-model="ap.params.powerFactor" :min="0.8" :max="1" :step="0.01" size="small" style="width:100%" /></el-col>
                  <el-col :span="6"><span style="font-size:11px;color:#909399">调节延迟(s)</span><el-input-number v-model="ap.params.regulationDelay" :min="0" :max="300" size="small" style="width:100%" /></el-col>
                </template>
                <template v-if="ap.nodeType === 'GRID'">
                  <el-col :span="12"><span style="font-size:11px;color:#909399">分接头自动调节</span><el-switch v-model="ap.params.tapRegulation" size="small" /></el-col>
                  <el-col :span="12"><span style="font-size:11px;color:#909399">无功补偿</span><el-switch v-model="ap.params.reactiveCompensation" size="small" /></el-col>
                </template>
                <template v-if="ap.nodeType === 'LOAD'">
                  <el-col :span="8"><span style="font-size:11px;color:#909399">削峰比例(%)</span><el-input-number v-model="ap.params.peakClippingRate" :min="0" :max="50" size="small" style="width:100%" /></el-col>
                  <el-col :span="8"><span style="font-size:11px;color:#909399">填谷比例(%)</span><el-input-number v-model="ap.params.valleyFillingRate" :min="0" :max="50" size="small" style="width:100%" /></el-col>
                  <el-col :span="8"><span style="font-size:11px;color:#909399">可中断比例(%)</span><el-input-number v-model="ap.params.interruptibleLoadRatio" :min="0" :max="30" size="small" style="width:100%" /></el-col>
                </template>
                <template v-if="ap.nodeType === 'STORAGE'">
                  <el-col :span="4"><span style="font-size:11px;color:#909399">额定功率(kW)</span><el-input-number v-model="ap.params.ratedPowerKw" :min="0" size="small" style="width:100%" /></el-col>
                  <el-col :span="4"><span style="font-size:11px;color:#909399">额定容量(kWh)</span><el-input-number v-model="ap.params.ratedCapacityKwh" :min="0" size="small" style="width:100%" /></el-col>
                  <el-col :span="3"><span style="font-size:11px;color:#909399">SOC上限(%)</span><el-input-number v-model="ap.params.socUpper" :min="50" :max="100" size="small" style="width:100%" /></el-col>
                  <el-col :span="3"><span style="font-size:11px;color:#909399">SOC下限(%)</span><el-input-number v-model="ap.params.socLower" :min="0" :max="50" size="small" style="width:100%" /></el-col>
                  <el-col :span="5"><span style="font-size:11px;color:#909399">充电时段</span><el-input v-model="ap.params.chargeSchedule" size="small" /></el-col>
                  <el-col :span="5"><span style="font-size:11px;color:#909399">放电时段</span><el-input v-model="ap.params.dischargeSchedule" size="small" /></el-col>
                </template>
              </el-row>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="协同规则" name="rules">
          <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:600">互动规则列表</span>
            <el-button size="small" type="primary" @click="formControlRules.push({ name: '', condition: '', action: '', priority: formControlRules.length + 1 })">添加规则</el-button>
          </div>
          <div v-for="(rule, idx) in formControlRules" :key="idx" style="padding:12px;margin-bottom:8px;background:#fafafa;border-radius:4px;border:1px solid #f0f0f0">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-weight:600;font-size:13px">规则 {{ idx + 1 }}</span>
              <el-button size="small" link type="danger" @click="formControlRules.splice(idx, 1)">删除</el-button>
            </div>
            <el-row :gutter="12">
              <el-col :span="8">
                <span style="font-size:12px;color:#606266">规则名称</span>
                <el-input v-model="rule.name" size="small" placeholder="如：光伏超发储能充电" />
              </el-col>
              <el-col :span="8">
                <span style="font-size:12px;color:#606266">触发条件</span>
                <el-input v-model="rule.condition" size="small" placeholder="如：光伏出力 > 80%" />
              </el-col>
              <el-col :span="5">
                <span style="font-size:12px;color:#606266">执行动作</span>
                <el-input v-model="rule.action" size="small" placeholder="如：启动储能充电" />
              </el-col>
              <el-col :span="3">
                <span style="font-size:12px;color:#606266">优先级</span>
                <el-input-number v-model="rule.priority" :min="1" :max="99" size="small" style="width:100%" />
              </el-col>
            </el-row>
          </div>
          <el-divider />
          <div style="font-size:13px;font-weight:600;margin-bottom:8px">关联数据源</div>
          <el-form label-position="top" size="small">
            <el-form-item label="数据源类型">
              <el-radio-group v-model="formDataSource.type">
                <el-radio value="realtime">实时数据</el-radio>
                <el-radio value="history">历史数据</el-radio>
                <el-radio value="hybrid">混合(实时+历史)</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="关联数据类别">
              <el-checkbox-group v-model="formDataSource.dataTypes">
                <el-checkbox label="pv_output">光伏出力数据</el-checkbox>
                <el-checkbox label="load">负荷数据</el-checkbox>
                <el-checkbox label="voltage">电压数据</el-checkbox>
                <el-checkbox label="frequency">频率数据</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="网架图编辑" name="topology">
          <GridEditorTab
            v-if="topologyTabSeen"
            :config="buildConfig()"
            :nodes-by-type="nodesByType"
            @update:topology="onTopologyUpdate"
          />
        </el-tab-pane>
      </el-tabs>

      <!-- 实时预览 -->
      <div v-if="formAccessPoints.length > 0" style="margin-top:16px;border-top:1px solid #ebeef5;padding-top:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#303133">实时预览</div>
        <div v-loading="editPreviewing" style="min-height:60px">
          <template v-if="editPreviewData && !editPreviewing">
            <el-row :gutter="12">
              <el-col :span="6">
                <div style="padding:8px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:18px;font-weight:600" :style="{color: editPreviewData.indicators.voltage.status === '越限' ? '#f56c6c' : '#303133'}">
                    {{ editPreviewData.indicators.voltage.min }}~{{ editPreviewData.indicators.voltage.max }}
                  </div>
                  <div style="font-size:11px;color:#909399">电压范围 (kV)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div style="padding:8px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:18px;font-weight:600" :style="{color: editPreviewData.indicators.frequency.status === '越限' ? '#f56c6c' : '#303133'}">
                    {{ editPreviewData.indicators.frequency.avg }}
                  </div>
                  <div style="font-size:11px;color:#909399">频率 (Hz)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div style="padding:8px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:18px;font-weight:600" :style="{color: editPreviewData.indicators.loadRate.status === '越限' ? '#f56c6c' : '#303133'}">
                    {{ editPreviewData.indicators.loadRate.peak }}%
                  </div>
                  <div style="font-size:11px;color:#909399">峰值负载率</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div style="padding:8px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:18px;font-weight:600" :style="{color: editPreviewData.indicators.consumptionRate.status === '偏低' ? '#e6a23c' : '#303133'}">
                    {{ editPreviewData.indicators.consumptionRate.value }}%
                  </div>
                  <div style="font-size:11px;color:#909399">消纳率</div>
                </div>
              </el-col>
            </el-row>
          </template>
          <div v-else-if="!editPreviewing" style="text-align:center;padding:16px;color:#c0c4cc;font-size:12px">
            预览结果将在此显示
          </div>
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="save">{{ editingId ? '更新' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="场景详情" width="700px">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称" :span="2">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ typeOptions.find(t => t.value === detail.type)?.label }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status === 'active' ? '已发布' : '草稿' }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
          <el-descriptions-item label="标签" :span="2">
            <el-tag v-for="tag in (detail.tags || [])" :key="tag" size="small" style="margin-right:4px">{{ tag }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="detail.config?.accessPoints?.length" style="margin-top:12px;font-size:13px;font-weight:600">接入点配置</div>
        <el-table v-if="detail.config?.accessPoints?.length" :data="detail.config.accessPoints" stripe size="small" style="margin-top:8px">
          <el-table-column label="类型" width="110"><template #default="{ row }">{{ NODE_TYPE_OPTIONS.find(nt => nt.value === row.nodeType)?.label || row.nodeType }}</template></el-table-column>
          <el-table-column prop="nodeName" label="节点名称" min-width="140" show-overflow-tooltip />
          <el-table-column label="接入容量(kW)" width="110"><template #default="{ row }">{{ row.connectedCapacity }}</template></el-table-column>
          <el-table-column label="电压等级(kV)" width="100"><template #default="{ row }">{{ row.voltageLevel }}</template></el-table-column>
        </el-table>
        <div v-if="detail.config?.controlRules?.length" style="margin-top:12px;font-size:13px;font-weight:600">协同规则</div>
        <el-table v-if="detail.config?.controlRules?.length" :data="detail.config.controlRules" stripe size="small" style="margin-top:8px">
          <el-table-column prop="name" label="规则名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="condition" label="触发条件" min-width="120" show-overflow-tooltip />
          <el-table-column prop="action" label="执行动作" min-width="120" show-overflow-tooltip />
          <el-table-column prop="priority" label="优先级" width="70" align="center" />
        </el-table>
      </template>
    </el-dialog>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewVisible" title="场景预览" width="900px" @opened="runPreview">
      <template v-if="previewScenario">
        <div style="margin-bottom:12px;display:flex;gap:16px;align-items:center">
          <span style="font-size:14px;font-weight:600">{{ previewScenario.name }}</span>
          <el-tag size="small">{{ typeOptions.find(t => t.value === previewScenario.type)?.label || previewScenario.type }}</el-tag>
          <el-tag :type="previewScenario.status === 'active' ? 'success' : 'warning'" size="small">{{ previewScenario.status === 'active' ? '已发布' : '草稿' }}</el-tag>
        </div>

        <!-- 网架图 -->
        <div style="margin-bottom:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">网架拓扑</div>
          <PreviewTopology v-if="previewScenario.config?.topology?.nodes?.length" :topology="previewScenario.config.topology" />
          <div v-else-if="previewScenario.config?.accessPoints?.length" style="font-size:12px;color:#909399;padding:20px;text-align:center;background:#fafafa;border:1px solid #e0e0e0;border-radius:4px">
            旧版场景（无网架图数据），{{ previewScenario.config.accessPoints.length }} 个接入点
          </div>
          <div v-else style="font-size:12px;color:#c0c4cc;padding:20px;text-align:center;background:#fafafa;border:1px solid #e0e0e0;border-radius:4px">
            无拓扑数据
          </div>
        </div>

        <el-divider style="margin:12px 0" />

        <!-- 仿真结果 -->
        <div v-loading="previewing" style="min-height:80px">
          <div v-if="!previewData && !previewing" style="text-align:center;padding:20px;color:#909399">
            <el-button type="primary" size="small" @click="runPreview">开始仿真预览</el-button>
          </div>
          <template v-if="previewData && !previewing">
            <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px">
              <span :style="{color: previewData.overallStatus === '正常' ? '#67c23a' : previewData.overallStatus === '关注' ? '#e6a23c' : '#f56c6c', fontWeight: 600, fontSize: 14}">{{ previewData.overallStatus }}</span>
              <el-button size="small" @click="runPreview">刷新</el-button>
            </div>
            <el-row :gutter="12">
              <el-col :span="6">
                <div style="padding:10px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:24px;font-weight:600" :style="{color: previewData.indicators.voltage.status === '越限' ? '#f56c6c' : '#303133'}">
                    {{ previewData.indicators.voltage.min }}~{{ previewData.indicators.voltage.max }}
                  </div>
                  <div style="font-size:11px;color:#909399">电压范围 (kV)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div style="padding:10px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:24px;font-weight:600" :style="{color: previewData.indicators.frequency.status === '越限' ? '#f56c6c' : '#303133'}">
                    {{ previewData.indicators.frequency.avg }}
                  </div>
                  <div style="font-size:11px;color:#909399">频率 (Hz)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div style="padding:10px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:24px;font-weight:600" :style="{color: previewData.indicators.loadRate.status === '越限' ? '#f56c6c' : '#303133'}">
                    {{ previewData.indicators.loadRate.peak }}%
                  </div>
                  <div style="font-size:11px;color:#909399">峰值负载率</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div style="padding:10px;background:#fafafa;border-radius:4px;text-align:center">
                  <div style="font-size:24px;font-weight:600" :style="{color: previewData.indicators.consumptionRate.status === '偏低' ? '#e6a23c' : '#303133'}">
                    {{ previewData.indicators.consumptionRate.value }}%
                  </div>
                  <div style="font-size:11px;color:#909399">消纳率</div>
                </div>
              </el-col>
            </el-row>
            <div v-if="previewData.violations.length" style="margin-top:12px">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px">越限告警</div>
              <div v-for="(v, i) in previewData.violations" :key="i" style="padding:6px 10px;margin-bottom:4px;background:#fef0f0;border-radius:4px;font-size:12px;color:#f56c6c">{{ v.detail }}</div>
            </div>
            <div v-if="previewData.suggestions.length" style="margin-top:12px">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px">优化建议</div>
              <div v-for="(s, i) in previewData.suggestions" :key="i" style="padding:4px 10px;margin-bottom:2px;font-size:12px;color:#606266">· {{ s }}</div>
            </div>
          </template>
        </div>
      </template>
    </el-dialog>

    <!-- 版本历史对话框 -->
    <el-dialog v-model="versionsVisible" title="版本历史" width="700px">
      <div style="margin-bottom:10px;font-size:12px;color:#606266">
        版本保留上限：<strong>{{ versionsScenarioData?.version_limit ?? 10 }}</strong> 个 | 当前已保存 <strong>{{ versions.length }}</strong> 个版本
      </div>
      <el-table :data="versions" stripe size="small">
        <el-table-column prop="version_number" label="版本号" width="80" />
        <el-table-column label="变更说明" min-width="160"><template #default="{ row }">{{ row.changelog }}</template></el-table-column>
        <el-table-column prop="created_by" label="操作人" width="120" />
        <el-table-column prop="created_at" label="操作时间" width="155" />
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="restore(versionsScenarioId, row.id)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>
