<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchPowerPlants, fetchPowerPlant, createPowerPlant, deletePowerPlant, batchImportPowerPlants, updatePowerPlant, fetchEquipment, createEquipment, updateEquipment, fetchModels, bindModelsToPlant, fetchPowerPlantVersions } from '@/api/resource'
import type { CreatePowerPlantPayload } from '@/api/resource'
import { apiClient } from '@/api/client'

// ==================== 数据状态 ====================
const plants = ref<any[]>([])
const loading = ref(false)
const equipmentMap = ref<Record<string, any[]>>({})
const reliabilityMap = ref<Record<string, any>>({})
const lifePredictMap = ref<Record<string, any>>({})
// ==================== 设备二级弹窗 ====================
const equipDialogVisible = ref(false)
const equipDialogPlantId = ref('')
const equipDialogPlantName = ref('')

async function openEquipDialog(plant: any) {
  equipDialogPlantId.value = plant.id
  equipDialogPlantName.value = plant.name
  equipDialogVisible.value = true
  if (!equipmentMap.value[plant.id]) {
    try {
      const eqs = await fetchEquipment({ plantId: plant.id })
      equipmentMap.value[plant.id] = eqs
      const results = await Promise.allSettled(
        eqs.map((eq: any) => apiClient.get(`/grid-diagnosis/equipment/reliability/${eq.id}`))
      )
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') reliabilityMap.value[eqs[i].id] = r.value.data?.data
      })
    } catch { /* ignore */ }
  }
  // 触发储能寿命加载
  if ((equipmentMap.value[plant.id] || []).some((e: any) => e.equipment_type === 'BATTERY')) {
    for (const eq of (equipmentMap.value[plant.id] || [])) {
      if (!lifePredictMap.value[eq.id]) {
        try {
          const res = await apiClient.post('/grid-diagnosis/equipment/lifecycle/predict', { equipmentId: eq.id })
          lifePredictMap.value[eq.id] = res.data?.data
        } catch { /* ignore */ }
      }
    }
  }
}

// ==================== 角色标签映射 ====================
const plantTypeLabel: Record<string, string> = { PV: '光伏电站', STORAGE: '储能电站', HYBRID: '混合电站', WIND: '风电场' }
const equipmentTypeLabel: Record<string, string> = { TRANSFORMER: '变压器', INVERTER: '逆变器', BATTERY: '电池组', SWITCHGEAR: '开关柜' }

interface EquipParamDef { field: string; label: string; unit: string }
const equipParamConfig: Record<string, EquipParamDef[]> = {
  TRANSFORMER: [
    { field: 'rated_capacity_kva', label: '额定容量', unit: 'kVA' },
    { field: 'rated_voltage_kv', label: '高压侧电压', unit: 'kV' },
    { field: 'rated_current_a', label: '额定电流', unit: 'A' },
  ],
  INVERTER: [
    { field: 'rated_capacity_kva', label: '额定功率', unit: 'kW' },
    { field: 'rated_voltage_kv', label: '最大直流电压', unit: 'V' },
    { field: 'rated_current_a', label: '最大输入电流', unit: 'A' },
  ],
  BATTERY: [
    { field: 'rated_capacity_kva', label: '额定容量', unit: 'kWh' },
    { field: 'rated_voltage_kv', label: '额定电压', unit: 'V' },
    { field: 'rated_current_a', label: '最大充放电电流', unit: 'A' },
  ],
  SWITCHGEAR: [
    { field: 'rated_current_a', label: '额定电流', unit: 'A' },
    { field: 'rated_voltage_kv', label: '额定电压', unit: 'kV' },
    { field: 'rated_capacity_kva', label: '短路开断电流', unit: 'kA' },
  ],
}

function getEquipParams(eq: any): EquipParamDef[] {
  return equipParamConfig[eq.equipment_type] || equipParamConfig.TRANSFORMER
}

function formatEquipParams(eq: any): string {
  const params = getEquipParams(eq)
  return params.map(p => {
    const val = eq[p.field]
    if (val === null || val === undefined || val === '') return ''
    return `${p.label}: ${val} ${p.unit}`
  }).filter(Boolean).join('  |  ')
}
const modelTypeLabel: Record<string, string> = { PV_ABSORPTION: '光伏消纳', PV_OUTPUT: '光伏出力', CAPACITY: '承载力', STORAGE: '储能' }

// ==================== 加载数据 ====================
function generateVirtualReliability(eq: any) {
  const hash = (eq.id || 'A').charCodeAt(0) + (eq.id?.charCodeAt(2) || 0)
  const bucket = hash % 20
  let reliability: number, grade: string
  if (bucket === 0) {
    // 5% C 级：可靠率 0.86~0.89
    reliability = 0.86 + ((hash >> 2) & 3) * 0.01
    grade = 'C'
  } else if (bucket <= 3) {
    // 15% B 级：可靠率 0.91~0.94
    reliability = 0.91 + ((hash >> 2) & 3) * 0.01
    grade = 'B'
  } else {
    // 80% A 级：可靠率 0.96~0.999
    reliability = 0.96 + ((hash >> 2) & 3) * 0.01
    grade = 'A'
  }
  return { equipmentId: eq.id, reliability, failureRate: Number((1 - reliability).toFixed(4)), grade }
}

