<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ChartContainer from '@/components/common/ChartContainer.vue'
import {
  fetchInvestmentPlans, createInvestmentPlan, updateInvestmentPlan, deleteInvestmentPlan,
  fetchCostItems, createCostItem, updateCostItem, deleteCostItem,
  fetchInvestmentConfig, saveInvestmentConfig,
  calculateInvestment, compareCost, roiAnalysis,
} from '@/api/planning'
import type { CostItem, InvestmentConfigItem, InvestmentPlan } from '@/api/planning'
import type { InvestmentResult, CostComparison, RoiAnalysis as RoiResult } from '@new-energy/shared'

// ==================== 导航 ====================
const mainTab = ref<'params' | 'calc' | 'compare' | 'roi'>('params')
const paramsTab = ref<'equipment' | 'construction' | 'other'>('equipment')
const equipTab = ref<'pv_body' | 'transmission' | 'traditional_coal'>('pv_body')

// ==================== 设备类型 ====================
const pvEquipTypes = ['光伏组件', '逆变器', '汇流箱']
const transEquipTypes = ['箱式变压器', '高低压柜及环网设备', '升压站成套及电气配套设备', '监控通讯及辅助设备']
const coalEquipTypes = ['锅炉', '汽轮机', '发电机', '脱硫脱硝', '冷却系统', '输煤系统', '灰渣处理', '电气系统', '热工控制', '建筑工程', '土地征用', '其他费用']
const equipTypes = computed(() => equipTab.value === 'pv_body' ? pvEquipTypes : equipTab.value === 'transmission' ? transEquipTypes : coalEquipTypes)

const techRouteOptions = [
  { label: '集中式光伏', value: 'centralized_pv' },
  { label: '组串式光伏', value: 'string_pv' },
  { label: '光储联合', value: 'pv_storage' },
  { label: '分布式光伏', value: 'distributed_pv' },
  { label: '输变电工程', value: 'transmission' },
  { label: '传统火电', value: 'traditional_coal' },
]
function techLabel(v: string) { return techRouteOptions.find(t => t.value === v)?.label || v }

// ==================== 造价参数管理 ====================
const costItems = ref<CostItem[]>([])
const loading = ref(false)
const searchCode = ref('')
const searchType = ref('')
const dialogVisible = ref(false)
const editMode = ref(false)
const currentItem = ref<CostItem | null>(null)
const form = ref({ itemCode: '', category: '', subCategory: '', equipmentType: '', modelSpec: '', itemName: '', unitPrice: 0, costUnit: '' })

const costUnitOptions: Record<string, string[]> = {
  equipment: ['元/Wp', '元/台', '元/面', '元/套', '元/kVA', '元/m', '元/kW'],
  construction: ['元/W', '元/m²', '元/km', '元/m'],
  other: ['元/W', '万元/亩', '元/W/年'],
}
function currentUnitOptions() {
  const cat = mainTab.value === 'params' ? paramsTab.value : 'equipment'
  return costUnitOptions[cat] || costUnitOptions.equipment
}

async function loadCostItems() {
  loading.value = true
  try {
    let category = ''; let subCategory: string | undefined
    if (mainTab.value === 'params') { category = paramsTab.value; if (paramsTab.value === 'equipment') subCategory = equipTab.value }
    costItems.value = await fetchCostItems({ category: category || undefined, subCategory, equipmentType: searchType.value || undefined, itemCode: searchCode.value || undefined })
  } catch { costItems.value = [] } finally { loading.value = false }
}

const equipPrefixMap: Record<string, { prefix: string; unit: string }> = {
  '光伏组件': { prefix: 'PV-M-', unit: '元/Wp' }, '逆变器': { prefix: 'PV-INV-', unit: '元/台' }, '汇流箱': { prefix: 'PV-BOX-', unit: '元/台' },
  '箱式变压器': { prefix: 'TD-TR-', unit: '元/台' }, '高低压柜及环网设备': { prefix: 'TD-SW-', unit: '元/面' },
  '升压站成套及电气配套设备': { prefix: 'TD-SUB-', unit: '元/套' }, '监控通讯及辅助设备': { prefix: 'TD-MON-', unit: '元/套' },
  '锅炉': { prefix: 'COAL-', unit: '元/kW' }, '汽轮机': { prefix: 'COAL-', unit: '元/kW' }, '发电机': { prefix: 'COAL-', unit: '元/kW' },
  '脱硫脱硝': { prefix: 'COAL-', unit: '元/kW' }, '冷却系统': { prefix: 'COAL-', unit: '元/kW' }, '输煤系统': { prefix: 'COAL-', unit: '元/kW' },
  '灰渣处理': { prefix: 'COAL-', unit: '元/kW' }, '电气系统': { prefix: 'COAL-', unit: '元/kW' }, '热工控制': { prefix: 'COAL-', unit: '元/kW' },
  '建筑工程': { prefix: 'COAL-', unit: '元/kW' }, '土地征用': { prefix: 'COAL-', unit: '元/kW' }, '其他费用': { prefix: 'COAL-', unit: '元/kW' },
}

