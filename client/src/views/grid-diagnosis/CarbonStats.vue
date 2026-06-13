<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchCarbonStats, fetchCarbonDynamic, fetchStations } from '@/api/grid-diagnosis'
import { fetchDataRanges } from '@/api/system'
import type { StationOption } from '@new-energy/shared'
import { todayStr } from '@/utils/time'

const stations = ref<StationOption[]>([])
const groupBy = ref<'station' | 'zone'>('station')
const dateRange = ref<[string, string]>(['2026-06-01', '2026-07-31'])
const loading = ref(false)
const carbonData = ref<any[]>([])

// 动态评估
const activeTab = ref('dynamic')
const dynamicStation = ref('')
const dynamicGranularity = ref<'hour' | 'day'>('hour')
const dynamicDate = ref('2026-06-15')
const dynamicData = ref<any>(null)


async function loadStats() {
  loading.value = true
  try {
    const data = await fetchCarbonStats({
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

// 电站/区域 CO₂ 减排纵向柱状图
const barOption = computed(() => {
  const names = carbonData.value.map((r) => r.stationName || r.groupKey || r.stationId)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: 80, containLabel: true },
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 20, interval: 0 } },
    yAxis: { type: 'value', name: '吨' },
    series: [{
      name: 'CO₂减排量',
      type: 'bar',
      data: carbonData.value.map((r) => +((r.co2ReductionKg || 0) / 1000).toFixed(1)),
      itemStyle: { color: '#388e3c' },
      label: { show: true, position: 'top', fontSize: 11, formatter: '{c}' },
    }],
  }
})

// 有光伏 vs 无光伏 碳排放对比曲线（堆叠面积图：底部=有光伏金色，中部=碳减排绿色高亮，顶部=无光伏灰色）
const comparisonOption = computed(() => {
  if (!dynamicData.value) return {}
  const ts = dynamicData.value.timeSeries
  const times = ts.map((d: any) => d.time.slice(11, 16))
  const withPv = ts.map((d: any) => +(d.thermalCo2Kg || 0).toFixed(1))
  const reduction = ts.map((d: any) => +(d.co2ReductionKg || 0).toFixed(1))
  const withoutPv = withPv.map((v: number, i: number) => +(v + reduction[i]).toFixed(1))
  const maxReduction = Math.max(...reduction, 1)
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        if (!params?.length) return ''
        const ti = params[0]?.axisValue || ''
        const wv = params.find((p: any) => p.seriesName === '有光伏碳排放(kg)')?.value ?? '-'
        const wo = params.find((p: any) => p.seriesName === '无光伏碳排放(kg)')?.value ?? '-'
        const rd = params.find((p: any) => p.seriesName === '碳减排量(kg)')?.value ?? '-'
        return `${ti}<br/>无光伏碳排放：${wo} kg<br/>有光伏碳排放：${wv} kg<br/><b>碳减排量：${rd} kg</b>`
      },
    },
    legend: { data: ['无光伏碳排放(kg)', '有光伏碳排放(kg)', '碳减排量(kg)'], top: 0 },
    grid: { top: 40, right: 40, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: times, name: '时间', boundaryGap: false },
    yAxis: { type: 'value', name: 'kg' },
    series: [
      {
        name: '有光伏碳排放(kg)',
        type: 'line',
        stack: 'total',
        data: withPv,
        areaStyle: { color: '#f9e4b7' },
        lineStyle: { color: '#f0a030', width: 2 },
        itemStyle: { color: '#f0a030' },
        smooth: true,
        symbol: 'none',
        emphasis: { focus: 'series' },
      },
      {
        name: '碳减排量(kg)',
        type: 'line',
        stack: 'total',
        data: reduction,
        areaStyle: { color: '#4caf50', opacity: 0.35 },
        lineStyle: { color: '#388e3c', width: 1, type: 'dashed' },
        itemStyle: { color: '#388e3c' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        emphasis: { focus: 'series' },
        label: {
          show: true,
          position: 'inside',
          fontSize: 10,
          color: '#2e7d32',
          formatter: (p: any) => {
            if (p.value > maxReduction * 0.3 || p.dataIndex % 3 === 0) return p.value.toFixed(0)
            return ''
          },
        },
      },
      {
        name: '无光伏碳排放(kg)',
        type: 'line',
        data: withoutPv,
        lineStyle: { color: '#909399', width: 2, type: 'dashed' },
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#909399' },
        emphasis: { focus: 'series' },
      },
    ],
  }
})

onMounted(async () => {
  stations.value = (await fetchStations()) || []
  if (stations.value.length > 0) {
    dynamicStation.value = stations.value[0].id
  }
  try {
    const ranges = await fetchDataRanges()
    const pv = ranges.pv_output_measurements
    if (pv?.minTime && pv?.maxTime) {
      const today = todayStr()
      const endDate = today < pv.maxTime.slice(0, 10) ? today : pv.maxTime.slice(0, 10)
      dateRange.value = [pv.minTime.slice(0, 10), endDate]
      dynamicDate.value = endDate
    }
  } catch { /* 兜底 */ }
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
          <ChartContainer :option="comparisonOption" height="350px" :loading="loading" />
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
          <div class="filter-group">
            <span class="filter-label">日期范围</span>
            <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadStats" style="width:130px" />
            <span style="color:#909399;margin:0 4px">至</span>
            <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadStats" style="width:130px" />
          </div>
        </div>

        <div class="chart-panel" style="margin-bottom:16px">
          <ChartContainer :option="barOption" height="350px" :loading="loading" />
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
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
