<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import StatCard from '@/components/common/StatCard.vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchUnitCostParams, calculateInvestment, compareCost, roiAnalysis } from '@/api/planning'
import type { UnitCostParam, InvestmentResult, CostComparison, RoiAnalysis as RoiResult } from '@new-energy/shared'

const loading = ref(false)
const capacityInput = ref(50000)
const params = ref<UnitCostParam[]>([])
const investment = ref<InvestmentResult | null>(null)
const comparison = ref<CostComparison | null>(null)
const roi = ref<RoiResult | null>(null)
const activeTab = ref<'params' | 'calc' | 'compare' | 'roi'>('calc')

const costCategoryOptions = [
  { value: 'equipment', label: '设备成本' },
  { value: 'construction', label: '工程建设成本' },
  { value: 'land', label: '土地费用' },
  { value: 'other', label: '其他费用' },
]

async function loadParams() {
  try {
    params.value = await fetchUnitCostParams()
  } catch { /* ignore */ }
}

async function runCalculation() {
  loading.value = true
  try {
    const [inv, comp, roiResult] = await Promise.all([
      calculateInvestment({ capacityKw: capacityInput.value }),
      compareCost({ pvCapacityKw: capacityInput.value }),
      roiAnalysis({ capacityKw: capacityInput.value }),
    ])
    investment.value = inv
    comparison.value = comp
    roi.value = roiResult
  } finally {
    loading.value = false
  }
}

