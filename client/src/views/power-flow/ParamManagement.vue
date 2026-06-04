<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchCurveTemplates, createCurveTemplate, updateCurveTemplate, deleteCurveTemplate, rollbackCurveTemplate, fetchCurveTemplateVersionHistory,
  fetchConfidenceSettings, createConfidenceSetting, updateConfidenceSetting, deleteConfidenceSetting, rollbackConfidenceSetting, fetchConfidenceSettingVersionHistory,
  fetchStationModels, createStationModel, updateStationModel, deleteStationModel, rollbackStationModel, exportStationModels, fetchStationModelVersionHistory,
  type CurveTemplate, type ConfidenceSetting, type StationModelParam,
} from '@/api/model-params'
import * as echarts from 'echarts'

// ==================== 出力曲线模板 ====================
const templates = ref<CurveTemplate[]>([])
const selectedWeather = ref('sunny')
const selectedTemplate = ref<CurveTemplate | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
const showTemplateDialog = ref(false)
const editingTemplate = ref<CurveTemplate | null>(null)
const templateForm = ref({ name: '', weatherType: 'custom' as string, coefficients: Array(24).fill(0), description: '' })

const filteredTemplates = computed(() =>
  templates.value.filter(t => t.weather_type === selectedWeather.value)
)

async function loadTemplates() {
  const { data } = await fetchCurveTemplates()
  templates.value = data.data
  selectWeatherTemplate()
}

function selectWeatherTemplate() {
  const found = filteredTemplates.value[0]
  selectedTemplate.value = found || null
  if (found) renderCurveChart(JSON.parse(found.coefficients))
  else renderCurveChart(Array(24).fill(0))
}

watch(selectedWeather, () => selectWeatherTemplate())

function renderCurveChart(coefficients: number[]) {
  if (!chartContainer.value) return
  if (!chartInstance) chartInstance = echarts.init(chartContainer.value)
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', max: 1.1, axisLabel: { fontSize: 10 } },
    series: [{ data: coefficients, type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, lineStyle: { color: '#267F7B' }, itemStyle: { color: '#267F7B' } }],
  })
}

function handleAddTemplate() {
  editingTemplate.value = null
  templateForm.value = { name: '', weatherType: 'custom', coefficients: Array(24).fill(0), description: '' }
  showTemplateDialog.value = true
}

function handleEditTemplate(row: CurveTemplate) {
  editingTemplate.value = row
  templateForm.value = {
    name: row.name, weatherType: row.weather_type,
    coefficients: JSON.parse(row.coefficients),
    description: row.description || '',
  }
  showTemplateDialog.value = true
}

