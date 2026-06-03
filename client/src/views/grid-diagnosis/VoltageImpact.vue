<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchEquipmentImpact, fetchComplaintStats, fetchHotspotDistribution, fetchStations } from '@/api/grid-diagnosis'
import { apiClient } from '@/api/client'

const dateRange = ref<[string, string]>(['2026-01-01', '2026-06-02'])
const selectedEquip = ref('')
const filterStation = ref('')
const loading = ref(false)
const stations = ref<any[]>([])
const equipmentImpact = ref<any[]>([])
const complaintStats = ref<any[]>([])
const hotspotData = ref<any[]>([])
const equipEvents = ref<any[]>([])
const typeAvgRise = ref(0)
const theoryRise = ref(5)
const isWeak = ref(false)
const noPeer = ref(false)
const noEquipData = ref(false)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  const list = await fetchStations()
  stations.value = list || []
  const [equip, complain, hotspot] = await Promise.all([
    fetchEquipmentImpact({ startDate: dateRange.value[0], endDate: dateRange.value[1] }),
    fetchComplaintStats({ startDate: dateRange.value[0], endDate: dateRange.value[1] }),
    fetchHotspotDistribution({ startDate: dateRange.value[0], endDate: dateRange.value[1] }),
  ])
  equipmentImpact.value = equip || []
  complaintStats.value = complain || []
  hotspotData.value = hotspot || []
  if (equip?.length && !selectedEquip.value) { selectedEquip.value = equip[0].id; await loadEquipEvents() }
  loading.value = false
}

async function loadEquipEvents() {
  if (!selectedEquip.value) return
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/equipment-events', {
    params: { equipmentId: selectedEquip.value }
  })
  const data = res.data?.data || {}
  equipEvents.value = data.events || []
  typeAvgRise.value = data.typeAvgRise || 0
  theoryRise.value = data.theoryRise || 5
  isWeak.value = data.isWeak || false
  noPeer.value = data.noPeer || false
  noEquipData.value = data.noData || false
}

const timelineOption = computed(() => ({
  tooltip: { formatter: (p: any) => `${p.data[0]}<br/>温升：${p.data[1]}°C` },
  xAxis: { type: 'category', data: equipEvents.value.map((e: any) => e.time?.slice(5, 16) || ''), axisLabel: { rotate: 30, fontSize: 10 } },
  yAxis: { type: 'value', name: '温升(°C)' },
  series: [
    { name: '骤升温升', type: 'scatter', symbolSize: 12,
      data: equipEvents.value.filter((e: any) => e.status === 'surge').map((e: any) => [e.time?.slice(5, 16), e.tempRise]),
      itemStyle: { color: '#F56C6C' },
      markLine: { silent: true, symbol: 'none', label: { formatter: `理论 ${theoryRise.value}°C` },
        data: [{ yAxis: theoryRise.value, lineStyle: { color: '#909399', type: 'dashed' } }] } },
    { name: '骤降温升', type: 'scatter', symbolSize: 12,
      data: equipEvents.value.filter((e: any) => e.status === 'sag').map((e: any) => [e.time?.slice(5, 16), e.tempRise]),
      itemStyle: { color: '#409EFF' } },
  ],
  legend: { data: ['骤升温升', '骤降温升'], bottom: 0 },
  grid: { left: 50, right: 16, top: 16, bottom: 50 },
}))

const complaintChartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: complaintStats.value.map(d => d.industry) },
  yAxis: { type: 'value', name: '投诉数量' },
  series: [{ name: '投诉数量', type: 'bar', data: complaintStats.value.map(d => d.complaints),
    itemStyle: { borderRadius: [4, 4, 0, 0] } }],
  grid: { left: 50, right: 16, top: 16, bottom: 30 },
}))

const hotspotOption = computed(() => {
  const zones = hotspotData.value.map(d => d.zone)
  const indicators = ['波动率(%)', '投诉数']
  const data: Array<[number, number, number]> = []
  hotspotData.value.forEach((d, i) => { data.push([i, 0, d.avgFluctuation]); data.push([i, 1, d.complaints]) })
  const maxVal = Math.max(...data.map(d => d[2]), 1)
  return {
    tooltip: { formatter: (p: any) => `${zones[p.data[0]]}<br/>${indicators[p.data[1]]}: ${p.data[2]}` },
    xAxis: { type: 'category', data: zones, axisLabel: { rotate: 30 } },
    yAxis: { type: 'category', data: indicators },
    visualMap: { min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#e8f5e9', '#fff9c4', '#ffcc02', '#ff9800', '#f44336'] } },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 11 } }],
    grid: { left: 70, right: 40, top: 16, bottom: 60 },
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">电压波动影响分析</div>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">电站</span>
        <el-select v-model="filterStation" size="small" style="width:160px" clearable placeholder="全部电站">
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.stationName" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">设备</span>
        <el-select v-model="selectedEquip" size="small" style="width:220px" @change="loadEquipEvents">
          <el-option v-for="d in equipmentImpact.filter((d:any) => !filterStation || d.stationName === filterStation)" :key="d.id" :label="d.device" :value="d.id" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期范围</span>
        <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadData" style="width:130px" />
        <span style="color:#909399;margin:0 4px">至</span>
        <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadData" style="width:130px" />
      </div>
      <div class="filter-group" v-if="equipEvents.length > 0 || noEquipData">
        <el-tag v-if="noEquipData" type="info" size="small">无温升数据</el-tag>
        <template v-else-if="noPeer">
          <el-tag type="info" size="small">同类仅此一台</el-tag>
        </template>
        <template v-else>
          <el-tag :type="isWeak ? 'danger' : 'success'" size="small">{{ isWeak ? '薄弱设备' : '正常设备' }}</el-tag>
          <span style="font-size:12px;color:#909399">正常设备基准：{{ typeAvgRise }}°C（理论{{ theoryRise }}°C）| 本设备：{{ equipEvents.length > 0 ? (equipEvents.reduce((s,e:any) => s + e.tempRise, 0) / equipEvents.length).toFixed(1) : 0 }}°C</span>
        </template>
      </div>
    </div>

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 0 4px 16px;color:#303133">电压骤升/骤降时温升变化（超同类均值即薄弱）</div>
      <ChartContainer :option="timelineOption" height="280px" :loading="loading" />
    </div>

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 0 4px 16px;color:#303133">设备运行影响评估</div>
      <el-table :data="equipmentImpact.filter((d:any) => !filterStation || d.stationName === filterStation)" size="small" stripe height="320">
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

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 0 4px 16px;color:#303133">用户侧影响量化分析</div>
      <ChartContainer :option="complaintChartOption" height="280px" :loading="loading" />
    </div>

    <div class="chart-panel">
      <div style="font-size:14px;font-weight:600;padding:8px 0 4px 16px;color:#303133">电压波动热点区域</div>
      <ChartContainer :option="hotspotOption" height="280px" :loading="loading" />
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
