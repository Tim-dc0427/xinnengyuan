<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { fetchAlerts, acknowledgeAlert } from '@/api/grid-diagnosis'

const showAlertDialog = ref(false)
const unackedAlerts = ref<any[]>([])
let timer: ReturnType<typeof setInterval> | null = null

async function checkAlerts() {
  const data = await fetchAlerts({ limit: 50 })
  const unacked = (data || []).filter((a: any) => !a.acknowledged_at && ['VOLTAGE_FLUCTUATION', 'FREQUENCY_DEVIATION', 'POWER_FACTOR'].includes(a.source_type))
  if (unacked.length > 0) {
    unackedAlerts.value = unacked
    showAlertDialog.value = true
  }
}

async function ackAll() {
  for (const a of unackedAlerts.value) {
    await acknowledgeAlert(a.id).catch(() => {})
  }
  showAlertDialog.value = false
}

onMounted(() => {
  checkAlerts()
  timer = setInterval(checkAlerts, 30000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <RouterView />

  <el-dialog v-model="showAlertDialog" title="供电质量告警" width="700px" :close-on-click-modal="false">
    <el-alert :title="`${unackedAlerts.length} 条待处理告警`" type="warning" :closable="false" style="margin-bottom:12px" />
    <el-table :data="unackedAlerts" size="small" stripe max-height="300">
      <el-table-column prop="triggered_at" label="时间" width="170" />
      <el-table-column label="等级" width="80">
        <template #default="{ row }">
          <el-tag :type="row.alert_level === 'CRITICAL' ? 'danger' : 'warning'" size="small">{{ row.alert_level === 'CRITICAL' ? '严重' : '警告' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="告警内容" />
    </el-table>
    <template #footer>
      <el-button @click="showAlertDialog = false">忽略</el-button>
      <el-button type="primary" @click="ackAll">全部确认</el-button>
    </template>
  </el-dialog>
</template>
