<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlanningStore } from '@/stores/planning.store'
import {
  generateAbsorptionPlan, fetchAbsorptionPlan, updateAbsorptionPlan,
  fetchCandidatePoints, fetchPlanVariants, createPlanVariant, deletePlanVariant,
  roiAnalysis,
  analyzeCandidatePoint,
} from '@/api/planning'
import type { CandidateAnalysisResult } from '@/api/planning'
import type { AbsorptionPlanDetail, StorageConfig, ReactiveCompConfig, LineModificationPlan, SchemeVariant } from '@new-energy/shared'
import ChartContainer from '@/components/common/ChartContainer.vue'

const route = useRoute()
const planningStore = usePlanningStore()
const { candidates } = storeToRefs(planningStore)
const loading = ref(false)
const plan = ref<AbsorptionPlanDetail | null>(null)
const selectedCandidate = ref('')
const analysisResult = ref<CandidateAnalysisResult | null>(null)
const analyzing = ref(false)
const planName = ref('光伏接入消纳方案')
const bottomActiveTab = ref<'detail' | 'compare'>('detail')

// Form data — 分析完成后自动填入推荐参数
const ratedCapacityKw = ref(0)

const storageConfig = ref<StorageConfig>({
  requiredCapacityKwh: 0, requiredPowerKw: 0,
  storageType: 'lithium', durationHours: 2, estimatedCost: 0, layoutPlan: '',
})
const reactiveConfig = ref<ReactiveCompConfig>({
  compType: 'SVG', requiredCapacityKvar: 0, targetPowerFactor: 0.95, estimatedCost: 0,
})
const lineMod = ref<LineModificationPlan>({
  modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240',
  targetSpec: 'LGJ-400', lineLengthKm: 0, estimatedCost: 0, description: '',
  currentCapacityKva: 0, targetCapacityKva: 0, voltageLevel: '10kV',
})

// Detail editing state
const detailEditing = ref(false)
const editingStorage = ref<StorageConfig>({ requiredCapacityKwh: 0, requiredPowerKw: 0, storageType: 'lithium', durationHours: 2, estimatedCost: 0, layoutPlan: '' })
const editingReactive = ref<ReactiveCompConfig>({ compType: 'SVG', requiredCapacityKvar: 0, targetPowerFactor: 0.95, estimatedCost: 0 })
const editingLineMod = ref<LineModificationPlan>({ modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: 0, estimatedCost: 0, description: '', currentCapacityKva: 0, targetCapacityKva: 0, voltageLevel: '10kV' })

// Variant management
const variants = ref<SchemeVariant[]>([])
const selectedVariantId = ref('')
const showSaveVariantDialog = ref(false)
const newVariantName = ref('')

const compTypeOptions = [
  { value: 'SVG', label: 'SVG静止无功发生器' },
  { value: 'SVC', label: 'SVC静态无功补偿' },
  { value: 'capacitor', label: '并联电容器' },
  { value: 'other', label: '其他' },
]
const storageTypeOptions = [
  { value: 'lithium', label: '磷酸铁锂' },
  { value: 'flow', label: '全钒液流' },
  { value: 'lead-carbon', label: '铅碳电池' },
  { value: 'other', label: '其他' },
]
const modTypeOptions = [
  { value: 'upgrade_conductor', label: '导线截面升级' },
  { value: 'new_tie_line', label: '新增联络线' },
  { value: 'upgrade_transformer', label: '变压器改造' },
  { value: 'other', label: '其他' },
]
const voltageLevelOptions = ['10kV', '35kV', '110kV', '220kV']
const layoutPlanOptions = [
  { value: 'centralized_substation', label: '集中式布置于升压站附近' },
  { value: 'distributed_array', label: '分散式按方阵就近布置' },
  { value: 'substation_side', label: '升压站侧集中布置' },
  { value: 'modular_container', label: '模块化集装箱式布置' },
]

function storageCost(powerKw: number) { return Math.round(powerKw * 1500 / 10000) }
function reactiveCost(kvar: number) { return Math.round(kvar * 200 / 10000) }
function lineCost(km: number) { return Math.round(km * 100) }
function transformerCost(kva: number) { return Math.round(kva * 200 / 10000) }

function lineModCost(m: { modificationType: string; lineLengthKm: number; targetCapacityKva?: number }) {
  if (m.modificationType === 'upgrade_transformer') return transformerCost(m.targetCapacityKva || 0)
  return lineCost(m.lineLengthKm)
}

const totalInvestment = computed(() => {
  return storageCost(storageConfig.value.requiredPowerKw) + reactiveCost(reactiveConfig.value.requiredCapacityKvar) + lineModCost(lineMod.value)
})

const powerFactorValid = computed(() => {
  return reactiveConfig.value.targetPowerFactor >= 0.95 && reactiveConfig.value.targetPowerFactor <= 1.0
})

const selectedCandidateData = computed(() => {
  return candidates.value.find(c => c.id === selectedCandidate.value) ?? null
})

// ===== Detail tab — real-time linkage computed =====
const baseCapacityKw = computed(() => {
  return selectedCandidateData.value?.recommendedCapacityKw || plan.value?.absorptionCapacityKw || 50000
})

const baseAbsorptionKw = computed(() => {
  return plan.value?.absorptionCapacityKw || 0
})

const computedTotalInvestment = computed(() => {
  return storageCost(editingStorage.value.requiredPowerKw) + reactiveCost(editingReactive.value.requiredCapacityKvar) + lineModCost(editingLineMod.value)
})

const lineBoostMap: Record<string, number> = {
  upgrade_conductor: 5,
  new_tie_line: 8,
  upgrade_transformer: 3,
  other: 0,
}

const absorptionImprovementPct = computed(() => {
  const base = baseCapacityKw.value
  if (base <= 0) return 0
  const storageBoost = ((editingStorage.value.requiredPowerKw || 0) / base) * 15
  const pf = editingReactive.value.targetPowerFactor || 0.9
  const reactiveBoost = Math.max(0, (pf - 0.90)) * 20
  const lineBoost = lineBoostMap[editingLineMod.value.modificationType] || 0
  return +(storageBoost + reactiveBoost + lineBoost).toFixed(1)
})

const computedAbsorptionKw = computed(() => {
  return Math.round(baseAbsorptionKw.value * (1 + absorptionImprovementPct.value / 100))
})

