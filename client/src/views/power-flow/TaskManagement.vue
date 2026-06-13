<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchTasks, pauseTask, resumeTask } from '@/api/power-flow'
import type { TaskListItem } from '@/api/power-flow'
import { ElMessage } from 'element-plus'

const router = useRouter()

const tasks = ref<TaskListItem[]>([])
const loading = ref(false)
const filterTaskType = ref('')
const filterStatus = ref('')

const filteredTasks = computed(() => {
  let list = tasks.value
  if (filterTaskType.value) list = list.filter(t => t.task_type === filterTaskType.value)
  if (filterStatus.value) list = list.filter(t => t.status === filterStatus.value)
  return list
})

const hasRunningTasks = computed(() => tasks.value.some(t => ['queued', 'running'].includes(t.status)))

const taskTypeMap: Record<string, string> = {
  STANDARD: '标准潮流',
  REVERSE: '反向潮流',
  PROBABILISTIC: '概率潮流',
  THREE_PHASE: '三相潮流',
}

const statusMap: Record<string, { type: string; label: string }> = {
  queued: { type: 'info', label: '排队中' },
  running: { type: 'warning', label: '运行中' },
  paused: { type: '', label: '已暂停' },
  completed: { type: 'success', label: '已完成' },
  failed: { type: 'danger', label: '失败' },
}

function formatEta(ms: number | null) {
  if (!ms || ms <= 0) return '-'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}小时${Math.floor((sec % 3600) / 60)}分`
}

function formatElapsed(sec: number) {
  if (!sec || sec <= 0) return '-'
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分`
  return `${Math.floor(sec / 3600)}小时`
}

const resultRoutes: Record<string, string> = {
  STANDARD: '/power-flow/online/standard',
  REVERSE: '/power-flow/online/reverse',
  PROBABILISTIC: '/power-flow/online/probabilistic',
  THREE_PHASE: '/power-flow/online/three-phase',
}

async function loadTasks() {
  try {
    tasks.value = await fetchTasks({ limit: 100 })
  } catch { /* ignore */ }
}

async function handlePause(id: string) {
  try {
    await pauseTask(id)
    ElMessage.success('任务已暂停')
    await loadTasks()
  } catch (e: any) { ElMessage.error(e?.message || '暂停失败') }
}

async function handleResume(id: string) {
  try {
    await resumeTask(id)
    ElMessage.success('任务已恢复')
    await loadTasks()
  } catch (e: any) { ElMessage.error(e?.message || '恢复失败') }
}

function handleViewResult(task: TaskListItem) {
  const route = resultRoutes[task.task_type]
  if (route) router.push({ path: route, query: { taskId: task.id } })
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!hasRunningTasks.value) return
    loadTasks()
  }, 3000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  loading.value = true
  await loadTasks()
  loading.value = false
  startPolling()
})

onUnmounted(() => stopPolling())
</script>

<template>
  <div class="task-management">
    <div class="chart-panel-title">异步计算及进度跟踪</div>
    <div class="chart-panel">
      <div class="chart-panel-title">异步计算及进度跟踪</div>
      <div class="filter-bar">
        <el-select v-model="filterTaskType" placeholder="计算类型" clearable size="small" style="width:140px">
          <el-option v-for="(label, value) in taskTypeMap" :key="value" :label="label" :value="value" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable size="small" style="width:120px">
          <el-option v-for="(item, value) in statusMap" :key="value" :label="item.label" :value="value" />
        </el-select>
      </div>
      <el-table :data="filteredTasks" v-loading="loading" size="small" stripe max-height="540">
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ taskTypeMap[row.task_type] || row.task_type }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type || 'info'" size="small">
              {{ statusMap[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" min-width="180">
          <template #default="{ row }">
            <el-progress
              :percentage="row.progress_pct"
              :stroke-width="8"
              :status="row.status === 'failed' ? 'exception' : row.status === 'completed' ? 'success' : ''"
            />
            <span v-if="row.progress_message" style="font-size:11px;color:#909399;margin-left:4px">{{ row.progress_message }}</span>
          </template>
        </el-table-column>
        <el-table-column label="预计剩余" width="90">
          <template #default="{ row }">
            <span style="font-size:12px;color:#909399">{{ formatEta(row.eta_ms) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="80">
          <template #default="{ row }">
            <span style="font-size:12px;color:#909399">{{ formatElapsed(row.elapsedSec) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button v-if="row.status === 'running'" size="small" link type="warning" @click="handlePause(row.id)">暂停</el-button>
            <el-button v-if="row.status === 'paused'" size="small" link type="primary" @click="handleResume(row.id)">{{ row.checkpointAvailable ? '断点续算' : '继续' }}</el-button>
            <el-button v-if="row.status === 'completed'" size="small" link type="primary" @click="handleViewResult(row)">查看结果</el-button>
            <el-button v-if="row.status === 'failed'" size="small" link type="danger" @click="ElMessage.info(row.error_message || '无错误详情')">查看错误</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.task-management { padding: 0; }
.filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
</style>
