<script setup lang="ts">
import { ref } from 'vue'
import StatCard from '@/components/common/StatCard.vue'
import ChartContainer from '@/components/common/ChartContainer.vue'

const dateRange = ref<[string, string]>(['2026-05-01', '2026-05-18'])

const outputChart = ref({
  tooltip: { trigger: 'axis' },
  legend: { data: ['集中式A站', '集中式B站', '清源储能站'] },
  xAxis: { type: 'category', data: Array.from({ length: 18 }, (_, i) => `${i + 1}日`) },
  yAxis: { type: 'value', name: 'MW' },
  series: [
    { name: '集中式A站', type: 'bar', stack: 'total', data: Array.from({ length: 18 }, () => Math.round(20 + Math.random() * 15)) },
    { name: '集中式B站', type: 'bar', stack: 'total', data: Array.from({ length: 18 }, () => Math.round(12 + Math.random() * 8)) },
    { name: '清源储能站', type: 'bar', stack: 'total', data: Array.from({ length: 18 }, () => Math.round(3 + Math.random() * 5)) },
  ],
})

const factorChart = ref({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', name: '辐照度 (W/m²)' },
  yAxis: { type: 'value', name: '出力 (kW)' },
  series: [
    {
      type: 'scatter', data: Array.from({ length: 100 }, () => [Math.random() * 1000, Math.random() * 50000]),
      symbolSize: 6,
    },
  ],
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span class="chart-panel-title" style="margin-bottom:0">发电量统计分析</span>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" size="small" />
      </div>
      <ChartContainer :option="outputChart" height="350px" />
    </div>

    <div class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">光照-光伏出力关联分析</div>
        <ChartContainer :option="factorChart" height="300px" />
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">极端场景模拟分析</div>
        <el-form label-width="100px" size="small">
          <el-form-item label="场景类型">
            <el-select model-value="high_temperature" style="width:100%">
              <el-option label="高温场景" value="high_temperature" />
              <el-option label="暴雨场景" value="rainstorm" />
            </el-select>
          </el-form-item>
          <el-form-item label="影响评估">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="出力骤降">15%</el-descriptions-item>
              <el-descriptions-item label="消纳能力变化">-150MW</el-descriptions-item>
              <el-descriptions-item label="备用容量需求">200MW</el-descriptions-item>
            </el-descriptions>
          </el-form-item>
          <el-form-item>
            <el-button type="primary">运行模拟</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">碳排放量统计分析</div>
      <el-table :data="[
        { period: '2026-05', output: '3,200 MWh', co2: '2,720 吨', coal: '960 吨' },
        { period: '2026-04', output: '4,150 MWh', co2: '3,527 吨', coal: '1,245 吨' },
        { period: '2026-03', output: '3,800 MWh', co2: '3,230 吨', coal: '1,140 吨' },
      ]" stripe>
        <el-table-column prop="period" label="统计周期" width="120" />
        <el-table-column prop="output" label="总发电量" />
        <el-table-column prop="co2" label="CO₂减排量" />
        <el-table-column prop="coal" label="节煤量" />
      </el-table>
    </div>
  </div>
</template>
