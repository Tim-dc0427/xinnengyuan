import { ref, watch, onUnmounted } from 'vue'
import { getTaskProgress } from '@/api/power-flow'

export function useTaskProgress(taskId: import('vue').Ref<string | null>) {
  const progressPct = ref(0)
  const etaMs = ref<number | null>(null)
  const status = ref<string>('pending')
  const phaseLabel = ref('')
  const elapsedSec = ref(0)
  const checkpointAvailable = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const startPolling = () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      if (!taskId.value) return
      try {
        const res = await getTaskProgress(taskId.value)
        if (!res) return
        progressPct.value = res.progressPct ?? 0
        etaMs.value = res.etaMs
        status.value = res.status
        phaseLabel.value = res.progressMessage || ''
        elapsedSec.value = res.elapsedSec ?? 0
        checkpointAvailable.value = res.checkpointAvailable ?? false

        if (res.status === 'completed' || res.status === 'failed') {
          if (pollTimer) clearInterval(pollTimer)
          pollTimer = null
        }
      } catch (e: any) {
        error.value = e.message
        // 如果任务不存在则停止轮询
        if (e?.response?.status === 404) {
          if (pollTimer) clearInterval(pollTimer)
          pollTimer = null
        }
      }
    }, 1000)
  }

  watch(taskId, (id) => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    // 重置
    progressPct.value = 0
    etaMs.value = null
    status.value = 'pending'
    phaseLabel.value = ''
    elapsedSec.value = 0
    checkpointAvailable.value = false
    error.value = null

    if (id) {
      startPolling()
    }
  })

  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })

  return {
    progressPct, etaMs, status, phaseLabel, elapsedSec, checkpointAvailable,
    loading, error,
  }
}
