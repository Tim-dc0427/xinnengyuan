<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchStations, fetchVoltageFluctuation } from '@/api/grid-diagnosis'
import type { VoltageFluctuation } from '@new-energy/shared'

const selectedDate = ref('2026-06-01')
const selectedPoint = ref('')
const windowSize = ref(15)
const loading = ref(false)
const noData = ref(false)
const stations = ref<any[]>([])
const result = ref<VoltageFluctuation | null>(null)
const selectedWindow = ref<{
  clickTime: string
  windowStart: string
  windowEnd: string
  maxV: number
  minV: number
  fluctuationPct: number
  records: Array<{ time: string; voltageKv: number; activePowerKw: number; loadKw: number }>
} | null>(null)

onMounted(async () => {
  const list = await fetchStations()
  stations.value = list || []
  if (list?.length) {
    selectedPoint.value = list[0].id
    // 宽范围查询获取数据边界，默认展示最近一天
    const boundary = await fetchVoltageFluctuation({
      pointId: list[0].id,
      startDate: '2025-01-01',
      endDate: '2026-12-31',
      windowMinutes: windowSize.value,
    })
    if (boundary?.dataRange?.lastTime) {
      selectedDate.value = new Date(boundary.dataRange.lastTime).toISOString().slice(0, 10)
    }
    await loadData()
  }
})

function endDateStr(dateStr: string) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function loadData() {
  if (!selectedPoint.value) return
  loading.value = true
  noData.value = false
  selectedWindow.value = null
  const data = await fetchVoltageFluctuation({
    pointId: selectedPoint.value,
    startDate: selectedDate.value,
    endDate: endDateStr(selectedDate.value),
    windowMinutes: windowSize.value,
  })
  result.value = data
  if (!data?.timeSeries?.length) {
    noData.value = true
  }
  loading.value = false
}