function handleSearch() { loadCostItems() }
function handleReset() { searchCode.value = ''; searchType.value = ''; loadCostItems() }
function onEquipTypeChange(etype: string) { const cfg = equipPrefixMap[etype]; if (cfg) { if (!editMode.value) form.value.costUnit = cfg.unit; form.value.modelSpec = '' } }
function openCreate() { editMode.value = false; currentItem.value = null; let cat = paramsTab.value; let sub = paramsTab.value === 'equipment' ? equipTab.value : ''; form.value = { itemCode: '', category: cat, subCategory: sub, equipmentType: '', modelSpec: '', itemName: '', unitPrice: 0, costUnit: '' }; dialogVisible.value = true }
function openEdit(row: CostItem) { editMode.value = true; currentItem.value = row; form.value = { itemCode: row.item_code, category: row.category, subCategory: row.sub_category || '', equipmentType: row.equipment_type || '', modelSpec: row.model_spec || '', itemName: row.item_name, unitPrice: row.unit_price, costUnit: row.cost_unit }; dialogVisible.value = true }

async function handleSave() {
  try {
    const fd = form.value
    if (!fd.itemName) fd.itemName = fd.modelSpec || fd.equipmentType
    if (!fd.itemCode && fd.category !== 'equipment') { const prefix = fd.category === 'construction' ? 'CONS-' : 'OTH-'; fd.itemCode = prefix + Date.now().toString(36).toUpperCase() }
    if (!fd.itemCode || fd.unitPrice <= 0 || !fd.costUnit) { ElMessage.warning('请填写所有必填项'); return }
    if (fd.category === 'equipment' && !fd.equipmentType) { ElMessage.warning('请选择设备类型'); return }
    if (editMode.value && currentItem.value) { await updateCostItem(currentItem.value.id, { itemCode: fd.itemCode, itemName: fd.itemName, unitPrice: fd.unitPrice, costUnit: fd.costUnit, equipmentType: fd.equipmentType, modelSpec: fd.modelSpec }); ElMessage.success('更新成功') }
    else { await createCostItem({ itemCode: fd.itemCode, category: fd.category, subCategory: fd.subCategory, equipmentType: fd.equipmentType, modelSpec: fd.modelSpec, itemName: fd.itemName, unitPrice: fd.unitPrice, costUnit: fd.costUnit }); ElMessage.success('新增成功') }
    dialogVisible.value = false; loadCostItems()
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '操作失败') }
}

async function handleDelete(row: CostItem) { try { await ElMessageBox.confirm(`确定删除「${row.item_name}」？`, '确认删除', { type: 'warning' }); await deleteCostItem(row.id); ElMessage.success('已删除'); loadCostItems() } catch { /* cancelled */ } }

const modelSpecOptions = computed(() => { if (!form.value.equipmentType) return []; return [...new Set(costItems.value.filter(i => i.equipment_type === form.value.equipmentType).map(i => i.model_spec).filter(Boolean))] })
watch([mainTab, paramsTab, equipTab], () => { if (mainTab.value === 'params') loadCostItems() })

// ==================== 投资方案管理 ====================
const investmentPlans = ref<InvestmentPlan[]>([])
const planDialogVisible = ref(false)
const planEditMode = ref(false)
const planEditId = ref('')
const planForm = ref({ planName: '', techRoute: '', capacityKw: 50000, description: '' })

async function loadInvestmentPlans() { try { investmentPlans.value = await fetchInvestmentPlans() } catch { investmentPlans.value = [] } }

const pvPlans = computed(() => investmentPlans.value.filter(p => ['centralized_pv', 'string_pv', 'pv_storage', 'distributed_pv'].includes(p.tech_route)))
const tradPlans = computed(() => investmentPlans.value.filter(p => ['transmission', 'traditional_coal'].includes(p.tech_route)))

function openCreatePlan() {
  planEditMode.value = false; planEditId.value = ''
  planForm.value = { planName: '', techRoute: '', capacityKw: 50000, description: '' }
  planDialogVisible.value = true
}
function openEditPlan() {
  const p = investmentPlans.value.find((p: InvestmentPlan) => p.id === configPlanId.value)
  if (!p) return
  planEditMode.value = true; planEditId.value = p.id
  planForm.value = { planName: p.plan_name, techRoute: p.tech_route, capacityKw: p.capacity_kw, description: p.description || '' }
  planDialogVisible.value = true
}
async function handleSavePlan() {
  try {
    const fd = planForm.value
    if (!fd.planName || !fd.techRoute) { ElMessage.warning('请填写名称和技术路线'); return }
    if (planEditMode.value && planEditId.value) {
      await updateInvestmentPlan(planEditId.value, { planName: fd.planName, techRoute: fd.techRoute, capacityKw: fd.capacityKw, description: fd.description })
      ElMessage.success('方案已更新')
      // 如果当前选中的方案被编辑，刷新容量
      if (configPlanId.value === planEditId.value) capacityInput.value = fd.capacityKw
    } else {
      const p = await createInvestmentPlan({ planName: fd.planName, techRoute: fd.techRoute, capacityKw: fd.capacityKw, description: fd.description })
      ElMessage.success('方案创建成功')
      configPlanId.value = p.id
      capacityInput.value = p.capacity_kw
      loadConfig()
    }
    planDialogVisible.value = false
    await loadInvestmentPlans()
  } catch { ElMessage.error('操作失败') }
}
async function handleDeletePlan() {
  if (!configPlanId.value) return
  try {
    await ElMessageBox.confirm('确定删除该投资方案及其配置？', '确认删除', { type: 'warning' })
    await deleteInvestmentPlan(configPlanId.value)
    ElMessage.success('已删除')
    configPlanId.value = ''
    configItems.value = []
    investment.value = null
    await loadInvestmentPlans()
  } catch { /* cancelled */ }
}

