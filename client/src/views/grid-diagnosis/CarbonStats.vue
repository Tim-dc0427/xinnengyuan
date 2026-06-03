<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchCarbonStats, fetchCarbonDynamic, fetchStations } from '@/api/grid-diagnosis'
import type { StationOption } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const selectedStation = ref('')
const groupBy = ref<'station' | 'zone'>('station')
const dateRange = ref<[string, string]>(['2026-03-01', '2026-05-31'])
const loading = ref(false)
const carbonData = ref<any[]>([])

// 动态评估
const activeTab = ref('dynamic')
const dynamicStation = ref('')
const dynamicGranularity = ref<'hour' | 'day'>('hour')
const dynamicDate = ref('2026-05-15')
const dynamicData = ref<any>(null)


async function loadStats() {
  loading.value = true
  try {
    const data = await fetchCarbonStats({
      stationId: groupBy.value === 'station' && selectedStation.value ? selectedStation.value : undefined,
      startDate: dateRange.value[0], endDate: dateRange.value[1], groupBy: groupBy.value,
    })
    carbonData.value = data || []
  } finally { loading.value = false }
}

async function loadDynamic() {
  if (!dynamicStation.value) return
  loading.value = true
  try {
    const data = await fetchCarbonDynamic({
      stationId: dynamicStation.value,
      startDate: dynamicDate.value + 'T00:00:00',
      endDate: dynamicDate.value + 'T23:59:59',
      granularity: dynamicGranularity.value,
    })
    dynamicData.value = data
  } finally { loading.value = false }
}

const barOption = computed(() => {
  const names = carbonData.value.map((r) => r.stationName || r.groupKey || r.stationId)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', containLabel: true },
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 20 } },
    yAxis: { type: 'value', name: '吨' },
    series: [{ name: 'CO₂减排量', type: 'bar', data: carbonData.value.map((r) => +((r.co2ReductionKg || 0) / 1000).toFixed(1)) }],
  }
})

const dynamicOption = computed(() => {
  if (!dynamicData.value) return {}
  const ts = dynamicData.value.timeSeries
  const times = ts.map((d: any) => d.time.slice(11, 16))
  const cumulative: number[] = []
  let sum = 0
  for (const d of ts) { sum += d.co2ReductionKg; cumulative.push(+sum.toFixed(1)) }
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['火电实际碳排放(kg)', '光伏碳减排(kg)', '累计碳减排(kg)'] },
    grid: { top: 40, right: 60, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: times, name: '时间' },
    yAxis: [
      { type: 'value', name: '每小时 (kg)' },
      { type: 'value', name: '累计 (kg)' },
    ],
    series: [
      { name: '火电实际碳排放(kg)', type: 'bar', data: ts.map((d: any) => d.thermalCo2Kg), barWidth: '35%', itemStyle: { color: '#fab6b6' } },
      { name: '光伏碳减排(kg)', type: 'bar', data: ts.map((d: any) => d.co2ReductionKg), barWidth: '35%', itemStyle: { color: '#67c23a' } },
      { name: '累计碳减排(kg)', type: 'line', yAxisIndex: 1, data: cumulative, smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#409EFF' } },
    ],
  }
})

onMounted(async () => {
  stations.value = (await fetchStations()) || []
  if (stations.value.length > 0) {
    selectedStation.value = stations.value[0].id
    dynamicStation.value = stations.value[0].id
  }
  await loadStats()
  if (dynamicStation.value) await loadDynamic()
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">碳排放量统计分析</div>

    <el-tabs v-model="activeTab" type="border-card" @tab-change="(tab: string) => tab === 'dynamic' && dynamicStation && loadDynamic()">
      <!-- Tab1: 动态评估 -->
      <el-tab-pane label="碳减排效益动态评估" name="dynamic">
        <div class="filter-bar">
          <div class="filter-group">
            <span class="filter-label">电站</span>
            <el-select v-model="dynamicStation" size="small" style="width:260px" @change="loadDynamic" filterable>
              <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
            </el-select>
          </div>
          <div class="filter-group">
            <span class="filter-label">分析日期</span>
            <el-date-picker v-model="dynamicDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" size="small" @change="loadDynamic" style="width:150px" />
          </div>
        </div>


        <div v-if="dynamicData" class="chart-panel" style="margin-bottom:16px">
          <ChartContainer :option="dynamicOption" height="350px" :loading="loading" />
        </div>

        <div v-if="dynamicData" class="chart-panel">
          <el-table :data="dynamicData.timeSeries" size="small" stripe max-height="400">
            <el-table-column prop="time" label="时段" width="150" />
            <el-table-column label="发电量(kWh)" width="120">
              <template #default="{ row }">{{ row.outputKwh }}</template>
            </el-table-column>
            <el-table-column label="碳减排(kg)" width="120">
              <template #default="{ row }">{{ row.co2ReductionKg }}</template>
            </el-table-column>
            <el-table-column label="火电排放(kg)" width="120">
              <template #default="{ row }">{{ row.thermalCo2Kg }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab2: 汇总统计 -->
      <el-tab-pane label="碳排放量统计分析" name="stats">

        <div class="filter-bar">
          <div class="filter-group">
            <span class="filter-label">分类</span>
            <el-radio-group v-model="groupBy" size="small" @change="loadStats">
              <el-radio-button value="zone">按区域</el-radio-button>
              <el-radio-button value="station">按电站</el-radio-button>
            </el-radio-group>
          </div>
          <div class="filter-group" v-if="groupBy === 'station'">
            <span class="filter-label">电站</span>
            <el-select v-model="selectedStation" size="small" style="width:220px" @change="loadStats" filterable clearable placeholder="全部电站">
              <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
            </el-select>
          </div>
          <div class="filter-group">
            <span class="filter-label">日期范围</span>
            <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadStats" style="width:130px" />
            <span style="color:#909399;margin:0 4px">至</span>
            <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadStats" style="width:130px" />
          </div>
        </div>

        <div class="chart-panel" style="margin-bottom:16px">
          <el-table :data="carbonData" size="small" stripe>
            <el-table-column :label="groupBy === 'zone' ? '区域' : '电站'" width="180">
              <template #default="{ row }">{{ row.stationName || row.groupKey || row.stationId }}</template>
            </el-table-column>
            <el-table-column label="总发电量(MWh)" width="120">
              <template #default="{ row }">{{ (row.totalOutputKwh / 1000).toFixed(0) }}</template>
            </el-table-column>
            <el-table-column label="CO₂减排(吨)" width="120">
              <template #default="{ row }">{{ (row.co2ReductionKg / 1000).toFixed(1) }}</template>
            </el-table-column>
            <el-table-column label="SO₂减排(kg)" width="110">
              <template #default="{ row }">{{ (row.so2ReductionKg || 0).toFixed(1) }}</template>
            </el-table-column>
            <el-table-column label="NOx减排(kg)" width="110">
              <template #default="{ row }">{{ (row.noxReductionKg || 0).toFixed(1) }}</template>
            </el-table-column>
            <el-table-column label="CO₂强度(kg/MWh)" width="140">
              <template #default="{ row }">{{ row.co2PerMwh }}</template>
            </el-table-column>
          </el-table>
        </div>

        <div class="chart-panel">
          <ChartContainer :option="barOption" height="350px" :loading="loading" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
