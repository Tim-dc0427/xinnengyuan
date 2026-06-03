<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAccessPoints, updateAccessPoint, createAccessPoint, importAccessPoints,
  fetchConditionPlans, createConditionPlan, updateConditionPlan, deleteConditionPlan,
} from '@/api/achievement'
import type { AccessPointResource, ConditionPlan } from '@/api/achievement'
import * as XLSX from 'xlsx'

// ==================== Tab ====================
const activeTab = ref('analysis')

// ==================== 默认条件模板（新增计划用） ====================
const defaultConditions = [
  { code: 'annual_irradiance', label: '年均辐照度', unit: 'kWh/㎡·年', enabled: true, op: '>=', threshold: 1500, category: '光伏资源' },
  { code: 'sunshine_hours', label: '年日照小时数', unit: 'h', enabled: true, op: '>=', threshold: 1300, category: '光伏资源' },
  { code: 'solar_grade', label: '资源等级', unit: '', enabled: false, op: 'in', threshold: 'A,B', category: '光伏资源' },
  { code: 'voltage_kv', label: '并网电压等级', unit: 'kV', enabled: true, op: '>=', threshold: 35, category: '电网条件' },
  { code: 'short_circuit_capacity_mva', label: '短路容量', unit: 'MVA', enabled: true, op: '>=', threshold: 100, category: '电网条件' },
  { code: 'corridor_available', label: '走廊可用性', unit: '', enabled: true, op: '==', threshold: '可用', category: '电网条件' },
  { code: 'transmission_line_length_km', label: '接入距离', unit: 'km', enabled: true, op: '<=', threshold: 10, category: '电网条件' },
  { code: 'unit_cost', label: '单位造价', unit: '元/W', enabled: true, op: '<=', threshold: 4.5, category: '投资条件' },
  { code: 'payback_years', label: '投资回收期', unit: '年', enabled: false, op: '<=', threshold: 8, category: '投资条件' },
  { code: 'irr_pct', label: '内部收益率', unit: '%', enabled: false, op: '>=', threshold: 8, category: '投资条件' },
  { code: 'land_type', label: '土地性质', unit: '', enabled: true, op: 'in', threshold: '未利用地,建设用地,草地', category: '环境条件' },
  { code: 'env_sensitivity', label: '环保敏感性', unit: '', enabled: true, op: '!=', threshold: '敏感', category: '环境条件' },
  { code: 'geohazard_risk', label: '地质灾害风险', unit: '', enabled: false, op: '!=', threshold: '高', category: '环境条件' },
]
const categories = ['光伏资源', '电网条件', '投资条件', '环境条件']

// ==================== 条件计划 ====================
const plans = ref<ConditionPlan[]>([])
const normalPlans = computed(() => plans.value.filter(p => p.plan_type === 'normal'))
const premiumPlans = computed(() => plans.value.filter(p => p.plan_type === 'premium'))
const selectedNormalPlanId = ref('')
const selectedPremiumPlanId = ref('')
// 当前生效的条件列表
const activeConditions = ref<any[]>([])
const activePremiumConditions = ref<any[]>([])

async function loadPlans() {
  plans.value = await fetchConditionPlans()
  if (normalPlans.value.length > 0 && !selectedNormalPlanId.value) {
    selectedNormalPlanId.value = normalPlans.value[0].id
    loadPlanConditions(selectedNormalPlanId.value, 'normal')
  }
  if (premiumPlans.value.length > 0 && !selectedPremiumPlanId.value) {
    selectedPremiumPlanId.value = premiumPlans.value[0].id
    loadPlanConditions(selectedPremiumPlanId.value, 'premium')
  }
}

function loadPlanConditions(planId: string, type: 'normal' | 'premium') {
  const plan = plans.value.find(p => p.id === planId)
  if (!plan) return
  try {
    const conds = JSON.parse(plan.conditions)
    if (type === 'normal') activeConditions.value = conds
    else activePremiumConditions.value = conds
  } catch { /* ignore */ }
}