function formatLocal(ms: number) {
  const d = new Date(ms)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${mi}`
}

function handleChartClick(params: any) {
  const ts = result.value?.timeSeries
  if (!ts?.length || params?.dataIndex == null) return
  const idx = params.dataIndex
  const clickTime = ts[idx].time
  const windowMs = windowSize.value * 60 * 1000
  const clickMs = new Date(clickTime).getTime()
  const windowStartMs = clickMs - windowMs

  const windowRecords = ts.filter(r => {
    const t = new Date(r.time).getTime()
    return t >= windowStartMs && t <= clickMs
  })

  if (windowRecords.length === 0) return

  const voltages = windowRecords.map(r => r.voltageKv)
  const nominalKv = result.value?.nominalVoltageKv || 10
  const maxV = Math.max(...voltages)
  const minV = Math.min(...voltages)
  const fluctuationPct = +(((maxV - minV) / nominalKv) * 100).toFixed(2)

  selectedWindow.value = {
    clickTime,
    windowStart: formatLocal(windowStartMs),
    windowEnd: clickTime.slice(0, 16).replace('T', ' '),
    maxV: +maxV.toFixed(2),
    minV: +minV.toFixed(2),
    fluctuationPct,
    records: windowRecords.map(r => ({
      time: r.time.slice(0, 16).replace('T', ' '),
      voltageKv: r.voltageKv,
      activePowerKw: r.activePowerKw,
      loadKw: r.loadKw,
    })),
  }
}

const voltageOption = computed(() => {
  const ts = result.value?.timeSeries || []
  const nominalKv = result.value?.nominalVoltageKv || 10
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p) return ''
        const d = ts[p.dataIndex]
        if (!d) return `${p.axisValue}<br/>电压：${p.value} kV`
        return `${d.time.slice(0, 16)}<br/>电压：${d.voltageKv} kV<br/>光伏出力：${d.activePowerKw} kW<br/>负荷：${d.loadKw} kW`
      },
    },
    legend: { data: ['并网点电压', `基准线(${nominalKv}kV)`] },
    xAxis: {
      type: 'category',
      data: ts.map(d => d.time.slice(11, 16)),
      axisLabel: { rotate: 0 },
    },
    yAxis: { type: 'value', name: 'kV' },
    series: [
      { name: '并网点电压', type: 'line', data: ts.map(d => d.voltageKv), smooth: true, symbol: 'circle', symbolSize: 5 },
      { name: `基准线(${nominalKv}kV)`, type: 'line', data: Array(ts.length).fill(nominalKv), lineStyle: { type: 'dashed', color: '#909399' }, symbol: 'none' },
    ],
    grid: { left: 50, right: 16, top: 32, bottom: 30 },
  }
})

const fluctuationOption = computed(() => {
  const ts = result.value?.timeSeries || []
  const threshold = 5
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p) return ''
        const d = ts[p.dataIndex]
        if (!d) return `${p.axisValue}<br/>波动率：${p.value}%`
        return `${d.time.slice(0, 16)}<br/>波动率：${d.fluctuationPct}%<br/>光伏出力：${d.activePowerKw} kW<br/>负荷：${d.loadKw} kW`
      },
    },
    xAxis: {
      type: 'category',
      data: ts.map(d => d.time.slice(11, 16)),
      axisLabel: { rotate: 0 },
    },
    yAxis: { type: 'value', name: '%', max: Math.max(threshold + 2, result.value?.maxFluctuationPct || threshold + 1) },
    series: [{
      name: '电压波动率',
      type: 'line',
      data: ts.map(d => d.fluctuationPct),
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      markLine: {
        silent: true,
        data: [
          { yAxis: threshold, lineStyle: { color: '#E6A23C', type: 'dashed' }, label: { formatter: `${threshold}%` } },
        ],
      },
    }],
    grid: { left: 50, right: 16, top: 32, bottom: 30 },
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">并网点电压波动监测</div>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">并网点</span>
        <el-select v-model="selectedPoint" size="small" style="width:200px" @change="loadData">
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期</span>
        <el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" size="small" @change="loadData" style="width:140px" />
      </div>
      <div class="filter-group">
        <span class="filter-label">滑动窗口</span>
        <el-input-number v-model="windowSize" :min="5" :max="60" :step="5" size="small" style="width:100px" @change="loadData" />
        <span class="filter-label">分钟</span>
      </div>
    </div>

    <div class="chart-panel" style="margin-bottom:16px">
      <ChartContainer :option="voltageOption" height="300px" :loading="loading" @chart-click="handleChartClick" />
      <div v-if="noData" style="text-align:center;color:#909399;padding:40px">该日期暂无数据</div>
    </div>

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 0 0 16px;color:#303133">电压波动率（阈值 ±5%）</div>
      <ChartContainer :option="fluctuationOption" height="250px" :loading="loading" @chart-click="handleChartClick" />
      <div v-if="noData" style="text-align:center;color:#909399;padding:40px">该日期暂无数据</div>
    </div>

    <div class="chart-panel" v-if="selectedWindow" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 0 0 16px;color:#303133">
        窗口详情（{{ selectedWindow.windowStart }} ~ {{ selectedWindow.windowEnd }}）
      </div>
      <div style="display:flex;gap:24px;padding:8px 16px 0 16px">
        <span>窗口大小：<b>{{ windowSize }} 分钟</b></span>
        <span>最高电压：<b>{{ selectedWindow.maxV }} kV</b></span>
        <span>最低电压：<b>{{ selectedWindow.minV }} kV</b></span>
        <span>波动幅度：<b :style="{ color: selectedWindow.fluctuationPct > 5 ? '#F56C6C' : '#303133' }">{{ selectedWindow.fluctuationPct }}%</b></span>
        <span>记录数：<b>{{ selectedWindow.records.length }}</b></span>
      </div>
      <el-table :data="selectedWindow.records" size="small" stripe max-height="240" style="margin-top:8px">
        <el-table-column prop="time" label="时间" width="170" />
        <el-table-column prop="voltageKv" label="电压(kV)" width="120" />
        <el-table-column prop="activePowerKw" label="光伏出力(kW)" width="140" />
        <el-table-column prop="loadKw" label="负荷(kW)" width="120" />
      </el-table>
    </div>

    <div class="chart-panel" v-if="result?.alerts?.length">
      <div style="font-size:14px;font-weight:600;padding:8px 0 4px 16px;color:#303133">告警清单</div>
      <el-table :data="result.alerts" size="small" stripe max-height="300">
        <el-table-column prop="time" label="时间" width="170" />
        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="row.level === 'CRITICAL' ? 'danger' : 'warning'" size="small">{{ row.level === 'CRITICAL' ? '严重' : '警告' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="告警内容" />
        <el-table-column prop="fluctuationPct" label="波动率" width="100">
          <template #default="{ row }">{{ row.fluctuationPct }}%</template>
        </el-table-column>
        <el-table-column prop="activePowerKw" label="光伏出力(kW)" width="140" />
        <el-table-column prop="loadKw" label="负荷(kW)" width="120" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
