<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import 'echarts-gl'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchEquipmentImpact, fetchComplaintStats, fetchHotspotDistribution, fetchStations, fetchComplaintTickets, fetchEquipmentEvents } from '@/api/grid-diagnosis'
import { fetchDataRanges } from '@/api/system'
import type { ComplaintTicketItem } from '@new-energy/shared'
import { todayStr } from '@/utils/time'


const dateRange = ref<[string, string]>(['2026-01-01', '2026-06-02'])
const selectedEquip = ref('')
const filterStation = ref('')
const filterType = ref('')
const loading = ref(false)
const activeTab = ref('equipment')
const stations = ref<any[]>([])
const equipmentImpact = ref<any[]>([])
const complaintStats = ref<any[]>([])
const hotspotData = ref<any[]>([])
const equipEvents = ref<any[]>([])
const typeAvgRise = ref(0)
const isWeak = ref(false)
const noEquipData = ref(false)
const tickets = ref<ComplaintTicketItem[]>([])
const ticketFilterV = ref('1')
const ticketFilterInd = ref('')

const filteredEquip = computed(() => equipmentImpact.value.filter((d: any) => {
  if (filterStation.value && d.stationName !== filterStation.value) return false
  if (filterType.value && d.type !== filterType.value) return false
  return true
}))
const equipTypes = computed(() => [...new Set(filteredEquip.value.map((d: any) => d.type))])

// 筛选电压波动工单
const filteredTickets = computed(() => {
  let list = tickets.value
  if (ticketFilterV.value !== '') {
    list = list.filter(t => t.isVoltageRelated === (ticketFilterV.value === '1'))
  }
  if (ticketFilterInd.value) {
    list = list.filter(t => t.industry === ticketFilterInd.value)
  }
  return list
})
const ticketIndustries = computed(() => [...new Set(tickets.value.map(t => t.industry))])

// 电压波动工单按行业统计(用于柱状图)
const voltageTicketsByIndustry = computed(() => {
  const map: Record<string, { complaints: number; loss: number }> = {}
  for (const t of tickets.value) {
    if (!t.isVoltageRelated) continue
    if (!map[t.industry]) map[t.industry] = { complaints: 0, loss: 0 }
    map[t.industry].complaints++
    map[t.industry].loss += t.lossEstimateWan
  }
  return Object.entries(map).map(([industry, v]) => ({ industry, complaints: v.complaints, lossEstimate: +v.loss.toFixed(1) }))
})
const volTotalComplaints = computed(() => voltageTicketsByIndustry.value.reduce((s, d) => s + d.complaints, 0))
const volTotalLoss = computed(() => voltageTicketsByIndustry.value.reduce((s, d) => s + d.lossEstimate, 0))

// 3D 热点区域图表实例
const hotspot3dRef = ref<HTMLDivElement>()
let hotspot3dInst: any = null

onMounted(async () => {
  try {
    const ranges = await fetchDataRanges()
    const v = ranges.voltage_measurements
    if (v?.minTime && v?.maxTime) {
      const today = todayStr()
      const endDate = today < v.maxTime.slice(0, 10) ? today : v.maxTime.slice(0, 10)
      dateRange.value = [v.minTime.slice(0, 10), endDate]
    }
  } catch { /* 兜底 */ }
  loadData()
})

async function loadData() {
  loading.value = true
  const list = await fetchStations()
  stations.value = list || []
  const [equip, complain, hotspot, ticketList] = await Promise.all([
    fetchEquipmentImpact({ startDate: dateRange.value[0], endDate: dateRange.value[1] }),
    fetchComplaintStats({ startDate: dateRange.value[0], endDate: dateRange.value[1] }),
    fetchHotspotDistribution({ startDate: dateRange.value[0], endDate: dateRange.value[1] }),
    fetchComplaintTickets(),
  ])
  equipmentImpact.value = equip || []
  complaintStats.value = complain || []
  hotspotData.value = hotspot || []
  tickets.value = ticketList || []
  if (equip?.length && !selectedEquip.value) { selectedEquip.value = equip[0].id; await loadEquipEvents() }
  loading.value = false
}

async function loadEquipEvents() {
  if (!selectedEquip.value) return
  const data = await fetchEquipmentEvents(selectedEquip.value) || {}
  equipEvents.value = data.events || []
  typeAvgRise.value = data.typeAvgRise || 0
  isWeak.value = data.isWeak || false
  noEquipData.value = data.noData || false
}