function onNormalPlanChange(id: string) { selectedNormalPlanId.value = id; loadPlanConditions(id, 'normal') }
function onPremiumPlanChange(id: string) { selectedPremiumPlanId.value = id; loadPlanConditions(id, 'premium') }

// ==================== 接入点资源 ====================
interface ResourceItem {
  id: string; sourceType: string
  name: string; zone: string | null
  annualIrradiance: number | null; sunshineHours: number | null; solarGrade: string | null
  voltageKv: number | null; shortCircuitMva: number | null; corridor: string | null; distanceKm: number | null
  unitCost: number | null; payback: number | null; irr: number | null
  landType: string | null; envSensitivity: string | null; geohazard: string | null
  score: number; strengths: string[]; risks: string[]
}
const resources = ref<ResourceItem[]>([])
const loading = ref(false)
const filterText = ref('')
const thresholdHigh = ref(70)

onMounted(async () => { await Promise.all([loadResources(), loadPlans()]) })

async function loadResources() {
  loading.value = true
  try {
    const data = await fetchAccessPoints()
    resources.value = data.map((ap: AccessPointResource) => ({
      id: ap.id, sourceType: ap.source_type, name: ap.name, zone: ap.zone,
      annualIrradiance: ap.annual_irradiance, sunshineHours: ap.sunshine_hours, solarGrade: ap.solar_grade,
      voltageKv: ap.voltage_kv, shortCircuitMva: ap.short_circuit_capacity_mva, corridor: ap.corridor_available,
      distanceKm: ap.transmission_line_length_km, unitCost: ap.unit_cost, payback: ap.payback_years, irr: ap.irr_pct,
      landType: ap.land_type, envSensitivity: ap.env_sensitivity, geohazard: ap.geohazard_risk,
      score: 0, strengths: [], risks: [],
    }))
  } catch { resources.value = [] } finally { loading.value = false }
}

// ==================== 编辑/新增/导入 ====================
const editDialogVisible = ref(false); const editRes = ref<ResourceItem | null>(null)
const editForm = reactive({ shortCircuitMva: null as number | null, corridor: '', distanceKm: null as number | null, unitCost: null as number | null, payback: null as number | null, irr: null as number | null, landType: '', envSensitivity: '', geohazard: '' })
function openEdit(row: ResourceItem) {
  editRes.value = row; editForm.shortCircuitMva = row.shortCircuitMva; editForm.corridor = row.corridor || ''; editForm.distanceKm = row.distanceKm; editForm.unitCost = row.unitCost; editForm.payback = row.payback; editForm.irr = row.irr; editForm.landType = row.landType || ''; editForm.envSensitivity = row.envSensitivity || ''; editForm.geohazard = row.geohazard || ''; editDialogVisible.value = true
}
async function handleEditSave() {
  if (!editRes.value) return
  try {
    const d: Record<string, any> = {}
    if (editForm.shortCircuitMva !== null) d.shortCircuitCapacityMva = editForm.shortCircuitMva
    if (editForm.corridor) d.corridorAvailable = editForm.corridor
    if (editForm.distanceKm !== null) d.transmissionLineLengthKm = editForm.distanceKm
    if (editForm.unitCost !== null) d.unitCost = editForm.unitCost
    if (editForm.payback !== null) d.paybackYears = editForm.payback
    if (editForm.irr !== null) d.irrPct = editForm.irr
    if (editForm.landType) d.landType = editForm.landType
    if (editForm.envSensitivity) d.envSensitivity = editForm.envSensitivity
    if (editForm.geohazard) d.geohazardRisk = editForm.geohazard
    const u = await updateAccessPoint(editRes.value.id, d)
    const r = editRes.value; r.shortCircuitMva = u.short_circuit_capacity_mva; r.corridor = u.corridor_available; r.distanceKm = u.transmission_line_length_km; r.unitCost = u.unit_cost; r.payback = u.payback_years; r.irr = u.irr_pct; r.landType = u.land_type; r.envSensitivity = u.env_sensitivity; r.geohazard = u.geohazard_risk
    editDialogVisible.value = false; ElMessage.success('保存成功')
  } catch { ElMessage.error('保存失败') }
}