// ==================== 投资计算 ====================
const calcLoading = ref(false)
const capacityInput = ref(50000)
const investment = ref<InvestmentResult | null>(null)
const roi = ref<RoiResult | null>(null)
const roiPlanId = ref('')
const roiParams = ref({ annualHours: 1300, gridPrice: 0.42, subsidyPrice: 0.03, carbonPrice: 60, omRate: 2, projectLife: 25 })
const configPlanId = ref('')
const configItems = ref<InvestmentConfigItem[]>([])
const configLoading = ref(false)
const addDeviceVisible = ref(false)
const addDeviceForm = ref({ costItemId: '', quantity: 1 })
const costItemOptions = ref<CostItem[]>([])

async function loadConfig() {
  if (!configPlanId.value) { configItems.value = []; return }
  configLoading.value = true
  try {
    configItems.value = await fetchInvestmentConfig({ investmentPlanId: configPlanId.value })
  } catch { configItems.value = [] } finally { configLoading.value = false }
}

// 选择方案时自动回填容量
function onPlanChange() {
  const p = investmentPlans.value.find((ip: InvestmentPlan) => ip.id === configPlanId.value)
  if (p) capacityInput.value = p.capacity_kw
  loadConfig()
}

const pvRoutes = ['centralized_pv', 'string_pv', 'pv_storage', 'distributed_pv']
const tradRoutes = ['transmission', 'traditional_coal']
const filteredCostOptions = computed(() => {
  const p = investmentPlans.value.find((ip: InvestmentPlan) => ip.id === configPlanId.value)
  const route = p?.tech_route || ''
  if (tradRoutes.includes(route)) return costItemOptions.value.filter(c => c.sub_category !== 'pv_body')
  if (pvRoutes.includes(route)) return costItemOptions.value.filter(c => c.sub_category !== 'traditional_coal')
  return costItemOptions.value
})
function openAddDevice() { addDeviceForm.value = { costItemId: '', quantity: 1 }; addDeviceVisible.value = true }
async function handleAddDevice() {
  if (!addDeviceForm.value.costItemId) return
  const exist = configItems.value.find(i => i.cost_item_id === addDeviceForm.value.costItemId)
  if (exist) { ElMessage.warning('该条目已在配置清单中'); return }
  const ci = costItemOptions.value.find(c => c.id === addDeviceForm.value.costItemId)
  configItems.value = [...configItems.value, {
    id: '', investment_plan_id: configPlanId.value, cost_item_id: addDeviceForm.value.costItemId,
    quantity: addDeviceForm.value.quantity, unit_price: ci?.unit_price || 0,
    equipment_type: ci?.equipment_type, model_spec: ci?.model_spec,
    cost_item_name: ci?.item_name, cost_unit: ci?.cost_unit, category: ci?.category
  } as any]
  addDeviceVisible.value = false
}
function calcSubtotal(row: any) {
  const ci = costItemOptions.value.find(c => c.id === row.cost_item_id)
  if (!ci) return 0
  const unit = ci.cost_unit || ''
  if (unit.endsWith('/kW')) return capacityInput.value * ci.unit_price
  if (unit.endsWith('/W') || unit.endsWith('/Wp')) return capacityInput.value * 1000 * ci.unit_price
  return row.quantity * ci.unit_price
}
function removeDevice(idx: number) { configItems.value.splice(idx, 1) }
async function handleSaveConfig() {
  if (!configPlanId.value) { ElMessage.warning('请先选择或新建投资方案'); return }
  try {
    await saveInvestmentConfig(configPlanId.value, configItems.value.map(i => ({ costItemId: i.cost_item_id, quantity: i.quantity })))
    ElMessage.success('配置方案已保存')
    await loadConfig()
  } catch { ElMessage.error('保存失败') }
}
const configTotal = computed(() => {
  let total = 0
  for (const item of configItems.value) {
    const ci = costItemOptions.value.find(c => c.id === item.cost_item_id)
    const unit = ci?.cost_unit || ''
    const price = ci?.unit_price || 0
    if (unit.endsWith('/kW')) total += capacityInput.value * price
    else if (unit.endsWith('/W') || unit.endsWith('/Wp')) total += capacityInput.value * 1000 * price
    else total += price * item.quantity
  }
  return Math.round(total)
})

async function runCalculation() {
  calcLoading.value = true
  try {
    if (configPlanId.value && configItems.value.length > 0) {
      await saveInvestmentConfig(configPlanId.value, configItems.value.map(i => ({ costItemId: i.cost_item_id, quantity: i.quantity })))
    }
    const inv = await calculateInvestment({ capacityKw: capacityInput.value, investmentPlanId: configPlanId.value || undefined })
    investment.value = inv
  } finally { calcLoading.value = false }
}

// ==================== 传统电网造价对比 ====================
const comparison = ref<CostComparison | null>(null)
const comparePlanA = ref('')
const comparePlanB = ref('')
const comparePlanAName = computed(() => {
  const p = investmentPlans.value.find((ip: InvestmentPlan) => ip.id === comparePlanA.value)
  return p ? p.plan_name : '方案A'
})
const comparePlanBName = computed(() => {
  const p = investmentPlans.value.find((ip: InvestmentPlan) => ip.id === comparePlanB.value)
  return p ? p.plan_name : '方案B'
})