function renderHotspot3D() {
  console.log('[hotspot3D] called', 'ref:', !!hotspot3dRef.value, 'w:', hotspot3dRef.value?.clientWidth, 'h:', hotspot3dRef.value?.clientHeight, 'pts:', hotspotData.value.length)

  if (!hotspot3dRef.value) { console.log('[hotspot3D] no ref'); return }
  if (hotspot3dRef.value.clientWidth === 0 || hotspot3dRef.value.clientHeight === 0) {
    console.log('[hotspot3D] zero size, retry in 100ms')
    setTimeout(() => renderHotspot3D(), 100)
    return
  }

  if (!hotspot3dInst) {
    console.log('[hotspot3D] init echarts-gl, renderer=webgl')
    hotspot3dInst = echarts.init(hotspot3dRef.value, undefined, { renderer: 'webgl' } as any)
  }
  const pts = hotspotData.value
  if (!pts.length) { hotspot3dInst.clear(); return }

  // 经纬度范围
  const lngMin = Math.min(...pts.map(d => d.longitude))
  const lngMax = Math.max(...pts.map(d => d.longitude))
  const latMin = Math.min(...pts.map(d => d.latitude))
  const latMax = Math.max(...pts.map(d => d.latitude))
  const lngPad = Math.max((lngMax - lngMin) * 0.3, 0.1)
  const latPad = Math.max((latMax - latMin) * 0.3, 0.1)

  const COLS = 50, ROWS = 40
  const maxFC = Math.max(...pts.map(d => d.fluctuationCount), 1)

  // 构建曲面顶点：[lng, lat, z] 三元组平铺数组 + 显式 dataShape
  const lngStart = lngMin - lngPad, lngEnd = lngMax + lngPad
  const latStart = latMin - latPad, latEnd = latMax + latPad
  const surfaceData: number[][] = []
  let gridMax = 0

  for (let r = 0; r < ROWS; r++) {
    const lat = latStart + (latEnd - latStart) * r / (ROWS - 1)
    for (let c = 0; c < COLS; c++) {
      const lng = lngStart + (lngEnd - lngStart) * c / (COLS - 1)
      let z = 0
      for (const pt of pts) {
        const dlng = (lng - pt.longitude) * 111 * Math.cos((pt.latitude * Math.PI) / 180)
        const dlat = (lat - pt.latitude) * 111
        const distKm = Math.sqrt(dlng * dlng + dlat * dlat)
        const sigma = 15 + (pt.fluctuationCount / maxFC) * 25
        const w = Math.exp(-distKm * distKm / (2 * sigma * sigma))
        z += w * pt.complaints * 0.8
      }
      surfaceData.push([+lng.toFixed(4), +lat.toFixed(4), +z.toFixed(1)])
      if (z > gridMax) gridMax = z
    }
  }

  console.log('[hotspot3D] surface data built', 'vertices:', surfaceData.length, 'grid:', ROWS, 'x', COLS, 'gridMax:', gridMax.toFixed(1))

  hotspot3dInst.setOption({
    tooltip: {
      formatter: (p: any) => {
        if (!p.data) return ''
        const [lng, lat] = p.data.value || p.data
        let best: any = null, bestD = Infinity
        for (const pt of pts) {
          const dlng = (lng - pt.longitude) * 111 * Math.cos((pt.latitude * Math.PI) / 180)
          const dlat = (lat - pt.latitude) * 111
          const d = Math.sqrt(dlng * dlng + dlat * dlat)
          if (d < bestD) { bestD = d; best = pt }
        }
        if (!best || bestD > 40) return ''
        return `${best.zone}<br/>投诉数：${best.complaints}<br/>波动次数：${best.fluctuationCount}<br/>波动率：${best.avgFluctuation}%`
      },
    },
    xAxis3D: {
      type: 'value', name: '经度', nameTextStyle: { fontSize: 11 },
      min: lngStart, max: lngEnd,
      axisLabel: { fontSize: 9, formatter: (v: number) => v.toFixed(2) },
    },
    yAxis3D: {
      type: 'value', name: '纬度', nameTextStyle: { fontSize: 11 },
      min: latStart, max: latEnd,
      axisLabel: { fontSize: 9, formatter: (v: number) => v.toFixed(2) },
    },
    zAxis3D: { type: 'value', name: '', axisLabel: { show: false } },
    grid3D: {
      viewControl: { autoRotate: true, autoRotateSpeed: 6, distance: 220, alpha: 35, beta: 50, minAlpha: 10, maxAlpha: 80 },
      boxWidth: 100, boxHeight: 55, boxDepth: Math.min(100, gridMax > 0 ? 100 : 40),
      light: { main: { intensity: 1.3, shadow: true }, ambient: { intensity: 0.5 } },
    },
    visualMap: {
      min: 0, max: gridMax || 1, calculable: true,
      orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#2e7d32', '#66bb6a', '#fdd835', '#f57c00', '#d32f2f'] },
      text: ['投诉多', '少'], textStyle: { fontSize: 10 },
    },
    series: [{
      type: 'surface',
      data: surfaceData,
      dataShape: [ROWS, COLS],
      shading: 'realistic',
      realisticMaterial: { roughness: 0.5, metalness: 0.05 },
      wireframe: { show: false },
      itemStyle: { opacity: 0.92 },
    }],
  }, true)
  nextTick(() => hotspot3dInst?.resize())
}