const addDialogVisible = ref(false); const addForm = reactive({ name: '', zone: '', voltageKv: null as number | null })
function openAdd() { addForm.name = ''; addForm.zone = ''; addForm.voltageKv = null; addDialogVisible.value = true }
async function handleAddSave() {
  try {
    const d: Record<string, any> = { name: addForm.name }; if (addForm.zone) d.zone = addForm.zone; if (addForm.voltageKv) d.voltageKv = addForm.voltageKv
    const created = await createAccessPoint(d)
    resources.value.push({ id: created.id, sourceType: 'manual', name: created.name, zone: created.zone, annualIrradiance: created.annual_irradiance, sunshineHours: created.sunshine_hours, solarGrade: created.solar_grade, voltageKv: created.voltage_kv, shortCircuitMva: null, corridor: null, distanceKm: null, unitCost: null, payback: null, irr: null, landType: null, envSensitivity: null, geohazard: null, score: 0, strengths: [], risks: [] })
    addDialogVisible.value = false; ElMessage.success('新增成功')
  } catch { ElMessage.error('新增失败') }
}
function handleImport() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls,.csv'
  input.onchange = async (e: any) => { const file = e.target?.files?.[0]; if (!file) return; try { const arr = await parseFile(file); const result = await importAccessPoints(arr); ElMessage.success(`导入 ${result.inserted} 条`); await loadResources() } catch { ElMessage.error('导入失败') } }; input.click()
}
function parseFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => { try { const wb = XLSX.read(e.target?.result, { type: 'array' }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]) } catch { reject(new Error('解析失败')) } }; reader.onerror = () => reject(new Error('读取失败')); reader.readAsArrayBuffer(file) })
}

// ==================== 计划管理弹窗 ====================
const planDialogVisible = ref(false); const planEditMode = ref(false); const planEditId = ref('')
const planForm = reactive({ name: '', planType: 'normal' as string, conditions: [] as any[] })
const upgradeFromId = ref('')

function openPlanCreate(type: string) {
  planEditMode.value = false; planEditId.value = ''; upgradeFromId.value = ''
  planForm.name = ''; planForm.planType = type; planForm.conditions = JSON.parse(JSON.stringify(defaultConditions))
  planDialogVisible.value = true
}
function openPlanEdit(plan: ConditionPlan) {
  planEditMode.value = true; planEditId.value = plan.id; upgradeFromId.value = ''
  planForm.name = plan.name; planForm.planType = plan.plan_type
  try { planForm.conditions = JSON.parse(plan.conditions) } catch { planForm.conditions = [] }
  planDialogVisible.value = true
}
function openPlanUpgrade(plan: ConditionPlan) {
  planEditMode.value = false; planEditId.value = ''; upgradeFromId.value = plan.id
  planForm.name = plan.name + '（升级优质版）'; planForm.planType = 'premium'
  try { planForm.conditions = JSON.parse(plan.conditions) } catch { planForm.conditions = [] }
  planDialogVisible.value = true
}
async function handlePlanSave() {
  try {
    if (planEditMode.value) {
      await updateConditionPlan(planEditId.value, { name: planForm.name, conditions: planForm.conditions })
      ElMessage.success('计划已更新')
    } else {
      await createConditionPlan({ name: planForm.name, planType: planForm.planType, conditions: planForm.conditions })
      ElMessage.success('计划已创建')
    }
    planDialogVisible.value = false; await loadPlans()
    // 自动选中新/更新的计划
    const reloaded = plans.value
    if (planForm.planType === 'normal' && normalPlans.value.length > 0) { selectedNormalPlanId.value = normalPlans.value[0].id; loadPlanConditions(selectedNormalPlanId.value, 'normal') }
    if (planForm.planType === 'premium' && premiumPlans.value.length > 0) { selectedPremiumPlanId.value = premiumPlans.value[0].id; loadPlanConditions(selectedPremiumPlanId.value, 'premium') }
  } catch { ElMessage.error('保存失败') }
}
async function handlePlanDelete(plan: ConditionPlan) {
  try { await ElMessageBox.confirm(`删除计划「${plan.name}」？`, '确认', { type: 'warning' }); await deleteConditionPlan(plan.id); ElMessage.success('已删除'); await loadPlans() } catch { /* cancelled */ }
}

