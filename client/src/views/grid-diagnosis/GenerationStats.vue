<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchPvOutputStats } from '@/api/grid-diagnosis'
import { fetchDataRanges } from '@/api/system'
import type { AggregatedOutputStats } from '@new-energy/shared'

const dateRange = ref<[string, string]>(['2026-06-01', '2026-07-31'])
const activeTab = ref<'zone' | 'voltage_level'>('zone')
const groupBy = ref<'zone' | 'voltage_level'>('zone')
const compareMode = ref<'yoy' | 'mom' | 'none'>('none')
const loading = ref(false)
const stats = ref<AggregatedOutputStats[]>([])

const compareLabel = computed(() => compareMode.value === 'yoy' ? '同比' : '环比')
const prevPeriodLabel = computed(() => compareMode.value === 'yoy' ? '去年同期' : '上期')

function onTabChange(tab: 'zone' | 'voltage_level') {
  activeTab.value = tab
  groupBy.value = tab
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const data = await fetchPvOutputStats({
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      groupBy: groupBy.value,
      compareMode: compareMode.value,
    })
    stats.value = data || []
  } finally {
    loading.value = false
  }
}

// ========== 按区域统计 图表 ==========
// 装机容量
const capacityBarOption = computed(() => {
  const names = stats.value.map((r) => r.stationName || r.groupKey)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['装机容量(MW)'] },
    dataZoom: [{ type: 'inside' }],
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 20 } },
    yAxis: { type: 'value', name: 'MW' },
    series: [
      { name: '装机容量(MW)', type: 'bar', data: stats.value.map((r) => +(r.installedCapacityMw || 0).toFixed(1)), barGap: '10%' },
    ],
  }
})

// 发电量 + 实际发电小时数（双Y轴）
const outputBarOption = computed(() => {
  const names = stats.value.map((r) => r.stationName || r.groupKey)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['发电量(万kWh)', '实际发电小时数(h)'] },
    dataZoom: [{ type: 'inside' }],
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 20 } },
    yAxis: [
      { type: 'value', name: '万kWh' },
      { type: 'value', name: '实际发电小时数(h)' },
    ],
    series: [
      { name: '发电量(万kWh)', type: 'bar', data: stats.value.map((r) => +((r.totalOutputKwh || 0) / 10000).toFixed(1)) },
      { name: '实际发电小时数(h)', type: 'bar', yAxisIndex: 1, data: stats.value.map((r) => r.generationHours || 0) },
    ],
  }
})

// ========== 按电压等级统计 图表 ==========
// 堆叠柱状图：X轴=装机容量+发电效率，堆叠段=各电压等级
const voltageStackOption = computed(() => {
  const levels = stats.value.map((r) => r.groupKey + ' 电压等级')
  const capacityData = stats.value.map((r) => +(r.installedCapacityMw || 0).toFixed(1))
  const hoursData = stats.value.map((r) => r.generationHours || 0)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: levels },
    xAxis: { type: 'category', data: ['装机容量(MW)', '等效利用小时数(h)'] },
    yAxis: { type: 'value' },
    series: levels.map((name, i) => ({
      name,
      type: 'bar',
      stack: 'total',
      data: [capacityData[i], hoursData[i]],
    })),
  }
})

// 发电量柱状图
const voltageOutputOption = computed(() => {
  const names = stats.value.map((r) => r.groupKey + ' 电压等级')
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['发电量(万kWh)'] },
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 20 } },
    yAxis: { type: 'value', name: '万kWh' },
    series: [
      { name: '发电量(万kWh)', type: 'bar', data: stats.value.map((r) => +((r.totalOutputKwh || 0) / 10000).toFixed(1)) },
    ],
  }
})

