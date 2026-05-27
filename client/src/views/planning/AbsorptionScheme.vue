<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlanningStore } from '@/stores/planning.store'
import {
  generateAbsorptionPlan, fetchAbsorptionPlan, updateAbsorptionPlan,
  fetchCandidatePoints, fetchPlanVariants, createPlanVariant, deletePlanVariant,
  roiAnalysis,
} from '@/api/planning'
import type { AbsorptionPlanDetail, CandidatePoint, StorageConfig, ReactiveCompConfig, LineModificationPlan, SchemeVariant } from '@new-energy/shared'
import ChartContainer from '@/components/common/ChartContainer.vue'

const route = useRoute()
const planningStore = usePlanningStore()
const { candidates } = storeToRefs(planningStore)
const loading = ref(false)
const plan = ref<AbsorptionPlanDetail | null>(null)
const activeTab = ref<'generation' | 'detail' | 'compare'>('generation')
const selectedCandidate = ref('')

// Form data (generation tab) — 选中候选接入点后自动填入推荐参数
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

// Editing state (detail tab — separated from plan.value for instant computed feedback)
const editingStorage = ref<StorageConfig>({ requiredCapacityKwh: 0, requiredPowerKw: 0, storageType: 'lithium', durationHours: 2, estimatedCost: 0, layoutPlan: '' })
const editingReactive = ref<ReactiveCompConfig>({ compType: 'SVG', requiredCapacityKvar: 0, targetPowerFactor: 0.95, estimatedCost: 0 })
const editingLineMod = ref<LineModificationPlan>({ modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: 0, estimatedCost: 0, description: '', currentCapacityKva: 0, targetCapacityKva: 0, voltageLevel: '10kV' })

// Variant management
const variants = ref<SchemeVariant[]>([])
const selectedVariantId = ref('')
const showSaveVariantDialog = ref(false)
const newVariantName = ref('')

const detailEditing = ref(false)

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

function storageCost(powerKw: number) { return Math.round(powerKw * 1500 / 10000) }
function reactiveCost(kvar: number) { return Math.round(kvar * 200 / 10000) }
function lineCost(km: number) { return Math.round(km * 100) }
/** 变压器造价粗略估算：目标容量(kVA) × 单价(元/kVA) / 10000 → 万元 */
function transformerCost(kva: number) { return Math.round(kva * 200 / 10000) }

function lineModCost(m: { modificationType: string; lineLengthKm: number; targetCapacityKva?: number }) {
  if (m.modificationType === 'upgrade_transformer') return transformerCost(m.targetCapacityKva || 0)
  return lineCost(m.lineLengthKm)
}

// Generation tab computed
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

// ===== Chart analysis data for detail tab =====
const chartMaxVal = 50000

const filteredTimeLabels = computed(() => {
  if (!plan.value?.pvOutputProfile) return []
  return plan.value.pvOutputProfile.filter((_pt: any, idx: number) => idx % 4 === 0).map((pt: any) => pt.time)
})

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
  // 假设线路额定容量（MVA），按负载率估算
  const ratedMva = 50
  return load.map((pt: any) => {
    const loadMva = pt.loadKw / 1000 * 1.05
    const loadRatePct = Math.min(150, loadMva / ratedMva * 100)
    return { time: pt.time, loadMva, loadRatePct }
  })
})

