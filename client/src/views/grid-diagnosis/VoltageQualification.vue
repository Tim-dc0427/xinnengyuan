<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchQualificationRate } from '@/api/grid-diagnosis'
import { fetchDataRanges } from '@/api/system'

const dateRange = ref<[string, string]>(['2026-03-01', '2026-06-02'])
const voltageLevel = ref('')
const filterZone = ref('')
const ledgerPage = ref(1)
const anomalyPage = ref(1)
const pageSize = 15
const groupBy = ref<'zone' | 'voltageLevel'>('zone')
const filterHour = ref('')
const loading = ref(false)
const hourlyLedger = ref<any[]>([])
const trendData = ref<any[]>([])
const trendKeys = ref<string[]>([])
const anomalyPoints = ref<any[]>([])
const rawData = ref<any>(null)

const hourSlots = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00')

const filteredLedger = computed(() => {
  let list = hourlyLedger.value
  if (filterZone.value) list = list.filter((l: any) => l.zone === filterZone.value)
  if (filterHour.value) list = list.filter((l: any) => l.period === filterHour.value)
  return list
})

onMounted(async () => {
  try {
    const ranges = await fetchDataRanges()
    const v = ranges.voltage_measurements
    if (v?.minTime && v?.maxTime) {
      const today = new Date().toISOString().slice(0, 10)
      const endDate = today < v.maxTime.slice(0, 10) ? today : v.maxTime.slice(0, 10)
      dateRange.value = [v.minTime.slice(0, 10), endDate]
    }
  } catch { /* 兜底 */ }
  loadData()
})

async function loadData() {
  loading.value = true
  const data = await fetchQualificationRate({
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    voltageLevel: voltageLevel.value || undefined,
  } as any)
  if (data) {
    rawData.value = data
    hourlyLedger.value = data.hourlyLedger || []
    trendData.value = data.trendData || []
    trendKeys.value = data.trendKeys || []
    anomalyPoints.value = data.anomalyPoints || []
  }
  loading.value = false
}

