<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTaskProgress } from '@/composables/useTaskProgress'
import { pauseTask, resumeTask } from '@/api/power-flow'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  taskId: string | null
  showPauseResume?: boolean
}>()

const emit = defineEmits<{
  completed: [result: any]
  failed: [error: string]
  statusChange: [status: string]
}>()

const {
  progressPct, etaMs, status, phaseLabel, elapsedSec, checkpointAvailable,
} = useTaskProgress(computed(() => props.taskId))

const isRunning = computed(() => status.value === 'running')
const isPaused = computed(() => status.value === 'paused')
const isCompleted = computed(() => status.value === 'completed')
const isFailed = computed(() => status.value === 'failed')

// 状态变化时通知父组件
watch(status, (val) => {
  if (val === 'completed') emit('completed', null)
  else if (val === 'failed') emit('failed', phaseLabel.value || '计算任务失败')
  emit('statusChange', val)
})

const etaFormatted = computed(() => {
  if (!etaMs.value) return null
  const s = Math.round(etaMs.value / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
})

const elapsedFormatted = computed(() => {
  const s = elapsedSec.value
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
})

const statusColor = computed(() => {
  switch (status.value) {
    case 'running': return '#267F7B'
    case 'paused': return '#E6A23C'
    case 'completed': return '#67C23A'
    case 'failed': return '#F56C6C'
    default: return '#909399'
  }
})

const statusText = computed(() => {
  switch (status.value) {
    case 'running': return '计算中'
    case 'paused': return '已暂停'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    default: return '待开始'
  }
})

async function handlePause() {
  if (!props.taskId) return
  try {
    await pauseTask(props.taskId)
    ElMessage.success('任务已暂停')
  } catch (e: any) {
    ElMessage.error('暂停失败: ' + (e.message || '未知错误'))
  }
}

async function handleResume() {
  if (!props.taskId) return
  try {
    await resumeTask(props.taskId)
    ElMessage.success('任务已恢复')
  } catch (e: any) {
    ElMessage.error('恢复失败: ' + (e.message || '未知错误'))
  }
}
</script>

<template>
  <div v-if="taskId" class="calc-progress">
    <div class="progress-header">
      <span class="status-badge" :style="{ background: statusColor }">{{ statusText }}</span>
      <span class="phase-label">{{ phaseLabel }}</span>
    </div>
    <el-progress
      :percentage="progressPct"
      :status="isFailed ? 'exception' : isCompleted ? 'success' : undefined"
      :stroke-width="16"
      :text-inside="false"
      striped
      striped-flow
    />
    <div class="progress-info">
      <span>已用时间: {{ elapsedFormatted }}</span>
      <span v-if="etaFormatted && isRunning">预计剩余: {{ etaFormatted }}</span>
      <span v-if="isPaused && checkpointAvailable" class="checkpoint-hint">已保存断点数据，可继续计算</span>
    </div>
    <div v-if="showPauseResume && (isRunning || isPaused)" class="progress-actions">
      <el-button v-if="isRunning" type="warning" size="small" @click="handlePause">
        暂停
      </el-button>
      <el-button v-if="isPaused" type="primary" size="small" @click="handleResume">
        继续
      </el-button>
    </div>
  </div>
  <div v-else class="calc-progress idle">
    <el-empty description='请点击"开始计算"按钮启动计算任务' :image-size="60" />
  </div>
</template>

<style scoped>
.calc-progress {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 16px 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.calc-progress.idle {
  text-align: center;
  padding: 10px;
}
.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
}
.phase-label {
  color: #606266;
  font-size: 13px;
}
.progress-info {
  display: flex;
  gap: 24px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.checkpoint-hint {
  color: #E6A23C;
}
.progress-actions {
  margin-top: 12px;
}
</style>
