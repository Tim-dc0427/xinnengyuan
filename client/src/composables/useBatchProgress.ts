import { ref, watch, onUnmounted } from 'vue'
import { fetchBatchStatus } from '@/api/power-flow'

export function useBatchProgress(groupId: string) {
  const group = ref<any>(null)
  const items = ref<any[]>([])
  const overallEtaMs = ref<number | null>(null)
  const status = ref<string>('pending')
  const completedTasks = ref(0)
  const totalTasks = ref(0)
  const failedTasks = ref(0)

  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false

  async function poll() {
    if (!groupId) return
    try {
      const data = await fetchBatchStatus(groupId)
      group.value = data.group
      items.value = data.items || []
      overallEtaMs.value = data.overallEtaMs
      status.value = data.group?.status || 'pending'
      completedTasks.value = data.group?.completedTasks || 0
      totalTasks.value = data.group?.totalTasks || 0
      failedTasks.value = data.group?.failedTasks || 0

      if (['completed', 'failed', 'partial_failed', 'cancelled'].includes(status.value)) {
        stop()
      }
    } catch {
      // 轮询失败不中断
    }
    if (!stopped) {
      timer = setTimeout(poll, 2000)
    }
  }

  function stop() {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function start() {
    stopped = false
    poll()
  }

  watch(() => groupId, (newId) => {
    stop()
    if (newId) start()
  }, { immediate: true })

  onUnmounted(() => stop())

  return { group, items, overallEtaMs, status, completedTasks, totalTasks, failedTasks, start, stop }
}