const trendOption = computed(() => {
  const groups = new Map<string, number[]>()
  for (const td of trendData.value) {
    for (const key of trendKeys.value) {
      if (td[key] == null) continue
      const [zone, vl] = key.split('|')
      const dim = groupBy.value === 'zone' ? zone : vl
      if (!groups.has(dim)) groups.set(dim, [])
      groups.get(dim)!.push(td[key] as number)
    }
  }
  const dimList = Array.from(groups.keys()).sort()
  const lines = dimList.map(dim => ({
    name: dim,
    type: 'line' as const,
    data: trendData.value.map(td => {
      let sum = 0, cnt = 0
      for (const key of trendKeys.value) {
        const [zone, vl] = key.split('|')
        const d = groupBy.value === 'zone' ? zone : vl
        if (d === dim && td[key] != null) { sum += td[key] as number; cnt++ }
      }
      return cnt > 0 ? +(sum / cnt).toFixed(1) : null
    }),
    smooth: true,
    symbol: 'circle',
    symbolSize: 4,
  }))
  // 动态 Y 轴范围：取所有有效值的最小值，向下取整到5的倍数，上限固定100
  const allVals = lines.flatMap(l => l.data.filter((v: any) => v != null) as number[])
  const dataMin = allVals.length > 0 ? Math.min(...allVals) : 95
  const yMin = Math.max(0, Math.floor(dataMin / 5) * 5)
  const yMax = 100
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => {
      let s = p[0]?.axisValue || ''
      for (const pi of p) { s += `<br/>${pi.seriesName}：${pi.value ?? '-'}%` }
      return s
    }},
    legend: { data: dimList, type: 'scroll' as const, bottom: 0 },
    xAxis: { type: 'category' as const, data: trendData.value.map(d => d.hour), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value' as const, name: '%', min: yMin, max: yMax },
    series: lines,
    grid: { left: 50, right: 16, top: 24, bottom: 50 },
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">电压合格率统计</div>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">区域</span>
        <el-select v-model="filterZone" size="small" style="width:120px" clearable placeholder="全部">
          <el-option v-for="z in [...new Set((hourlyLedger||[]).map((l:any)=>l.zone))].sort()" :key="z" :label="z" :value="z" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">电压等级</span>
        <el-select v-model="voltageLevel" size="small" style="width:120px" clearable placeholder="全部" @change="loadData">
          <el-option label="10kV" value="10kV" />
          <el-option label="35kV" value="35kV" />
          <el-option label="110kV" value="110kV" />
          <el-option label="220kV" value="220kV" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">时段</span>
        <el-select v-model="filterHour" size="small" style="width:100px" clearable placeholder="全部">
          <el-option v-for="h in hourSlots" :key="h" :label="h" :value="h" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期范围</span>
        <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadData" style="width:130px" />
        <span style="color:#909399;margin:0 4px">至</span>
        <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadData" style="width:130px" />
      </div>
    </div>

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="padding:8px 16px 4px 16px;font-size:14px;font-weight:600;color:#303133">分时段合格率台账</div>
      <el-table :data="filteredLedger.slice((ledgerPage-1)*pageSize, ledgerPage*pageSize)" stripe style="width:100%" max-height="520">
        <el-table-column prop="period" label="时段" width="80" />
        <el-table-column prop="zone" label="区域" min-width="100" />
        <el-table-column prop="voltageLevel" label="电压等级" min-width="100" />
        <el-table-column prop="totalHours" label="总采样点" min-width="90" />
        <el-table-column prop="qualifiedHours" label="合格采样点" min-width="100" />
        <el-table-column label="合格率" min-width="80">
          <template #default="{ row }">{{ row.rate }}%</template>
        </el-table-column>
        <el-table-column prop="violations" label="越限次数" min-width="80" />
      </el-table>
      <el-pagination v-if="filteredLedger.length > pageSize" v-model:current-page="ledgerPage" :page-size="pageSize" :total="filteredLedger.length" layout="prev, pager, next" size="small" style="padding:8px 16px;justify-content:flex-end" />
    </div>

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px 4px 16px">
        <span style="font-size:14px;font-weight:600;color:#303133">24小时合格率趋势</span>
        <el-radio-group v-model="groupBy" size="small">
          <el-radio-button value="zone">按区域</el-radio-button>
          <el-radio-button value="voltageLevel">按电压等级</el-radio-button>
        </el-radio-group>
      </div>
      <ChartContainer :option="trendOption" height="320px" :loading="loading" />
    </div>

    <div class="chart-panel" v-if="anomalyPoints.length > 0">
      <div style="font-size:14px;font-weight:600;padding:8px 16px 4px 16px;color:#303133">电压影响因素标注</div>
      <el-table :data="anomalyPoints.slice((anomalyPage-1)*pageSize, anomalyPage*pageSize)" size="small" stripe max-height="280">
        <el-table-column prop="time" label="异常时段" width="170" />
        <el-table-column prop="zone" label="区域" width="80" />
        <el-table-column label="偏差率" width="80">
          <template #default="{ row }">
            <span :style="{ color: row.rate > 10 ? '#F56C6C' : '#E6A23C', fontWeight: 600 }">{{ row.rate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="主因类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.causeType === '气象条件' ? 'warning' : row.causeType === '负荷情况' ? 'info' : 'success'" size="small">{{ row.causeType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rootCause" label="根因分析" min-width="220" />
        <el-table-column prop="weather" label="天气" width="100" />
        <el-table-column prop="pvStatus" label="光伏(kW)" width="100" />
        <el-table-column prop="loadStatus" label="负荷(kW)" width="100" />
      </el-table>
      <el-pagination v-if="anomalyPoints.length > pageSize" v-model:current-page="anomalyPage" :page-size="pageSize" :total="anomalyPoints.length" layout="prev, pager, next" size="small" style="padding:4px 16px 8px;justify-content:flex-end" />
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