const computedAnnualBenefit = computed(() => {
  if (computedTotalInvestment.value <= 0) return 0
  return Math.round(computedTotalInvestment.value * 0.35 * 100) / 100
})

const computedPaybackPeriod = computed(() => {
  if (computedAnnualBenefit.value <= 0) return Infinity
  return +(computedTotalInvestment.value / computedAnnualBenefit.value).toFixed(1)
})

const computedUnitCost = computed(() => {
  const base = baseCapacityKw.value
  if (base <= 0) return 0
  return Math.round(computedTotalInvestment.value * 10000 / base)
})

// ===== Chart analysis data =====
const chartMaxVal = 50000

const storageChartData = computed(() => {
  const pv = plan.value?.pvOutputProfile || []
  const load = plan.value?.loadProfile || []
  return pv.map((pt: any, i: number) => {
    const l = load[i]?.loadKw || 0
    return {
      time: pt.time, pvKw: pt.outputKw, loadKw: l,
      pvPct: Math.min(100, pt.outputKw / chartMaxVal * 100),
      loadPct: Math.min(100, l / chartMaxVal * 100),
    }
  })
})

const reactiveAnalysisData = computed(() => {
  const load = plan.value?.loadProfile || []
  const currentPf = 0.85
  const targetPf = editingReactive.value.targetPowerFactor || 0.95
  return load.map((pt: any) => {
    const l = pt.loadKw
    const currentQ = l * Math.tan(Math.acos(currentPf))
    const targetQ = l * Math.tan(Math.acos(targetPf))
    const compKvar = Math.max(0, currentQ - targetQ)
    return {
      time: pt.time, loadKw: l, currentQ, targetQ, compKvar,
      currentQPct: Math.min(100, currentQ / chartMaxVal * 100),
      compPct: Math.min(100, compKvar / chartMaxVal * 100),
    }
  })
})

const lineAnalysisData = computed(() => {
  const load = plan.value?.loadProfile || []
  const ratedMva = 50
  return load.map((pt: any) => {
    const loadMva = pt.loadKw / 1000 * 1.05
    const loadRatePct = Math.min(150, loadMva / ratedMva * 100)
    return { time: pt.time, loadMva, loadRatePct }
  })
})

// ECharts line chart options
const storageChartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['光伏出力', '本地负荷'], bottom: 0, textStyle: { fontSize: 11, color: '#606266' }, itemWidth: 12, itemHeight: 8 },
  grid: { left: '10%', right: '5%', top: '12%', bottom: '18%' },
  xAxis: { type: 'category', data: storageChartData.value.map(d => d.time), axisLabel: { interval: 3, fontSize: 10, color: '#909399' }, axisTick: { show: false } },
  yAxis: { type: 'value', name: 'kW', nameTextStyle: { fontSize: 10, color: '#909399' }, axisLabel: { fontSize: 10, color: '#909399' }, splitLine: { lineStyle: { color: '#eee' } } },
  series: [
    { name: '光伏出力', type: 'line', data: storageChartData.value.map(d => d.pvKw), symbol: 'circle', symbolSize: 4, lineStyle: { color: '#267F7B', width: 1.5 }, itemStyle: { color: '#267F7B' } },
    { name: '本地负荷', type: 'line', data: storageChartData.value.map(d => d.loadKw), symbol: 'circle', symbolSize: 4, lineStyle: { color: '#67C23A', width: 1.5 }, itemStyle: { color: '#67C23A' } },
  ],
}))

const reactiveChartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['补偿前无功', '需补偿量'], bottom: 0, textStyle: { fontSize: 11, color: '#606266' }, itemWidth: 12, itemHeight: 8 },
  grid: { left: '10%', right: '5%', top: '12%', bottom: '18%' },
  xAxis: { type: 'category', data: reactiveAnalysisData.value.map(d => d.time), axisLabel: { interval: 3, fontSize: 10, color: '#909399' }, axisTick: { show: false } },
  yAxis: { type: 'value', name: 'kvar', nameTextStyle: { fontSize: 10, color: '#909399' }, axisLabel: { fontSize: 10, color: '#909399' }, splitLine: { lineStyle: { color: '#eee' } } },
  series: [
    { name: '补偿前无功', type: 'line', data: reactiveAnalysisData.value.map(d => Math.round(d.currentQ)), symbol: 'circle', symbolSize: 4, lineStyle: { color: '#909399', width: 1.5 }, itemStyle: { color: '#909399' } },
    { name: '需补偿量', type: 'line', data: reactiveAnalysisData.value.map(d => Math.round(d.compKvar)), symbol: 'circle', symbolSize: 4, lineStyle: { color: '#267F7B', width: 1.5 }, itemStyle: { color: '#267F7B' } },
  ],
}))

const lineChartOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].axisValue}<br/>负载率: ${params[0].value}%` },
  grid: { left: '10%', right: '5%', top: '12%', bottom: '15%' },
  xAxis: { type: 'category', data: lineAnalysisData.value.map(d => d.time), axisLabel: { interval: 3, fontSize: 10, color: '#909399' }, axisTick: { show: false } },
  yAxis: { type: 'value', name: '%', nameTextStyle: { fontSize: 10, color: '#909399' }, axisLabel: { fontSize: 10, color: '#909399' }, splitLine: { lineStyle: { color: '#eee' } } },
  series: [{
    type: 'line', data: lineAnalysisData.value.map(d => Math.min(d.loadRatePct, 150)), symbol: 'circle', symbolSize: 4,
    lineStyle: { color: '#267F7B', width: 1.5 }, itemStyle: { color: '#267F7B' },
    markLine: { silent: true, symbol: 'none', data: [{ yAxis: 70, lineStyle: { color: '#E6A23C', type: 'dashed', width: 1 } }] },
  }],
}))

// Comparison table
const comparisonTableData = computed(() => {
  return [
    { key: 'variantName', label: '方案名称' },
    { key: 'storageCapacity', label: '储能容量' },
    { key: 'reactiveCapacity', label: '无功补偿' },
    { key: 'powerFactor', label: '目标功率因数' },
    { key: 'lineLength', label: '线路长度' },
    { key: 'totalInvestment', label: '总投资(万元)' },
    { key: 'annualBenefit', label: '年均收益(万元)' },
    { key: 'absorptionCapacity', label: '消纳能力' },
    { key: 'absorptionImprovement', label: '消纳提升' },
    { key: 'payback', label: '回收期(年)' },
    { key: 'irr', label: 'IRR(%)' },
    { key: 'npv', label: 'NPV(万元)' },
  ]
})

const bestValues = computed(() => {
  if (variants.value.length === 0) return {} as Record<string, any>
  const all = variants.value.map(v => v.computedIndicators)
  return {
    minInvestment: Math.min(...all.map(x => x.totalInvestmentTenThousand)),
    maxAnnualBenefit: Math.max(...all.map(x => x.annualBenefitTenThousand)),
    absorptionCapacity: Math.max(...all.map(x => x.absorptionCapacityKw)),
    maxImprovement: Math.max(...all.map(x => x.absorptionImprovementPct)),
    minPayback: Math.min(...all.map(x => x.paybackPeriodYears === Infinity ? Infinity : x.paybackPeriodYears)),
    maxIrr: Math.max(...all.map(x => x.irrPct ?? -Infinity)),
    maxNpv: Math.max(...all.map(x => x.npv ?? -Infinity)),
  }
})

const comparisonReport = computed(() => {
  if (variants.value.length === 0) return null
  const bv = bestValues.value
  const details: { name: string; score: number; breakdown: { label: string; value: number; weight: number; weighted: number }[]; isWinner: boolean }[] = []
  const recommendations: { priority: string; choose: string; reason: string }[] = []

  variants.value.forEach(v => {
    const irr = v.computedIndicators.irrPct ?? 0
    const benefit = v.computedIndicators.annualBenefitTenThousand
    const invest = v.computedIndicators.totalInvestmentTenThousand
    const improve = v.computedIndicators.absorptionImprovementPct
    const payback = v.computedIndicators.paybackPeriodYears === Infinity ? 50 : v.computedIndicators.paybackPeriodYears
    const bd = [
      { label: 'IRR', value: irr, weight: 0.3, weighted: +(irr * 0.3).toFixed(2) },
      { label: '年收益(万元)', value: benefit, weight: 0.25, weighted: +(benefit * 0.25).toFixed(2) },
      { label: '消纳提升(%)', value: improve, weight: 0.2, weighted: +(improve * 0.2).toFixed(2) },
      { label: '总投资(万元)', value: invest, weight: -0.15, weighted: +(-invest * 0.15).toFixed(2) },
      { label: '回收期(年)', value: payback, weight: -0.1, weighted: +(-payback * 0.1).toFixed(2) },
    ]
    const totalScore = +(bd.reduce((s, x) => s + x.weighted, 0)).toFixed(2)
    details.push({ name: v.name, score: totalScore, breakdown: bd, isWinner: false })
  })

  const maxScore = Math.max(...details.map(d => d.score))
  details.forEach(d => { d.isWinner = d.score === maxScore })

  variants.value.forEach(v => {
    if (v.computedIndicators.totalInvestmentTenThousand === bv.minInvestment) recommendations.push({ priority: '最低总投资', choose: v.name, reason: `总投资${v.computedIndicators.totalInvestmentTenThousand.toFixed(0)}万元` })
    if (v.computedIndicators.annualBenefitTenThousand === bv.maxAnnualBenefit) recommendations.push({ priority: '最高年收益', choose: v.name, reason: `年收益${v.computedIndicators.annualBenefitTenThousand.toFixed(0)}万元` })
    if (v.computedIndicators.absorptionCapacityKw === bv.absorptionCapacity) recommendations.push({ priority: '最大消纳能力', choose: v.name, reason: `消纳${(v.computedIndicators.absorptionCapacityKw / 1000).toFixed(1)}MW` })
    if (v.computedIndicators.absorptionImprovementPct === bv.maxImprovement) recommendations.push({ priority: '最高消纳提升', choose: v.name, reason: `提升${v.computedIndicators.absorptionImprovementPct.toFixed(1)}%` })
    if (v.computedIndicators.paybackPeriodYears === bv.minPayback) recommendations.push({ priority: '最短回收期', choose: v.name, reason: `${v.computedIndicators.paybackPeriodYears.toFixed(1)}年` })
  })

  const sorted = [...details].sort((a, b) => b.score - a.score)
  const narrativeParts: string[] = []

  if (sorted.length >= 1) {
    const rankStr = sorted.map((d, i) => `第${i + 1}名"${d.name}"（${d.score}分）`).join('，')
    narrativeParts.push(`综合评分排名：${rankStr}。`)
  }

  if (sorted.length >= 2) {
    const w = sorted[0]
    const r = sorted[1]
    const diff = (w.score - r.score).toFixed(2)
    const advantages = w.breakdown.map((b, i) => ({ label: b.label, gap: +(b.weighted - r.breakdown[i].weighted).toFixed(2) })).filter(x => x.gap > 0).sort((a, b) => b.gap - a.gap)
    const disadvantages = w.breakdown.map((b, i) => ({ label: b.label, gap: +(b.weighted - r.breakdown[i].weighted).toFixed(2) })).filter(x => x.gap < 0).sort((a, b) => a.gap - b.gap)
    let compareStr = `推荐方案"${w.name}"总分${w.score}，领先次优方案"${r.name}"（${r.score}分）${diff}分。`
    if (advantages.length > 0) {
      const topAdv = advantages.slice(0, 2).map(a => `${a.label}（领先${Math.abs(a.gap).toFixed(2)}分）`).join('、')
      compareStr += `主要优势体现在${topAdv}。`
    }
    if (disadvantages.length > 0) {
      const topDis = disadvantages.slice(0, 2).map(a => `${a.label}（落后${Math.abs(a.gap).toFixed(2)}分）`).join('、')
      compareStr += `不足之处在于${topDis}。`
    }
    narrativeParts.push(compareStr)
  }

  sorted.forEach(d => {
    const pos = d.breakdown.filter(x => x.weight > 0).sort((a, b) => b.weighted - a.weighted)
    const neg = d.breakdown.filter(x => x.weight < 0).sort((a, b) => a.weighted - b.weighted)
    const best = pos[0]
    let s = `"${d.name}"：${best ? `核心优势在${best.label}（原始值${best.value}，加权${best.weighted}分）` : ''}`
    if (neg.length > 0) {
      const weakest = neg[neg.length - 1]
      s += `，${weakest.label}（原始值${weakest.value}）拉低评分。`
    }
    s += d.isWinner ? '综合最优，推荐首选。' : ''
    narrativeParts.push(s)
  })

  if (recommendations.length > 0) {
    narrativeParts.push('场景化建议：')
    recommendations.forEach(r => {
      narrativeParts.push(`- 若侧重"${r.priority}"，建议选用"${r.choose}"（${r.reason}）。`)
    })
  }

  if (sorted.length > 0) {
    const w = sorted[0]
    narrativeParts.push(`综上，在多方案综合比选后，"${w.name}"综合评分最高（${w.score}分），各项指标均衡且核心优势突出，推荐作为本项目的优选消纳方案。`)
  }

  return { details, metrics: recommendations, narrative: narrativeParts, recommendations }
})

function formatCell(key: string, v: SchemeVariant) {
  const ind = v.computedIndicators
  switch (key) {
    case 'variantName': return { text: v.name, isBest: false }
    case 'storageCapacity': return { text: `${v.storageConfig.requiredCapacityKwh?.toLocaleString()} kWh`, isBest: ind.absorptionCapacityKw === bestValues.value.absorptionCapacity }
    case 'reactiveCapacity': return { text: `${v.reactiveCompConfig.requiredCapacityKvar?.toLocaleString()} kvar`, isBest: false }
    case 'powerFactor': return { text: v.reactiveCompConfig.targetPowerFactor?.toFixed(2), isBest: false }
    case 'lineLength': return { text: `${v.lineModification.lineLengthKm} km`, isBest: false }
    case 'totalInvestment': return { text: `${ind.totalInvestmentTenThousand.toFixed(2)} 万元`, isBest: ind.totalInvestmentTenThousand === bestValues.value.minInvestment }
    case 'annualBenefit': return { text: `${ind.annualBenefitTenThousand.toFixed(1)} 万元`, isBest: ind.annualBenefitTenThousand === bestValues.value.maxAnnualBenefit }
    case 'absorptionCapacity': return { text: `${(ind.absorptionCapacityKw / 1000).toFixed(1)} MW`, isBest: ind.absorptionCapacityKw === bestValues.value.absorptionCapacity }
    case 'absorptionImprovement': return { text: `${ind.absorptionImprovementPct.toFixed(1)}%`, isBest: ind.absorptionImprovementPct === bestValues.value.maxImprovement }
    case 'payback': return { text: ind.paybackPeriodYears === Infinity ? '-' : `${ind.paybackPeriodYears.toFixed(1)} 年`, isBest: ind.paybackPeriodYears === bestValues.value.minPayback }
    case 'irr': return { text: ind.irrPct !== null ? `${ind.irrPct.toFixed(1)}%` : '-', isBest: ind.irrPct !== null && ind.irrPct === bestValues.value.maxIrr }
    case 'npv': return { text: ind.npv !== null ? `${(ind.npv / 10000).toFixed(0)} 万元` : '-', isBest: ind.npv !== null && ind.npv === bestValues.value.maxNpv }
    default: return { text: '-', isBest: false }
  }
}

// ===== Methods =====
async function runAnalysis(candidateId: string) {
  if (!candidateId) { analysisResult.value = null; return }
  analyzing.value = true
  analysisResult.value = null
  try {
    const result = await analyzeCandidatePoint(candidateId)
    analysisResult.value = result
    // 分析完成后自动填入推荐参数
    ratedCapacityKw.value = result.recommended.ratedCapacityKw
    storageConfig.value = { ...result.recommended.storage }
    reactiveConfig.value = { ...result.recommended.reactive }
    lineMod.value = { ...result.recommended.line }
  } catch { /* ignore */ }
  finally { analyzing.value = false }
}

watch(selectedCandidate, (val) => {
  if (val) runAnalysis(val)
  else analysisResult.value = null
})

async function loadCandidates() {
  if (candidates.value.length === 0) {
    try {
      const data = await fetchCandidatePoints()
      planningStore.setCandidates(data)
    } catch { /* ignore */ }
  }
}

async function generatePlan() {
  loading.value = true
  try {
    const analysis = analysisResult.value
    const result = await generateAbsorptionPlan({
      candidatePointId: selectedCandidate.value || 'cp-1',
      planName: planName.value,
      storageConfig: storageConfig.value,
      reactiveCompConfig: reactiveConfig.value,
      lineModification: lineMod.value,
      investmentCost: totalInvestment.value,
      annualBenefit: Math.round(totalInvestment.value * 0.35),
      candidatePointData: selectedCandidateData.value,
      pvOutputProfile: analysis?.pvOutputProfile || [],
      loadProfile: analysis?.loadProfile || [],
    })
    plan.value = result
    initEditingFromPlan(result)
    loadVariants()
  } finally {
    loading.value = false
  }
}

function initEditingFromPlan(p: AbsorptionPlanDetail) {
  editingStorage.value = { ...p.storageConfig }
  editingReactive.value = { ...p.reactiveCompConfig }
  editingLineMod.value = { ...p.lineModification }
}

// Variant management
async function saveCurrentAsVariant(name: string) {
  if (!plan.value || !name.trim()) return

  let irrPct: number | null = null
  let npv: number | null = null
  try {
    const roi = await roiAnalysis({
      capacityKw: computedAbsorptionKw.value || 50000,
      investment: computedTotalInvestment.value * 10000 || 47300000,
    })
    irrPct = roi.financialIndicators.irrPct
    npv = roi.financialIndicators.npv
  } catch { /* ignore */ }

  const variant: SchemeVariant = {
    id: `variant-${Date.now()}`,
    name: name.trim(),
    parentPlanId: plan.value.id,
    storageConfig: { ...editingStorage.value },
    reactiveCompConfig: { ...editingReactive.value },
    lineModification: { ...editingLineMod.value },
    computedIndicators: {
      totalInvestmentTenThousand: computedTotalInvestment.value,
      annualBenefitTenThousand: computedAnnualBenefit.value,
      absorptionCapacityKw: computedAbsorptionKw.value,
      absorptionImprovementPct: absorptionImprovementPct.value,
      paybackPeriodYears: computedPaybackPeriod.value === Infinity ? 0 : computedPaybackPeriod.value,
      irrPct, npv,
      storageCostBreakdown: {
        equipmentCost: Math.round(storageCost(editingStorage.value.requiredPowerKw) * 0.6),
        constructionCost: Math.round(storageCost(editingStorage.value.requiredPowerKw) * 0.25),
        otherCost: Math.round(storageCost(editingStorage.value.requiredPowerKw) * 0.15),
      },
      annualCashflow: [],
    },
    createdAt: new Date().toISOString(),
  }
  variants.value.push(variant)
  selectedVariantId.value = variant.id
  showSaveVariantDialog.value = false
  newVariantName.value = ''

  createPlanVariant(plan.value.id, {
    variantName: variant.name,
    storageConfig: variant.storageConfig,
    reactiveCompConfig: variant.reactiveCompConfig,
    lineModification: variant.lineModification,
    computedIndicators: variant.computedIndicators,
  }).catch(() => {})
}

function switchToVariant(variantId: string) {
  const v = variants.value.find(x => x.id === variantId)
  if (!v) return
  editingStorage.value = { ...v.storageConfig }
  editingReactive.value = { ...v.reactiveCompConfig }
  editingLineMod.value = { ...v.lineModification }
  selectedVariantId.value = variantId
}

function resetToBasePlan() {
  if (!plan.value) return
  editingStorage.value = { ...plan.value.storageConfig }
  editingReactive.value = { ...plan.value.reactiveCompConfig }
  editingLineMod.value = { ...plan.value.lineModification }
  selectedVariantId.value = ''
}

function deleteVariant(variantId: string) {
  const idx = variants.value.findIndex(x => x.id === variantId)
  if (idx >= 0) variants.value.splice(idx, 1)
  if (selectedVariantId.value === variantId) selectedVariantId.value = ''
  deletePlanVariant(variantId).catch(() => {})
}

async function loadVariants() {
  if (!plan.value) return
  try {
    variants.value = await fetchPlanVariants(plan.value.id)
  } catch { /* ignore */ }
}

onMounted(() => {
  loadCandidates().then(() => {
    const candidateId = route.query.candidateId as string
    if (candidateId && candidates.value.some(c => c.id === candidateId)) {
      selectedCandidate.value = candidateId
    }
  })
})
</script>

<template>
  <div>
    <!-- ===== 页面标题 ===== -->
    <div class="chart-panel-title">消纳方案智能编制</div>

    <!-- ===== 步骤1：选择候选接入点 ===== -->
    <div class="chart-panel">
      <div class="chart-panel-title">选择候选接入点</div>
      <el-form label-width="140px" size="small">
        <el-form-item label="候选接入点">
          <el-select v-model="selectedCandidate" style="width:380px" :loading="analyzing" placeholder="请选择候选接入点">
            <el-option v-for="c in candidates" :key="c.id" :label="`${c.locationDesc}（${c.comprehensiveScore}分）`" :value="c.id" />
          </el-select>
          <span v-if="analyzing" style="margin-left:12px;font-size:12px;color:#909399">正在分析接入点数据...</span>
        </el-form-item>
      </el-form>
    </div>

    <!-- ===== 步骤2：接入点综合分析（选点后自动展示） ===== -->
    <div v-if="analysisResult && !analyzing" class="chart-panel">
      <div class="chart-panel-title">接入点综合分析 — {{ analysisResult.siteInfo.name }}</div>

      <!-- 基础信息 -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;font-size:12px">
        <div><span style="color:#909399">年均辐照</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.siteInfo.annualIrradiance }} kWh/m²</span></div>
        <div><span style="color:#909399">等效小时</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.siteInfo.equivHours }} h</span></div>
        <div><span style="color:#909399">可接入容量</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.siteInfo.availableCapacityMw }} MW</span></div>
        <div><span style="color:#909399">距变电站</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.siteInfo.distanceToSubstationKm }} km</span></div>
      </div>

      <!-- 光伏出力与本地负荷对比曲线 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#606266">光伏出力与本地负荷对比</div>
          <ChartContainer :option="{
            tooltip: { trigger: 'axis' },
            legend: { data: ['光伏出力', '本地负荷'], bottom: 0, textStyle: { fontSize: 10, color: '#606266' }, itemWidth: 12, itemHeight: 8 },
            grid: { left: '10%', right: '5%', top: '12%', bottom: '18%' },
            xAxis: { type: 'category', data: analysisResult.pvOutputProfile.map(d => d.time), axisLabel: { interval: 3, fontSize: 9, color: '#909399' } },
            yAxis: { type: 'value', name: 'kW', nameTextStyle: { fontSize: 9, color: '#909399' }, axisLabel: { fontSize: 9, color: '#909399' }, splitLine: { lineStyle: { color: '#eee' } } },
            series: [
              { name: '光伏出力', type: 'line', data: analysisResult.pvOutputProfile.map(d => d.outputKw), symbol: 'circle', symbolSize: 3, lineStyle: { color: '#267F7B', width: 1.5 }, itemStyle: { color: '#267F7B' } },
              { name: '本地负荷', type: 'line', data: analysisResult.loadProfile.map(d => d.loadKw), symbol: 'circle', symbolSize: 3, lineStyle: { color: '#67C23A', width: 1.5 }, itemStyle: { color: '#67C23A' } },
            ],
          }" height="150px" />
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#606266">净负荷与倒送分析</div>
          <ChartContainer :option="{
            tooltip: { trigger: 'axis' },
            legend: { data: ['净负荷'], bottom: 0, textStyle: { fontSize: 10, color: '#606266' }, itemWidth: 12, itemHeight: 8 },
            grid: { left: '10%', right: '5%', top: '12%', bottom: '18%' },
            xAxis: { type: 'category', data: analysisResult.netLoadProfile.map(d => d.time), axisLabel: { interval: 3, fontSize: 9, color: '#909399' } },
            yAxis: { type: 'value', name: 'kW', nameTextStyle: { fontSize: 9, color: '#909399' }, axisLabel: { fontSize: 9, color: '#909399' }, splitLine: { lineStyle: { color: '#eee' } } },
            series: [{
              name: '净负荷', type: 'line', data: analysisResult.netLoadProfile.map(d => d.netKw), symbol: 'circle', symbolSize: 3,
              lineStyle: { color: '#E6A23C', width: 1.5 }, itemStyle: { color: '#E6A23C' },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(230,162,60,0.15)' }, { offset: 1, color: 'rgba(230,162,60,0)' }] } },
              markLine: { silent: true, symbol: 'none', lineStyle: { color: '#F56C6C', type: 'dashed', width: 1 }, data: [{ yAxis: 0, label: { formatter: '倒送线', fontSize: 9 } }] },
            }],
          }" height="150px" />
        </div>
      </div>

      <!-- 倒送风险 & 电压波动 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#606266">倒送风险评估</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            <div><span style="color:#909399">风险等级</span><span :style="{ marginLeft: '8px', fontWeight: 600, color: analysisResult.backfeedAnalysis.risk === 'high' ? '#F56C6C' : analysisResult.backfeedAnalysis.risk === 'medium' ? '#E6A23C' : '#67C23A' }">{{ analysisResult.backfeedAnalysis.risk === 'high' ? '高' : analysisResult.backfeedAnalysis.risk === 'medium' ? '中' : '低' }}</span></div>
            <div><span style="color:#909399">最大倒送</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.backfeedAnalysis.maxBackfeedKw.toLocaleString() }} kW</span></div>
            <div><span style="color:#909399">倒送时段/天</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.backfeedAnalysis.backfeedHoursCount }} h</span></div>
            <div><span style="color:#909399">倒送时段</span><span style="margin-left:8px;font-weight:600;font-size:11px">{{ analysisResult.backfeedAnalysis.backfeedHours.join(', ') }}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#606266">电压波动历史（近30天）</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            <div><span style="color:#909399">最大偏差</span><span :style="{ marginLeft: '8px', fontWeight: 600, color: analysisResult.voltageAnalysis.maxDeviationPct > 5 ? '#F56C6C' : '#E6A23C' }">{{ analysisResult.voltageAnalysis.maxDeviationPct }}%</span></div>
            <div><span style="color:#909399">平均偏差</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.voltageAnalysis.avgDeviationPct }}%</span></div>
            <div><span style="color:#909399">越限次数</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.voltageAnalysis.violationCount }} 次</span></div>
            <div><span style="color:#909399">越限率</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.voltageAnalysis.violationRatePct }}%</span></div>
          </div>
        </div>
      </div>

      <!-- 送出线路参数分析 -->
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#606266">送出线路参数分析</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:12px">
          <div><span style="color:#909399">输送距离</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.lineLengthKm }} km</span></div>
          <div><span style="color:#909399">当前规格</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.currentSpec }}</span></div>
          <div><span style="color:#909399">线路阻抗</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.currentImpedanceOhm }} Ω (R+jX)</span></div>
          <div><span style="color:#909399">额定容量</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.currentRatedMva }} MVA</span></div>
          <div><span style="color:#909399">施工难度</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.constructionDifficulty }}</span></div>
          <div><span style="color:#909399">实际峰值</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.actualPeakMva }} MVA</span></div>
          <div><span style="color:#909399">负载率</span><span :style="{ marginLeft: '8px', fontWeight: 600, color: analysisResult.lineAnalysis.isOverloaded ? '#F56C6C' : '#606266' }">{{ analysisResult.lineAnalysis.loadRatePct }}%</span></div>
          <div><span style="color:#909399">线路压降</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.voltageDropPct }}%</span></div>
          <div><span style="color:#909399">推荐升级</span><span style="margin-left:8px;font-weight:600;color:#267F7B">{{ analysisResult.lineAnalysis.currentSpec }} → {{ analysisResult.lineAnalysis.recommendedSpec }}</span></div>
          <div><span style="color:#909399">升级后额定</span><span style="margin-left:8px;font-weight:600">{{ analysisResult.lineAnalysis.targetRatedMva }} MVA</span></div>
        </div>
      </div>

      <!-- 推荐参数 -->
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">推荐参数</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:12px">
          <div style="padding:6px 8px;background:#f9fafb;border:1px solid #ebeef5;border-radius:4px">
            <div style="color:#909399">储能配置</div>
            <div style="font-weight:600">{{ analysisResult.recommended.storage.requiredPowerKw.toLocaleString() }} kW / {{ analysisResult.recommended.storage.requiredCapacityKwh.toLocaleString() }} kWh</div>
            <div style="font-size:11px;margin-top:2px">
              <span style="color:#909399">类型：</span><span style="font-weight:500">{{ storageTypeOptions.find(o => o.value === analysisResult!.recommended.storage.storageType)?.label }}</span>
            </div>
            <div style="font-size:11px;margin-top:1px">
              <span style="color:#909399">布局：</span><span style="font-weight:500">{{ layoutPlanOptions.find(o => o.value === analysisResult!.recommended.storage.layoutPlan)?.label || analysisResult!.recommended.storage.layoutPlan }}</span>
            </div>
            <div style="color:#909399;font-size:11px;margin-top:2px">{{ analysisResult.recommended.storage.reasoning }}</div>
          </div>
          <div style="padding:6px 8px;background:#f9fafb;border:1px solid #ebeef5;border-radius:4px">
            <div style="color:#909399">无功补偿</div>
            <div style="font-weight:600">{{ analysisResult.recommended.reactive.compType }} {{ analysisResult.recommended.reactive.requiredCapacityKvar.toLocaleString() }} kvar</div>
            <div style="color:#909399;font-size:11px;margin-top:2px">{{ analysisResult.recommended.reactive.reasoning }}</div>
          </div>
          <div style="padding:6px 8px;background:#f9fafb;border:1px solid #ebeef5;border-radius:4px">
            <div style="color:#909399">线路改造</div>
            <div style="font-weight:600">{{ analysisResult.recommended.line.currentSpec }} → {{ analysisResult.recommended.line.targetSpec }} ({{ analysisResult.recommended.line.lineLengthKm }}km)</div>
            <div style="color:#909399;font-size:11px;margin-top:2px">{{ analysisResult.recommended.line.reasoning }}</div>
          </div>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
        <el-input v-model="planName" style="width:320px" placeholder="请输入消纳方案名称" size="small" />
        <el-button type="primary" @click="generatePlan" :loading="loading">生成消纳方案</el-button>
      </div>
    </div>

    <!-- 没选候选点或分析失败 -->
    <div v-if="!analysisResult && !analyzing && selectedCandidate" class="chart-panel" style="text-align:center;padding:20px;color:#909399;font-size:13px">
      分析失败，请重新选择候选接入点
    </div>

    <!-- ===== 方案详情与对比（生成后展示） ===== -->
    <div v-if="plan" style="margin-top:12px">
      <div class="sub-tabs" style="margin-bottom:12px">
        <span :class="['sub-tab', { active: bottomActiveTab === 'detail' }]" @click="bottomActiveTab = 'detail'">方案详情</span>
        <span :class="['sub-tab', { active: bottomActiveTab === 'compare' }]" @click="bottomActiveTab = 'compare'">方案对比</span>
      </div>

      <!-- 方案详情 tab -->
      <div v-if="bottomActiveTab === 'detail'" class="chart-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="chart-panel-title" style="margin-bottom:0">方案详情 — {{ plan.planName }}</div>
        <el-switch
          v-model="detailEditing"
          active-text="编辑参数"
          inactive-text="预览数据"
          style="--el-switch-on-color:#267F7B;--el-switch-off-color:#909399"
        />
      </div>

      <!-- 编辑模式 -->
      <template v-if="detailEditing">
        <el-divider content-position="left">储能配置</el-divider>
        <el-form label-width="100px" size="small">
          <el-row :gutter="16">
            <el-col :span="8"><el-form-item label="额定容量"><el-input v-model.number="editingStorage.requiredCapacityKwh" type="number"><template #append>kWh</template></el-input></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="额定功率"><el-input v-model.number="editingStorage.requiredPowerKw" type="number"><template #append>kW</template></el-input></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="持续时长"><el-input v-model.number="editingStorage.durationHours" type="number"><template #append>h</template></el-input></el-form-item></el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12"><el-form-item label="储能类型"><el-select v-model="editingStorage.storageType" style="width:100%"><el-option v-for="o in storageTypeOptions" :key="o.value" :label="o.label" :value="o.value" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="布局方案"><el-select v-model="editingStorage.layoutPlan" style="width:100%"><el-option v-for="o in layoutPlanOptions" :key="o.value" :label="o.label" :value="o.value" /></el-select></el-form-item></el-col>
          </el-row>
        </el-form>

        <el-divider content-position="left">无功补偿</el-divider>
        <el-form label-width="100px" size="small">
          <el-row :gutter="16">
            <el-col :span="8"><el-form-item label="补偿类型"><el-select v-model="editingReactive.compType" style="width:100%"><el-option v-for="o in compTypeOptions" :key="o.value" :label="o.label" :value="o.value" /></el-select></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="补偿容量"><el-input v-model.number="editingReactive.requiredCapacityKvar" type="number"><template #append>kvar</template></el-input></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="目标功率因数"><el-input v-model.number="editingReactive.targetPowerFactor" type="number" :step="0.01" :min="0.9" :max="1.0" /></el-form-item></el-col>
          </el-row>
        </el-form>

        <el-divider content-position="left">线路改造方案</el-divider>
        <el-form label-width="100px" size="small">
          <el-row :gutter="16">
            <el-col :span="12"><el-form-item label="改造类型"><el-select v-model="editingLineMod.modificationType" style="width:100%"><el-option v-for="o in modTypeOptions" :key="o.value" :label="o.label" :value="o.value" /></el-select></el-form-item></el-col>
            <el-col :span="12">
              <el-form-item v-if="editingLineMod.modificationType === 'upgrade_transformer'" label="电压等级"><el-select v-model="editingLineMod.voltageLevel" style="width:100%"><el-option v-for="v in voltageLevelOptions" :key="v" :label="v" :value="v" /></el-select></el-form-item>
              <el-form-item v-else-if="editingLineMod.modificationType !== 'other'" label="线路长度"><el-input v-model.number="editingLineMod.lineLengthKm" type="number"><template #append>km</template></el-input></el-form-item>
            </el-col>
          </el-row>
          <el-row v-if="editingLineMod.modificationType === 'upgrade_conductor'" :gutter="16">
            <el-col :span="12"><el-form-item label="当前规格"><el-input v-model="editingLineMod.currentSpec" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="目标规格"><el-input v-model="editingLineMod.targetSpec" /></el-form-item></el-col>
          </el-row>
          <el-row v-if="editingLineMod.modificationType === 'new_tie_line'" :gutter="16">
            <el-col :span="12"><el-form-item label="目标规格"><el-input v-model="editingLineMod.targetSpec" /></el-form-item></el-col>
          </el-row>
          <el-row v-if="editingLineMod.modificationType === 'upgrade_transformer'" :gutter="16">
            <el-col :span="12"><el-form-item label="当前容量"><el-input v-model.number="editingLineMod.currentCapacityKva" type="number"><template #append>kVA</template></el-input></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="目标容量"><el-input v-model.number="editingLineMod.targetCapacityKva" type="number"><template #append>kVA</template></el-input></el-form-item></el-col>
          </el-row>
        </el-form>
      </template>

      <!-- 变体管理（编辑和预览模式均可见） -->
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <el-button type="primary" size="small" @click="showSaveVariantDialog = true">保存为变体方案</el-button>
        <el-button size="small" @click="resetToBasePlan" :disabled="!selectedVariantId">恢复基准方案</el-button>
        <span v-if="selectedVariantId" style="font-size:12px;color:#909399">当前查看: {{ variants.find(v => v.id === selectedVariantId)?.name }}</span>
      </div>

      <el-divider content-position="left">已保存变体</el-divider>
      <div v-if="variants.length === 0" style="color:#909399;font-size:13px;padding:8px 0">调整参数后点击"保存为变体方案"可创建对比方案</div>
      <div v-else style="display:flex;flex-wrap:wrap;gap:8px">
        <el-tag v-for="v in variants" :key="v.id" :type="v.id === selectedVariantId ? 'primary' : 'info'" style="cursor:pointer" closable @click="switchToVariant(v.id)" @close="deleteVariant(v.id)">{{ v.name }}</el-tag>
      </div>

      <el-dialog v-model="showSaveVariantDialog" title="保存为变体方案" width="400px">
        <el-form>
          <el-form-item label="变体名称"><el-input v-model="newVariantName" placeholder="如：保守配置、激进配置" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showSaveVariantDialog = false">取消</el-button>
          <el-button type="primary" @click="saveCurrentAsVariant(newVariantName)" :disabled="!newVariantName.trim()">保存</el-button>
        </template>
      </el-dialog>

      <!-- 预览模式 -->
      <template v-if="!detailEditing && plan">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- 储能配置 -->
          <div style="border:1px solid #ebeef5;border-radius:4px;overflow:hidden">
            <div style="font-size:13px;font-weight:600;color:#303133;padding:8px 12px;background:#fafafa;border-bottom:1px solid #ebeef5">储能配置</div>
            <div style="padding:8px 12px">
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">额定容量</span><span style="color:#303133;font-weight:500">{{ plan!.storageConfig?.requiredCapacityKwh?.toLocaleString() }} kWh</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">额定功率</span><span style="color:#303133;font-weight:500">{{ plan!.storageConfig?.requiredPowerKw?.toLocaleString() }} kW</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">持续时长</span><span style="color:#303133;font-weight:500">{{ plan!.storageConfig?.durationHours }} h</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">储能类型</span><span style="color:#303133;font-weight:500">{{ storageTypeOptions.find((o:any) => o.value === plan!.storageConfig?.storageType)?.label || plan!.storageConfig?.storageType }}</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">布局方案</span><span style="color:#303133;font-weight:500">{{ layoutPlanOptions.find((o:any) => o.value === plan!.storageConfig?.layoutPlan)?.label || plan!.storageConfig?.layoutPlan || '-' }}</span></div>
            </div>
          </div>

          <!-- 无功补偿 -->
          <div style="border:1px solid #ebeef5;border-radius:4px;overflow:hidden">
            <div style="font-size:13px;font-weight:600;color:#303133;padding:8px 12px;background:#fafafa;border-bottom:1px solid #ebeef5">无功补偿</div>
            <div style="padding:8px 12px">
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">补偿类型</span><span style="color:#303133;font-weight:500">{{ compTypeOptions.find((o:any) => o.value === plan!.reactiveCompConfig?.compType)?.label || plan!.reactiveCompConfig?.compType }}</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">补偿容量</span><span style="color:#303133;font-weight:500">{{ plan!.reactiveCompConfig?.requiredCapacityKvar?.toLocaleString() }} kvar</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">目标功率因数</span><span style="color:#303133;font-weight:500">{{ plan!.reactiveCompConfig?.targetPowerFactor }}</span></div>
            </div>
          </div>

          <!-- 线路改造 -->
          <div style="border:1px solid #ebeef5;border-radius:4px;overflow:hidden;grid-column:1 / -1">
            <div style="font-size:13px;font-weight:600;color:#303133;padding:8px 12px;background:#fafafa;border-bottom:1px solid #ebeef5">线路改造方案</div>
            <div style="padding:8px 12px">
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">改造类型</span><span style="color:#303133;font-weight:500">{{ modTypeOptions.find((o:any) => o.value === plan!.lineModification?.modificationType)?.label || plan!.lineModification?.modificationType }}</span></div>
              <template v-if="plan!.lineModification?.modificationType === 'upgrade_transformer'">
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">电压等级</span><span style="color:#303133;font-weight:500">{{ plan!.lineModification?.voltageLevel }}</span></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">当前容量</span><span style="color:#303133;font-weight:500">{{ plan!.lineModification?.currentCapacityKva?.toLocaleString() }} kVA</span></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">目标容量</span><span style="color:#303133;font-weight:500">{{ plan!.lineModification?.targetCapacityKva?.toLocaleString() }} kVA</span></div>
              </template>
              <template v-else>
                <div v-if="plan!.lineModification?.modificationType !== 'other'" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">线路长度</span><span style="color:#303133;font-weight:500">{{ plan!.lineModification?.lineLengthKm }} km</span></div>
                <div v-if="plan!.lineModification?.modificationType === 'upgrade_conductor'" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">当前规格</span><span style="color:#303133;font-weight:500">{{ plan!.lineModification?.currentSpec }}</span></div>
                <div v-if="plan!.lineModification?.modificationType === 'upgrade_conductor' || plan!.lineModification?.modificationType === 'new_tie_line'" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#909399">目标规格</span><span style="color:#303133;font-weight:500">{{ plan!.lineModification?.targetSpec }}</span></div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>  <!-- end detail tab -->

      <!-- 方案对比 tab -->
      <div v-if="bottomActiveTab === 'compare'" class="chart-panel">
        <div v-if="variants.length === 0" style="text-align:center;padding:60px;color:#909399;font-size:13px">
          暂无变体方案，请在"方案详情"标签页保存变体后再进行对比
        </div>
        <template v-if="variants.length > 0">
      <div class="chart-panel-title">多方案对比</div>
      <div style="font-size:12px;color:#909399;margin-bottom:8px">基准方案：{{ plan!.planName }}</div>
      <template v-if="comparisonReport">
        <div style="margin-bottom:12px;padding:10px 12px;background:#f9fafb;border:1px solid #ebeef5;border-radius:4px">
          <div style="font-size:13px;font-weight:600;color:#303133;margin-bottom:6px">综合推荐报告</div>
          <template v-for="(p, pi) in comparisonReport.narrative" :key="pi">
            <div v-if="p.startsWith('场景化建议')" style="margin-top:6px;font-size:13px;color:#606266;line-height:1.6">{{ p }}</div>
            <div v-else-if="p.startsWith('-')" style="margin-left:14px;font-size:12.5px;color:#606266;line-height:1.6">{{ p }}</div>
            <div v-else-if="p.startsWith('综上')" style="margin-top:6px;padding-top:6px;border-top:1px dashed #e4e7ed;font-weight:500;color:#303133;font-size:13px;line-height:1.6">{{ p }}</div>
            <div v-else style="font-size:13px;color:#606266;line-height:1.6">{{ p }}</div>
          </template>
          <div style="margin-top:4px;font-size:12px;color:#909399">
            评分规则：总分 = IRR×0.3 + 年收益(万元)×0.25 + 消纳提升(%)×0.2 - 总投资(万元)×0.15 - 回收期(年)×0.1
          </div>
        </div>
      </template>
      <el-table :data="comparisonTableData" border size="small" style="width:100%">
        <el-table-column label="指标" prop="label" width="150" fixed />
        <el-table-column v-for="v in variants" :key="v.id" :label="v.name" min-width="170">
          <template #default="{ row }">
            <span v-if="formatCell(row.key, v).isBest" class="best-value">
              {{ formatCell(row.key, v).text }}
            </span>
            <span v-else>
              {{ formatCell(row.key, v).text }}
            </span>
          </template>
        </el-table-column>
      </el-table>
        </template>
    </div>  <!-- end compare tab -->
    </div>  <!-- end outer tab container -->
  </div>
</template>

<style scoped>
.sub-tabs {
  display: flex;
  gap: 0;
}
.sub-tab {
  padding: 6px 18px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-right: none;
  background: #fff;
}
.sub-tab:first-child { border-radius: 4px 0 0 4px; }
.sub-tab:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #dcdfe6; }
.sub-tab.active { background: #267F7B; color: #fff; border-color: #267F7B; }
.sub-tab.active + .sub-tab { border-left-color: #267F7B; }
.best-value {
  color: #67c23a;
  font-weight: 700;
}
</style>