async function runRoiAnalysis() {
  calcLoading.value = true
  try {
    roi.value = await roiAnalysis({
      investmentPlanId: roiPlanId.value || undefined,
      ...roiParams.value
    })
  } catch { ElMessage.error('分析失败') }
  finally { calcLoading.value = false }
}

async function runCompare() {
  if (!comparePlanA.value || !comparePlanB.value) { ElMessage.warning('请选择两个方案'); return }
  if (configPlanId.value && configItems.value.length > 0) {
    await saveInvestmentConfig(configPlanId.value, configItems.value.map(i => ({ costItemId: i.cost_item_id, quantity: i.quantity })))
  }
  calcLoading.value = true
  try {
    comparison.value = await compareCost({ investmentPlanIdA: comparePlanA.value, investmentPlanIdB: comparePlanB.value })
  } catch { ElMessage.error('对比失败') }
  finally { calcLoading.value = false }
}

// ==================== 图表 ====================
const investmentChartOption = computed(() => { if (!investment.value) return {}; const b = investment.value.breakdown; return { tooltip: { trigger: 'item', formatter: '{b}: {c}万元 ({d}%)' }, series: [{ type: 'pie', radius: ['40%', '65%'], data: [{ name: '设备投资', value: Math.round(b.equipmentCost / 10000), itemStyle: { color: '#267F7B' } }, { name: '建设安装', value: Math.round(b.constructionCost / 10000), itemStyle: { color: '#67C23A' } }, { name: '土地费用', value: Math.round(b.landCost / 10000), itemStyle: { color: '#E6A23C' } }, { name: '其他费用', value: Math.round(b.otherCost / 10000), itemStyle: { color: '#909399' } }], label: { formatter: '{b}\\n{d}%' } }] } })

const unitCostChartOption = computed(() => { if (!comparison.value) return {}; return { tooltip: { trigger: 'axis', formatter: (p: any) => p[0].name + ': ' + p[0].value + ' 元/kW' }, grid: { left: '8%', right: '4%', top: 20, bottom: 40 }, xAxis: { type: 'category', data: ['单位容量造价'] }, yAxis: { type: 'value', name: '元/kW' }, series: [{ name: '光伏', type: 'bar', data: [comparison.value.pvUnitCost], itemStyle: { color: '#267F7B' }, barWidth: '25%', label: { show: true, position: 'top', formatter: '{c} 元/kW' } }, { name: '传统火电/输变电', type: 'bar', data: [comparison.value.traditionalUnitCost], itemStyle: { color: '#F56C6C' }, barWidth: '25%', label: { show: true, position: 'top', formatter: '{c} 元/kW' } }] } })