// ==================== 评估 ====================
function checkCondition(r: ResourceItem, c: any): boolean {
  const m: Record<string, any> = { annual_irradiance: r.annualIrradiance, sunshine_hours: r.sunshineHours, solar_grade: r.solarGrade, voltage_kv: r.voltageKv, short_circuit_capacity_mva: r.shortCircuitMva, corridor_available: r.corridor, transmission_line_length_km: r.distanceKm, unit_cost: r.unitCost, payback_years: r.payback, irr_pct: r.irr, land_type: r.landType, env_sensitivity: r.envSensitivity, geohazard_risk: r.geohazard }
  const val = m[c.code]; if (val === null || val === undefined || val === '') return false
  const tv = c.threshold
  if (c.op === '>=') return Number(val) >= Number(tv); if (c.op === '>') return Number(val) > Number(tv)
  if (c.op === '<=') return Number(val) <= Number(tv); if (c.op === '<') return Number(val) < Number(tv)
  if (c.op === '==') return String(val) === String(tv); if (c.op === '!=') return String(val) !== String(tv)
  if (c.op === 'in') return String(tv).split(',').map((s: string) => s.trim()).includes(String(val))
  return false
}
function catLabel(cat: string, all: boolean, part: boolean): string {
  if (all) { const m: Record<string, string> = { '光伏资源': '光资源优质', '电网条件': '接入条件优质', '投资条件': '经济性优质', '环境条件': '开发条件优质' }; return m[cat] || cat + '全面达标' }
  if (part) { const m: Record<string, string> = { '光伏资源': '光资源基本达标', '电网条件': '接入条件基本满足', '投资条件': '经济性尚可', '环境条件': '开发条件基本可行' }; return m[cat] || cat + '部分达标' }
  const m: Record<string, string> = { '光伏资源': '光资源不足', '电网条件': '接入条件薄弱', '投资条件': '经济性较差', '环境条件': '开发制约多' }; return m[cat] || cat + '未达标'
}
function evaluateAll() {
  const normalConds = activeConditions.value.filter((c: any) => c.enabled)
  const premiumConds = activePremiumConditions.value.filter((c: any) => c.enabled)
  for (const r of resources.value) {
    r.strengths = []; r.risks = []
    // 用普通条件计分 + 生成strengths/risks
    const catScores: Record<string, { pass: number; total: number }> = {}
    for (const cn of categories) catScores[cn] = { pass: 0, total: 0 }
    for (const c of normalConds) { catScores[c.category].total++; if (checkCondition(r, c)) catScores[c.category].pass++ }
    for (const cn of categories) {
      const cs = catScores[cn]; if (cs.total === 0) continue
      const rate = cs.pass / cs.total
      if (rate === 1) r.strengths.push(catLabel(cn, true, false))
      else if (rate === 0) r.risks.push(catLabel(cn, false, false))
      else if (rate >= 0.5) { r.strengths.push(catLabel(cn, false, true)); const unmet = normalConds.filter((c: any) => c.category === cn && !checkCondition(r, c)); for (const c of unmet) r.risks.push(`${c.label}不达标(${c.op}${c.threshold}${c.unit})`) }
      else r.risks.push(catLabel(cn, false, false))
    }
    const scores = categories.map(cn => { const cs = catScores[cn]; return cs.total > 0 ? (cs.pass / cs.total) * 25 : 0 })
    r.score = Math.round(scores.reduce((a: number, b: number) => a + b, 0))
  }
}