const investmentChartOption = computed(() => {
  if (!investment.value) return {}
  return {
    title: { text: '投资构成明细', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}万元 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '55%'],
      data: [
        { name: '设备投资', value: Math.round(investment.value.breakdown.equipmentCost / 10000), itemStyle: { color: '#267F7B' } },
        { name: '建设安装', value: Math.round(investment.value.breakdown.constructionCost / 10000), itemStyle: { color: '#67C23A' } },
        { name: '土地费用', value: Math.round(investment.value.breakdown.landCost / 10000), itemStyle: { color: '#E6A23C' } },
        { name: '其他费用', value: Math.round(investment.value.breakdown.otherCost / 10000), itemStyle: { color: '#909399' } },
      ],
      label: { formatter: '{b}\n{d}%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  }
})

const comparisonChartOption = computed(() => {
  if (!comparison.value) return {}
  return {
    title: { text: '光伏 vs 传统火电/输变电项目造价对比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['光伏项目', '传统火电/输变电'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: { type: 'category', data: comparison.value.comparisonChart.labels },
    yAxis: { type: 'value', name: '万元' },
    series: [
      { name: '光伏项目', type: 'bar', data: comparison.value.comparisonChart.pvValues, itemStyle: { color: '#267F7B' }, barWidth: '30%' },
      { name: '传统火电/输变电', type: 'bar', data: comparison.value.comparisonChart.traditionalValues, itemStyle: { color: '#F56C6C' }, barWidth: '30%' },
    ],
  }
})

const roiChartOption = computed(() => {
  if (!roi.value) return {}
  const yearly = roi.value.yearlyCashflow
  return {
    title: { text: '累计现金流曲线', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}年: ${(p[0].data / 10000).toFixed(1)}万元` },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: yearly.map((y: any) => y.year) },
    yAxis: { type: 'value', name: '万元', axisLabel: { formatter: (v: any) => (v / 10000).toFixed(0) } },
    series: [{
      type: 'line', smooth: true, data: yearly.map((y: any) => Math.round(y.cumulativeCashflow / 10000)),
      areaStyle: { color: 'rgba(64,158,255,0.1)' },
      lineStyle: { color: '#267F7B', width: 2 },
      itemStyle: { color: '#267F7B' },
      markLine: {
        data: [{ yAxis: 0 }],
        lineStyle: { color: '#F56C6C', type: 'dashed' },
        label: { formatter: '盈亏平衡线' },
      },
    }],
  }
})

onMounted(() => {
  loadParams()
  runCalculation()
})
</script>

<template>
  <div>
    <div class="stat-card-row">
      <StatCard title="总投资" :value="investment ? (investment.totalInvestment / 10000).toFixed(0) : '-'" unit="万元" icon="Money" color="#267F7B" />
      <StatCard title="单位容量造价" :value="investment ? investment.unitCostPerKw : '-'" unit="元/kW" icon="TrendCharts" color="#67C23A" />
      <StatCard title="内部收益率(IRR)" :value="roi ? roi.financialIndicators.irrPct : '-'" unit="%" icon="DataAnalysis" color="#E6A23C" />
      <StatCard title="投资回收期" :value="roi ? roi.financialIndicators.paybackPeriodYears : '-'" unit="年" icon="Timer" color="#F56C6C" />
    </div>

    <!-- Sub tabs -->
    <div class="sub-tabs" style="margin-bottom:16px">
      <span :class="['sub-tab', { active: activeTab === 'calc' }]" @click="activeTab = 'calc'">投资估算</span>
      <span :class="['sub-tab', { active: activeTab === 'compare' }]" @click="activeTab = 'compare'">造价对比</span>
      <span :class="['sub-tab', { active: activeTab === 'roi' }]" @click="activeTab = 'roi'">效益分析</span>
      <span :class="['sub-tab', { active: activeTab === 'params' }]" @click="activeTab = 'params'">造价参数库</span>
    </div>

    <!-- Investment Calculation -->
    <div v-if="activeTab === 'calc'" class="chart-panel">
      <div class="chart-panel-title">项目总投资计算</div>
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
        <span style="font-size:13px;color:#606266">规划容量:</span>
        <el-input v-model.number="capacityInput" type="number" style="width:200px"><template #append>kW</template></el-input>
        <el-button type="primary" @click="runCalculation" :loading="loading">重新计算</el-button>
      </div>
      <div v-if="investment" class="grid-2">
        <div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="总投资">{{ (investment.totalInvestment / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="单位容量造价">{{ investment.unitCostPerKw }} 元/kW</el-descriptions-item>
            <el-descriptions-item label="设备投资">{{ (investment.breakdown.equipmentCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="建设安装">{{ (investment.breakdown.constructionCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="土地费用">{{ (investment.breakdown.landCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
            <el-descriptions-item label="其他费用">{{ (investment.breakdown.otherCost / 10000).toFixed(2) }} 万元</el-descriptions-item>
          </el-descriptions>
        </div>
        <div>
          <ChartContainer :option="investmentChartOption" height="280px" />
        </div>
      </div>
    </div>

    <!-- Cost Comparison -->
    <div v-if="activeTab === 'compare'" class="chart-panel">
      <div class="chart-panel-title">传统电网项目造价对比</div>
      <div v-if="comparison">
        <ChartContainer :option="comparisonChartOption" height="350px" />
        <el-descriptions :column="3" border size="small" style="margin-top:16px">
          <el-descriptions-item label="光伏单位造价">{{ comparison.pvUnitCost }} 元/kW</el-descriptions-item>
          <el-descriptions-item label="火电单位造价">{{ comparison.traditionalCoalUnitCost }} 元/kW</el-descriptions-item>
          <el-descriptions-item label="输变电造价">{{ comparison.traditionalTransmissionCost }} 元/kW</el-descriptions-item>
          <el-descriptions-item label="光伏总投资">{{ (comparison.pvTotalCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
          <el-descriptions-item label="火电总投资">{{ (comparison.traditionalCoalCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
          <el-descriptions-item label="成本优势">
            <span style="color:#67C23A;font-weight:600">{{ comparison.costAdvantagePct }}%</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <!-- ROI Analysis -->
    <div v-if="activeTab === 'roi'" class="chart-panel">
      <div class="chart-panel-title">成本效益平衡分析</div>
      <div v-if="roi">
        <ChartContainer :option="roiChartOption" height="350px" />
        <div class="grid-2" style="margin-top:16px">
          <el-descriptions title="一次性投入成本" :column="1" border size="small">
            <el-descriptions-item label="设备投资">{{ (roi.upfrontCosts.equipmentInvestment / 10000).toFixed(0) }} 万元</el-descriptions-item>
            <el-descriptions-item label="土地费用">{{ (roi.upfrontCosts.landCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
            <el-descriptions-item label="建设成本">{{ (roi.upfrontCosts.constructionCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
            <el-descriptions-item label="其他费用">{{ (roi.upfrontCosts.otherCost / 10000).toFixed(0) }} 万元</el-descriptions-item>
            <el-descriptions-item label="合计"><strong>{{ (roi.upfrontCosts.total / 10000).toFixed(0) }} 万元</strong></el-descriptions-item>
          </el-descriptions>
          <el-descriptions title="财务指标" :column="1" border size="small">
            <el-descriptions-item label="内部收益率(IRR)">
              <span style="color:#67C23A;font-weight:600">{{ roi.financialIndicators.irrPct }}%</span>
            </el-descriptions-item>
            <el-descriptions-item label="净现值(NPV)">
              <span style="color:#67C23A;font-weight:600">{{ (roi.financialIndicators.npv / 10000).toFixed(0) }} 万元</span>
            </el-descriptions-item>
            <el-descriptions-item label="投资回收期">{{ roi.financialIndicators.paybackPeriodYears }} 年</el-descriptions-item>
            <el-descriptions-item label="投资回报率(ROI)">{{ roi.financialIndicators.roiPct }}%</el-descriptions-item>
          </el-descriptions>
        </div>
        <div class="grid-2" style="margin-top:16px">
          <el-descriptions title="年均收益" :column="1" border size="small">
            <el-descriptions-item label="发电收入">{{ roi.annualRevenue.powerGenerationIncome }} 万元</el-descriptions-item>
            <el-descriptions-item label="绿电补贴">{{ roi.annualRevenue.greenSubsidy }} 万元</el-descriptions-item>
            <el-descriptions-item label="碳交易收入">{{ roi.annualRevenue.carbonTradingIncome }} 万元</el-descriptions-item>
            <el-descriptions-item label="合计"><strong>{{ roi.annualRevenue.total }} 万元</strong></el-descriptions-item>
          </el-descriptions>
          <el-descriptions title="年均支出" :column="1" border size="small">
            <el-descriptions-item label="运营费">{{ roi.annualExpenses.operationCost }} 万元</el-descriptions-item>
            <el-descriptions-item label="维护费">{{ roi.annualExpenses.maintenanceCost }} 万元</el-descriptions-item>
            <el-descriptions-item label="保险费">{{ roi.annualExpenses.insuranceCost }} 万元</el-descriptions-item>
            <el-descriptions-item label="其他费用">{{ roi.annualExpenses.otherCost }} 万元</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </div>

    <!-- Unit Cost Params -->
    <div v-if="activeTab === 'params'" class="chart-panel">
      <div class="chart-panel-title">单位造价参数库</div>
      <el-table :data="params" stripe size="small">
        <el-table-column label="分类" width="120">
          <template #default="{ row }">{{ costCategoryOptions.find(o => o.value === row.category)?.label || row.category }}</template>
        </el-table-column>
        <el-table-column prop="itemName" label="项目名称" min-width="160" />
        <el-table-column label="单位造价" width="130">
          <template #default="{ row }">{{ row.unitCost?.toLocaleString() }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="费用类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ ({ fixed: '固定费用', per_kw: '按容量', per_kwh: '按电量', per_mu: '按面积', per_km: '按长度' } as Record<string, string>)[row.costType] || row.costType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="effectiveDate" label="生效日期" width="100" />
        <el-table-column prop="remark" label="备注" min-width="120" />
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
</style>