const comparisonChartOption = computed(() => { if (!comparison.value) return {}; const c = comparison.value; return { title: { text: '投资构成对比（万元）', left: 'center', textStyle: { fontSize: 13 } }, tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } }, legend: { data: ['光伏项目', '传统火电/输变电'], bottom: 0 }, grid: { left: '3%', right: '4%', top: 30, bottom: 40, containLabel: true }, xAxis: { type: 'category' as const, data: c.comparisonChart.labels }, yAxis: { type: 'value' as const, name: '万元' }, series: [{ name: '光伏项目', type: 'bar' as const, data: c.comparisonChart.pvValues, itemStyle: { color: '#267F7B' }, barWidth: '30%' }, { name: '传统火电/输变电', type: 'bar' as const, data: c.comparisonChart.traditionalValues, itemStyle: { color: '#F56C6C' }, barWidth: '30%' }] } })
const roiChartOption = computed(() => { if (!roi.value) return {}; const yearly = roi.value.yearlyCashflow; return { tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}年: ${(p[0].data / 10000).toFixed(1)}万元` }, grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }, xAxis: { type: 'category', data: yearly.map((y: any) => y.year) }, yAxis: { type: 'value', name: '万元', axisLabel: { formatter: (v: any) => (v / 10000).toFixed(0) } }, series: [{ type: 'line', smooth: true, data: yearly.map((y: any) => Math.round(y.cumulativeCashflow / 10000)), areaStyle: { color: 'rgba(64,158,255,0.1)' }, lineStyle: { color: '#267F7B', width: 2 }, itemStyle: { color: '#267F7B' }, markLine: { data: [{ yAxis: 0, name: '盈亏平衡线' }], lineStyle: { color: '#F56C6C', type: 'dashed' }, label: { formatter: '回本线' } } }] } })

onMounted(async () => { loadCostItems(); await loadInvestmentPlans(); costItemOptions.value = await fetchCostItems() })
</script>

<template>
  <div class="cost-page">
    <div class="chart-panel-title">造价管理与经济性分析</div>

    <div class="main-tabs">
      <span :class="['tab', { active: mainTab === 'params' }]" @click="mainTab = 'params'">造价参数管理</span>
      <span :class="['tab', { active: mainTab === 'calc' }]" @click="mainTab = 'calc'">项目投资自动计算</span>
      <span :class="['tab', { active: mainTab === 'compare' }]" @click="mainTab = 'compare'">传统电网造价对比</span>
      <span :class="['tab', { active: mainTab === 'roi' }]" @click="mainTab = 'roi'">成本效益分析</span>
    </div>

    <!-- ===== 造价参数管理 ===== -->
    <template v-if="mainTab === 'params'">
      <div class="sub-tabs">
        <span :class="['sub-tab', { active: paramsTab === 'equipment' }]" @click="paramsTab = 'equipment'">设备成本</span>
        <span :class="['sub-tab', { active: paramsTab === 'construction' }]" @click="paramsTab = 'construction'">工程建设成本</span>
        <span :class="['sub-tab', { active: paramsTab === 'other' }]" @click="paramsTab = 'other'">其他成本</span>
      </div>
      <div v-if="paramsTab === 'equipment'" class="sub-sub-tabs">
        <span :class="['sub-sub-tab', { active: equipTab === 'pv_body' }]" @click="equipTab = 'pv_body'">光伏本体</span>
        <span :class="['sub-sub-tab', { active: equipTab === 'transmission' }]" @click="equipTab = 'transmission'">输变电项目</span>
        <span :class="['sub-sub-tab', { active: equipTab === 'traditional_coal' }]" @click="equipTab = 'traditional_coal'">传统火电</span>
      </div>
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <el-input v-model="searchCode" placeholder="设备编号" size="small" style="width:160px" clearable />
            <el-select v-model="searchType" placeholder="设备类型" size="small" style="width:140px" clearable v-if="paramsTab === 'equipment'">
              <el-option v-for="t in equipTypes" :key="t" :label="t" :value="t" />
            </el-select>
            <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" @click="handleReset">重置</el-button>
          </div>
          <el-button type="primary" size="small" @click="openCreate">新增</el-button>
        </div>
        <el-table :data="costItems" stripe size="small" v-loading="loading">
          <el-table-column prop="item_code" label="编号" width="140" />
          <el-table-column label="类型" width="130" v-if="paramsTab === 'equipment'">
            <template #default="{ row }">{{ row.equipment_type || '-' }}</template>
          </el-table-column>
          <el-table-column label="型号/名称" min-width="180">
            <template #default="{ row }">{{ row.model_spec || row.item_name }}</template>
          </el-table-column>
          <el-table-column label="单价" width="120"><template #default="{ row }">{{ row.unit_price.toLocaleString() }}</template></el-table-column>
          <el-table-column prop="cost_unit" label="单位" width="80" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" link @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- ===== 项目投资自动计算 ===== -->
    <template v-if="mainTab === 'calc'">
      <div class="chart-panel">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-size:13px;color:#606266">方案:</span>
          <el-select v-model="configPlanId" placeholder="选择投资方案" size="small" style="width:320px" @change="onPlanChange" clearable>
            <el-option-group label="-- 光伏类 --">
              <el-option v-for="p in pvPlans" :key="p.id" :label="p.plan_name + ' [' + techLabel(p.tech_route) + '] ' + p.capacity_kw + 'kW'" :value="p.id" />
            </el-option-group>
            <el-option-group label="-- 传统类 --">
              <el-option v-for="p in tradPlans" :key="p.id" :label="p.plan_name + ' [' + techLabel(p.tech_route) + '] ' + p.capacity_kw + 'kW'" :value="p.id" />
            </el-option-group>
          </el-select>
          <el-button size="small" @click="openCreatePlan">新建</el-button>
          <el-button size="small" @click="openEditPlan" :disabled="!configPlanId">编辑</el-button>
          <el-button size="small" @click="handleDeletePlan" :disabled="!configPlanId">删除</el-button>
          <span style="font-size:12px;color:#909399;margin-left:8px">容量:</span>
          <el-input-number v-model="capacityInput" :min="1" size="small" style="width:140px" />
          <span style="font-size:12px;color:#909399">kW</span>
          <el-button type="primary" size="small" @click="runCalculation" :loading="calcLoading" style="margin-left:auto">计算投资</el-button>
        </div>
        <div v-if="configPlanId" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;font-weight:600;color:#303133">成本配置清单</span>
            <div style="display:flex;gap:8px">
              <el-button size="small" @click="openAddDevice">添加成本项</el-button>
              <el-button size="small" type="primary" @click="handleSaveConfig">保存</el-button>
            </div>
          </div>
          <el-table :data="configItems" stripe size="small" v-loading="configLoading">
            <el-table-column label="类别" width="70">
              <template #default="{ row }">
                <el-tag size="small" :type="row.category === 'equipment' ? '' : row.category === 'construction' ? 'success' : 'info'">{{ row.category === 'equipment' ? '设备' : row.category === 'construction' ? '施工' : '其他' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="型号/名称" min-width="180"><template #default="{ row }">{{ row.model_spec || row.cost_item_name || '-' }}</template></el-table-column>
            <el-table-column label="单价" width="120"><template #default="{ row }">{{ costItemOptions.find(c => c.id === row.cost_item_id)?.unit_price?.toLocaleString() || '-' }}</template></el-table-column>
            <el-table-column label="单位" width="70"><template #default="{ row }">{{ row.cost_unit || '-' }}</template></el-table-column>
            <el-table-column label="数量" width="90"><template #default="{ row }"><el-input-number v-model="row.quantity" :min="1" size="small" style="width:70px" controls-position="right" /></template></el-table-column>
            <el-table-column label="小计(元)" width="130"><template #default="{ row }">{{ calcSubtotal(row).toLocaleString() }}</template></el-table-column>
            <el-table-column label="操作" width="70"><template #default="{ $index }"><el-button size="small" link @click="removeDevice($index)">删除</el-button></template></el-table-column>
          </el-table>
          <div v-if="configItems.length > 0" style="text-align:right;margin-top:8px;font-size:13px;color:#303133">配置合计: <strong>{{ configTotal.toLocaleString() }} 元</strong>（{{ (configTotal / 10000).toFixed(2) }} 万元）</div>
        </div>
        <div v-if="investment" class="grid-2" style="margin-top:16px">
          <el-descriptions title="投资构成明细" :column="1" border size="small">
            <el-descriptions-item label="总投资">{{ (investment.totalInvestment / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="单位造价">{{ investment.unitCostPerKw }} 元/kW</el-descriptions-item>
            <el-descriptions-item label="设备投资">{{ (investment.breakdown.equipmentCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="建设安装">{{ (investment.breakdown.constructionCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="土地费用">{{ (investment.breakdown.landCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="其他费用">{{ (investment.breakdown.otherCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
          </el-descriptions>
          <ChartContainer :option="investmentChartOption" height="280px" />
        </div>
      </div>

      <!-- 投资方案编辑弹窗 -->
      <el-dialog :title="planEditMode ? '编辑投资方案' : '新建投资方案'" v-model="planDialogVisible" width="480px">
        <el-form :model="planForm" label-width="100px" size="small">
          <el-form-item label="名称" required><el-input v-model="planForm.planName" /></el-form-item>
          <el-form-item label="技术路线" required>
            <el-select v-model="planForm.techRoute" style="width:100%">
              <el-option-group label="光伏类"><el-option v-for="t in techRouteOptions.filter(t => ['centralized_pv','string_pv','pv_storage','distributed_pv'].includes(t.value))" :key="t.value" :label="t.label" :value="t.value" /></el-option-group>
              <el-option-group label="传统类"><el-option v-for="t in techRouteOptions.filter(t => ['transmission','traditional_coal'].includes(t.value))" :key="t.value" :label="t.label" :value="t.value" /></el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item label="装机容量" required><el-input-number v-model="planForm.capacityKw" :min="1" style="width:100%" /><span style="margin-left:8px;font-size:12px;color:#909399">kW</span></el-form-item>
          <el-form-item label="描述"><el-input v-model="planForm.description" type="textarea" :rows="2" /></el-form-item>
        </el-form>
        <template #footer><el-button size="small" @click="planDialogVisible = false">取消</el-button><el-button size="small" type="primary" @click="handleSavePlan">保存</el-button></template>
      </el-dialog>

      <!-- 添加成本项弹窗 -->
      <el-dialog title="添加成本项" v-model="addDeviceVisible" width="500px">
        <el-form :model="addDeviceForm" label-width="90px" size="small">
          <el-form-item label="选择条目" required>
            <el-select v-model="addDeviceForm.costItemId" style="width:100%" filterable>
              <el-option-group v-for="grp in [{ label: '设备成本', items: filteredCostOptions.filter(c => c.category === 'equipment') }, { label: '工程建设', items: filteredCostOptions.filter(c => c.category === 'construction') }, { label: '其他成本', items: filteredCostOptions.filter(c => c.category === 'other') }]" :key="grp.label" :label="grp.label">
                <el-option v-for="c in grp.items" :key="c.id" :label="(c.equipment_type ? '['+c.equipment_type+'] ' : '') + (c.model_spec || c.item_name) + ' — ' + c.unit_price + ' ' + c.cost_unit" :value="c.id" />
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item label="数量" required><el-input-number v-model="addDeviceForm.quantity" :min="1" style="width:100%" /></el-form-item>
        </el-form>
        <template #footer><el-button size="small" @click="addDeviceVisible = false">取消</el-button><el-button size="small" type="primary" @click="handleAddDevice">添加</el-button></template>
      </el-dialog>
    </template>

    <!-- ===== 传统电网造价对比 ===== -->
    <template v-if="mainTab === 'compare'">
      <div class="chart-panel">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-size:13px;color:#606266">光伏方案:</span>
          <el-select v-model="comparePlanA" placeholder="选择光伏方案" size="small" style="width:280px" clearable>
            <el-option v-for="p in pvPlans" :key="p.id" :label="p.plan_name + ' [' + techLabel(p.tech_route) + '] ' + p.capacity_kw + 'kW'" :value="p.id" />
          </el-select>
          <span style="font-size:13px;color:#606266;margin-left:12px">传统方案:</span>
          <el-select v-model="comparePlanB" placeholder="选择传统方案" size="small" style="width:280px" clearable>
            <el-option v-for="p in tradPlans" :key="p.id" :label="p.plan_name + ' [' + techLabel(p.tech_route) + '] ' + p.capacity_kw + 'kW'" :value="p.id" />
          </el-select>
          <el-button type="primary" size="small" @click="runCompare" :loading="calcLoading">开始对比</el-button>
        </div>
        <div v-if="comparison" style="margin-bottom:12px;font-size:14px;color:#303133">
          单位容量造价：光伏 <strong style="color:#267F7B">{{ comparison.pvUnitCost }} 元/kW</strong>，传统 <strong style="color:#F56C6C">{{ comparison.traditionalUnitCost }} 元/kW</strong>，光伏低 <strong style="color:#67C23A">{{ comparison.costAdvantagePct }}%</strong>
        </div>
        <div v-if="comparison" class="grid-2" style="gap:12px">
          <div>
            <el-descriptions :title="comparePlanAName + ' 投资构成'" :column="1" border size="small">
              <el-descriptions-item label="总投资">{{ (comparison.pvTotalCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
              <el-descriptions-item label="设备投资">{{ comparison.pvBreakdown ? (comparison.pvBreakdown.equipmentCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
              <el-descriptions-item label="建设安装">{{ comparison.pvBreakdown ? (comparison.pvBreakdown.constructionCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
              <el-descriptions-item label="土地费用">{{ comparison.pvBreakdown ? (comparison.pvBreakdown.landCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
              <el-descriptions-item label="其他费用">{{ comparison.pvBreakdown ? (comparison.pvBreakdown.otherCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
            </el-descriptions>
          </div>
          <div>
            <el-descriptions :title="comparePlanBName + ' 投资构成'" :column="1" border size="small">
              <el-descriptions-item label="总投资">{{ (comparison.traditionalTotalCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
              <el-descriptions-item label="设备投资">{{ comparison.traditionalBreakdown ? (comparison.traditionalBreakdown.equipmentCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
              <el-descriptions-item label="建设安装">{{ comparison.traditionalBreakdown ? (comparison.traditionalBreakdown.constructionCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
              <el-descriptions-item label="土地费用">{{ comparison.traditionalBreakdown ? (comparison.traditionalBreakdown.landCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
              <el-descriptions-item label="其他费用">{{ comparison.traditionalBreakdown ? (comparison.traditionalBreakdown.otherCost / 10000).toFixed(2) : '-' }} 万元</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
        <div v-if="comparison" style="margin-top:12px">
          <ChartContainer :option="unitCostChartOption" height="260px" />
          <ChartContainer :option="comparisonChartOption" height="320px" style="margin-top:12px" />
        </div>
      </div>
    </template>

    <!-- ===== 成本效益分析 ===== -->
    <template v-if="mainTab === 'roi'">
      <div class="chart-panel">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-size:13px;color:#606266">方案:</span>
          <el-select v-model="roiPlanId" placeholder="选择投资方案" size="small" style="width:320px" clearable>
            <el-option v-for="p in pvPlans" :key="p.id" :label="p.plan_name + ' [' + techLabel(p.tech_route) + '] ' + p.capacity_kw + 'kW'" :value="p.id" />
          </el-select>
        </div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-size:12px;color:#909399">年利用小时:</span>
          <el-input-number v-model="roiParams.annualHours" :min="1" size="small" style="width:100px" />
          <span style="font-size:12px;color:#909399">上网电价:</span>
          <el-input-number v-model="roiParams.gridPrice" :min="0" :precision="2" size="small" style="width:110px" />
          <span style="font-size:12px;color:#909399">元/kWh</span>
          <span style="font-size:12px;color:#909399;margin-left:8px">绿电补贴:</span>
          <el-input-number v-model="roiParams.subsidyPrice" :min="0" :precision="2" size="small" style="width:100px" />
          <span style="font-size:12px;color:#909399">碳价:</span>
          <el-input-number v-model="roiParams.carbonPrice" :min="0" :precision="1" size="small" style="width:90px" />
          <span style="font-size:12px;color:#909399">元/吨</span>
          <span style="font-size:12px;color:#909399;margin-left:8px">运维费率:</span>
          <el-input-number v-model="roiParams.omRate" :min="0" :precision="1" size="small" style="width:80px" />
          <span style="font-size:12px;color:#909399">%</span>
          <span style="font-size:12px;color:#909399">寿命:</span>
          <el-input-number v-model="roiParams.projectLife" :min="1" :max="50" size="small" style="width:70px" />
          <span style="font-size:12px;color:#909399">年</span>
          <el-button type="primary" size="small" @click="runRoiAnalysis" :loading="calcLoading">开始分析</el-button>
        </div>
        <div v-if="roi">
          <ChartContainer :option="roiChartOption" height="350px" />
          <div class="grid-2" style="margin-top:16px">
            <el-descriptions title="一次性投入成本" :column="1" border size="small">
              <el-descriptions-item label="设备投资">{{ (roi.upfrontCosts.equipmentInvestment / 10000).toFixed(0) }} 万元</el-descriptions-item>
              <el-descriptions-item label="建设施工">{{ (roi.upfrontCosts.constructionCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
              <el-descriptions-item label="土地费用">{{ (roi.upfrontCosts.landCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
              <el-descriptions-item label="其他费用">{{ (roi.upfrontCosts.otherCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
              <el-descriptions-item label="合计"><strong>{{ (roi.upfrontCosts.total / 10000).toFixed(0) }} 万元</strong></el-descriptions-item>
            </el-descriptions>
            <el-descriptions title="运营期收益预估（年度）" :column="1" border size="small">
              <el-descriptions-item label="发电收入">{{ roi.annualRevenue.powerGenerationIncome }} 万元</el-descriptions-item>
              <el-descriptions-item label="绿电补贴">{{ roi.annualRevenue.greenSubsidy }} 万元</el-descriptions-item>
              <el-descriptions-item label="碳交易收入">{{ roi.annualRevenue.carbonTradingIncome }} 万元</el-descriptions-item>
              <el-descriptions-item label="运维支出">{{ roi.annualExpenses.operationCost }} 万元</el-descriptions-item>
              <el-descriptions-item label="年度净收益"><strong style="color:#67C23A">{{ (roi.annualRevenue.total - roi.annualExpenses.total) }} 万元</strong></el-descriptions-item>
            </el-descriptions>
          </div>
          <div class="grid-2" style="margin-top:16px">
            <el-descriptions title="财务指标" :column="1" border size="small">
              <el-descriptions-item label="内部收益率"><span style="color:#67C23A;font-weight:600">{{ roi.financialIndicators.irrPct }}%</span></el-descriptions-item>
              <el-descriptions-item label="净现值"><span style="color:#67C23A;font-weight:600">{{ (roi.financialIndicators.npv / 10000).toFixed(0) }} 万元</span></el-descriptions-item>
              <el-descriptions-item label="投资回收期">{{ roi.financialIndicators.paybackPeriodYears }} 年</el-descriptions-item>
              <el-descriptions-item label="投资回报率">{{ roi.financialIndicators.roiPct }}%</el-descriptions-item>
            </el-descriptions>
          </div>
          <!-- 成本效益平衡表 -->
          <div style="margin-top:16px">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">成本效益平衡表</div>
            <el-table :data="roi.yearlyCashflow" stripe size="small" max-height="400">
              <el-table-column prop="year" label="年份" width="80" />
              <el-table-column label="年度净现金流(万元)" width="160">
                <template #default="{ row }">{{ (row.netCashflow / 10000).toFixed(1) }}</template>
              </el-table-column>
              <el-table-column label="累计现金流(万元)" width="160">
                <template #default="{ row }">
                  <span :style="{ color: row.cumulativeCashflow >= 0 ? '#67C23A' : '#F56C6C' }">{{ (row.cumulativeCashflow / 10000).toFixed(1) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.cumulativeCashflow >= 0 ? 'success' : 'danger'" size="small">{{ row.cumulativeCashflow >= 0 ? '已回本' : '回收中' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== 造价条目编辑弹窗 ===== -->
    <el-dialog :title="editMode ? '编辑' : '新增'" v-model="dialogVisible" width="520px">
      <el-form :model="form" label-width="90px" size="small">
        <el-form-item label="类型" required v-if="paramsTab === 'equipment'">
          <el-select v-model="form.equipmentType" style="width:100%" @change="onEquipTypeChange"><el-option v-for="t in equipTypes" :key="t" :label="t" :value="t" /></el-select>
        </el-form-item>
        <el-form-item label="名称" required v-if="paramsTab !== 'equipment'"><el-input v-model="form.itemName" /></el-form-item>
        <el-form-item label="型号" v-if="paramsTab === 'equipment'">
          <el-select v-model="form.modelSpec" style="width:100%" filterable allow-create @change="(v: any) => { if (v && !editMode) { form.itemName = v; const pfx = equipPrefixMap[form.equipmentType]; if (pfx && !form.itemCode) form.itemCode = pfx.prefix + Date.now().toString(36).slice(-4).toUpperCase() } }"><el-option v-for="m in modelSpecOptions" :key="m" :label="m" :value="m" /></el-select>
        </el-form-item>
        <el-form-item label="编号" required><el-input v-model="form.itemCode" :disabled="editMode" /></el-form-item>
        <el-form-item label="单价" required><el-input-number v-model="form.unitPrice" :min="0" :precision="4" style="width:100%" /></el-form-item>
        <el-form-item label="单位" required><el-select v-model="form.costUnit" style="width:100%"><el-option v-for="u in currentUnitOptions()" :key="u" :label="u" :value="u" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button size="small" @click="dialogVisible = false">取消</el-button><el-button size="small" type="primary" @click="handleSave">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cost-page { display: flex; flex-direction: column; gap: 12px; }
.main-tabs { display: flex; gap: 0; }
.tab { padding: 8px 20px; font-size: 14px; color: #606266; cursor: pointer; border: 1px solid #dcdfe6; border-right: none; background: #fff; }
.tab:first-child { border-radius: 4px 0 0 4px; }
.tab:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #dcdfe6; }
.tab.active { background: #267F7B; color: #fff; border-color: #267F7B; }
.tab.active + .tab { border-left-color: #267F7B; }
.sub-tabs { display: flex; gap: 0; }
.sub-tab { padding: 5px 16px; font-size: 13px; color: #606266; cursor: pointer; border: 1px solid #dcdfe6; border-right: none; background: #f5f7fa; }
.sub-tab:first-child { border-radius: 4px 0 0 4px; }
.sub-tab:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #dcdfe6; }
.sub-tab.active { background: #267F7B; color: #fff; border-color: #267F7B; }
.sub-tab.active + .sub-tab { border-left-color: #267F7B; }
.sub-sub-tabs { display: flex; gap: 0; margin-bottom: 0; }
.sub-sub-tab { padding: 4px 14px; font-size: 12px; color: #909399; cursor: pointer; border: 1px solid #dcdfe6; border-right: none; background: #fff; }
.sub-sub-tab:first-child { border-radius: 3px 0 0 3px; }
.sub-sub-tab:last-child { border-radius: 0 3px 3px 0; border-right: 1px solid #dcdfe6; }
.sub-sub-tab.active { background: #267F7B; color: #fff; border-color: #267F7B; }
.sub-sub-tab.active + .sub-sub-tab { border-left-color: #267F7B; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>