async function handleSaveTemplate() {
  try {
    if (editingTemplate.value) {
      await updateCurveTemplate(editingTemplate.value.id, templateForm.value)
      ElMessage.success('模板已更新')
    } else {
      await createCurveTemplate(templateForm.value)
      ElMessage.success('模板已创建')
    }
    showTemplateDialog.value = false
    await loadTemplates()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function handleDeleteTemplate(row: CurveTemplate) {
  try {
    await ElMessageBox.confirm('确定删除该模板？', '确认删除', { type: 'warning' })
    await deleteCurveTemplate(row.id)
    ElMessage.success('模板已删除')
    await loadTemplates()
  } catch { /* cancelled */ }
}

// ==================== 置信系数设置 ====================
const confidenceList = ref<ConfidenceSetting[]>([])
const confidenceForm = ref({ confidenceLevel: 0.95, distributionType: 'normal', name: '', description: '' })
const generateLoading = ref(false)

async function loadConfidenceSettings() {
  const { data } = await fetchConfidenceSettings()
  confidenceList.value = data.data
}

function computePdfParams() {
  const level = confidenceForm.value.confidenceLevel
  const dtype = confidenceForm.value.distributionType
  let pdfParams: any = {}
  if (dtype === 'normal') {
    const zMap: Record<number, number> = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 }
    const z = zMap[level] || 1.96
    pdfParams = { mu: 1.0, sigma: Math.round((0.1 * (1.96 / z)) * 1000) / 1000 }
  } else if (dtype === 'beta') {
    pdfParams = { alpha: 5, beta: Math.round(5 * (1 - level) * 10) / 10 + 0.25 }
  } else if (dtype === 'weibull') {
    pdfParams = { k: 2.5, lambda: Math.round((1 + (1 - level) * 2) * 100) / 100 }
  }
  return pdfParams
}

async function handleGenerateConfidence() {
  generateLoading.value = true
  try {
    const pdfParams = computePdfParams()
    const payload = {
      name: confidenceForm.value.name || `${confidenceForm.value.distributionType}_${confidenceForm.value.confidenceLevel}`,
      confidenceLevel: confidenceForm.value.confidenceLevel,
      distributionType: confidenceForm.value.distributionType,
      pdfParams,
      description: confidenceForm.value.description,
    }
    await createConfidenceSetting(payload)
    ElMessage.success('置信配置已生成')
    await loadConfidenceSettings()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  } finally {
    generateLoading.value = false
  }
}

async function handleDeleteConfidence(row: ConfidenceSetting) {
  try {
    await ElMessageBox.confirm('确定删除该配置？', '确认删除', { type: 'warning' })
    await deleteConfidenceSetting(row.id)
    ElMessage.success('已删除')
    await loadConfidenceSettings()
  } catch { /* cancelled */ }
}

async function handleSetActive(row: ConfidenceSetting) {
  await updateConfidenceSetting(row.id, { ...row, pdfParams: JSON.parse(row.pdf_params), isActive: true })
  ElMessage.success('已设为活跃配置')
  await loadConfidenceSettings()
}

// ==================== 版本历史弹窗（通用） ====================
const showVersionDialog = ref(false)
const versionList = ref<any[]>([])
const versionDialogTitle = ref('')
const versionRootId = ref('')
const versionType = ref<'station' | 'curve' | 'confidence'>('station')

async function loadVersionHistory(rootId: string, type: 'station' | 'curve' | 'confidence') {
  versionRootId.value = rootId
  versionType.value = type
  try {
    let res: any
    if (type === 'station') res = await fetchStationModelVersionHistory(rootId)
    else if (type === 'curve') res = await fetchCurveTemplateVersionHistory(rootId)
    else res = await fetchConfidenceSettingVersionHistory(rootId)
    versionList.value = res.data.data || []
    versionDialogTitle.value = `版本历史 (共${versionList.value.length}个版本)`
  } catch {
    versionList.value = []
  }
  showVersionDialog.value = true
}

async function handleRollback(row: any) {
  try {
    await ElMessageBox.confirm(`确定回退到版本 ${row.version}？当前活跃版本将被替换。`, '确认回退', { type: 'warning' })
    if (versionType.value === 'station') await rollbackStationModel(row.id)
    else if (versionType.value === 'curve') await rollbackCurveTemplate(row.id)
    else if (versionType.value === 'confidence') await rollbackConfidenceSetting(row.id)
    ElMessage.success('版本已回退')
    showVersionDialog.value = false
    loadStationModels()
    loadTemplates()
    loadConfidenceSettings()
  } catch { /* cancelled */ }
}

// ==================== 集中式光伏电站模型参数 ====================
const stationList = ref<StationModelParam[]>([])
const stationLoading = ref(false)
const stationPage = ref(1)
const stationPageSize = ref(10)
const stationTotal = ref(0)
const showStationDialog = ref(false)
const editingStation = ref<StationModelParam | null>(null)
const stationSelectedIds = ref<string[]>([])

const stationForm = ref({
  modelName: '',
  ratedCapacityMw: undefined as number | undefined,
  ratedVoltageKv: undefined as number | undefined,
  powerFactor: undefined as number | undefined,
  efficiencyPct: undefined as number | undefined,
  shortCircuitRatio: undefined as number | undefined,
  mpptAlgorithm: 'P&O',
  powerLimitMode: '',
  rampRateLimit: undefined as number | undefined,
  lvrtEnabled: true,
  hvrtEnabled: false,
  islandProtection: true,
  designTempC: undefined as number | undefined,
  designIrradiance: undefined as number | undefined,
  designHumidityPct: undefined as number | undefined,
  altitudeM: undefined as number | undefined,
  soilingFactor: undefined as number | undefined,
  changeSummary: '',
})

function resetStationForm() {
  stationForm.value = {
    modelName: '', ratedCapacityMw: undefined, ratedVoltageKv: undefined,
    powerFactor: undefined, efficiencyPct: undefined, shortCircuitRatio: undefined,
    mpptAlgorithm: 'P&O', powerLimitMode: '', rampRateLimit: undefined,
    lvrtEnabled: true, hvrtEnabled: false, islandProtection: true,
    designTempC: undefined, designIrradiance: undefined, designHumidityPct: undefined,
    altitudeM: undefined, soilingFactor: undefined, changeSummary: '',
  }
}

async function loadStationModels() {
  stationLoading.value = true
  try {
    const { data } = await fetchStationModels({ page: stationPage.value, pageSize: stationPageSize.value })
    const result = data.data
    if (result && result.rows) {
      stationList.value = result.rows
      stationTotal.value = result.total
    } else {
      // 兼容不分页返回
      stationList.value = Array.isArray(result) ? result : (result?.rows || [])
      stationTotal.value = stationList.value.length
    }
  } finally {
    stationLoading.value = false
  }
}

function onStationPageChange(page: number) {
  stationPage.value = page
  loadStationModels()
}

function onStationPageSizeChange(size: number) {
  stationPageSize.value = size
  stationPage.value = 1
  loadStationModels()
}

async function handleDeleteStation(row: StationModelParam) {
  try {
    await ElMessageBox.confirm(`确定删除模型「${row.model_name}」？`, '确认删除', { type: 'warning' })
    await deleteStationModel(row.id)
    ElMessage.success('已删除')
    await loadStationModels()
  } catch { /* cancelled */ }
}

function handleAddStation() {
  editingStation.value = null
  resetStationForm()
  showStationDialog.value = true
}

function handleEditStation(row: StationModelParam) {
  editingStation.value = row
  stationForm.value = {
    modelName: row.model_name, ratedCapacityMw: row.rated_capacity_mw,
    ratedVoltageKv: row.rated_voltage_kv, powerFactor: row.power_factor,
    efficiencyPct: row.efficiency_pct, shortCircuitRatio: row.short_circuit_ratio,
    mpptAlgorithm: row.mppt_algorithm, powerLimitMode: row.power_limit_mode,
    rampRateLimit: row.ramp_rate_limit, lvrtEnabled: !!row.lvrt_enabled,
    hvrtEnabled: !!row.hvrt_enabled, islandProtection: !!row.island_protection,
    designTempC: row.design_temp_c, designIrradiance: row.design_irradiance,
    designHumidityPct: row.design_humidity_pct, altitudeM: row.altitude_m,
    soilingFactor: row.soiling_factor, changeSummary: '',
  }
  showStationDialog.value = true
}

async function handleSaveStation() {
  const payload = { ...stationForm.value }
  try {
    if (editingStation.value) {
      await updateStationModel(editingStation.value.id, payload)
      ElMessage.success('电站模型已更新')
    } else {
      await createStationModel(payload)
      ElMessage.success('电站模型已创建')
    }
    showStationDialog.value = false
    await loadStationModels()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function handleStationExport() {
  const ids = stationSelectedIds.value.length > 0 ? stationSelectedIds.value : []
  try {
    const { data } = await exportStationModels(ids)
    const json = JSON.stringify(data.data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'station_model_params.json'; a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  loadTemplates()
  loadConfidenceSettings()
  loadStationModels()
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">参数管理</div>
    <!-- 集中式光伏电站模型参数 -->
    <div class="chart-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span class="chart-panel-title" style="margin-bottom:0">集中式光伏电站模型</span>
        <div style="display:flex;gap:8px">
          <el-button type="primary" size="small" @click="handleAddStation">新增模型</el-button>
          <el-button size="small" @click="handleStationExport">批量导出</el-button>
        </div>
      </div>
      <el-table :data="stationList" v-loading="stationLoading" stripe size="small" @selection-change="(rows: StationModelParam[]) => stationSelectedIds = rows.map(r => r.id)">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="model_name" label="模型名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="version" label="版本" width="60" />
        <el-table-column label="额定容量(MW)" width="110">
          <template #default="{ row }">{{ row.rated_capacity_mw ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="额定电压(kV)" width="110">
          <template #default="{ row }">{{ row.rated_voltage_kv ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="效率(%)" width="80">
          <template #default="{ row }">{{ row.efficiency_pct ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="MPPT" width="80">
          <template #default="{ row }">{{ row.mppt_algorithm }}</template>
        </el-table-column>
        <el-table-column label="功率限制模式" width="110">
          <template #default="{ row }">{{ row.power_limit_mode || '-' }}</template>
        </el-table-column>
        <el-table-column label="LVRT" width="60">
          <template #default="{ row }">{{ row.lvrt_enabled ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="防孤岛" width="70">
          <template #default="{ row }">{{ row.island_protection ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleEditStation(row)">编辑</el-button>
            <el-button size="small" link type="primary" @click="loadVersionHistory(row.root_id, 'station')">版本历史</el-button>
            <el-button size="small" link type="danger" @click="handleDeleteStation(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <el-pagination
          v-model:current-page="stationPage"
          v-model:page-size="stationPageSize"
          :page-sizes="[10, 20, 50]"
          :total="stationTotal"
          layout="total, sizes, prev, pager, next"
          size="small"
          @current-change="onStationPageChange"
          @size-change="onStationPageSizeChange"
        />
      </div>
    </div>

    <div class="grid-2">
      <!-- 面板2：出力曲线模板配置 -->
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span class="chart-panel-title" style="margin-bottom:0">出力曲线模板</span>
          <el-button size="small" @click="handleAddTemplate">新建模板</el-button>
        </div>
        <el-radio-group v-model="selectedWeather" size="small">
          <el-radio-button value="sunny">晴天</el-radio-button>
          <el-radio-button value="cloudy">多云</el-radio-button>
          <el-radio-button value="rainy">雨天</el-radio-button>
          <el-radio-button value="custom">自定义</el-radio-button>
        </el-radio-group>
        <div ref="chartContainer" style="height:200px;margin-top:8px"></div>
        <div v-if="filteredTemplates.length" style="margin-top:8px">
          <div v-for="t in filteredTemplates" :key="t.id" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;border-bottom:1px solid #ebeef5">
            <span>{{ t.name }}{{ t.is_preset ? ' (预设)' : '' }}</span>
            <span v-if="!t.is_preset">
              <el-button size="small" link type="primary" @click="loadVersionHistory(t.root_id || t.id, 'curve')">历史</el-button>
              <el-button size="small" link type="primary" @click="handleEditTemplate(t)">编辑</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteTemplate(t)">删除</el-button>
            </span>
          </div>
        </div>
      </div>

      <!-- 面板3：置信系数设置 -->
      <div class="chart-panel">
        <div class="chart-panel-title">置信系数设置</div>
        <el-form size="small" label-width="80px">
          <el-form-item label="置信水平">
            <el-input-number v-model="confidenceForm.confidenceLevel" :min="0.01" :max="0.99" :step="0.01" />
          </el-form-item>
          <el-form-item label="分布类型">
            <el-select v-model="confidenceForm.distributionType" style="width:100%">
              <el-option label="正态分布" value="normal" />
              <el-option label="Beta分布" value="beta" />
              <el-option label="Weibull分布" value="weibull" />
            </el-select>
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="confidenceForm.name" placeholder="可选" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="generateLoading" @click="handleGenerateConfidence">生成概率密度函数</el-button>
          </el-form-item>
        </el-form>
        <div v-if="confidenceList.length" style="margin-top:8px">
          <div v-for="c in confidenceList" :key="c.id" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;border-bottom:1px solid #ebeef5">
            <span>{{ c.name || '-' }} ({{ c.distribution_type }}, {{ c.confidence_level }})</span>
            <span>
              <el-tag v-if="c.is_active" type="success" size="small">当前</el-tag>
              <el-button v-else size="small" link type="primary" @click="handleSetActive(c)">启用</el-button>
              <el-button size="small" link type="primary" @click="loadVersionHistory(c.root_id || c.id, 'confidence')">历史</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteConfidence(c)">删除</el-button>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 曲线模板编辑弹窗 -->
    <el-dialog :title="editingTemplate ? '编辑出力曲线模板' : '新建出力曲线模板'" v-model="showTemplateDialog" width="550px" @close="showTemplateDialog = false">
      <el-form :model="templateForm" label-width="80px" size="small">
        <el-form-item label="模板名称"><el-input v-model="templateForm.name" /></el-form-item>
        <el-form-item label="天气类型">
          <el-select v-model="templateForm.weatherType">
            <el-option label="晴天" value="sunny" />
            <el-option label="多云" value="cloudy" />
            <el-option label="雨天" value="rainy" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="templateForm.description" /></el-form-item>
        <el-form-item label="24h系数">
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;width:100%">
            <div v-for="(_, i) in templateForm.coefficients" :key="i" style="display:flex;align-items:center;gap:2px">
              <span style="font-size:11px;width:28px">{{ i }}h</span>
              <el-input-number v-model="templateForm.coefficients[i]" :min="0" :max="1" :step="0.05" size="small" style="width:100%" />
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTemplateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveTemplate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 电站模型编辑弹窗 -->
    <el-dialog :title="editingStation ? '编辑电站模型' : '新增电站模型'" v-model="showStationDialog" width="650px" @close="showStationDialog = false">
      <el-tabs>
        <el-tab-pane label="电气参数">
          <el-form :model="stationForm" label-width="120px" size="small">
            <el-row :gutter="16">
              <el-col :span="12"><el-form-item label="模型名称"><el-input v-model="stationForm.modelName" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="额定容量(MW)"><el-input-number v-model="stationForm.ratedCapacityMw" :min="0" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12"><el-form-item label="额定电压(kV)"><el-input-number v-model="stationForm.ratedVoltageKv" :min="0" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="功率因数"><el-input-number v-model="stationForm.powerFactor" :min="0" :max="1" :step="0.01" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12"><el-form-item label="综合效率(%)"><el-input-number v-model="stationForm.efficiencyPct" :min="0" :max="100" :precision="1" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="短路比"><el-input-number v-model="stationForm.shortCircuitRatio" :min="0" :precision="1" style="width:100%" /></el-form-item></el-col>
            </el-row>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="控制参数">
          <el-form :model="stationForm" label-width="120px" size="small">
            <el-form-item label="MPPT算法">
              <el-select v-model="stationForm.mpptAlgorithm">
                <el-option label="P&O" value="P&O" />
                <el-option label="INC" value="INC" />
                <el-option label="恒压法" value="ConstantVoltage" />
              </el-select>
            </el-form-item>
            <el-form-item label="限功率模式">
              <el-select v-model="stationForm.powerLimitMode">
                <el-option label="无限制" value="" />
                <el-option label="固定限值" value="fixed" />
                <el-option label="调度指令" value="dispatch" />
                <el-option label="频率响应" value="frequency_response" />
              </el-select>
            </el-form-item>
            <el-form-item label="爬坡率(MW/min)"><el-input-number v-model="stationForm.rampRateLimit" :min="0" :precision="2" /></el-form-item>
            <el-row :gutter="16">
              <el-col :span="8"><el-form-item label="低压穿越"><el-switch v-model="stationForm.lvrtEnabled" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="高压穿越"><el-switch v-model="stationForm.hvrtEnabled" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="防孤岛保护"><el-switch v-model="stationForm.islandProtection" /></el-form-item></el-col>
            </el-row>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="环境参数">
          <el-form :model="stationForm" label-width="140px" size="small">
            <el-row :gutter="16">
              <el-col :span="12"><el-form-item label="设计温度(°C)"><el-input-number v-model="stationForm.designTempC" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="设计辐照度(W/m²)"><el-input-number v-model="stationForm.designIrradiance" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12"><el-form-item label="设计湿度(%)"><el-input-number v-model="stationForm.designHumidityPct" :min="0" :max="100" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="海拔(m)"><el-input-number v-model="stationForm.altitudeM" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="积灰系数"><el-input-number v-model="stationForm.soilingFactor" :min="0" :max="1" :step="0.01" /></el-form-item>
            <el-form-item v-if="editingStation" label="修改说明"><el-input v-model="stationForm.changeSummary" /></el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showStationDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveStation">保存</el-button>
      </template>
    </el-dialog>

    <!-- 版本历史弹窗 -->
    <el-dialog :title="versionDialogTitle" v-model="showVersionDialog" width="700px">
      <el-table :data="versionList" size="small" stripe max-height="400">
        <el-table-column prop="version" label="版本" width="60" />
        <el-table-column label="修改人" width="100">
          <template #default="{ row }">{{ row.modified_by || row.created_by || '-' }}</template>
        </el-table-column>
        <el-table-column label="修改说明" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.change_summary || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ row.created_at }}</template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.is_active" type="success" size="small">当前</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button v-if="!row.is_active" size="small" link type="primary" @click="handleRollback(row)">回退</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>