// ==================== 筛选结果 ====================
function passesAllEnabled(r: ResourceItem, conds: any[]): boolean {
  if (conds.length === 0) return false
  return conds.every((c: any) => checkCondition(r, c))
}
const allResources = computed(() => { let l = resources.value; if (filterText.value) l = l.filter(r => r.name.includes(filterText.value) || r.zone?.includes(filterText.value)); return l })

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const pagedResources = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return allResources.value.slice(start, start + pageSize.value)
})
const matchedResources = computed(() => allResources.value.filter(r => passesAllEnabled(r, activeConditions.value.filter((c: any) => c.enabled))).sort((a, b) => b.score - a.score))
const premiumResources = computed(() => allResources.value.filter(r => passesAllEnabled(r, activePremiumConditions.value.filter((c: any) => c.enabled))).sort((a, b) => b.score - a.score))

function valOrDash(v: any, s = '') { return v !== null && v !== undefined && v !== '' ? String(v) + s : '-' }
function isEmpty(v: any) { return v === null || v === undefined || v === '' }

// 计划的条件预览文本
function planSummary(plan: ConditionPlan): string {
  try { const cs = JSON.parse(plan.conditions); const enabled = cs.filter((c: any) => c.enabled); return enabled.map((c: any) => `${c.label}${c.op}${c.threshold}${c.unit}`).join('，') || '无条件' } catch { return '-' }
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">接入条件数字化管理</div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="条件分析与匹配" name="analysis" />
      <el-tab-pane label="接入点列表" name="list" />
    </el-tabs>

    <!-- ==================== Tab1: 条件分析与匹配 ==================== -->
    <template v-if="activeTab === 'analysis'">
      <!-- 条件计划列表 -->
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:14px;font-weight:600;color:#303133">条件计划列表</span>
          <div style="display:flex;gap:8px">
            <el-button size="small" @click="openPlanCreate('normal')">新增普通</el-button>
            <el-button size="small" type="warning" @click="openPlanCreate('premium')">新增优质</el-button>
          </div>
        </div>
        <el-table :data="plans" stripe size="small">
          <el-table-column prop="name" label="计划名称" min-width="180" />
          <el-table-column label="类型" width="90">
            <template #default="{ row }"><el-tag :type="row.plan_type==='premium'?'warning':''" size="small">{{ row.plan_type==='premium'?'优质':'普通' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="条件概要" min-width="200">
            <template #default="{ row }"><span style="font-size:12px;color:#606266">{{ planSummary(row) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openPlanEdit(row)">编辑</el-button>
              <el-button v-if="row.plan_type==='normal'" size="small" link @click="openPlanUpgrade(row)">升级优质</el-button>
              <el-button size="small" link @click="handlePlanDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 接入点资源清单 -->
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:14px;font-weight:600;color:#303133">接入点资源清单（满足条件：{{ matchedResources.length }} 个）</span>
          <div style="display:flex;gap:8px;align-items:center">
            <el-select v-model="selectedNormalPlanId" placeholder="选择普通计划" size="small" style="width:180px" @change="onNormalPlanChange">
              <el-option v-for="p in normalPlans" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-button type="primary" size="small" @click="evaluateAll">筛选</el-button>
          </div>
        </div>
        <el-table :data="matchedResources" stripe size="small" v-loading="loading">
          <el-table-column prop="name" label="名称" width="180" show-overflow-tooltip />
          <el-table-column label="区域" width="70"><template #default="{ row }">{{ valOrDash(row.zone) }}</template></el-table-column>
          <el-table-column label="电压" width="70"><template #default="{ row }">{{ valOrDash(row.voltageKv, 'kV') }}</template></el-table-column>
          <el-table-column label="辐照度" width="80"><template #default="{ row }">{{ valOrDash(row.annualIrradiance) }}</template></el-table-column>
          <el-table-column label="距离" width="65"><template #default="{ row }">{{ valOrDash(row.distanceKm, 'km') }}</template></el-table-column>
          <el-table-column label="评分" width="60" sortable prop="score"><template #default="{ row }"><span class="score-text" :style="{ color: row.score >= 80 ? '#67C23A' : row.score >= 50 ? '#E6A23C' : '#F56C6C' }">{{ row.score }}</span></template></el-table-column>
        </el-table>
      </div>

      <!-- 优质资源清单 -->
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:14px;font-weight:600;color:#303133">优质资源清单（满足条件：{{ premiumResources.length }} 个）</span>
          <div style="display:flex;gap:8px;align-items:center">
            <el-select v-model="selectedPremiumPlanId" placeholder="选择优质计划" size="small" style="width:180px" @change="onPremiumPlanChange">
              <el-option v-for="p in premiumPlans" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-button type="primary" size="small" @click="evaluateAll">筛选</el-button>
          </div>
        </div>
        <div class="quality-grid">
          <div v-for="r in premiumResources" :key="r.id" class="quality-card">
            <div class="quality-card-header">
              <span class="quality-card-name">{{ r.name }}</span>
              <div class="quality-card-score"><span class="score-num" :style="{ color: r.score >= 80 ? '#67C23A' : '#E6A23C' }">{{ r.score }}</span><span class="score-label">综合评分</span></div>
            </div>
            <div class="quality-card-info">{{ r.zone }} | {{ valOrDash(r.voltageKv, 'kV') }} | 辐照{{ valOrDash(r.annualIrradiance) }} | 距离{{ valOrDash(r.distanceKm, 'km') }}</div>
            <div class="quality-card-section"><div class="quality-card-subtitle">核心优势</div><div v-if="r.strengths.length"><div v-for="s in r.strengths" :key="s" class="quality-item quality-item-good">{{ s }}</div></div><span v-else style="font-size:12px;color:#909399">-</span></div>
            <div class="quality-card-section"><div class="quality-card-subtitle">潜在风险</div><div v-if="r.risks.length"><div v-for="rsk in r.risks" :key="rsk" class="quality-item quality-item-risky">{{ rsk }}</div></div><span v-else style="font-size:12px;color:#67C23A">无制约因素</span></div>
          </div>
          <div v-if="premiumResources.length === 0 && !loading" class="quality-empty">无满足优质条件的接入点</div>
        </div>
      </div>
    </template>

    <!-- ==================== Tab2: 接入点列表 ==================== -->
    <template v-if="activeTab === 'list'">
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:14px;font-weight:600;color:#303133">接入点列表 ({{ allResources.length }} 条)</span>
          <div style="display:flex;gap:8px"><el-input v-model="filterText" size="small" placeholder="搜索名称/区域" style="width:180px" clearable @input="currentPage=1" /><el-button size="small" @click="handleImport">导入</el-button><el-button size="small" type="primary" @click="openAdd">新增</el-button></div>
        </div>
        <el-table :data="pagedResources" stripe size="small" v-loading="loading" max-height="520">
          <el-table-column prop="name" label="名称" width="200" show-overflow-tooltip />
          <el-table-column label="区域" width="80"><template #default="{ row }">{{ valOrDash(row.zone) }}</template></el-table-column>
          <el-table-column label="电压" width="70"><template #default="{ row }">{{ valOrDash(row.voltageKv, 'kV') }}</template></el-table-column>
          <el-table-column label="辐照度" width="90"><template #default="{ row }">{{ valOrDash(row.annualIrradiance) }}</template></el-table-column>
          <el-table-column label="短路容量" width="90"><template #default="{ row }"><span :class="{ 'field-empty': isEmpty(row.shortCircuitMva) }">{{ valOrDash(row.shortCircuitMva, 'MVA') }}</span></template></el-table-column>
          <el-table-column label="接入距离" width="80"><template #default="{ row }">{{ valOrDash(row.distanceKm, 'km') }}</template></el-table-column>
          <el-table-column label="来源" width="80"><template #default="{ row }"><el-tag v-if="row.sourceType==='grid_bus'" size="small">已有</el-tag><el-tag v-else-if="row.sourceType==='candidate_point'" type="warning" size="small">候选</el-tag><el-tag v-else type="info" size="small">手动</el-tag></template></el-table-column>
          <el-table-column label="操作" width="70"><template #default="{ row }"><el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button></template></el-table-column>
        </el-table>
        <div style="display:flex;justify-content:flex-end;margin-top:12px">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[15, 20, 50, 100]"
            :total="allResources.length"
            layout="total, sizes, prev, pager, next"
            small
          />
        </div>
      </div>
    </template>

    <!-- 编辑弹窗 -->
    <el-dialog title="编辑接入点数据" v-model="editDialogVisible" width="520px">
      <template v-if="editRes">
        <div style="margin-bottom:12px;font-size:13px;color:#606266">接入点：<strong>{{ editRes.name }}</strong><span v-if="editRes.zone">（{{ editRes.zone }}）</span></div>
        <el-form label-width="120px" size="small">
          <el-form-item label="年均辐照度"><el-input :value="valOrDash(editRes.annualIrradiance,' kWh/㎡·年')" disabled /></el-form-item>
          <el-form-item label="日照小时数"><el-input :value="valOrDash(editRes.sunshineHours,' h')" disabled /></el-form-item>
          <el-form-item label="资源等级"><el-input :value="valOrDash(editRes.solarGrade)" disabled /></el-form-item>
          <el-form-item label="电压等级"><el-input :value="valOrDash(editRes.voltageKv,' kV')" disabled /></el-form-item>
          <div style="font-size:13px;font-weight:600;margin:12px 0 8px;padding-bottom:4px;border-bottom:1px solid #eee">可编辑字段</div>
          <el-form-item label="短路容量(MVA)"><el-input-number v-model="editForm.shortCircuitMva" :min="0" style="width:100%" controls-position="right" /></el-form-item>
          <el-form-item label="走廊可用性"><el-select v-model="editForm.corridor" style="width:100%" clearable><el-option label="可用" value="可用" /><el-option label="受限" value="受限" /><el-option label="不可用" value="不可用" /></el-select></el-form-item>
          <el-form-item label="接入距离(km)"><el-input-number v-model="editForm.distanceKm" :min="0" :precision="2" style="width:100%" controls-position="right" /></el-form-item>
          <el-form-item label="单位造价(元/W)"><el-input-number v-model="editForm.unitCost" :min="0" :precision="2" style="width:100%" controls-position="right" /></el-form-item>
          <el-form-item label="回收期(年)"><el-input-number v-model="editForm.payback" :min="0" :precision="1" style="width:100%" controls-position="right" /></el-form-item>
          <el-form-item label="内部收益率(%)"><el-input-number v-model="editForm.irr" :min="0" :max="100" :precision="1" style="width:100%" controls-position="right" /></el-form-item>
          <el-form-item label="土地性质"><el-select v-model="editForm.landType" style="width:100%" clearable><el-option v-for="o in ['未利用地','建设用地','农用地','草地','林地']" :key="o" :label="o" :value="o" /></el-select></el-form-item>
          <el-form-item label="环保敏感性"><el-select v-model="editForm.envSensitivity" style="width:100%" clearable><el-option v-for="o in ['不敏感','一般','敏感']" :key="o" :label="o" :value="o" /></el-select></el-form-item>
          <el-form-item label="地质灾害风险"><el-select v-model="editForm.geohazard" style="width:100%" clearable><el-option v-for="o in ['低','中','高']" :key="o" :label="o" :value="o" /></el-select></el-form-item>
        </el-form>
      </template>
      <template #footer><el-button size="small" @click="editDialogVisible = false">取消</el-button><el-button size="small" type="primary" @click="handleEditSave">保存</el-button></template>
    </el-dialog>

    <!-- 新增弹窗 -->
    <el-dialog title="新增接入点" v-model="addDialogVisible" width="400px">
      <el-form :model="addForm" label-width="80px" size="small">
        <el-form-item label="名称" required><el-input v-model="addForm.name" /></el-form-item>
        <el-form-item label="区域"><el-select v-model="addForm.zone" style="width:100%" clearable><el-option v-for="z in ['钱塘区','萧山区','余杭区','临安区','富阳区','建德市','桐庐县','淳安县','西湖区','拱墅区','上城区','滨江区','临平区']" :key="z" :label="z" :value="z" /></el-select></el-form-item>
        <el-form-item label="电压(kV)"><el-input-number v-model="addForm.voltageKv" :min="0" style="width:100%" controls-position="right" /></el-form-item>
      </el-form>
      <template #footer><el-button size="small" @click="addDialogVisible = false">取消</el-button><el-button size="small" type="primary" @click="handleAddSave">保存</el-button></template>
    </el-dialog>

    <!-- 条件计划编辑弹窗 -->
    <el-dialog :title="planEditMode ? '编辑条件计划' : '新增条件计划'" v-model="planDialogVisible" width="700px">
      <el-form label-width="100px" size="small">
        <el-form-item label="计划名称" required><el-input v-model="planForm.name" /></el-form-item>
        <el-form-item label="计划类型"><el-tag v-if="planForm.planType==='normal'" size="small">普通计划</el-tag><el-tag v-else type="warning" size="small">优质计划</el-tag></el-form-item>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">条件指标配置</div>
        <div class="plan-cond-grid">
          <div v-for="cat in categories" :key="cat" style="margin-bottom:8px">
            <div style="font-size:12px;font-weight:600;color:#267F7B;margin-bottom:4px">{{ cat }}</div>
            <div v-for="c in planForm.conditions.filter((ci: any) => ci.category === cat)" :key="c.code" class="plan-cond-row">
              <el-checkbox v-model="c.enabled" size="small" />
              <span style="width:100px;font-size:12px">{{ c.label }}</span>
              <el-select v-model="c.op" size="small" style="width:60px" :disabled="!c.enabled"><el-option label="≥" value=">=" /><el-option label="≤" value="<=" /><el-option label="=" value="==" /><el-option label="≠" value="!=" /><el-option label="属于" value="in" /></el-select>
              <el-input v-if="typeof c.threshold === 'number'" v-model.number="c.threshold" size="small" style="width:80px" :disabled="!c.enabled" />
              <el-input v-else v-model="c.threshold" size="small" style="width:100px" :disabled="!c.enabled" />
              <span style="color:#909399;font-size:11px;width:60px">{{ c.unit }}</span>
            </div>
          </div>
        </div>
      </el-form>
      <template #footer><el-button size="small" @click="planDialogVisible = false">取消</el-button><el-button size="small" type="primary" @click="handlePlanSave">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.score-text { font-weight:700 }
.field-empty { color:#F56C6C }
.quality-grid { display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px }
.quality-card { border:1px solid #e4e7ed;border-radius:4px;padding:16px }
.quality-card-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px }
.quality-card-name { font-weight:600;font-size:15px;color:#303133 }
.quality-card-score { text-align:center;min-width:56px }
.score-num { font-size:24px;font-weight:700 }
.score-label { font-size:11px;color:#909399 }
.quality-card-info { font-size:12px;color:#909399;margin-bottom:10px }
.quality-card-section { margin-bottom:6px }
.quality-card-subtitle { font-size:12px;font-weight:600;color:#303133;margin-bottom:3px }
.quality-item { font-size:13px;color:#606266;padding:2px 0;padding-left:10px }
.quality-item-good { border-left:2px solid #67C23A }
.quality-item-risky { border-left:2px solid #F56C6C }
.quality-empty { grid-column:1/-1;text-align:center;color:#909399;padding:24px }
.plan-cond-row { display:flex;align-items:center;gap:4px;font-size:13px;padding:2px 0 }
.plan-cond-grid { max-height:400px;overflow-y:auto }
</style>
