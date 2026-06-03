<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchAlerts, fetchEventTrace } from '@/api/grid-diagnosis'

const loading = ref(false)
const alerts = ref<any[]>([])
const page = ref(1)
const pSize = 10

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  const data: any[] = await fetchAlerts({ limit: 200 }) as any[]
  const voltageAlerts = (data || []).filter((a: any) =>
    ['VOLTAGE_FLUCTUATION', 'FREQUENCY_DEVIATION', 'POWER_FACTOR'].includes(a.source_type)
  )
  // 每条告警自动分析根因
  const result = []
  for (const a of voltageAlerts) {
    const analysis = await fetchEventTrace(a.id)
    result.push({
      id: a.id,
      time: a.triggered_at?.slice(0, 16).replace('T', ' '),
      level: a.alert_level,
      sourceType: a.source_type,
      title: a.title,
      primaryCause: analysis?.primaryCause || '-',
      probability: analysis?.probability || 0,
      measures: analysis?.preventiveMeasures || [],
    })
  }
  alerts.value = result
  loading.value = false
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">历史事件追溯分析</div>

    <div class="chart-panel">
      <el-table :data="alerts.slice((page-1)*pSize, page*pSize)" size="small" stripe height="420">
        <el-table-column prop="time" label="时间" width="170" />
        <el-table-column label="等级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.level === 'CRITICAL' ? 'danger' : 'warning'" size="small">{{ row.level === 'CRITICAL' ? '严重' : '警告' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="指标" width="100">
          <template #default="{ row }">
            <el-tag :type="row.sourceType === 'FREQUENCY_DEVIATION' ? 'info' : row.sourceType === 'POWER_FACTOR' ? 'success' : 'warning'" size="small">{{ (row.sourceType === 'FREQUENCY_DEVIATION' ? '频率偏差' : row.sourceType === 'POWER_FACTOR' ? '功率因数' : '电压波动') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="告警内容" width="160" />
        <el-table-column prop="primaryCause" label="根因分析" min-width="200" />
        <el-table-column label="置信度" width="80">
          <template #default="{ row }">{{ row.probability }}%</template>
        </el-table-column>
        <el-table-column label="预防措施" min-width="160">
          <template #default="{ row }">{{ (row.measures || []).slice(0, 2).join('；') }}</template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="pSize" :total="alerts.length" layout="prev, pager, next" size="small" style="padding:8px 16px;justify-content:flex-end" />
    </div>
  </div>
</template>

<style scoped>
</style>
