<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchStations, fetchVoltageFluctuation } from '@/api/grid-diagnosis'
import type { VoltageFluctuation } from '@new-energy/shared'
import dayjs from 'dayjs'

const selectedPoint = ref('')
const selectedDate = ref('')
const windowSize = ref(15)
const loading = ref(false)
const noData = ref(false)
const stations = ref<any[]>([])
const result = ref<VoltageFluctuation | null>(null)
const windowStartMs = ref(0)
const chartContainerRef = ref<InstanceType<typeof ChartContainer> | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null

const nominalKv = computed(() => result.value?.nominalVoltageKv || 10)

const windowData = computed(() => {
  const ts = result.value?.timeSeries || []; if (!ts.length) return []
  const ws = windowStartMs.value; const we = ws + windowSize.value * 60000
  return ts.filter(r => { const t = new Date(r.time).getTime(); return t >= ws && t <= we })
})

const fluctuationPct = computed(() => {
  const vals = windowData.value.map(d => d.voltageKv); if (vals.length < 2) return 0
  return +(((Math.max(...vals) - Math.min(...vals)) / nominalKv.value) * 100).toFixed(2)
})
const windowMaxV = computed(() => windowData.value.length ? +Math.max(...windowData.value.map(d=>d.voltageKv)).toFixed(2) : 0)
const windowMinV = computed(() => windowData.value.length ? +Math.min(...windowData.value.map(d=>d.voltageKv)).toFixed(2) : 0)