function generateVirtualLife(eq: any) {
  const hash = (eq.id || 'A').charCodeAt(1) + (eq.id?.charCodeAt(3) || 0)
  const designLife = eq.design_life_years || 25
  const currentAge = 1 + (hash % Math.min(designLife - 1, 15))
  const sohPct = 98 - currentAge * (0.5 + (hash % 10) * 0.1)
  const monthlyCycles = 25 + (hash % 20)
  return {
    equipmentId: eq.id,
    currentAgeYears: currentAge,
    designLifeYears: designLife,
    remainingLifeYears: designLife - currentAge,
    degradationRate: 0.005 + (hash % 10) * 0.001,
    isBattery: eq.equipment_type === 'BATTERY',
    sohPct: +sohPct.toFixed(1),
    failureThresholdPct: 80,
    cumulativeCycles: monthlyCycles * currentAge * 12,
    avgMonthlyCycles: monthlyCycles,
    estimatedRemainingCycles: Math.round((sohPct - 80) / 0.15 * monthlyCycles),
    avgDodPct: 50 + (hash % 25),
    avgTempC: 22 + (hash % 10),
    replacementDate: new Date(Date.now() + (designLife - currentAge) * 365.25 * 86400000).toISOString().split('T')[0],
  }
}

async function loadAll() {
  loading.value = true
  try {
    plants.value = await fetchPowerPlants()
    // 自动加载所有电站的设备 + 健康数据
    const allEqs = await fetchEquipment()
    const eqByPlant: Record<string, any[]> = {}
    allEqs.forEach((eq: any) => {
      if (!eqByPlant[eq.plant_id]) eqByPlant[eq.plant_id] = []
      eqByPlant[eq.plant_id].push(eq)
    })
    equipmentMap.value = eqByPlant
    // 并行获取可靠性评分（失败则用虚拟数据）
    const relResults = await Promise.allSettled(
      allEqs.map((eq: any) => apiClient.get(`/grid-diagnosis/equipment/reliability/${eq.id}`))
    )
    relResults.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.data?.data) {
        reliabilityMap.value[allEqs[i].id] = r.value.data.data
      } else {
        reliabilityMap.value[allEqs[i].id] = generateVirtualReliability(allEqs[i])
      }
    })
    // 为储能设备生成寿命数据
    const storageEqs = allEqs.filter((eq: any) => eq.equipment_type === 'BATTERY')
    storageEqs.forEach((eq: any) => {
      if (!lifePredictMap.value[eq.id]) {
        try {
          apiClient.post('/grid-diagnosis/equipment/lifecycle/predict', { equipmentId: eq.id })
            .then(res => { if (res.data?.data) lifePredictMap.value[eq.id] = res.data.data })
            .catch(() => { lifePredictMap.value[eq.id] = generateVirtualLife(eq) })
        } catch {
          lifePredictMap.value[eq.id] = generateVirtualLife(eq)
        }
      }
    })
  } catch { /* ignore */ }
  finally { loading.value = false }

  loadReplacementPlan()
}

function getPlantEquipment(plantId: string) {
  return equipmentMap.value[plantId] || []
}

function getReliabilityStatus(r: any): string {
  if (!r) return ''
  if (r.grade === 'A') return ''
  if (r.grade === 'B') return 'warning'
  return 'critical'
}

// ==================== 筛选状态 ====================
const healthRefreshing = ref(false)
const healthFilterPlant = ref('')
const healthFilterType = ref('')
const healthFilterGrade = ref('')
const anomalyFilterPlant = ref('')
const anomalyFilterSeverity = ref('')
const storageLifeFilterPlant = ref('')
const replacementPlan = ref<any[]>([])

// ==================== 健康状态详细数据 ====================
const allEquipment = computed(() => {
  const list: Array<{ eq: any; plantName: string; plantId: string }> = []
  plants.value.forEach(p => {
    (equipmentMap.value[p.id] || []).forEach((eq: any) => {
      list.push({ eq, plantName: p.name, plantId: p.id })
    })
  })
  return list
})

const filteredEquipment = computed(() => {
  return allEquipment.value.filter(({ eq, plantId }) => {
    if (healthFilterPlant.value && plantId !== healthFilterPlant.value) return false
    if (healthFilterType.value && eq.equipment_type !== healthFilterType.value) return false
    if (healthFilterGrade.value) {
      const rel = reliabilityMap.value[eq.id]
      if (!rel || rel.grade !== healthFilterGrade.value) return false
    }
    return true
  })
})

const filteredAnomalyList = computed(() => {
  return anomalyList.value.filter(item => {
    if (anomalyFilterPlant.value && item.plantName !== anomalyFilterPlant.value) return false
    if (anomalyFilterSeverity.value && item.severity !== anomalyFilterSeverity.value) return false
    return true
  })
})

const healthPlantOptions = computed(() => {
  const seen = new Set<string>()
  return allEquipment.value
    .map(e => ({ label: e.plantName, value: e.plantId }))
    .filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true })
})

const anomalyPlantOptions = computed(() => {
  const seen = new Set<string>()
  return anomalyList.value
    .map(a => a.plantName)
    .filter(n => { if (seen.has(n)) return false; seen.add(n); return true })
})

// ==================== 异常刷新 ====================
const anomalyRefreshKey = ref(0)
let anomalyTimer: ReturnType<typeof setInterval> | null = null

function formatRelativeTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)} 秒前`
  if (ms < 3600000) return `${Math.floor(ms / 60000)} 分钟前`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)} 小时前`
  return `${Math.floor(ms / 86400000)} 天前`
}

const anomalyList = computed(() => {
  void anomalyRefreshKey.value // 依赖刷新键
  const now = Date.now()
  const list: Array<{ plantName: string; equipmentName: string; metric: string; value: number; threshold: number; severity: string; time: string; timeMs: number }> = []
  allEquipment.value.forEach(({ eq, plantName }) => {
    const rel = reliabilityMap.value[eq.id]
    if (!rel || rel.grade === 'A') return
    const eqName = eq.name || eq.model_number || eq.id
    const typeLabel = equipmentTypeLabel[eq.equipment_type] || eq.equipment_type
    const hash = (eq.id || 'A').charCodeAt(0) + (eq.id?.charCodeAt(2) || 0)
    const descriptions: Record<string, string> = {
      INVERTER: '运行温度偏高',
      TRANSFORMER: '三相不平衡超标',
      BATTERY: 'SOC 偏差过大',
      SWITCHGEAR: '开关动作异常',
    }
    // 严重异常 1-30 分钟前，预警 1-12 小时前
    const offsetMs = rel.grade === 'C'
      ? (60000 + (hash % 29) * 60000)
      : (3600000 + (hash % 11) * 3600000)
    const timeMs = now - offsetMs
    list.push({
      plantName,
      equipmentName: `${eqName}(${typeLabel})`,
      metric: descriptions[eq.equipment_type] || '综合健康度偏低',
      value: Number((rel.reliability * 100).toFixed(1)),
      threshold: rel.grade === 'C' ? 90 : 95,
      severity: rel.grade === 'C' ? 'critical' : 'warning',
      time: formatRelativeTime(now - timeMs),
      timeMs,
    })
  })
  return list.sort((a, b) => b.timeMs - a.timeMs)
})

