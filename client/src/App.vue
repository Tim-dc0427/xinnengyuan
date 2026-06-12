<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { fetchAlerts, acknowledgeAlert } from '@/api/grid-diagnosis'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const showAlertDialog = ref(false)
const unackedAlerts = ref<any[]>([])
let timer: ReturnType<typeof setInterval> | null = null

// 已弹过窗的告警ID集合，避免同一条告警反复弹窗
const shownAlertIds = new Set<string>()

function loadShownIds() {
  try {
    const raw = localStorage.getItem('shown_alert_ids')
    if (raw) {
      const ids: string[] = JSON.parse(raw)
      ids.forEach(id => shownAlertIds.add(id))
    }
  } catch {}
}
loadShownIds()

function persistShownIds() {
  localStorage.setItem('shown_alert_ids', JSON.stringify([...shownAlertIds].slice(-200)))
}

function startPolling() {
  stopPolling()
  checkAlerts()
  timer = setInterval(checkAlerts, 30000)
}

function stopPolling() {
  if (timer) { clearInterval(timer); timer = null }
}

async function checkAlerts() {
  if (!authStore.isLoggedIn) return
  try {
    const data = await fetchAlerts({ limit: 50 })
    const unacked = (data || []).filter((a: any) => !a.acknowledged_at)
    // 只对没弹过窗的新告警弹窗
    const newAlerts = unacked.filter((a: any) => !shownAlertIds.has(a.id))
    if (newAlerts.length > 0) {
      newAlerts.forEach((a: any) => shownAlertIds.add(a.id))
      persistShownIds()
      unackedAlerts.value = unacked
      showAlertDialog.value = true
    }
    // 当所有未确认告警都已弹过窗时，只更新数据不弹窗
  } catch {
    // 静默失败，避免后台轮询报错干扰用户
  }
}

function closeDialog() {
  showAlertDialog.value = false
  // 关闭弹窗时标记当前所有未确认告警为已显示过
  unackedAlerts.value.forEach((a: any) => shownAlertIds.add(a.id))
  persistShownIds()
}

async function ackAll() {
  for (const a of unackedAlerts.value) {
    await acknowledgeAlert(a.id).catch(() => {})
    shownAlertIds.add(a.id)
  }
  persistShownIds()
  showAlertDialog.value = false
}

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    startPolling()
  } else {
    stopPolling()
  }
}, { immediate: true })

onUnmounted(() => {
  stopPolling()
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
      <el-button @click="closeDialog">忽略</el-button>
      <el-button type="primary" @click="ackAll">全部确认</el-button>
    </template>
  </el-dialog>
</template>
