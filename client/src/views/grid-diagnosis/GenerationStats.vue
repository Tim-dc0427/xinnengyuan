<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchPvOutputStats } from '@/api/grid-diagnosis'
import type { AggregatedOutputStats } from '@new-energy/shared'

const dateRange = ref<[string, string]>(['2026-04-01', '2026-06-01'])
const activeTab = ref<'zone' | 'voltage_level'>('zone')
const groupBy = ref<'zone' | 'voltage_level'>('zone')
const compareMode = ref<'yoy' | 'mom' | 'none'>('none')
const loading = ref(false)
const stats = ref<AggregatedOutputStats[]>([])

// 对比模式中文标签
const compareLabel = computed(() => compareMode.value === 'yoy' ? '同比' : '环比')
const prevPeriodLabel = computed(() => compareMode.value === 'yoy' ? '去年同期' : '上期')

// Tab 切换
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

// 柱状图：区域对比
const barOption = computed(() => {
  const names = stats.value.map((r) => r.stationName || r.groupKey)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['装机容量(MW)', '发电量(万kWh)', '发电小时数(h)'] },
    dataZoom: [{ type: 'inside' }],
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 20 } },
    yAxis: [
      { type: 'value', name: 'MW / 万kWh' },
      { type: 'value', name: '小时(h)' },
    ],
    series: [
      { name: '装机容量(MW)', type: 'bar', data: stats.value.map((r) => +(r.installedCapacityMw || 0).toFixed(1)), barGap: '10%' },
      { name: '发电量(万kWh)', type: 'bar', data: stats.value.map((r) => +((r.totalOutputKwh || 0) / 10000).toFixed(1)) },
      { name: '发电小时数(h)', type: 'bar', yAxisIndex: 1, data: stats.value.map((r) => r.generationHours || 0) },
    ],
  }
})

// 堆叠柱状图：电压等级分层
const voltageStackOption = computed(() => {
  const names = stats.value.map((r) => r.groupKey)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['装机容量(MW)', '发电量(万kWh)'] },
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value', name: 'MW / 万kWh' },
    series: [
      { name: '装机容量(MW)', type: 'bar', stack: 'total', data: stats.value.map((r) => +(r.installedCapacityMw || 0).toFixed(1)) },
      { name: '发电量(万kWh)', type: 'bar', stack: 'total', data: stats.value.map((r) => +((r.totalOutputKwh || 0) / 10000).toFixed(1)) },
    ],
  }
})

onMounted(async () => {
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

    <!-- 筛选栏 -->
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

    <!-- 图表 -->
    <div class="chart-panel" style="margin-bottom:16px">
      <ChartContainer :option="groupBy === 'voltage_level' ? voltageStackOption : barOption" height="280px" :loading="loading" />
    </div>

    <!-- 数据表格 -->
    <div class="chart-panel" v-if="stats.length > 0" style="overflow-x:auto">
      <el-table :data="stats" size="small" stripe max-height="500">
        <el-table-column label="时间周期" width="220">
          <template #default>
            {{ dateRange[0] }} 至 {{ dateRange[1] }}
          </template>
        </el-table-column>
        <el-table-column :label="groupBy === 'zone' ? '区域' : '电压等级'" width="160">
          <template #default="{ row }">
            {{ groupBy === 'voltage_level' ? row.groupKey + ' 电压等级' : row.groupKey }}
          </template>
        </el-table-column>
        <el-table-column label="装机容量(MW)" width="110">
          <template #default="{ row }">{{ (row.installedCapacityMw || 0).toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="发电量(万kWh)" width="130">
          <template #default="{ row }">{{ ((row.totalOutputKwh || 0) / 10000).toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="发电小时数(h)" width="120">
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
          <el-table-column :label="`${prevPeriodLabel}发电小时数(h)`" width="160">
            <template #default="{ row }">{{ row.prevGenerationHours != null ? row.prevGenerationHours : '-' }}</template>
          </el-table-column>
          <el-table-column :label="`发电小时数${compareLabel}变化率`" width="140">
            <template #default="{ row }">
              <span v-if="row.generationHoursChangePct != null" :style="{ color: row.generationHoursChangePct >= 0 ? '#67c23a' : '#f56c6c' }">{{ row.generationHoursChangePct >= 0 ? '+' : '' }}{{ row.generationHoursChangePct }}%</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </template>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>