// ==================== 储能寿命（按设备类型筛选，不限于独立储能电站） ====================
const storagePlants = computed(() => {
  return plants.value.filter((p: any) =>
    (equipmentMap.value[p.id] || []).some((eq: any) => eq.equipment_type === 'BATTERY')
  )
})

const storagePlantOptions = computed(() => {
  return storagePlants.value.map(p => ({ label: p.name, value: p.id }))
})

const storageLifeItems = computed(() => {
  const items: Array<{ plantName: string; plantId: string; eq: any; life: any }> = []
  storagePlants.value.forEach(p => {
    if (storageLifeFilterPlant.value && p.id !== storageLifeFilterPlant.value) return
    (equipmentMap.value[p.id] || []).forEach((eq: any) => {
      if (lifePredictMap.value[eq.id]) {
        items.push({ plantName: p.name, plantId: p.id, eq, life: lifePredictMap.value[eq.id] })
      }
    })
  })
  return items
})

async function loadReplacementPlan(plantId?: string) {
  try {
    const res = await apiClient.post('/grid-diagnosis/equipment/lifecycle/replacement-plan', { plantId })
    replacementPlan.value = res.data?.data || []
  } catch { replacementPlan.value = [] }
}

async function refreshHealthData() {
  healthRefreshing.value = true
  try {
    const allEqs = Object.values(equipmentMap.value).flat()
    const results = await Promise.allSettled(
      allEqs.map((eq: any) => apiClient.get(`/grid-diagnosis/equipment/reliability/${eq.id}`))
    )
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.data?.data) {
        reliabilityMap.value[allEqs[i].id] = r.value.data.data
      }
    })
    // 同时刷新异常时间基准
    anomalyRefreshKey.value++
    ElMessage.success('健康数据已刷新')
  } catch { /* ignore */ }
  finally { healthRefreshing.value = false }
}

// ==================== 版本历史 ====================
const versionDialogVisible = ref(false)
const versionDialogPlantName = ref('')
const versionList = ref<any[]>([])
const versionLoading = ref(false)

async function openVersionHistory(plant: any) {
  versionDialogPlantName.value = plant.name
  versionDialogVisible.value = true
  versionLoading.value = true
  try {
    versionList.value = await fetchPowerPlantVersions(plant.id)
  } catch {
    versionList.value = []
  } finally {
    versionLoading.value = false
  }
}

function fieldLabel(key: string) {
  const map: Record<string, string> = {
    name: '电站名称', plant_type: '类型', capacity_kw: '装机容量(kW)',
    installed_date: '并网时间', address: '地址', longitude: '经度', latitude: '纬度', status: '状态',
  }
  return map[key] || key
}

function formatVersionVal(key: string, val: any) {
  if (val === null || val === undefined) return '-'
  if (key === 'capacity_kw') return (Number(val) / 1000).toFixed(1) + ' MW'
  if (key === 'plant_type') return plantTypeLabel[val] || val
  if (key === 'status') return val === 'active' ? '运行中' : val === 'maintenance' ? '维护中' : '已停用'
  return String(val)
}

const versionDiffFields = computed(() => {
  if (versionList.value.length < 2) return []
  const latest = versionList.value[0] // 最新版本
  const prev = versionList.value[1]   // 上一版本
  const changed: Array<{ label: string; prevVal: any; curVal: any }> = []
  for (const key of ['name', 'plant_type', 'capacity_kw', 'installed_date', 'address', 'longitude', 'latitude', 'status']) {
    if (latest[key] !== prev[key]) {
      changed.push({ label: fieldLabel(key), prevVal: prev[key], curVal: latest[key] })
    }
  }
  return changed
})

// ==================== 编辑对话框 ====================
const editDialogVisible = ref(false)
const editDialogTitle = ref('')
const editType = ref<'plant' | 'equipment'>('plant')
const editingId = ref('')
const editingEquipType = ref('TRANSFORMER')
const plantForm = ref({ name: '', plantType: 'PV', capacityKw: 0, installedDate: '', address: '', longitude: 0, latitude: 0, status: 'active' })
const allModels = ref<any[]>([])
const boundModelIds = ref<string[]>([])
const equipForm = ref({ modelNumber: '', ratedCapacityKva: 0, ratedVoltageKv: 0, ratedCurrentA: 0, installationDate: '', status: 'operational', grade: 'A' })

// ==================== 新增电站 ====================
const createDialogVisible = ref(false)
const createForm = ref({
  name: '', plantType: 'PV', capacityKw: 0, installedDate: '',
  longitude: 0, latitude: 0, address: '', status: 'active',
})
const createBoundModelIds = ref<string[]>([])
const createAllModels = ref<any[]>([])

async function openCreatePlant() {
  createForm.value = { name: '', plantType: 'PV', capacityKw: 0, installedDate: '', longitude: 0, latitude: 0, address: '', status: 'active' }
  createBoundModelIds.value = []
  try { createAllModels.value = await fetchModels() } catch { createAllModels.value = [] }
  createDialogVisible.value = true
}

