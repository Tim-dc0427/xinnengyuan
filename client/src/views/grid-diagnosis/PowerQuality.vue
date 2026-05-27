<script setup lang="ts">
import { ref } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'

const voltageChart = ref({
  tooltip: { trigger: 'axis' },
  legend: { data: ['A相电压', 'B相电压', 'C相电压', '基准线'] },
  xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}:00`) },
  yAxis: { type: 'value', name: 'kV' },
  series: [
    { name: 'A相电压', type: 'line', data: Array.from({ length: 24 }, () => 10.1 + Math.random() * 0.6 - 0.3) },
    { name: 'B相电压', type: 'line', data: Array.from({ length: 24 }, () => 10.1 + Math.random() * 0.6 - 0.3) },
    { name: 'C相电压', type: 'line', data: Array.from({ length: 24 }, () => 10.1 + Math.random() * 0.6 - 0.3) },
    { name: '基准线', type: 'line', data: Array(24).fill(10), lineStyle: { type: 'dashed', color: '#E6A23C' } },
  ],
})

const alerts = ref([
  { time: '14:32', level: 'WARN', title: '电压波动超5%', source: '接入点A', status: 'pending' },
  { time: '11:08', level: 'INFO', title: '三相不平衡预警', source: '接入点B', status: 'acknowledged' },
  { time: '09:15', level: 'CRITICAL', title: '电压骤降', source: '接入点A', status: 'resolved' },
])

const historyEvents = ref([
  { id: 'EVT-001', time: '2026-05-18 14:32', type: '电压波动', cause: '光伏出力突降', impact: '中', suggestion: '启用备用电源' },
  { id: 'EVT-002', time: '2026-05-17 08:45', type: '三相不平衡', cause: '单相负荷突变', impact: '低', suggestion: '调整负荷分配' },
  { id: 'EVT-003', time: '2026-05-16 16:20', type: '电压越限', cause: '逆变器故障', impact: '高', suggestion: '检修逆变器' },
])
</script>

<template>
  <div class="page-container">
    <div class="chart-panel">
      <div class="chart-panel-title">并网点电压波动监测</div>
      <ChartContainer :option="voltageChart" height="350px" />
    </div>

    <div class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">供电可靠性分析</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="SAIFI">0.85次/年</el-descriptions-item>
          <el-descriptions-item label="SAIDI">120分钟/年</el-descriptions-item>
          <el-descriptions-item label="理论可靠率">99.8%</el-descriptions-item>
          <el-descriptions-item label="实际可靠率">99.6%</el-descriptions-item>
          <el-descriptions-item label="偏差率">0.2%</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">电压合格率</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="总监测时长">720h</el-descriptions-item>
          <el-descriptions-item label="合格时长">714h</el-descriptions-item>
          <el-descriptions-item label="合格率">99.2%</el-descriptions-item>
          <el-descriptions-item label="越限次数">6次</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">告警清单</div>
      <el-table :data="alerts" stripe>
        <el-table-column prop="time" label="时间" width="100" />
        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="row.level === 'CRITICAL' ? 'danger' : row.level === 'WARN' ? 'warning' : 'info'" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="告警内容" />
        <el-table-column prop="source" label="来源" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'resolved' ? 'success' : row.status === 'acknowledged' ? 'warning' : 'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">历史事件追溯分析</div>
      <el-table :data="historyEvents" stripe>
        <el-table-column prop="id" label="事件ID" width="100" />
        <el-table-column prop="time" label="时间" width="170" />
        <el-table-column prop="type" label="类型" />
        <el-table-column prop="cause" label="原因分析" />
        <el-table-column prop="impact" label="影响程度" />
        <el-table-column prop="suggestion" label="建议措施" />
      </el-table>
    </div>
  </div>
</template>