watch(hotspotData, () => { if (activeTab.value === 'hotspot') nextTick(() => renderHotspot3D()) }, { deep: true })
watch(activeTab, (tab) => { if (tab === 'hotspot') { nextTick(() => { if (hotspot3dRef.value?.clientWidth) renderHotspot3D() }) } })
const resizeHandler = () => hotspot3dInst?.resize()
onMounted(() => { window.addEventListener('resize', resizeHandler) })
onUnmounted(() => { window.removeEventListener('resize', resizeHandler); hotspot3dInst?.dispose() })

const timelineOption = computed(() => ({
  tooltip: { formatter: (p: any) => `${p.data[0]}<br/>温升：${p.data[1]}°C` },
  xAxis: { type: 'category', data: equipEvents.value.map((e: any) => e.time?.slice(5, 16) || ''), axisLabel: { rotate: 30, fontSize: 10 } },
  yAxis: { type: 'value', name: '温升(°C)' },
  series: [
    { name: '骤升温升', type: 'scatter', symbolSize: 12,
      data: equipEvents.value.filter((e: any) => e.status === 'surge').map((e: any) => [e.time?.slice(5, 16), e.tempRise]),
      itemStyle: { color: '#F56C6C' },
      markLine: { silent: true, symbol: 'none', label: { formatter: `判定线 ${typeAvgRise.value}°C` },
        data: [{ yAxis: typeAvgRise.value, lineStyle: { color: '#F56C6C', type: 'dashed' } }] } },
    { name: '骤降温升', type: 'scatter', symbolSize: 12,
      data: equipEvents.value.filter((e: any) => e.status === 'sag').map((e: any) => [e.time?.slice(5, 16), e.tempRise]),
      itemStyle: { color: '#409EFF' } },
  ],
  legend: { data: ['骤升温升', '骤降温升'], bottom: 0 },
  grid: { left: 50, right: 16, top: 16, bottom: 50 },
}))

const complaintChartOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>投诉数量：${p[0].value}<br/>经济损失：${p[1].value} 万元` },
  xAxis: { type: 'category', data: voltageTicketsByIndustry.value.map(d => d.industry) },
  yAxis: [
    { type: 'value', name: '投诉数量' },
    { type: 'value', name: '经济损失(万元)' },
  ],
  series: [
    { name: '投诉数量', type: 'bar', data: voltageTicketsByIndustry.value.map(d => d.complaints), itemStyle: { borderRadius: [4, 4, 0, 0] } },
    { name: '经济损失', type: 'line', yAxisIndex: 1, data: voltageTicketsByIndustry.value.map(d => d.lossEstimate), itemStyle: { color: '#E6A23C' }, lineStyle: { color: '#E6A23C' }, symbol: 'circle', symbolSize: 8 },
  ],
  grid: { left: 50, right: 50, top: 16, bottom: 30 },
}))
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">电压波动影响分析</div>

    <div class="filter-bar">
      <div class="filter-group" v-if="activeTab === 'equipment'">
        <span class="filter-label">电站</span>
        <el-select v-model="filterStation" size="small" style="width:160px" clearable placeholder="全部电站" @change="filterType = ''; selectedEquip = ''">
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.stationName" />
        </el-select>
      </div>
      <div class="filter-group" v-if="activeTab === 'equipment'">
        <span class="filter-label">设备分类</span>
        <el-select v-model="filterType" size="small" style="width:120px" clearable placeholder="全部分类" @change="selectedEquip = ''">
          <el-option v-for="t in equipTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <div class="filter-group" v-if="activeTab === 'equipment'">
        <span class="filter-label">设备</span>
        <el-select v-model="selectedEquip" size="small" style="width:220px" @change="loadEquipEvents">
          <el-option v-for="d in filteredEquip" :key="d.id" :label="d.device" :value="d.id" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期范围</span>
        <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadData" style="width:130px" />
        <span style="color:#909399;margin:0 4px">至</span>
        <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadData" style="width:130px" />
      </div>
      <div class="filter-group" v-if="activeTab === 'equipment' && (equipEvents.length > 0 || noEquipData)">
        <el-tag v-if="noEquipData" type="info" size="small">无温升数据</el-tag>
        <template v-else>
          <el-tag :type="isWeak ? 'danger' : 'success'" size="small">{{ isWeak ? '薄弱设备' : '正常设备' }}</el-tag>
          <span style="font-size:12px;color:#909399">判定线：{{ typeAvgRise }}°C | 本设备：{{ equipEvents.length > 0 ? (equipEvents.reduce((s,e:any) => s + e.tempRise, 0) / equipEvents.length).toFixed(1) : 0 }}°C</span>
        </template>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- Tab 1: 设备运行影响分析 -->
      <el-tab-pane label="设备运行影响分析" name="equipment">
        <div class="chart-panel" style="margin-bottom:16px">
          <div style="font-size:14px;font-weight:600;padding:8px 0 4px 16px;color:#303133">电压骤升/骤降时温升变化</div>
          <ChartContainer :option="timelineOption" height="280px" :loading="loading" />
        </div>
        <div class="chart-panel">
          <el-table :data="filteredEquip" size="small" stripe height="320">
            <el-table-column prop="device" label="设备名称" min-width="140" />
            <el-table-column prop="type" label="类型" width="80" />
            <el-table-column prop="surgeCount" label="电压冲击次数" width="110" />
            <el-table-column prop="sagCount" label="故障次数" width="100" />
            <el-table-column prop="noramlTemp" label="正常(°C)" width="90" />
            <el-table-column prop="surgeTemp" label="骤升(°C)" width="90" />
            <el-table-column label="薄弱设备" width="90">
              <template #default="{ row }">
                <el-tag :type="row.risk === '薄弱' ? 'danger' : row.risk === '关注' ? 'warning' : 'success'" size="small">{{ row.risk }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 用户侧影响量化分析 -->
      <el-tab-pane label="用户侧影响量化分析" name="user">
        <div class="filter-bar" style="padding:8px 12px;margin-bottom:12px">
          <div class="filter-group">
            <span class="filter-label">电压波动</span>
            <el-select v-model="ticketFilterV" size="small" style="width:100px" clearable placeholder="全部">
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </div>
          <div class="filter-group">
            <span class="filter-label">行业</span>
            <el-select v-model="ticketFilterInd" size="small" style="width:120px" clearable placeholder="全部行业">
              <el-option v-for="ind in ticketIndustries" :key="ind" :label="ind" :value="ind" />
            </el-select>
          </div>
          <span style="font-size:12px;color:#909399;margin-left:12px">
            共 {{ filteredTickets.length }} 条工单（电压波动 {{ filteredTickets.filter(t => t.isVoltageRelated).length }} 条）
          </span>
        </div>
        <div class="chart-panel" style="margin-bottom:16px">
          <el-table :data="filteredTickets" size="small" stripe height="280">
            <el-table-column prop="ticketNo" label="工单号" width="130" />
            <el-table-column prop="zone" label="区域" width="80" />
            <el-table-column prop="industry" label="行业" width="70" />
            <el-table-column prop="issueDesc" label="问题描述" min-width="200" show-overflow-tooltip />
            <el-table-column label="电压波动" width="85">
              <template #default="{ row }">
                <el-tag :type="row.isVoltageRelated ? 'danger' : 'info'" size="small">{{ row.isVoltageRelated ? row.voltageIssueType : '非电压原因' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="lossEstimateWan" label="损失(万元)" width="95" />
            <el-table-column prop="status" label="状态" width="80" />
            <el-table-column prop="reportedAt" label="日期" width="100" />
          </el-table>
        </div>
        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;padding:8px 16px 4px 16px;color:#303133;display:flex;justify-content:space-between;align-items:center">
            <span>电压波动投诉行业统计</span>
            <span style="font-size:12px;font-weight:400;color:#909399">{{ volTotalComplaints }} 笔，经济损失 {{ volTotalLoss.toFixed(1) }} 万元</span>
          </div>
          <ChartContainer :option="complaintChartOption" height="280px" :loading="loading" />
        </div>
      </el-tab-pane>

      <!-- Tab 3: 电压波动热点区域 -->
      <el-tab-pane label="电压波动热点区域" name="hotspot">
        <div class="chart-panel" style="margin-bottom:12px">
          <div style="font-size:14px;font-weight:600;padding:8px 16px 4px 16px;color:#303133;display:flex;justify-content:space-between;align-items:center">
            <span>地理热点分布</span>
            <span style="font-size:11px;font-weight:400;color:#909399">X: 经度 | Y: 纬度 | Z: 投诉密度 | 色: 投诉密度 | 可拖拽旋转/缩放</span>
          </div>
          <div ref="hotspot3dRef" style="width:100%;height:380px"></div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
:deep(.el-tabs--border-card) { border: 1px solid #e4e7ed; box-shadow: none; }
:deep(.el-tabs--border-card > .el-tabs__header) { background: #f5f7fa; border-bottom: 1px solid #e4e7ed; margin: 0; }
:deep(.el-tabs--border-card > .el-tabs__content) { padding: 16px; }
</style>
