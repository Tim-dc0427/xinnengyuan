<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchJointOutputAnalysis, fetchStations, fetchStorageList } from '@/api/grid-diagnosis'
import type { StationOption, StorageOption, JointOutputAnalysis } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const storageList = ref<StorageOption[]>([])
const selectedStation = ref('')
const viewMode = ref<'joint' | 'pv_only' | 'storage_only'>('joint')
const jointDate = ref('2026-05-15')
const loading = ref(false)
const analysis = ref<JointOutputAnalysis | null>(null)

async function loadData() {
  if (!selectedStation.value) return
  loading.value = true
  try {
    const data = await fetchJointOutputAnalysis({
      stationId: selectedStation.value,
      storageId: '',
      startDate: jointDate.value + 'T00:00:00',
      endDate: jointDate.value + 'T23:59:59',
    })
    analysis.value = data
  } finally {
    loading.value = false
  }
}

const chartOption = computed(() => {
  if (!analysis.value) return {}
  const ts = analysis.value.timeSeries
  const times = ts.map((d) => d.time.slice(11, 16))
  const series: any[] = []

  if (viewMode.value === 'pv_only' || viewMode.value === 'joint') {
    series.push({
      name: '光伏出力', type: 'line', smooth: true,
      data: ts.map((d) => d.pvOutputKw),
      areaStyle: { opacity: 0.1 },
    })
  }
  if (viewMode.value === 'storage_only' || viewMode.value === 'joint') {
    series.push({
      name: '储能充电', type: 'line',
      data: ts.map((d) => d.storageChargeKw),
      lineStyle: { type: 'dotted' },
    })
    series.push({
      name: '储能放电', type: 'line',
      data: ts.map((d) => d.storageDischargeKw),
      lineStyle: { type: 'dotted' },
    })
  }
  if (viewMode.value === 'joint') {
    series.push({
      name: '联合出力', type: 'line', smooth: true,
      data: ts.map((d) => d.jointOutputKw),
      areaStyle: { opacity: 0.2 },
    })
  }

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map((s) => s.name) },
    xAxis: { type: 'category', data: times, name: '时间', axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: 'kW' },
    series,
  }
})

onMounted(async () => {
  stations.value = (await fetchStations()) || []
  storageList.value = (await fetchStorageList()) || []
  if (stations.value.length > 0) selectedStation.value = stations.value[0].id
  if (selectedStation.value) await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">光储联合出力分析</div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">电站</span>
        <el-select v-model="selectedStation" size="small" style="width:240px" @change="loadData" filterable>
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="joint">联合出力</el-radio-button>
          <el-radio-button value="pv_only">单独光伏</el-radio-button>
          <el-radio-button value="storage_only">储能充放电</el-radio-button>
        </el-radio-group>
      </div>
      <div class="filter-group">
        <span class="filter-label">分析日期</span>
        <el-date-picker v-model="jointDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" size="small" @change="loadData" style="width:150px" />
      </div>
    </div>

    <!-- 指标卡片 -->
    <div v-if="analysis" style="display:flex;gap:16px;margin-bottom:16px">
      <div class="stat-card" style="flex:1">
        <div class="stat-label">光伏波动率(标准差)</div>
        <div class="stat-value">{{ analysis.pvFluctuationStdDev }} kW</div>
      </div>
      <div class="stat-card" style="flex:1">
        <div class="stat-label">联合波动率(标准差)</div>
        <div class="stat-value">{{ analysis.jointFluctuationStdDev }} kW</div>
        <div class="stat-sub" v-if="analysis.fluctuationImprovementPct != null" style="color:#67c23a">
          降低 {{ analysis.fluctuationImprovementPct }}%
        </div>
      </div>
      <div class="stat-card" style="flex:1">
        <div class="stat-label">峰谷差</div>
        <div class="stat-value">{{ (analysis.jointPeakValleyDiff ?? 0).toFixed(0) }} kW</div>
        <div class="stat-sub" v-if="analysis.peakValleyImprovementPct != null" style="color:#67c23a">
          缩小 {{ analysis.peakValleyImprovementPct }}%
        </div>
      </div>
      <div class="stat-card" style="flex:1">
        <div class="stat-label">调峰能力</div>
        <div class="stat-value">{{ analysis.peakShavingCapacityKw }} kW</div>
      </div>
    </div>

    <!-- 曲线图 -->
    <div v-if="analysis" class="chart-panel" style="margin-bottom:16px">
      <ChartContainer :option="chartOption" height="400px" :loading="loading" />
    </div>

    <!-- 时序数据表 -->
    <div v-if="analysis" class="chart-panel">
      <el-table :data="analysis.timeSeries" size="small" stripe max-height="400">
        <el-table-column prop="time" label="时间" width="150" />
        <el-table-column label="光伏出力(kW)" width="120">
          <template #default="{ row }">{{ row.pvOutputKw }}</template>
        </el-table-column>
        <el-table-column label="储能充电(kW)" width="120">
          <template #default="{ row }">{{ row.storageChargeKw }}</template>
        </el-table-column>
        <el-table-column label="储能放电(kW)" width="120">
          <template #default="{ row }">{{ row.storageDischargeKw }}</template>
        </el-table-column>
        <el-table-column label="联合出力(kW)" width="120">
          <template #default="{ row }">{{ row.jointOutputKw }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  padding: 16px;
  text-align: center;
}
.stat-label { font-size: 13px; color: #909399; margin-bottom: 8px; }
.stat-value { font-size: 24px; color: #303133; font-weight: 600; }
.stat-sub { font-size: 12px; margin-top: 4px; }
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