const lineCurrentCapacityMva = computed(() => {
  const spec = editingLineMod.value.currentSpec || 'LGJ-240'
  const map: Record<string, number> = { 'LGJ-120': 30, 'LGJ-185': 42, 'LGJ-240': 50, 'LGJ-300': 58, 'LGJ-400': 68, 'LGJ-630': 85 }
  return map[spec] || 50
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

// Comparison analysis report
const comparisonReport = computed(() => {
  if (variants.value.length === 0) return null
  const bv = bestValues.value
  const metrics: { label: string; winner: string }[] = []
  const details: { name: string; score: number; breakdown: { label: string; value: number; weight: number; weighted: number }[]; isWinner: boolean }[] = []

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
  const winners = details.filter(d => d.isWinner)

  variants.value.forEach(v => {
    if (v.computedIndicators.totalInvestmentTenThousand === bv.minInvestment) metrics.push({ label: '最低总投资', winner: v.name })
    if (v.computedIndicators.annualBenefitTenThousand === bv.maxAnnualBenefit) metrics.push({ label: '最高年收益', winner: v.name })
    if (v.computedIndicators.absorptionCapacityKw === bv.absorptionCapacity) metrics.push({ label: '最大消纳能力', winner: v.name })
    if (v.computedIndicators.absorptionImprovementPct === bv.maxImprovement) metrics.push({ label: '最高消纳提升', winner: v.name })
    if (v.computedIndicators.paybackPeriodYears === bv.minPayback) metrics.push({ label: '最短回收期', winner: v.name })
    if (v.computedIndicators.irrPct !== null && v.computedIndicators.irrPct === bv.maxIrr) metrics.push({ label: '最高IRR', winner: v.name })
    if (v.computedIndicators.npv !== null && v.computedIndicators.npv === bv.maxNpv) metrics.push({ label: '最大NPV', winner: v.name })
  })

  // ===== Build structured narrative =====
  // Rule 1: 先总体排名，列出所有方案得分
  // Rule 2: 逐方案分析优劣势
  // Rule 3: 单项指标优胜
  // Rule 4: 场景推荐
  // Rule 5: 最终结论

  const sorted = [...details].sort((a, b) => b.score - a.score)
  const narrativeParts: string[] = []
  const recommendations: { priority: string; choose: string; reason: string }[] = []

  // --- Part 1: 总体排名 ---
  if (sorted.length >= 1) {
    const rankStr = sorted.map((d, i) => `第${i + 1}名"${d.name}"（${d.score}分）`).join('，')
    narrativeParts.push(`综合评分排名：${rankStr}。`)
  }

  // --- Part 2: Winner vs runner-up comparison ---
  if (sorted.length >= 2) {
    const w = sorted[0]
    const r = sorted[1]
    const diff = (w.score - r.score).toFixed(2)
    // Find which metrics the winner beat the runner-up on
    const advantages = w.breakdown.map((b, i) => {
      const rVal = r.breakdown[i].weighted
      return { label: b.label, gap: +(b.weighted - rVal).toFixed(2) }
    }).filter(x => x.gap > 0).sort((a, b) => b.gap - a.gap)
    const disadvantages = w.breakdown.map((b, i) => {
      const rVal = r.breakdown[i].weighted
      return { label: b.label, gap: +(b.weighted - rVal).toFixed(2) }
    }).filter(x => x.gap < 0).sort((a, b) => a.gap - b.gap)

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

  // --- Part 3: 各方案优劣势分析 ---
  sorted.forEach((d, i) => {
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

  // --- Part 4: 场景化推荐 ---
  // Which variant is best for each scenario
  if (bv.maxIrr > -Infinity) {
    const bestIrr = variants.value.find(v => v.computedIndicators.irrPct === bv.maxIrr)
    if (bestIrr && bestIrr.computedIndicators.irrPct !== null) {
      recommendations.push({ priority: '追求最高投资回报率', choose: bestIrr.name, reason: `IRR达${bestIrr.computedIndicators.irrPct.toFixed(1)}%` })
    }
  }
  if (bv.minInvestment > 0) {
    const bestInvest = variants.value.find(v => v.computedIndicators.totalInvestmentTenThousand === bv.minInvestment)
    if (bestInvest) {
      recommendations.push({ priority: '控制初始投资规模', choose: bestInvest.name, reason: `总投资仅${bestInvest.computedIndicators.totalInvestmentTenThousand.toFixed(0)}万元` })
    }
  }
  if (bv.minPayback < Infinity) {
    const bestPayback = variants.value.find(v => v.computedIndicators.paybackPeriodYears === bv.minPayback)
    if (bestPayback) {
      recommendations.push({ priority: '最快回收投资', choose: bestPayback.name, reason: `回收期仅${bestPayback.computedIndicators.paybackPeriodYears.toFixed(1)}年` })
    }
  }
  if (bv.absorptionCapacity > 0) {
    const bestAbs = variants.value.find(v => v.computedIndicators.absorptionCapacityKw === bv.absorptionCapacity)
    if (bestAbs) {
      recommendations.push({ priority: '最大化消纳能力', choose: bestAbs.name, reason: `消纳能力达${(bestAbs.computedIndicators.absorptionCapacityKw / 1000).toFixed(1)}MW` })
    }
  }

  if (recommendations.length > 0) {
    narrativeParts.push('场景化建议：')
    recommendations.forEach(r => {
      narrativeParts.push(`- 若侧重"${r.priority}"，建议选用"${r.choose}"（${r.reason}）。`)
    })
  }

  // --- Part 5: 最终结论 ---
  if (sorted.length > 0) {
    const w = sorted[0]
    narrativeParts.push(`综上，在多方案综合比选后，"${w.name}"综合评分最高（${w.score}分），各项指标均衡且核心优势突出，推荐作为本项目的优选消纳方案。`)
  }

  return { details, metrics, narrative: narrativeParts, recommendations }
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
function fillFromCandidate(candidate: CandidatePoint) {
  const capacityKw = candidate.recommendedCapacityKw
  ratedCapacityKw.value = capacityKw
  const storagePower = Math.round(capacityKw * 0.15 / 100) * 100
  const storageEnergy = storagePower * 2
  const reactiveKvar = Math.round(capacityKw * 0.25 / 100) * 100
  const lineKm = candidate.transmissionLineLengthKm

  storageConfig.value = { requiredCapacityKwh: storageEnergy, requiredPowerKw: storagePower, storageType: 'lithium', durationHours: 2, estimatedCost: 0, layoutPlan: '' }
  reactiveConfig.value = { compType: 'SVG', requiredCapacityKvar: reactiveKvar, targetPowerFactor: 0.95, estimatedCost: 0 }
  lineMod.value = { modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: lineKm, estimatedCost: 0, description: '', currentCapacityKva: 0, targetCapacityKva: 0, voltageLevel: '10kV' }
}

watch(selectedCandidate, (val) => {
  const c = candidates.value.find(x => x.id === val)
  if (c) fillFromCandidate(c)
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
    const result = await generateAbsorptionPlan({
      candidatePointId: selectedCandidate.value || 'cp-1',
      planName: '光伏接入消纳方案',
      storageConfig: storageConfig.value,
      reactiveCompConfig: reactiveConfig.value,
      lineModification: lineMod.value,
      investmentCost: totalInvestment.value,
      annualBenefit: Math.round(totalInvestment.value * 0.35),
      candidatePointData: selectedCandidateData.value,
    })
    plan.value = result
    initEditingFromPlan(result)
    activeTab.value = 'detail'
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

function updateParameter(param: string, value: number) {
  if (!plan.value) return
  const updated = { ...plan.value, parameters: { ...plan.value.parameters, [param]: value } }
  updateAbsorptionPlan(plan.value.id, updated).then(r => { plan.value = r })
}

// Variant management
async function saveCurrentAsVariant(name: string) {
  if (!plan.value || !name.trim()) return

  // 计算经济指标用于方案对比
  let irrPct: number | null = null
  let npv: number | null = null
  let annualCashflow: any[] = []
  try {
    const roi = await roiAnalysis({
      capacityKw: computedAbsorptionKw.value || 50000,
      investment: computedTotalInvestment.value * 10000 || 47300000,
      storageConfig: editingStorage.value,
      reactiveCompConfig: editingReactive.value,
      lineModification: editingLineMod.value,
    })
    irrPct = roi.financialIndicators.irrPct
    npv = roi.financialIndicators.npv
    annualCashflow = roi.yearlyCashflow ?? []
  } catch { /* 不影响保存 */ }

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
      irrPct,
      npv,
      storageCostBreakdown: {
        equipmentCost: Math.round(storageCost(editingStorage.value.requiredPowerKw) * 0.6),
        constructionCost: Math.round(storageCost(editingStorage.value.requiredPowerKw) * 0.25),
        otherCost: Math.round(storageCost(editingStorage.value.requiredPowerKw) * 0.15),
      },
      annualCashflow,
    },
    createdAt: new Date().toISOString(),
  }
  variants.value.push(variant)
  selectedVariantId.value = variant.id
  showSaveVariantDialog.value = false
  newVariantName.value = ''

  // Sync to backend
  createPlanVariant(plan.value.id, {
    variantName: variant.name,
    storageConfig: variant.storageConfig,
    reactiveCompConfig: variant.reactiveCompConfig,
    lineModification: variant.lineModification,
    computedIndicators: variant.computedIndicators,
  }).catch(() => { /* frontend already saved */ })
}

function switchToVariant(variantId: string) {
  const v = variants.value.find(x => x.id === variantId)
  if (!v) return
  editingStorage.value = { ...v.storageConfig }
  editingReactive.value = { ...v.reactiveCompConfig }
  editingLineMod.value = { ...v.lineModification }
  selectedVariantId.value = variantId
  activeTab.value = 'detail'
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
    <div class="sub-tabs" style="margin-bottom:12px">
      <span :class="['sub-tab', { active: activeTab === 'generation' }]" @click="activeTab = 'generation'">方案编制</span>
      <span :class="['sub-tab', { active: activeTab === 'detail' }]" @click="activeTab = 'detail'">方案详情</span>
      <span :class="['sub-tab', { active: activeTab === 'compare' }]" @click="activeTab = 'compare'">方案对比</span>
    </div>

    <!-- ===== Generation Tab ===== -->
    <div v-if="activeTab === 'generation'" class="chart-panel">
      <div class="chart-panel-title">消纳方案参数配置</div>
      <el-form label-width="140px" size="small">
        <el-form-item label="关联候选接入点">
          <el-select v-model="selectedCandidate" style="width:300px">
            <el-option v-for="c in candidates" :key="c.id" :label="c.locationDesc" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-form label-width="140px" size="small">
        <el-form-item label="光伏额定容量">
          <el-input v-model.number="ratedCapacityKw" type="number" style="width:200px"><template #append>kW</template></el-input>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">储能配置</el-divider>
      <el-form label-width="140px" size="small">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="额定容量"><el-input v-model.number="storageConfig.requiredCapacityKwh" type="number"><template #append>kWh</template></el-input></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="额定功率"><el-input v-model.number="storageConfig.requiredPowerKw" type="number"><template #append>kW</template></el-input></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="持续时长"><el-input v-model.number="storageConfig.durationHours" type="number"><template #append>h</template></el-input></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="储能类型"><el-select v-model="storageConfig.storageType" style="width:100%">
              <el-option v-for="o in storageTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select></el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-divider content-position="left">无功补偿</el-divider>
      <el-form label-width="140px" size="small">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="补偿类型"><el-select v-model="reactiveConfig.compType" style="width:100%">
              <el-option v-for="o in compTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="补偿容量"><el-input v-model.number="reactiveConfig.requiredCapacityKvar" type="number"><template #append>kvar</template></el-input></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="目标功率因数">
              <el-input v-model.number="reactiveConfig.targetPowerFactor" type="number" :step="0.01" :min="0.9" :max="1.0">
                <template #append>{{ powerFactorValid ? '✓' : '需要0.95-1.0' }}</template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-divider content-position="left">线路改造方案</el-divider>
      <el-form label-width="140px" size="small">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="改造类型"><el-select v-model="lineMod.modificationType" style="width:100%">
              <el-option v-for="o in modTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="lineMod.modificationType === 'upgrade_transformer'" label="电压等级">
              <el-select v-model="lineMod.voltageLevel" style="width:100%">
                <el-option v-for="v in voltageLevelOptions" :key="v" :label="v" :value="v" />
              </el-select>
            </el-form-item>
            <el-form-item v-else-if="lineMod.modificationType !== 'other'" label="线路长度">
              <el-input v-model.number="lineMod.lineLengthKm" type="number"><template #append>km</template></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="lineMod.modificationType === 'upgrade_conductor'" :gutter="20">
          <el-col :span="12">
            <el-form-item label="当前规格"><el-input v-model="lineMod.currentSpec" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标规格"><el-input v-model="lineMod.targetSpec" /></el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="lineMod.modificationType === 'new_tie_line'" :gutter="20">
          <el-col :span="12">
            <el-form-item label="目标规格"><el-input v-model="lineMod.targetSpec" /></el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="lineMod.modificationType === 'upgrade_transformer'" :gutter="20">
          <el-col :span="12">
            <el-form-item label="当前容量"><el-input v-model.number="lineMod.currentCapacityKva" type="number"><template #append>kVA</template></el-input></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标容量"><el-input v-model.number="lineMod.targetCapacityKva" type="number"><template #append>kVA</template></el-input></el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-divider />
      <el-button type="primary" @click="generatePlan" :loading="loading">生成消纳方案</el-button>
    </div>

    <!-- ===== Detail Tab ===== -->
    <div v-if="activeTab === 'detail' && plan" class="chart-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="chart-panel-title" style="margin-bottom:0">消纳方案详情 — {{ plan.planName }}</div>
        <el-switch
          v-model="detailEditing"
          active-text="编辑参数"
          inactive-text="预览数据"
          style="--el-switch-on-color:#267F7B;--el-switch-off-color:#909399"
        />
      </div>


      <!-- Edit mode: parameter adjustment -->
      <template v-if="detailEditing">
        <!-- ===== 储能配置 ===== -->
        <el-divider content-position="left">储能配置</el-divider>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">光伏出力与负荷对比</div>
            <ChartContainer :option="storageChartOption" height="140px" />
            <div style="font-size:11px;color:#909399;margin-top:2px">储能容量 {{ editingStorage.requiredCapacityKwh?.toLocaleString() }} kWh</div>
          </div>
          <div>
            <el-form label-width="100px" size="small">
              <el-form-item label="额定容量"><el-input v-model.number="editingStorage.requiredCapacityKwh" type="number"><template #append>kWh</template></el-input></el-form-item>
              <el-form-item label="额定功率"><el-input v-model.number="editingStorage.requiredPowerKw" type="number"><template #append>kW</template></el-input></el-form-item>
              <el-form-item label="持续时长"><el-input v-model.number="editingStorage.durationHours" type="number"><template #append>h</template></el-input></el-form-item>
              <el-form-item label="储能类型"><el-select v-model="editingStorage.storageType" style="width:100%">
                <el-option v-for="o in storageTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select></el-form-item>
            </el-form>
          </div>
        </div>

        <!-- ===== 无功补偿 ===== -->
        <el-divider content-position="left">无功补偿</el-divider>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">无功需求分析</div>
            <ChartContainer :option="reactiveChartOption" height="140px" />
          </div>
          <div>
            <el-form label-width="100px" size="small">
              <el-form-item label="补偿类型"><el-select v-model="editingReactive.compType" style="width:100%">
                <el-option v-for="o in compTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select></el-form-item>
              <el-form-item label="补偿容量"><el-input v-model.number="editingReactive.requiredCapacityKvar" type="number"><template #append>kvar</template></el-input></el-form-item>
              <el-form-item label="目标功率因数"><el-input v-model.number="editingReactive.targetPowerFactor" type="number" :step="0.01" :min="0.9" :max="1.0" /></el-form-item>
            </el-form>
          </div>
        </div>

        <!-- ===== 线路改造 ===== -->
        <el-divider content-position="left">线路改造方案</el-divider>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">线路负载率分析</div>
            <ChartContainer :option="lineChartOption" height="140px" />
            <div v-if="editingLineMod.modificationType === 'upgrade_transformer'" style="font-size:11px;color:#909399;margin-top:2px">目标容量 {{ editingLineMod.targetCapacityKva?.toLocaleString() }} kVA</div>
            <div v-else style="font-size:11px;color:#909399;margin-top:2px">当前线长 {{ editingLineMod.lineLengthKm }} km</div>
          </div>
          <div>
            <el-form label-width="100px" size="small">
              <el-form-item label="改造类型"><el-select v-model="editingLineMod.modificationType" style="width:100%">
                <el-option v-for="o in modTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select></el-form-item>
              <el-form-item v-if="editingLineMod.modificationType === 'upgrade_transformer'" label="电压等级">
                <el-select v-model="editingLineMod.voltageLevel" style="width:100%">
                  <el-option v-for="v in voltageLevelOptions" :key="v" :label="v" :value="v" />
                </el-select>
              </el-form-item>
              <el-form-item v-else-if="editingLineMod.modificationType !== 'other'" label="线路长度">
                <el-input v-model.number="editingLineMod.lineLengthKm" type="number"><template #append>km</template></el-input>
              </el-form-item>
              <template v-if="editingLineMod.modificationType === 'upgrade_conductor'">
                <el-form-item label="当前规格"><el-input v-model="editingLineMod.currentSpec" /></el-form-item>
                <el-form-item label="目标规格"><el-input v-model="editingLineMod.targetSpec" /></el-form-item>
              </template>
              <el-form-item v-if="editingLineMod.modificationType === 'new_tie_line'" label="目标规格">
                <el-input v-model="editingLineMod.targetSpec" />
              </el-form-item>
              <template v-if="editingLineMod.modificationType === 'upgrade_transformer'">
                <el-form-item label="当前容量"><el-input v-model.number="editingLineMod.currentCapacityKva" type="number"><template #append>kVA</template></el-input></el-form-item>
                <el-form-item label="目标容量"><el-input v-model.number="editingLineMod.targetCapacityKva" type="number"><template #append>kVA</template></el-input></el-form-item>
              </template>
            </el-form>
          </div>
        </div>

<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <el-button type="primary" size="small" @click="showSaveVariantDialog = true">保存为变体方案</el-button>
          <el-button size="small" @click="resetToBasePlan" :disabled="!selectedVariantId">恢复基准方案</el-button>
          <span v-if="selectedVariantId" style="font-size:12px;color:#909399;margin-left:4px">当前查看: {{ variants.find(v => v.id === selectedVariantId)?.name }}</span>
        </div>

        <el-divider content-position="left">已保存变体</el-divider>
        <div v-if="variants.length === 0" style="color:#909399;font-size:13px;padding:8px 0">调整参数后点击"保存为变体方案"可创建对比方案</div>
        <div v-else style="display:flex;flex-wrap:wrap;gap:8px">
          <el-tag v-for="v in variants" :key="v.id" :type="v.id === selectedVariantId ? 'primary' : 'info'" style="cursor:pointer" closable @click="switchToVariant(v.id)" @close="deleteVariant(v.id)">
            {{ v.name }}
          </el-tag>
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
      </template>

      <template v-if="!detailEditing && plan">
        <el-divider content-position="left">储能配置</el-divider>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">光伏出力与负荷对比</div>
            <ChartContainer :option="storageChartOption" height="140px" />
          </div>
          <div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 0">
              <div><div style="font-size:11px;color:#909399">额定容量</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.storageConfig?.requiredCapacityKwh?.toLocaleString() }} kWh</div></div>
              <div><div style="font-size:11px;color:#909399">额定功率</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.storageConfig?.requiredPowerKw?.toLocaleString() }} kW</div></div>
              <div><div style="font-size:11px;color:#909399">储能类型</div><div style="font-size:13px;font-weight:600;color:#303133">{{ storageTypeOptions.find((o:any) => o.value === plan!.storageConfig?.storageType)?.label || plan!.storageConfig?.storageType }}</div></div>
            </div>
          </div>
        </div>

        <el-divider content-position="left">无功补偿</el-divider>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">无功需求分析</div>
            <ChartContainer :option="reactiveChartOption" height="140px" />
          </div>
          <div>
            <div style="display:grid;grid-template-columns:1fr;gap:12px;padding:4px 0">
              <div><div style="font-size:11px;color:#909399">补偿类型</div><div style="font-size:13px;font-weight:600;color:#303133">{{ compTypeOptions.find((o:any) => o.value === plan!.reactiveCompConfig?.compType)?.label || plan!.reactiveCompConfig?.compType }}</div></div>
              <div><div style="font-size:11px;color:#909399">补偿容量</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.reactiveCompConfig?.requiredCapacityKvar?.toLocaleString() }} kvar</div></div>
            </div>
          </div>
        </div>

        <el-divider content-position="left">线路改造方案</el-divider>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#606266">线路负载率分析</div>
            <ChartContainer :option="lineChartOption" height="140px" />
          </div>
          <div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 0">
              <div><div style="font-size:11px;color:#909399">改造类型</div><div style="font-size:13px;font-weight:600;color:#303133">{{ modTypeOptions.find((o:any) => o.value === plan!.lineModification?.modificationType)?.label || plan!.lineModification?.modificationType }}</div></div>
              <template v-if="plan!.lineModification?.modificationType === 'upgrade_transformer'">
                <div><div style="font-size:11px;color:#909399">电压等级</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.lineModification?.voltageLevel }}</div></div>
                <div><div style="font-size:11px;color:#909399">当前容量</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.lineModification?.currentCapacityKva?.toLocaleString() }} kVA</div></div>
                <div><div style="font-size:11px;color:#909399">目标容量</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.lineModification?.targetCapacityKva?.toLocaleString() }} kVA</div></div>
              </template>
              <template v-else>
                <div v-if="plan!.lineModification?.modificationType !== 'other'"><div style="font-size:11px;color:#909399">线路长度</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.lineModification?.lineLengthKm }} km</div></div>
                <div v-if="plan!.lineModification?.modificationType === 'upgrade_conductor'"><div style="font-size:11px;color:#909399">当前规格</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.lineModification?.currentSpec }}</div></div>
                <div v-if="plan!.lineModification?.modificationType === 'upgrade_conductor' || plan!.lineModification?.modificationType === 'new_tie_line'"><div style="font-size:11px;color:#909399">目标规格</div><div style="font-size:13px;font-weight:600;color:#303133">{{ plan!.lineModification?.targetSpec }}</div></div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div v-if="activeTab === 'detail' && !plan" class="chart-panel" style="text-align:center;padding:60px;color:#909399">
      请先在"方案编制"标签页生成消纳方案
    </div>

    <!-- ===== Comparison Tab ===== -->
    <div v-if="activeTab === 'compare'" class="chart-panel">
      <div class="chart-panel-title">多方案对比</div>
      <div v-if="variants.length === 0" style="text-align:center;padding:60px;color:#909399;font-size:13px">
        请在"方案详情"标签页保存至少两个变体方案后，在此进行对比
      </div>
      <template v-if="variants.length > 0 && comparisonReport">
        <div style="margin-bottom:12px;padding:10px 12px;background:#f9fafb;border:1px solid #ebeef5;border-radius:4px">
          <div style="font-size:13px;font-weight:600;color:#303133;margin-bottom:6px">综合推荐报告</div>
          <div v-for="(p, pi) in comparisonReport.narrative" :key="pi" style="font-size:13px;color:#606266;line-height:1.6;margin-bottom:2px">
            <template v-if="p.startsWith('场景化建议')"><div style="margin-top:6px">{{ p }}</div></template>
            <template v-else-if="p.startsWith('-')"><div style="margin-left:14px;font-size:12.5px">{{ p }}</div></template>
            <template v-else-if="p.startsWith('综上')"><div style="margin-top:6px;padding-top:6px;border-top:1px dashed #e4e7ed;font-weight:500;color:#303133">{{ p }}</div></template>
            <template v-else><div>{{ p }}</div></template>
          </div>
          <div style="margin-top:4px;font-size:12px;color:#909399">
            评分规则：总分 = IRR×0.3 + 年收益(万元)×0.25 + 消纳提升(%)×0.2 - 总投资(万元)×0.15 - 回收期(年)×0.1
          </div>
        </div>
      </template>
      <el-table v-if="variants.length > 0" :data="comparisonTableData" border size="small" style="width:100%">
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
    </div>
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