onMounted(async () => {
  try {
    const ranges = await fetchDataRanges()
    const pv = ranges.pv_output_measurements
    if (pv?.minTime && pv?.maxTime) {
      const today = new Date().toISOString().slice(0, 10)
      const endDate = today < pv.maxTime.slice(0, 10) ? today : pv.maxTime.slice(0, 10)
      dateRange.value = [pv.minTime.slice(0, 10), endDate]
    }
  } catch { /* 保留兜底日期 */ }
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">发电量统计分析</div>

    <el-tabs v-model="activeTab" @tab-change="onTabChange" style="margin-bottom:16px">
      <el-tab-pane label="按区域统计" name="zone" />
      <el-tab-pane label="按电压等级统计" name="voltage_level" />
    </el-tabs>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">对比模式</span>
        <el-select v-model="compareMode" size="small" style="width:100px" @change="loadData">
          <el-option label="无对比" value="none" />
          <el-option label="同比" value="yoy" />
          <el-option label="环比" value="mom" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期范围</span>
        <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadData" style="width:130px" />
        <span style="color:#909399;margin:0 4px">至</span>
        <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadData" style="width:130px" />
      </div>
    </div>

    <!-- 按区域统计 -->
    <template v-if="activeTab === 'zone'">
      <div class="chart-panel" style="margin-bottom:16px">
        <ChartContainer :option="capacityBarOption" height="280px" :loading="loading" />
      </div>
      <div class="chart-panel" style="margin-bottom:16px">
        <ChartContainer :option="outputBarOption" height="280px" :loading="loading" />
      </div>
      <div class="chart-panel" v-if="stats.length > 0" style="overflow-x:auto">
        <el-table :data="stats" size="small" stripe max-height="500">
          <el-table-column label="时间周期" width="220">
            <template #default>{{ dateRange[0] }} 至 {{ dateRange[1] }}</template>
          </el-table-column>
          <el-table-column label="区域" width="160">
            <template #default="{ row }">{{ row.groupKey }}</template>
          </el-table-column>
          <el-table-column label="装机容量(MW)" width="110">
            <template #default="{ row }">{{ (row.installedCapacityMw || 0).toFixed(1) }}</template>
          </el-table-column>
          <el-table-column label="发电量(万kWh)" width="130">
            <template #default="{ row }">{{ ((row.totalOutputKwh || 0) / 10000).toFixed(1) }}</template>
          </el-table-column>
          <el-table-column label="实际发电小时数(h)" width="140">
            <template #default="{ row }">{{ row.generationHours }}</template>
          </el-table-column>
          <template v-if="compareMode !== 'none'">
            <el-table-column :label="`${prevPeriodLabel}发电量(万kWh)`" width="160">
              <template #default="{ row }">{{ row.prevTotalOutputKwh != null ? ((row.prevTotalOutputKwh || 0) / 10000).toFixed(1) : '-' }}</template>
            </el-table-column>
            <el-table-column :label="`发电量${compareLabel}变化率`" width="130">
              <template #default="{ row }">
                <span v-if="row.changePct != null" :style="{ color: row.changePct >= 0 ? '#67c23a' : '#f56c6c' }">{{ row.changePct >= 0 ? '+' : '' }}{{ row.changePct }}%</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column :label="`${prevPeriodLabel}实际发电小时数(h)`" width="170">
              <template #default="{ row }">{{ row.prevGenerationHours != null ? row.prevGenerationHours : '-' }}</template>
            </el-table-column>
            <el-table-column :label="`实际发电小时数${compareLabel}变化率`" width="160">
              <template #default="{ row }">
                <span v-if="row.generationHoursChangePct != null" :style="{ color: row.generationHoursChangePct >= 0 ? '#67c23a' : '#f56c6c' }">{{ row.generationHoursChangePct >= 0 ? '+' : '' }}{{ row.generationHoursChangePct }}%</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>
    </template>

    <!-- 按电压等级统计 -->
    <template v-if="activeTab === 'voltage_level'">
      <div class="chart-panel" style="margin-bottom:16px">
        <ChartContainer :option="voltageStackOption" height="300px" :loading="loading" />
      </div>
      <div class="chart-panel" style="margin-bottom:16px">
        <ChartContainer :option="voltageOutputOption" height="260px" :loading="loading" />
      </div>
      <div class="chart-panel" v-if="stats.length > 0" style="overflow-x:auto">
        <el-table :data="stats" size="small" stripe max-height="500">
          <el-table-column label="时间周期" width="220">
            <template #default>{{ dateRange[0] }} 至 {{ dateRange[1] }}</template>
          </el-table-column>
          <el-table-column label="电压等级" width="160">
            <template #default="{ row }">{{ row.groupKey }} 电压等级</template>
          </el-table-column>
          <el-table-column label="装机容量(MW)" width="110">
            <template #default="{ row }">{{ (row.installedCapacityMw || 0).toFixed(1) }}</template>
          </el-table-column>
          <el-table-column label="发电量(万kWh)" width="130">
            <template #default="{ row }">{{ ((row.totalOutputKwh || 0) / 10000).toFixed(1) }}</template>
          </el-table-column>
          <el-table-column label="等效利用小时数(h)" width="140">
            <template #default="{ row }">{{ row.generationHours }}</template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