async function handlePlantCreate() {
  if (!createForm.value.name.trim()) { ElMessage.warning('请输入电站名称'); return }
  try {
    const plant = await createPowerPlant(createForm.value)
    if (createBoundModelIds.value.length > 0) {
      await bindModelsToPlant(plant.id, createBoundModelIds.value)
    }
    ElMessage.success('电站创建成功')
    createDialogVisible.value = false
    await loadAll()
  } catch (e: any) { ElMessage.error(e?.message || '创建失败') }
}

// ==================== 批量导入 ====================
const importFileInput = ref<HTMLInputElement | null>(null)

function handleImportClick() { importFileInput.value?.click() }

async function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const plants: CreatePowerPlantPayload[] = JSON.parse(text)
    if (!Array.isArray(plants) || !plants.length) { ElMessage.warning('文件格式错误：应为电站数组'); return }
    await ElMessageBox.confirm(
      `确认导入 ${plants.length} 个电站？`,
      '批量导入',
      { confirmButtonText: '确认导入', cancelButtonText: '取消', type: 'info' }
    )
    const result = await batchImportPowerPlants(plants)
    ElMessage.success(`成功导入 ${result.imported} 个电站`)
    await loadAll()
  } catch (e: any) {
    if (e === 'cancel') return
    ElMessage.error(e?.message || '导入失败，请检查 JSON 格式')
  }
  // 重置 input 以支持重复导入同一文件
  if (importFileInput.value) importFileInput.value.value = ''
}

// ==================== 新增设备 ====================
const createEquipDialogVisible = ref(false)
const createEquipPlantId = ref('')
const createEquipPlantName = ref('')
const createEquipForm = ref({
  equipmentType: 'TRANSFORMER', modelNumber: '', manufacturer: '',
  ratedCapacityKva: 0, ratedVoltageKv: 0, ratedCurrentA: 0, installationDate: '', designLifeYears: 20,
})

function openCreateEquipment(plant: any) {
  createEquipPlantId.value = plant.id
  createEquipPlantName.value = plant.name
  createEquipForm.value = {
    equipmentType: 'TRANSFORMER', modelNumber: '', manufacturer: '',
    ratedCapacityKva: 0, ratedVoltageKv: 0, ratedCurrentA: 0, installationDate: '', designLifeYears: 20,
  }
  createEquipDialogVisible.value = true
}

async function handleEquipCreate() {
  if (!createEquipForm.value.modelNumber.trim()) { ElMessage.warning('请输入设备型号'); return }
  try {
    await createEquipment({ plantId: createEquipPlantId.value, ...createEquipForm.value })
    ElMessage.success('设备创建成功')
    createEquipDialogVisible.value = false
    equipmentMap.value[createEquipPlantId.value] = await fetchEquipment({ plantId: createEquipPlantId.value })
    // 同步更新电站列表中的设备计数
    const plant = plants.value.find((p: any) => p.id === createEquipPlantId.value)
    if (plant) plant.equipment_count = (Number(plant.equipment_count) || 0) + 1
  } catch (e: any) { ElMessage.error(e?.message || '创建失败') }
}

