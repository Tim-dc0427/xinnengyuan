<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchModels, createModel, updateModel, deleteModel, toggleModelStatus, hardDeleteModel } from '@/api/resource'
import type { ResourceModelType } from '@new-energy/shared'

const activeTab = ref<ResourceModelType>('PV_ABSORPTION')
const models = ref<any[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('')
const editingModelId = ref<string | null>(null)
const form = ref({
  modelName: '',
  plantId: '',
  description: '',
  // PV_ABSORPTION
  installedCapacityMw: 0,
  gridVoltageKv: 10,
  inverterPowerKw: 0,
  activePowerLimitMw: 0,
  curtailmentPriority: 'guaranteed',
  nMinus1Enabled: true,
  loadProfile: [] as Array<{ time: string; loadMw: number }>,
  minThermalOutputMw: 0,
  transmissionLimitMw: 0,
  // PV_OUTPUT
  ratedPowerKw: 0,
  panelType: 'monocrystalline',
  tempCoefficientPct: -0.35,
  mpptAlgorithm: 'pno',
  powerLimitEnabled: false,
  rampRateLimitKwMin: 10,
  weatherApiEnabled: true,
  inverterProtocol: 'modbus',
  forecastFormat: 'json',
  // CAPACITY
  transformerCapacityKva: 0,
  lineAmpacityA: 0,
  overloadThresholdPct: 120,
  loadBalancingMode: 'active',
  demandResponseEnabled: false,
  scadaEnabled: true,
  loadForecastEnabled: true,
  topologyFormat: 'cim',
  // STORAGE
  ratedCapacityKwh: 0,
  efficiencyPct: 95,
  chargeMode: 'peakShaving',
  socLimitPct: 20,
  gridSupportMode: 'none',
  bmsProtocol: 'modbus',
  pcsInterface: 'digital',
  sohReportFormat: 'json',
})

const tabLabelMap: Record<string, string> = {
  PV_ABSORPTION: '集中式光伏消纳模型',
  PV_OUTPUT: '光伏出力模型',
  CAPACITY: '承载力模型',
  STORAGE: '储能模型',
}

function paramsFromRow(row: any): Record<string, any> {
  if (typeof row.model_parameters === 'string') {
    try { return JSON.parse(row.model_parameters) } catch { return {} }
  }
  return row.model_parameters || {}
}

async function loadModels() {
  loading.value = true
  try {
    models.value = await fetchModels(activeTab.value)
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function openCreate() {
  dialogTitle.value = '新增' + (tabLabelMap[activeTab.value] || '模型')
  editingModelId.value = null
  form.value = {
    modelName: '', plantId: '', description: '',
    installedCapacityMw: 0, gridVoltageKv: 10, inverterPowerKw: 0,
    activePowerLimitMw: 0, curtailmentPriority: 'guaranteed', nMinus1Enabled: true,
    loadProfile: [], minThermalOutputMw: 0, transmissionLimitMw: 0,
    ratedPowerKw: 0, panelType: 'monocrystalline', tempCoefficientPct: -0.35,
    mpptAlgorithm: 'pno', powerLimitEnabled: false, rampRateLimitKwMin: 10,
    weatherApiEnabled: true, inverterProtocol: 'modbus', forecastFormat: 'json',
    transformerCapacityKva: 0, lineAmpacityA: 0,
    overloadThresholdPct: 120, loadBalancingMode: 'active', demandResponseEnabled: false,
    scadaEnabled: true, loadForecastEnabled: true, topologyFormat: 'cim',
    ratedCapacityKwh: 0, efficiencyPct: 95,
    chargeMode: 'peakShaving', socLimitPct: 20, gridSupportMode: 'none',
    bmsProtocol: 'modbus', pcsInterface: 'digital', sohReportFormat: 'json',
  }
  dialogVisible.value = true
}

function openEdit(row: any) {
  const id = row.id
  if (!id) {
    ElMessage.error('无法获取模型 ID')
    return
  }
  editingModelId.value = id
  dialogTitle.value = '编辑 - ' + (row.model_name || '模型')
  const p = paramsFromRow(row)
  form.value.modelName = row.model_name || ''
  form.value.plantId = row.plant_id || ''
  form.value.description = row.description || ''
  // PV_ABSORPTION
  form.value.installedCapacityMw = p.physicalCharacteristics?.installedCapacityMw || 0
  form.value.gridVoltageKv = p.physicalCharacteristics?.gridVoltageKv || 10
  form.value.inverterPowerKw = p.physicalCharacteristics?.inverterPowerKw || 0
  form.value.activePowerLimitMw = p.controlStrategy?.activePowerLimitMw || 0
  form.value.curtailmentPriority = p.controlStrategy?.curtailmentPriority || 'guaranteed'
  form.value.nMinus1Enabled = p.controlStrategy?.nMinus1Enabled ?? true
  form.value.loadProfile = p.interfaceParameters?.loadProfile || []
  form.value.minThermalOutputMw = p.interfaceParameters?.minThermalOutputMw || 0
  form.value.transmissionLimitMw = p.interfaceParameters?.transmissionLimitMw || 0
  // PV_OUTPUT
  form.value.ratedPowerKw = p.physicalCharacteristics?.ratedPowerKw || 0
  form.value.panelType = p.physicalCharacteristics?.panelType || 'monocrystalline'
  form.value.tempCoefficientPct = p.physicalCharacteristics?.tempCoefficientPct ?? -0.35
  form.value.mpptAlgorithm = p.controlStrategy?.mpptAlgorithm || 'pno'
  form.value.powerLimitEnabled = p.controlStrategy?.powerLimitEnabled ?? false
  form.value.rampRateLimitKwMin = p.controlStrategy?.rampRateLimitKwMin || 10
  form.value.weatherApiEnabled = p.interfaceParameters?.weatherApiEnabled ?? true
  form.value.inverterProtocol = p.interfaceParameters?.inverterProtocol || 'modbus'
  form.value.forecastFormat = p.interfaceParameters?.forecastFormat || 'json'
  // CAPACITY
  form.value.transformerCapacityKva = p.physicalCharacteristics?.transformerCapacityKva || 0
  form.value.lineAmpacityA = p.physicalCharacteristics?.lineAmpacityA || 0
  form.value.nMinus1Enabled = p.physicalCharacteristics?.nMinus1Enabled ?? true
  form.value.overloadThresholdPct = p.controlStrategy?.overloadThresholdPct || 120
  form.value.loadBalancingMode = p.controlStrategy?.loadBalancingMode || 'active'
  form.value.demandResponseEnabled = p.controlStrategy?.demandResponseEnabled ?? false
  form.value.scadaEnabled = p.interfaceParameters?.scadaEnabled ?? true
  form.value.loadForecastEnabled = p.interfaceParameters?.loadForecastEnabled ?? true
  form.value.topologyFormat = p.interfaceParameters?.topologyFormat || 'cim'
  // STORAGE
  form.value.ratedCapacityKwh = p.physicalCharacteristics?.ratedCapacityKwh || 0
  form.value.efficiencyPct = p.physicalCharacteristics?.efficiencyPct || 95
  form.value.chargeMode = p.controlStrategy?.chargeMode || 'peakShaving'
  form.value.socLimitPct = p.controlStrategy?.socLimitPct || 20
  form.value.gridSupportMode = p.controlStrategy?.gridSupportMode || 'none'
  form.value.bmsProtocol = p.interfaceParameters?.bmsProtocol || 'modbus'
  form.value.pcsInterface = p.interfaceParameters?.pcsInterface || 'digital'
  form.value.sohReportFormat = p.interfaceParameters?.sohReportFormat || 'json'
  dialogVisible.value = true
}

function buildParams(): Record<string, any> {
  const f = form.value
  if (activeTab.value === 'PV_ABSORPTION') {
    return {
      physicalCharacteristics: { installedCapacityMw: f.installedCapacityMw, gridVoltageKv: f.gridVoltageKv, inverterPowerKw: f.inverterPowerKw },
      controlStrategy: { activePowerLimitMw: f.activePowerLimitMw, curtailmentPriority: f.curtailmentPriority, nMinus1Enabled: f.nMinus1Enabled },
      interfaceParameters: { loadProfile: f.loadProfile, minThermalOutputMw: f.minThermalOutputMw, transmissionLimitMw: f.transmissionLimitMw },
    }
  }
  if (activeTab.value === 'PV_OUTPUT') {
    return {
      physicalCharacteristics: { ratedPowerKw: f.ratedPowerKw, panelType: f.panelType, tempCoefficientPct: f.tempCoefficientPct },
      controlStrategy: { mpptAlgorithm: f.mpptAlgorithm, powerLimitEnabled: f.powerLimitEnabled, rampRateLimitKwMin: f.rampRateLimitKwMin },
      interfaceParameters: { weatherApiEnabled: f.weatherApiEnabled, inverterProtocol: f.inverterProtocol, forecastFormat: f.forecastFormat },
    }
  }
  if (activeTab.value === 'CAPACITY') {
    return {
      physicalCharacteristics: { transformerCapacityKva: f.transformerCapacityKva, lineAmpacityA: f.lineAmpacityA, nMinus1Enabled: f.nMinus1Enabled },
      controlStrategy: { overloadThresholdPct: f.overloadThresholdPct, loadBalancingMode: f.loadBalancingMode, demandResponseEnabled: f.demandResponseEnabled },
      interfaceParameters: { scadaEnabled: f.scadaEnabled, loadForecastEnabled: f.loadForecastEnabled, topologyFormat: f.topologyFormat },
    }
  }
  // STORAGE
  return {
    physicalCharacteristics: { ratedCapacityKwh: f.ratedCapacityKwh, ratedPowerKw: f.ratedPowerKw, efficiencyPct: f.efficiencyPct },
    controlStrategy: { chargeMode: f.chargeMode, socLimitPct: f.socLimitPct, gridSupportMode: f.gridSupportMode },
    interfaceParameters: { bmsProtocol: f.bmsProtocol, pcsInterface: f.pcsInterface, sohReportFormat: f.sohReportFormat },
  }
}

async function handleSave() {
  if (!form.value.modelName.trim()) {
    ElMessage.warning('请输入模型名称')
    return
  }
  const payload = {
    modelName: form.value.modelName.trim(),
    modelType: activeTab.value,
    parameters: buildParams(),
    plantId: form.value.plantId || null,
    description: form.value.description || null,
  }
  const isEdit = !!editingModelId.value
  try {
    if (isEdit) {
      await updateModel(editingModelId.value!, payload as any)
      ElMessage.success('更新成功')
    } else {
      await createModel(payload as any)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadModels()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleToggleStatus(row: any) {
  const isActive = row.is_active === 1
  const action = isActive ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(
      `确认${action}模型"${row.model_name}"？`,
      `${action}确认`,
      { confirmButtonText: `确认${action}`, cancelButtonText: '取消', type: 'warning' }
    )
    const updated = await toggleModelStatus(row.id)
    if (updated) row.is_active = updated.is_active
    ElMessage.success(`模型已${action}`)
  } catch (e: any) {
    if (e === 'cancel') return
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleHardDelete(row: any) {
  try {
    const { value } = await ElMessageBox.prompt(
      `请输入模型名称"${row.model_name}"以确认硬删除。此操作不可恢复。`,
      '硬删除确认',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning', inputPlaceholder: '输入模型名称确认' }
    )
    if (value !== row.model_name) {
      ElMessage.warning('名称不匹配，操作已取消')
      return
    }
    const res = await hardDeleteModel(row.id)
    if (res?.code === 200) {
      ElMessage.success('模型已彻底删除')
    } else {
      ElMessage.error(res?.message || '删除失败')
    }
    await loadModels()
  } catch (e: any) {
    if (e === 'cancel') return
    ElMessage.error(e?.message || '删除失败')
  }
}

const panelLabel: Record<string, string> = { monocrystalline: '单晶硅', polycrystalline: '多晶硅', thinFilm: '薄膜' }
const mpptLabel: Record<string, string> = { pno: '扰动观察法', incCond: '电导增量法', constantVoltage: '恒压法' }
const balanceLabel: Record<string, string> = { active: '主动均衡', passive: '被动均衡', off: '关闭' }
const chargeLabel: Record<string, string> = { peakShaving: '削峰填谷', freqRegulation: '频率调节', backup: '备用电源' }
const gridLabel: Record<string, string> = { inertia: '惯性支撑', primaryFreq: '一次调频', none: '无' }
const priorityLabel: Record<string, string> = { guaranteed: '保障性', market: '市场化', competitive: '竞价' }

const gap = '<span class="dim-gap">|</span>'
function tag(label: string, v: string | number, suffix = '') { return `<span class="dim-tag">${label}${v}${suffix}</span>` }
function tagBool(label: string, v: boolean) { return `<span class="dim-tag">${label}:${v ? '开启' : '关闭'}</span>` }
function tagSelect(v: string, map: Record<string, string>) { return `<span class="dim-tag">${map[v] || v}</span>` }

function fmtPhysical(row: any): string {
  const pc = (paramsFromRow(row).physicalCharacteristics || {}) as Record<string, any>
  if (pc.installedCapacityMw !== undefined) return tag('装机容量', pc.installedCapacityMw, 'MW') + gap + tag('并网电压', pc.gridVoltageKv, 'kV') + gap + tag('逆变器功率', pc.inverterPowerKw, 'kW')
  if (pc.ratedPowerKw !== undefined && pc.panelType) return tag('额定功率', pc.ratedPowerKw, 'kW') + gap + tagSelect(pc.panelType, panelLabel) + gap + tag('温度系数', pc.tempCoefficientPct, '%/°C')
  if (pc.transformerCapacityKva !== undefined) return tag('变压器容量', pc.transformerCapacityKva, 'kVA') + gap + tag('线路载流量', pc.lineAmpacityA, 'A') + gap + tagBool('N-1', pc.nMinus1Enabled)
  if (pc.ratedCapacityKwh !== undefined) return tag('额定容量', pc.ratedCapacityKwh, 'kWh') + gap + tag('额定功率', pc.ratedPowerKw, 'kW') + gap + tag('充放电效率', pc.efficiencyPct, '%')
  return '-'
}

function fmtControl(row: any): string {
  const cs = (paramsFromRow(row).controlStrategy || {}) as Record<string, any>
  if (cs.activePowerLimitMw !== undefined) return tag('有功出力', cs.activePowerLimitMw, 'MW') + gap + tagSelect(cs.curtailmentPriority, priorityLabel) + gap + tagBool('N-1校核', cs.nMinus1Enabled)
  if (cs.mpptAlgorithm) return tagSelect(cs.mpptAlgorithm, mpptLabel) + gap + tagBool('功率限制', cs.powerLimitEnabled) + gap + tag('爬坡率限制', cs.rampRateLimitKwMin, 'kW/min')
  if (cs.loadBalancingMode) return tag('过载保护定值', cs.overloadThresholdPct, '%') + gap + tagSelect(cs.loadBalancingMode, balanceLabel) + gap + tagBool('需求响应', cs.demandResponseEnabled)
  if (cs.chargeMode) return tagSelect(cs.chargeMode, chargeLabel) + gap + tag('SOC保护定值', cs.socLimitPct, '%') + gap + tagSelect(cs.gridSupportMode, gridLabel)
  return '-'
}

function fmtInterface(row: any): string {
  const ip = (paramsFromRow(row).interfaceParameters || {}) as Record<string, any>
  if (ip.loadProfile) { const len = Array.isArray(ip.loadProfile) ? ip.loadProfile.length : 0; return tag('负荷曲线', len, '时段') + gap + tag('火电最小出力', ip.minThermalOutputMw, 'MW') + gap + tag('断面限额', ip.transmissionLimitMw, 'MW') }
  if (ip.inverterProtocol) return tagBool('气象数据接口', ip.weatherApiEnabled) + gap + tag('逆变器协议', ip.inverterProtocol) + gap + tag('预测格式', ip.forecastFormat)
  if (ip.topologyFormat) return tagBool('SCADA接口', ip.scadaEnabled) + gap + tagBool('负荷预测输入', ip.loadForecastEnabled) + gap + tag('拓扑格式', ip.topologyFormat)
  if (ip.bmsProtocol) return tag('BMS协议', ip.bmsProtocol) + gap + tag('PCS接口', ip.pcsInterface) + gap + tag('SOH格式', ip.sohReportFormat)
  return '-'
}
const csvInput = ref<HTMLInputElement | null>(null)
function handleCsvUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    const lines = text.split(/\r?\n/).filter(Boolean)
    const profile: Array<{ time: string; loadMw: number }> = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols.length >= 2) {
        const t = cols[0].trim()
        const v = parseFloat(cols[1])
        if (t && !isNaN(v)) profile.push({ time: t, loadMw: v })
      }
    }
    if (profile.length > 0) {
      form.value.loadProfile = profile
      ElMessage.success(`已导入 ${profile.length} 时段负荷数据`)
    } else {
      ElMessage.warning('未解析到有效数据，请检查CSV格式（time,loadMw）')
    }
  }
  reader.readAsText(file)
}
onMounted(() => { loadModels() })
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">资源模型构建</div>

    <div style="margin-bottom: 12px;">
      <el-radio-group v-model="activeTab" @change="loadModels">
        <el-radio-button v-for="(label, type) in tabLabelMap" :key="type" :value="type">{{ label }}</el-radio-button>
      </el-radio-group>
    </div>

    <div style="margin-bottom: 12px; display: flex; gap: 12px;">
      <el-button type="primary" @click="openCreate">新增模型</el-button>
    </div>

    <el-table :data="models" stripe v-loading="loading">
      <el-table-column prop="model_name" label="模型名称" min-width="140" />
      <el-table-column label="模型类型" width="150">
        <template #default="{ row }">
          <el-tag size="small">{{ tabLabelMap[row.model_type] || row.model_type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="物理特性" min-width="180">
        <template #default="{ row }"><span v-html="fmtPhysical(row)" /></template>
      </el-table-column>
      <el-table-column label="控制策略" min-width="180">
        <template #default="{ row }"><span v-html="fmtControl(row)" /></template>
      </el-table-column>
      <el-table-column label="接口参数" min-width="180">
        <template #default="{ row }"><span v-html="fmtInterface(row)" /></template>
      </el-table-column>
      <el-table-column label="版本" width="60" prop="version" />
      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <el-tag size="small" :type="row.is_active === 1 ? 'success' : 'info'">{{ row.is_active === 1 ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.is_active === 1" size="small" link type="danger" @click="handleToggleStatus(row)">停用</el-button>
          <template v-else>
            <el-button size="small" link type="success" @click="handleToggleStatus(row)">启用</el-button>
            <el-button size="small" link type="danger" @click="handleHardDelete(row)">硬删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px" @closed="editingModelId = null">
      <el-form label-width="140px">
        <el-divider content-position="left">基本信息</el-divider>
        <el-form-item label="模型名称" required>
          <el-input v-model="form.modelName" placeholder="请输入模型名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>

        <!-- ============ PV_ABSORPTION 集中式光伏消纳模型 ============ -->
        <template v-if="activeTab === 'PV_ABSORPTION'">
          <el-divider content-position="left">物理特性</el-divider>
          <el-form-item label="装机容量 (MW)">
            <el-input-number v-model="form.installedCapacityMw" :min="0" :max="10000" :step="0.1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="并网电压 (kV)">
            <el-input-number v-model="form.gridVoltageKv" :min="0.1" :max="1000" :step="0.1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="逆变器功率 (kW)">
            <el-input-number v-model="form.inverterPowerKw" :min="0" :max="100000" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>

          <el-divider content-position="left">控制策略</el-divider>
          <el-form-item label="有功出力上限 (MW)">
            <el-input-number v-model="form.activePowerLimitMw" :min="0" :max="10000" :step="0.1" controls-position="right" style="width:220px" />
            <div style="color:#909399;font-size:12px;margin-top:2px">调度限电指令，设低于装机容量即模拟弃光</div>
          </el-form-item>
          <el-form-item label="限电优先级">
            <el-select v-model="form.curtailmentPriority" style="width:220px">
              <el-option label="保障性收购" value="guaranteed" />
              <el-option label="市场化平价" value="market" />
              <el-option label="竞价项目" value="competitive" />
            </el-select>
          </el-form-item>
          <el-form-item label="N-1 安全校核">
            <el-switch v-model="form.nMinus1Enabled" />
            <span style="color:#909399;font-size:12px;margin-left:8px">开启后限额更严格，消纳空间缩小</span>
          </el-form-item>

          <el-divider content-position="left">接口参数</el-divider>
          <el-form-item label="时序负荷曲线">
            <div style="display:flex;align-items:center;gap:8px">
              <input ref="csvInput" type="file" accept=".csv" style="display:none" @change="handleCsvUpload" />
              <el-button size="small" @click="csvInput?.click()">导入 CSV</el-button>
              <span v-if="form.loadProfile.length" style="color:#67C23A;font-size:13px">
                已导入 {{ form.loadProfile.length }} 时段，峰值 {{ Math.max(...form.loadProfile.map((d:any) => d.loadMw)) }}MW
              </span>
              <span v-else style="color:#909399;font-size:13px">未导入</span>
            </div>
          </el-form-item>
          <el-form-item label="火电最小技术出力 (MW)">
            <el-input-number v-model="form.minThermalOutputMw" :min="0" :max="10000" :step="1" controls-position="right" style="width:220px" />
            <div style="color:#909399;font-size:12px;margin-top:2px">调峰深度硬约束，抬高将挤压午间消纳空间</div>
          </el-form-item>
          <el-form-item label="断面输送限额 (MW)">
            <el-input-number v-model="form.transmissionLimitMw" :min="0" :max="10000" :step="1" controls-position="right" style="width:220px" />
            <div style="color:#909399;font-size:12px;margin-top:2px">光伏送出主断面功率上限，通道满载触发优化削减</div>
          </el-form-item>
        </template>

        <!-- ============ PV_OUTPUT 光伏出力模型 ============ -->
        <template v-if="activeTab === 'PV_OUTPUT'">
          <el-divider content-position="left">物理特性</el-divider>
          <el-form-item label="额定功率 (kW)">
            <el-input-number v-model="form.ratedPowerKw" :min="0" :max="100000" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="组件类型">
            <el-select v-model="form.panelType" style="width:220px">
              <el-option label="单晶硅" value="monocrystalline" />
              <el-option label="多晶硅" value="polycrystalline" />
              <el-option label="薄膜" value="thinFilm" />
            </el-select>
          </el-form-item>
          <el-form-item label="温度系数 (%/°C)">
            <el-input-number v-model="form.tempCoefficientPct" :min="-1" :max="0" :step="0.01" controls-position="right" style="width:220px" />
          </el-form-item>

          <el-divider content-position="left">控制策略</el-divider>
          <el-form-item label="MPPT 算法">
            <el-select v-model="form.mpptAlgorithm" style="width:220px">
              <el-option label="扰动观察法" value="pno" />
              <el-option label="电导增量法" value="incCond" />
              <el-option label="恒压法" value="constantVoltage" />
            </el-select>
          </el-form-item>
          <el-form-item label="功率限制策略">
            <el-switch v-model="form.powerLimitEnabled" />
          </el-form-item>
          <el-form-item label="爬坡率限制 (kW/min)">
            <el-input-number v-model="form.rampRateLimitKwMin" :min="0" :max="10000" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>

          <el-divider content-position="left">接口参数</el-divider>
          <el-form-item label="气象数据接口">
            <el-switch v-model="form.weatherApiEnabled" />
          </el-form-item>
          <el-form-item label="逆变器通信协议">
            <el-select v-model="form.inverterProtocol" style="width:220px">
              <el-option label="Modbus" value="modbus" />
              <el-option label="IEC 61850" value="iec61850" />
              <el-option label="RS485" value="rs485" />
            </el-select>
          </el-form-item>
          <el-form-item label="出力预测数据格式">
            <el-select v-model="form.forecastFormat" style="width:220px">
              <el-option label="JSON" value="json" />
              <el-option label="CSV" value="csv" />
              <el-option label="XML" value="xml" />
            </el-select>
          </el-form-item>
        </template>

        <!-- ============ CAPACITY 承载力模型 ============ -->
        <template v-if="activeTab === 'CAPACITY'">
          <el-divider content-position="left">物理特性</el-divider>
          <el-form-item label="变压器容量 (kVA)">
            <el-input-number v-model="form.transformerCapacityKva" :min="0" :max="100000" :step="10" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="线路载流量 (A)">
            <el-input-number v-model="form.lineAmpacityA" :min="0" :max="10000" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="N-1 安全准则">
            <el-switch v-model="form.nMinus1Enabled" />
          </el-form-item>

          <el-divider content-position="left">控制策略</el-divider>
          <el-form-item label="过载保护定值 (%)">
            <el-input-number v-model="form.overloadThresholdPct" :min="100" :max="200" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="负载均衡策略">
            <el-select v-model="form.loadBalancingMode" style="width:220px">
              <el-option label="主动均衡" value="active" />
              <el-option label="被动均衡" value="passive" />
              <el-option label="关闭" value="off" />
            </el-select>
          </el-form-item>
          <el-form-item label="需求响应策略">
            <el-switch v-model="form.demandResponseEnabled" />
          </el-form-item>

          <el-divider content-position="left">接口参数</el-divider>
          <el-form-item label="SCADA 接口">
            <el-switch v-model="form.scadaEnabled" />
          </el-form-item>
          <el-form-item label="负荷预测输入">
            <el-switch v-model="form.loadForecastEnabled" />
          </el-form-item>
          <el-form-item label="拓扑数据格式">
            <el-select v-model="form.topologyFormat" style="width:220px">
              <el-option label="CIM" value="cim" />
              <el-option label="JSON" value="json" />
              <el-option label="自定义" value="custom" />
            </el-select>
          </el-form-item>
        </template>

        <!-- ============ STORAGE 储能模型 ============ -->
        <template v-if="activeTab === 'STORAGE'">
          <el-divider content-position="left">物理特性</el-divider>
          <el-form-item label="额定容量 (kWh)">
            <el-input-number v-model="form.ratedCapacityKwh" :min="0" :max="100000" :step="10" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="额定功率 (kW)">
            <el-input-number v-model="form.ratedPowerKw" :min="0" :max="100000" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="充放电效率 (%)">
            <el-input-number v-model="form.efficiencyPct" :min="1" :max="100" :step="0.1" controls-position="right" style="width:220px" />
          </el-form-item>

          <el-divider content-position="left">控制策略</el-divider>
          <el-form-item label="充放电策略">
            <el-select v-model="form.chargeMode" style="width:220px">
              <el-option label="削峰填谷" value="peakShaving" />
              <el-option label="频率调节" value="freqRegulation" />
              <el-option label="备用电源" value="backup" />
            </el-select>
          </el-form-item>
          <el-form-item label="SOC 保护定值 (%)">
            <el-input-number v-model="form.socLimitPct" :min="5" :max="50" :step="1" controls-position="right" style="width:220px" />
          </el-form-item>
          <el-form-item label="电网支撑模式">
            <el-select v-model="form.gridSupportMode" style="width:220px">
              <el-option label="惯性支撑" value="inertia" />
              <el-option label="一次调频" value="primaryFreq" />
              <el-option label="无" value="none" />
            </el-select>
          </el-form-item>

          <el-divider content-position="left">接口参数</el-divider>
          <el-form-item label="BMS 通信协议">
            <el-select v-model="form.bmsProtocol" style="width:220px">
              <el-option label="CAN" value="can" />
              <el-option label="RS485" value="rs485" />
              <el-option label="Modbus" value="modbus" />
            </el-select>
          </el-form-item>
          <el-form-item label="PCS 接口规范">
            <el-select v-model="form.pcsInterface" style="width:220px">
              <el-option label="模拟量" value="analog" />
              <el-option label="数字量" value="digital" />
              <el-option label="混合" value="mixed" />
            </el-select>
          </el-form-item>
          <el-form-item label="SOC/SOH 上报格式">
            <el-select v-model="form.sohReportFormat" style="width:220px">
              <el-option label="JSON" value="json" />
              <el-option label="CSV" value="csv" />
              <el-option label="Modbus寄存器" value="modbus_register" />
            </el-select>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dim-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}
.dim-gap {
  display: inline-block;
  width: 16px;
  text-align: center;
  color: #c0c4cc;
  font-size: 11px;
}
</style>