const windowTimeText = computed(() => {
  if (!windowStartMs.value) return ''
  const s = new Date(windowStartMs.value), e = new Date(windowStartMs.value + windowSize.value * 60000)
  const f = (d:Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  return `${f(s)} ~ ${f(e)}`
})

function getInst(): any {
  const v = chartContainerRef.value?.echartsInst as any
  const inst = (v && typeof v === 'object' && 'value' in v) ? v.value : v
  return inst?.setOption ? inst : null
}

function applyDataZoom(s: number, e: number) {
  const inst = getInst(); if (!inst) return
  inst.dispatchAction({ type: 'dataZoom', startValue: s, endValue: e })
}

// 轮询 dataZoom 状态 → 同步到 windowStartMs/windowSize
function startPolling() {
  stopPolling()
  let lastS = -1, lastE = -1
  pollTimer = setInterval(() => {
    const inst = getInst(); if (!inst) return
    try {
      const dz = inst.getOption()?.dataZoom?.[0]
      if (!dz || dz.startValue == null || dz.endValue == null) return
      const sv = dz.startValue as number, ev = dz.endValue as number
      if (sv !== lastS || ev !== lastE) {
        lastS = sv; lastE = ev
        windowStartMs.value = sv
        windowSize.value = Math.round((ev - sv) / 60000)
      }
    } catch { /* */ }
  }, 150)
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

// 仅数据加载时重建 chartOption（shallowRef 避免响应式循环）
const chartOption = shallowRef<any>({})

function buildOption(ts: any[], nKv: number, wStart: number, wEnd: number) {
  return {
    tooltip: { trigger: 'axis',
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params; if (!p) return ''
        const d = ts[p.dataIndex]; if (!d) return ''
        const t = new Date(d.time)
        const tf = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
        return `${tf}<br/>电压：${d.voltageKv} kV<br/>光伏出力：${d.activePowerKw} kW<br/>负荷：${d.loadKw} kW`
      },
    },
    xAxis: { type: 'time', axisLabel: { formatter: (v:number) => { const d=new Date(v); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` } } },
    yAxis: { type: 'value', name: 'kV' },
    series: [{
      name: '并网点电压', type: 'line',
      data: ts.map((d:any) => [new Date(d.time).getTime(), d.voltageKv]),
      smooth: true, symbol: 'circle', symbolSize: 4,
      markLine: { silent: true, symbol: 'none',
        data: [{ yAxis: nKv, lineStyle: { type: 'dashed', color: '#909399', width: 1 }, label: { formatter: `基准 ${nKv}kV`, position: 'end' } }]
      },
      markArea: { silent: true,
        data: wStart ? [[{ xAxis: wStart, itemStyle: { color: 'rgba(64,158,255,0.08)' } }, { xAxis: wEnd }]] : []
      },
    }],
    grid: { left: 48, right: 16, top: 30, bottom: 52 },
    dataZoom: [{ type: 'slider', height: 20, bottom: 24, filterMode: 'none' }],
  }
}

onMounted(async () => {
  try {
    const list = await fetchStations(); stations.value = list || []
    if (list?.length) {
      selectedPoint.value = list[0].id
      const d = dayjs().subtract(1, 'day'); selectedDate.value = d.format('YYYY-MM-DD')
      await loadData()
      if (!result.value?.timeSeries?.length) {
        const d2 = d.subtract(1, 'day'); selectedDate.value = d2.format('YYYY-MM-DD'); await loadData()
      }
    }
  } catch { noData.value = true }
})

onUnmounted(stopPolling)

function endDateStr(ds: string) { return dayjs(ds).add(1, 'day').format('YYYY-MM-DD') }

async function loadData() {
  if (!selectedPoint.value) return
  stopPolling()
  loading.value = true; noData.value = false
  const data = await fetchVoltageFluctuation({
    pointId: selectedPoint.value, startDate: selectedDate.value,
    endDate: endDateStr(selectedDate.value), windowMinutes: windowSize.value,
  })
  result.value = data
  if (data?.timeSeries?.length) {
    const ts = data.timeSeries
    const first = new Date(ts[0].time).getTime()
    const last = new Date(ts[ts.length-1].time).getTime()
    const mid = first + (last - first) / 2
    const ws = mid - windowSize.value * 30000
    const we = ws + windowSize.value * 60000
    windowStartMs.value = ws
    // 一次性构建 option，后续不再变
    chartOption.value = buildOption(ts, nominalKv.value, ws, we)
  } else { noData.value = true }
  loading.value = false
  // 等 VChart 渲染后启动轮询 + 设初始 dataZoom
  setTimeout(() => {
    const inst = getInst(); if (!inst) return
    const ws = windowStartMs.value
    applyDataZoom(ws, ws + windowSize.value * 60000)
    startPolling()
  }, 300)
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">并网点电压波动监测</div>
    <div class="filter-bar">
      <div class="filter-group"><span class="filter-label">并网点</span>
        <el-select v-model="selectedPoint" size="small" style="width:200px" @change="loadData">
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
        </el-select>
      </div>
      <div class="filter-group"><span class="filter-label">日期</span>
        <el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" size="small" @change="loadData" style="width:140px" />
      </div>
      <div class="filter-group"><span class="filter-label">窗口</span>
        <span style="font-size:13px;color:#303133">{{ windowTimeText }}</span>
      </div>
    </div>

    <div class="chart-panel" style="margin-bottom:12px">
      <ChartContainer ref="chartContainerRef" :option="chartOption" height="340px" :loading="loading" />
      <div v-if="noData" style="text-align:center;color:#909399;padding:32px">该日期暂无数据</div>
    </div>

    <div v-if="!noData && windowData.length" class="chart-panel" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 16px 0 16px;color:#303133">窗口分析（{{ windowTimeText }}）</div>
      <div style="display:flex;gap:24px;padding:8px 16px 0 16px">
        <span>记录数：<b>{{ windowData.length }}</b></span><span>最高电压：<b>{{ windowMaxV }} kV</b></span><span>最低电压：<b>{{ windowMinV }} kV</b></span>
        <span>波动率：<b :style="{ color: fluctuationPct>7?'#F56C6C':fluctuationPct>5?'#E6A23C':'#303133' }">{{ fluctuationPct }}%</b>
          <span v-if="fluctuationPct>7" style="color:#F56C6C;font-size:12px"> 严重越限</span>
          <span v-else-if="fluctuationPct>5" style="color:#E6A23C;font-size:12px"> 超出阈值</span>
        </span>
      </div>
      <el-table :data="windowData" size="small" stripe max-height="240" style="margin-top:8px">
        <el-table-column label="时间" width="170"><template #default="{row}">{{ row.time.slice(0,16).replace('T',' ') }}</template></el-table-column>
        <el-table-column prop="voltageKv" label="电压(kV)" width="120" />
        <el-table-column prop="activePowerKw" label="光伏出力(kW)" width="140" />
        <el-table-column prop="loadKw" label="负荷(kW)" width="120" />
      </el-table>
    </div>

    <div v-if="!noData && result?.alerts?.length" class="chart-panel">
      <div style="font-size:14px;font-weight:600;padding:8px 16px 0 16px;color:#303133">告警清单（波动率 > 5%）</div>
      <el-table :data="result.alerts" size="small" stripe max-height="300" style="margin-top:4px">
        <el-table-column label="时间" width="170"><template #default="{row}">{{ row.time.slice(0,16).replace('T',' ') }}</template></el-table-column>
        <el-table-column label="级别" width="90"><template #default="{row}"><el-tag :type="row.level==='CRITICAL'?'danger':'warning'" size="small">{{ row.level==='CRITICAL'?'严重':'警告' }}</el-tag></template></el-table-column>
        <el-table-column prop="title" label="告警内容" min-width="220" />
        <el-table-column label="波动率" width="100"><template #default="{row}">{{ row.fluctuationPct }}%</template></el-table-column>
        <el-table-column prop="activePowerKw" label="光伏出力(kW)" width="130" />
        <el-table-column prop="loadKw" label="负荷(kW)" width="110" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.filter-bar{display:flex;align-items:center;gap:20px;flex-wrap:wrap;background:#f5f7fa;padding:10px 16px;border-radius:4px;margin-bottom:16px}
.filter-group{display:flex;align-items:center;gap:8px}
.filter-label{font-size:13px;color:#606266;white-space:nowrap}
</style>