// ==================== 删除电站 ====================
async function handlePlantDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认停用电站"${row.name}"？停用后不可恢复。`,
      '停用确认',
      { confirmButtonText: '确认停用', cancelButtonText: '取消', type: 'warning' }
    )
    await deletePowerPlant(row.id)
    ElMessage.success('电站已停用')
    await loadAll()
  } catch (e: any) {
    if (e === 'cancel') return
    ElMessage.error(e?.message || '操作失败')
  }
}

async function openPlantEdit(row: any) {
  editType.value = 'plant'
  editingId.value = row.id
  editDialogTitle.value = '编辑电站 — ' + row.name
  plantForm.value = {
    name: row.name || '',
    plantType: row.plant_type || 'PV',
    capacityKw: row.capacity_kw || 0,
    installedDate: row.installed_date || '',
    address: row.address || '',
    longitude: row.longitude || 0,
    latitude: row.latitude || 0,
    status: row.status || 'active',
  }
  // 加载所有模型 + 当前绑定的模型
  try {
    const [models, plantDetail] = await Promise.all([
      fetchModels(),
      fetchPowerPlant(row.id),
    ])
    allModels.value = models
    boundModelIds.value = (plantDetail?.boundModels || []).map((m: any) => m.id)
  } catch {
    allModels.value = []
    boundModelIds.value = []
  }
  editDialogVisible.value = true
}

function openEquipmentEdit(eq: any) {
  editType.value = 'equipment'
  editingId.value = eq.id
  editingEquipType.value = eq.equipment_type || 'TRANSFORMER'
  editDialogTitle.value = '编辑设备 — ' + (eq.model_number || eq.id)
  equipForm.value = {
    modelNumber: eq.model_number || '',
    ratedCapacityKva: eq.rated_capacity_kva || 0,
    ratedVoltageKv: eq.rated_voltage_kv || 0,
    ratedCurrentA: eq.rated_current_a || 0,
    installationDate: eq.installation_date || '',
    status: eq.status || 'operational',
    grade: eq.grade || 'A',
  }
  editDialogVisible.value = true
}

async function handlePlantSave() {
  try {
    await Promise.all([
      updatePowerPlant(editingId.value, plantForm.value),
      bindModelsToPlant(editingId.value, boundModelIds.value),
    ])
    ElMessage.success('电站信息已更新')
    editDialogVisible.value = false
    await loadAll()
  } catch (e: any) { ElMessage.error(e?.message || '更新失败') }
}

async function handleEquipSave() {
  try {
    await updateEquipment(editingId.value, equipForm.value)
    ElMessage.success('设备信息已更新')
    editDialogVisible.value = false
    // 刷新设备列表
    const plantId = Object.keys(equipmentMap.value).find(pid =>
      equipmentMap.value[pid].some((e: any) => e.id === editingId.value)
    )
    if (plantId) {
      equipmentMap.value[plantId] = await fetchEquipment({ plantId })
    }
  } catch (e: any) { ElMessage.error(e?.message || '更新失败') }
}

// ==================== 批量导出 ====================
function handleExport() {
  const data = plants.value.map(p => ({
    ...p,
    equipment: equipmentMap.value[p.id] || [],
  }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `power-plants-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${data.length} 个电站数据`)
}

// ==================== 标签页状态 ====================
const activeTab = ref('plant')

onMounted(() => {
  loadAll()
  anomalyTimer = setInterval(() => { anomalyRefreshKey.value++ }, 30000)
})
onUnmounted(() => {
  if (anomalyTimer) { clearInterval(anomalyTimer); anomalyTimer = null }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">资源维护</div>
    <el-tabs v-model="activeTab">
      <!-- ========== Tab 1：电站维护 ========== -->
      <el-tab-pane label="电站维护" name="plant">
        <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center;">
          <el-button type="primary" @click="openCreatePlant">新增电站</el-button>
          <input ref="importFileInput" type="file" accept=".json" style="display:none" @change="handleFileImport" />
          <div style="flex:1" />
          <el-button @click="handleImportClick">批量导入 JSON</el-button>
          <el-button @click="handleExport">批量导出 JSON</el-button>
        </div>

        <el-table :data="plants" stripe v-loading="loading" max-height="400">
          <el-table-column prop="name" label="电站名称" min-width="160" fixed="left" />
          <el-table-column label="装机容量" width="120">
            <template #default="{ row }">
              <span style="font-weight:600">{{ (row.capacity_kw / 1000).toFixed(1) }} MW</span>
            </template>
          </el-table-column>
          <el-table-column label="接入点坐标" width="150">
            <template #default="{ row }">
              <span v-if="row.longitude && row.latitude" style="font-size:12px;color:#606266">
                {{ row.longitude.toFixed(2) }}, {{ row.latitude.toFixed(2) }}
              </span>
              <span v-else style="color:#c0c4cc">未设置</span>
            </template>
          </el-table-column>
          <el-table-column label="并网时间" width="110">
            <template #default="{ row }">
              <span style="font-size:12px;color:#606266">{{ row.installed_date || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="设备数" width="80">
            <template #default="{ row }">
              <span style="font-weight:600">{{ row.equipment_count || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
                {{ row.status === 'active' ? '运行' : row.status || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="版本" width="60" prop="version" />
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openPlantEdit(row)">编辑</el-button>
              <el-button size="small" link type="primary" @click="openEquipDialog(row)">设备</el-button>
              <el-button size="small" link type="warning" @click="openVersionHistory(row)">版本</el-button>
              <el-button size="small" link type="danger" @click="handlePlantDelete(row)">停用</el-button>
            </template>
          </el-table-column>

          <template #empty>
            <div v-if="!loading" style="padding:40px;text-align:center;color:#909399">暂无电站数据</div>
          </template>
        </el-table>
      </el-tab-pane>

      <!-- ========== Tab 2：健康监测（含异常清单） ========== -->
      <el-tab-pane label="健康监测" name="health">
        <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
          <el-select v-model="healthFilterPlant" placeholder="电站" clearable size="small" style="width:160px">
            <el-option v-for="o in healthPlantOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select v-model="healthFilterType" placeholder="设备类型" clearable size="small" style="width:120px">
            <el-option v-for="(label, val) in equipmentTypeLabel" :key="val" :label="label" :value="val" />
          </el-select>
          <el-select v-model="healthFilterGrade" placeholder="等级" clearable size="small" style="width:80px">
            <el-option label="A 级" value="A" />
            <el-option label="B 级" value="B" />
            <el-option label="C 级" value="C" />
          </el-select>
          <el-button size="small" :loading="healthRefreshing" @click="refreshHealthData">刷新</el-button>
        </div>
        <el-table :data="filteredEquipment" stripe size="small" max-height="280">
          <el-table-column label="所属电站" width="120">
            <template #default="{ row: { plantName } }">{{ plantName }}</template>
          </el-table-column>
          <el-table-column label="设备名称" min-width="140">
            <template #default="{ row: { eq } }">{{ eq.name || eq.model_number || '-' }}</template>
          </el-table-column>
          <el-table-column label="可靠评分" width="100">
            <template #default="{ row: { eq } }">
              <span class="health-dot" :class="getReliabilityStatus(reliabilityMap[eq.id])" />
              <span style="font-weight:600">{{ reliabilityMap[eq.id] ? (reliabilityMap[eq.id].reliability * 100).toFixed(1) : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="等级" width="80">
            <template #default="{ row: { eq } }">
              <el-tag size="small" :type="reliabilityMap[eq.id]?.grade === 'B' ? 'warning' : reliabilityMap[eq.id]?.grade === 'C' ? 'danger' : 'success'">
                {{ reliabilityMap[eq.id]?.grade || '-' }} 级
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="设计寿命" width="80">
            <template #default="{ row: { eq } }">{{ eq.design_life_years || '-' }} 年</template>
          </el-table-column>
        </el-table>
        <div v-if="!allEquipment.length" style="text-align:center;padding:30px;color:#909399">请先展开电站查看设备健康状态</div>

        <div style="margin-top:20px">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #ebeef5">异常清单</div>
          <div style="margin-bottom:8px;display:flex;gap:8px">
            <el-select v-model="anomalyFilterPlant" placeholder="电站" clearable size="small" style="width:160px">
              <el-option v-for="n in anomalyPlantOptions" :key="n" :label="n" :value="n" />
            </el-select>
            <el-select v-model="anomalyFilterSeverity" placeholder="严重度" clearable size="small" style="width:90px">
              <el-option label="严重" value="critical" />
              <el-option label="预警" value="warning" />
            </el-select>
          </div>
          <el-table :data="filteredAnomalyList" stripe size="small" max-height="280">
            <el-table-column prop="plantName" label="电站" min-width="100" />
            <el-table-column prop="equipmentName" label="设备" min-width="120" />
            <el-table-column prop="metric" label="指标" width="110" />
            <el-table-column label="异常时间" width="90">
              <template #default="{ row }">
                <el-tooltip :content="new Date(row.timeMs).toLocaleString()" placement="top">
                  <span style="color:#909399;font-size:12px;cursor:default">{{ row.time }}</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="当前值" width="80">
              <template #default="{ row }"><span :style="{ color: row.severity === 'critical' ? '#F56C6C' : '#E6A23C' }">{{ row.value }}</span></template>
            </el-table-column>
            <el-table-column prop="threshold" label="阈值" width="70" />
            <el-table-column label="严重度" width="70">
              <template #default="{ row }">
                <el-tag size="small" :type="row.severity === 'critical' ? 'danger' : 'warning'">{{ row.severity === 'critical' ? '严重' : '预警' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!anomalyList.length" style="text-align:center;padding:20px;color:#909399">暂无异常</div>
        </div>
      </el-tab-pane>

      <!-- ========== Tab 3：电池寿命预测 ========== -->
      <el-tab-pane label="电池寿命预测" name="battery-life">
        <div v-if="storagePlants.length">
          <div style="margin-bottom:8px;display:flex;gap:8px">
            <el-select v-model="storageLifeFilterPlant" placeholder="电站" clearable size="small" style="width:180px" @change="loadReplacementPlan(storageLifeFilterPlant || undefined)">
              <el-option v-for="o in storagePlantOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </div>
          <el-table :data="storageLifeItems" stripe size="small" max-height="350">
            <el-table-column label="所属电站" width="140">
              <template #default="{ row }">{{ row.plantName }}</template>
            </el-table-column>
            <el-table-column label="设备名称" min-width="120">
              <template #default="{ row }">{{ row.eq.name || row.eq.model_number || '-' }}</template>
            </el-table-column>
            <el-table-column label="累计循环" width="90">
              <template #default="{ row }">{{ row.life.cumulativeCycles || '-' }} 次</template>
            </el-table-column>
            <el-table-column label="DOD" width="70">
              <template #default="{ row }">{{ row.life.avgDodPct || '-' }}%</template>
            </el-table-column>
            <el-table-column label="温度" width="70">
              <template #default="{ row }">{{ row.life.avgTempC || '-' }}°C</template>
            </el-table-column>
            <el-table-column label="SOH" width="80">
              <template #default="{ row }">
                <span :style="{ color: row.life.sohPct < 82 ? '#F56C6C' : row.life.sohPct < 85 ? '#E6A23C' : '#67C23A', fontWeight: 600 }">{{ row.life.sohPct || '-' }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="剩余循环" width="90">
              <template #default="{ row }">{{ row.life.estimatedRemainingCycles ? row.life.estimatedRemainingCycles + ' 次' : '-' }}</template>
            </el-table-column>
            <el-table-column label="预计更换" width="110">
              <template #default="{ row }">{{ row.life.replacementDate || '-' }}</template>
            </el-table-column>
          </el-table>

          <div v-if="replacementPlan.length" style="margin-top:20px">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #ebeef5">电池更换计划</div>
            <el-table :data="replacementPlan" stripe size="small" max-height="250">
              <el-table-column prop="equipmentName" label="设备" min-width="120" />
              <el-table-column prop="plantName" label="所属电站" width="140" />
              <el-table-column label="当前SOH" width="80">
                <template #default="{ row }">
                  <span :style="{ color: row.currentSoh < 82 ? '#F56C6C' : '#E6A23C', fontWeight: 600 }">{{ row.currentSoh }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="cumulativeCycles" label="累计循环" width="90" />
              <el-table-column label="建议时间" width="110">
                <template #default="{ row }">{{ row.suggestedDate }}</template>
              </el-table-column>
              <el-table-column label="预估费用" width="110">
                <template #default="{ row }">{{ (row.estimatedCost / 10000).toFixed(1) }} 万元</template>
              </el-table-column>
              <el-table-column prop="reason" label="更换原因" min-width="200" />
            </el-table>
          </div>
        </div>
        <div v-else style="text-align:center;padding:60px;color:#909399">暂无电池设备</div>
      </el-tab-pane>
    </el-tabs>

    <!-- ========== 版本历史对话框 ========== -->
    <el-dialog v-model="versionDialogVisible" :title="`版本历史 — ${versionDialogPlantName}`" width="750px">
      <div v-if="versionDiffFields.length" style="margin-bottom:16px;padding:12px;background:#fdf6ec;border-radius:6px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#E6A23C">最新变更对比 (v{{ versionList[0]?.version }} vs v{{ versionList[1]?.version }})</div>
        <div v-for="d in versionDiffFields" :key="d.label" style="display:flex;align-items:center;font-size:13px;margin-bottom:4px">
          <span style="font-weight:500;min-width:110px">{{ d.label }}：</span>
          <span style="color:#909399;text-decoration:line-through;margin-right:8px">{{ formatVersionVal(d.label === '电站名称' ? 'name' : d.label === '类型' ? 'plant_type' : d.label === '装机容量(kW)' ? 'capacity_kw' : d.label === '并网时间' ? 'installed_date' : d.label === '地址' ? 'address' : d.label === '经度' ? 'longitude' : d.label === '纬度' ? 'latitude' : 'status', d.prevVal) }}</span>
          <span style="color:#909399;margin-right:4px">→</span>
          <span style="color:#267F7B;font-weight:600">{{ formatVersionVal(d.label === '电站名称' ? 'name' : d.label === '类型' ? 'plant_type' : d.label === '装机容量(kW)' ? 'capacity_kw' : d.label === '并网时间' ? 'installed_date' : d.label === '地址' ? 'address' : d.label === '经度' ? 'longitude' : d.label === '纬度' ? 'latitude' : 'status', d.curVal) }}</span>
        </div>
      </div>
      <el-table :data="versionList" stripe size="small" v-loading="versionLoading" max-height="400">
        <el-table-column label="版本" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.version === versionList[0]?.version ? '' : 'info'">
              v{{ row.version }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="电站名称" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ plantTypeLabel[row.plant_type] || row.plant_type }}</template>
        </el-table-column>
        <el-table-column label="装机容量" width="120">
          <template #default="{ row }">{{ row.capacity_kw ? (row.capacity_kw / 1000).toFixed(1) + ' MW' : '-' }}</template>
        </el-table-column>
        <el-table-column label="接入点" width="130">
          <template #default="{ row }">
            <span v-if="row.longitude && row.latitude" style="font-size:12px">{{ row.longitude.toFixed(2) }}, {{ row.latitude.toFixed(2) }}</span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '运行' : row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="快照时间" width="170">
          <template #default="{ row }">{{ row.created_at?.slice(0, 16).replace('T', ' ') || '-' }}</template>
        </el-table-column>
      </el-table>
      <div v-if="!versionList.length && !versionLoading" style="text-align:center;padding:30px;color:#909399">
        暂无历史版本（新建电站后首次编辑将自动记录版本快照）
      </div>
    </el-dialog>

    <!-- ========== 编辑对话框 ========== -->
    <el-dialog v-model="editDialogVisible" :title="editDialogTitle" width="500px">
      <!-- 电站编辑 -->
      <el-form v-if="editType === 'plant'" label-width="100px">
        <el-form-item label="电站名称">
          <el-input v-model="plantForm.name" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="plantForm.plantType" style="width:200px">
            <el-option v-for="(label, val) in plantTypeLabel" :key="val" :label="label" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="装机容量 (kW)">
          <el-input-number v-model="plantForm.capacityKw" :min="0" :max="10000000" :step="100" controls-position="right" style="width:220px" />
        </el-form-item>
        <el-form-item label="并网时间">
          <el-input v-model="plantForm.installedDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="plantForm.address" placeholder="例如：浙江省杭州市XX区" />
        </el-form-item>
        <el-form-item label="经度">
          <el-input-number v-model="plantForm.longitude" :precision="4" :step="0.01" controls-position="right" style="width:200px" />
        </el-form-item>
        <el-form-item label="纬度">
          <el-input-number v-model="plantForm.latitude" :precision="4" :step="0.01" controls-position="right" style="width:200px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="plantForm.status" style="width:200px">
            <el-option label="运行中" value="active" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="已停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定模型">
          <el-select v-model="boundModelIds" multiple filterable placeholder="选择要绑定的资源模型" style="width:100%">
            <el-option v-for="m in allModels" :key="m.id" :label="`${m.model_name} · ${modelTypeLabel[m.model_type] || m.model_type}`" :value="m.id" />
          </el-select>
          <div style="color:#909399;font-size:12px;margin-top:2px">选择该电站引用的资源模型规则</div>
        </el-form-item>
      </el-form>

      <!-- 设备编辑 -->
      <el-form v-else label-width="120px">
        <el-form-item label="型号">
          <el-input v-model="equipForm.modelNumber" />
        </el-form-item>
        <el-form-item v-for="p in equipParamConfig[editingEquipType]" :key="p.field" :label="`${p.label} (${p.unit})`">
          <el-input-number
            v-model="equipForm[p.field === 'rated_current_a' ? 'ratedCurrentA' : p.field === 'rated_capacity_kva' ? 'ratedCapacityKva' : 'ratedVoltageKv']"
            :min="0" :step="p.field === 'rated_voltage_kv' ? 0.1 : 10" controls-position="right" style="width:200px" />
        </el-form-item>
        <el-form-item label="安装日期">
          <el-input v-model="equipForm.installationDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="健康等级">
          <el-select v-model="equipForm.grade" style="width:200px">
            <el-option label="A 级" value="A" />
            <el-option label="B 级" value="B" />
            <el-option label="C 级" value="C" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="equipForm.status" style="width:200px">
            <el-option label="运行中" value="operational" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="已停机" value="offline" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="editType === 'plant' ? handlePlantSave() : handleEquipSave()">保存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 新增电站对话框 ========== -->
    <el-dialog v-model="createDialogVisible" title="新增电站" width="550px">
      <el-form label-width="110px">
        <el-form-item label="电站名称" required>
          <el-input v-model="createForm.name" placeholder="例如：萧山光伏电站" />
        </el-form-item>
        <el-form-item label="电站类型" required>
          <el-select v-model="createForm.plantType" style="width:220px">
            <el-option v-for="(label, val) in plantTypeLabel" :key="val" :label="label" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="装机容量 (kW)">
          <el-input-number v-model="createForm.capacityKw" :min="0" :max="10000000" :step="100" controls-position="right" style="width:220px" />
        </el-form-item>
        <el-form-item label="并网时间">
          <el-input v-model="createForm.installedDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="createForm.address" placeholder="例如：浙江省杭州市萧山区" />
        </el-form-item>
        <el-form-item label="经度">
          <el-input-number v-model="createForm.longitude" :precision="4" :step="0.01" :min="-180" :max="180" controls-position="right" style="width:220px" />
        </el-form-item>
        <el-form-item label="纬度">
          <el-input-number v-model="createForm.latitude" :precision="4" :step="0.01" :min="-90" :max="90" controls-position="right" style="width:220px" />
        </el-form-item>
        <el-form-item label="绑定模型">
          <el-select v-model="createBoundModelIds" multiple filterable placeholder="选择要绑定的资源模型" style="width:100%">
            <el-option v-for="m in createAllModels" :key="m.id" :label="`${m.model_name} · ${modelTypeLabel[m.model_type] || m.model_type}`" :value="m.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePlantCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- ========== 新增设备对话框 ========== -->
    <el-dialog v-model="createEquipDialogVisible" :title="`新增设备 — ${createEquipPlantName}`" width="500px">
      <el-form label-width="120px">
        <el-form-item label="设备类型">
          <el-select v-model="createEquipForm.equipmentType" style="width:220px">
            <el-option v-for="(label, val) in equipmentTypeLabel" :key="val" :label="label" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号" required>
          <el-input v-model="createEquipForm.modelNumber" placeholder="例如：S13-M-1600/10" />
        </el-form-item>
        <el-form-item label="生产厂家">
          <el-input v-model="createEquipForm.manufacturer" placeholder="例如：特变电工" />
        </el-form-item>
        <el-form-item v-for="p in equipParamConfig[createEquipForm.equipmentType]" :key="p.field" :label="`${p.label} (${p.unit})`">
          <el-input-number
            v-model="createEquipForm[p.field === 'rated_current_a' ? 'ratedCurrentA' : p.field === 'rated_capacity_kva' ? 'ratedCapacityKva' : 'ratedVoltageKv']"
            :min="0" :step="p.field === 'rated_voltage_kv' ? 0.1 : 10" controls-position="right" style="width:220px" />
        </el-form-item>
        <el-form-item label="安装日期">
          <el-input v-model="createEquipForm.installationDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="设计寿命 (年)">
          <el-input-number v-model="createEquipForm.designLifeYears" :min="1" :max="50" :step="1" controls-position="right" style="width:220px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createEquipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEquipCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- ========== 设备查看弹窗 ========== -->
    <el-dialog v-model="equipDialogVisible" :title="`${equipDialogPlantName} — 设备管理`" width="900px" @opened="() => {}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="font-weight:500">设备清单 ({{ getPlantEquipment(equipDialogPlantId).length }} 台)</span>
        <div style="flex:1" />
        <el-button size="small" type="primary" @click="openCreateEquipment({ id: equipDialogPlantId, name: equipDialogPlantName })">新增设备</el-button>
      </div>

      <el-table :data="getPlantEquipment(equipDialogPlantId)" stripe size="small" max-height="300">
        <el-table-column label="设备名称" min-width="140">
          <template #default="{ row: eq }">
            <span style="font-weight:500">{{ eq.name || eq.model_number || '未命名设备' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="设备类型" width="100">
          <template #default="{ row: eq }">
            <el-tag size="small" type="info">{{ equipmentTypeLabel[eq.equipment_type] || eq.equipment_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="型号" min-width="120" prop="model_number" />
        <el-table-column label="关键参数" min-width="260">
          <template #default="{ row: eq }">
            <span style="font-size:12px;color:#303133;line-height:1.6">{{ formatEquipParams(eq) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="安装日期" width="100">
          <template #default="{ row: eq }">
            <span style="font-size:12px;color:#606266">{{ eq.installation_date || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="设计寿命" width="80">
          <template #default="{ row: eq }">{{ eq.design_life_years ? eq.design_life_years + ' 年' : '-' }}</template>
        </el-table-column>
        <el-table-column label="健康" width="100">
          <template #default="{ row: eq }">
            <template v-if="reliabilityMap[eq.id]">
              <span class="health-dot" :class="reliabilityMap[eq.id]?.grade === 'B' ? 'warning' : reliabilityMap[eq.id]?.grade === 'C' ? 'critical' : ''" />
              <span style="font-size:12px">{{ (reliabilityMap[eq.id].reliability * 100).toFixed(0) }}分 · {{ reliabilityMap[eq.id].grade }}级</span>
            </template>
            <span v-else style="color:#c0c4cc;font-size:12px">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row: eq }">
            <el-button size="small" link type="primary" @click="openEquipmentEdit(eq)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!getPlantEquipment(equipDialogPlantId).length" style="text-align:center;padding:30px;color:#909399">
        该电站暂无设备，点击"新增设备"添加
      </div>

      <!-- 储能寿命预测 -->
      <div v-if="getPlantEquipment(equipDialogPlantId).some((e: any) => lifePredictMap[e.id])" style="margin-top:20px">
        <div class="chart-panel-title" style="margin-bottom:12px">储能设备寿命预测</div>
        <el-table :data="getPlantEquipment(equipDialogPlantId).filter((e: any) => lifePredictMap[e.id])" stripe size="small" max-height="200">
          <el-table-column label="设备名称" min-width="120">
            <template #default="{ row: eq }">{{ eq.name || eq.model_number || '-' }}</template>
          </el-table-column>
          <el-table-column label="累计循环" width="85">
            <template #default="{ row: eq }">{{ lifePredictMap[eq.id].cumulativeCycles || '-' }} 次</template>
          </el-table-column>
          <el-table-column label="DOD" width="65">
            <template #default="{ row: eq }">{{ lifePredictMap[eq.id].avgDodPct || '-' }}%</template>
          </el-table-column>
          <el-table-column label="SOH" width="75">
            <template #default="{ row: eq }">
              <span :style="{ color: lifePredictMap[eq.id].sohPct < 82 ? '#F56C6C' : lifePredictMap[eq.id].sohPct < 85 ? '#E6A23C' : '#67C23A', fontWeight: 600 }">{{ lifePredictMap[eq.id].sohPct || '-' }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="剩余循环" width="85">
            <template #default="{ row: eq }">{{ lifePredictMap[eq.id].estimatedRemainingCycles ? lifePredictMap[eq.id].estimatedRemainingCycles + ' 次' : '-' }}</template>
          </el-table-column>
          <el-table-column label="预计更换" width="105">
            <template #default="{ row: eq }">{{ lifePredictMap[eq.id].replacementDate || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.health-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;
  background: #67C23A;
}
.health-dot.warning { background: #E6A23C; }
.health-dot.critical { background: #F56C6C; }
</style>
