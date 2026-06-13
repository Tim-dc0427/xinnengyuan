<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBatchList, fetchBatchStatus, cancelBatch, deleteBatch } from '@/api/power-flow'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()

const activeGroupId = ref<string>('')
const batchList = ref<any[]>([])
const group = ref<any>(null)
const items = ref<any[]>([])
const overallEtaMs = ref<number | null>(null)
const status = ref<string>('pending')
const completedTasks = ref(0)
const totalTasks = ref(0)
const failedTasks = ref(0)

let pollTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false

const progressPct = computed(() => {
  if (!totalTasks.value) return 0
  return Math.round((completedTasks.value / totalTasks.value) * 100)
})

const statusTag = computed(() => {
  const map: Record<string, { type: string; label: string }> = {
    pending: { type: 'info', label: '等待中' },
    running: { type: 'warning', label: '运行中' },
    completed: { type: 'success', label: '已完成' },
    partial_failed: { type: 'warning', label: '部分失败' },
    failed: { type: 'danger', label: '失败' },
    cancelled: { type: 'info', label: '已取消' },
  }
  return map[status.value] || { type: 'info', label: status.value }
})

const isFinished = computed(() => ['completed', 'failed', 'partial_failed', 'cancelled'].includes(status.value))
const hasAnomalies = computed(() => failedTasks.value > 0)

function formatEta(ms: number | null) {
  if (ms === null || ms === undefined || ms <= 0) return '-'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}小时${Math.floor((sec % 3600) / 60)}分`
}

async function poll() {
  if (!activeGroupId.value || stopped) return
  try {
    const data = await fetchBatchStatus(activeGroupId.value)
    group.value = data.group
    items.value = data.items || []
    overallEtaMs.value = data.overallEtaMs
    status.value = data.group?.status || 'pending'
    completedTasks.value = data.group?.completedTasks || 0
    totalTasks.value = data.group?.totalTasks || 0
    failedTasks.value = data.group?.failedTasks || 0

    if (['completed', 'failed', 'partial_failed', 'cancelled'].includes(status.value)) {
      stopPoll()
    }
  } catch { /* 忽略轮询错误 */ }
  if (!stopped) {
    pollTimer = setTimeout(poll, 2000)
  }
}

function stopPoll() {
  stopped = true
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
}

function startPoll() {
  stopPoll()
  stopped = false
  poll()
}

async function loadBatchList() {
  try { batchList.value = (await fetchBatchList({ limit: 30 })) || [] } catch { batchList.value = [] }
}

function selectBatch(row: any) {
  activeGroupId.value = row.id
  router.replace({ query: { groupId: row.id } })
  startPoll()
}

async function handleCancel() {
  try {
    await ElMessageBox.confirm('确定要取消此批次？', '确认取消', { type: 'warning' })
    await cancelBatch(activeGroupId.value)
    ElMessage.success('批次已取消')
  } catch { /* 用户取消 */ }
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm('确定要删除此批次？删除后相关计算任务也将被清除。', '确认删除', { type: 'warning' })
    await deleteBatch(activeGroupId.value)
    ElMessage.success('批次已删除')
    activeGroupId.value = ''
    stopPoll()
    await loadBatchList()
  } catch { /* 用户取消 */ }
}

const failedItems = computed(() => items.value.filter((i: any) => i.status === 'failed'))

const solutions = computed(() => {
  if (!hasAnomalies.value) return []
  const suggests: Array<{ target: string; reason: string; fix: string }> = []
  for (const item of failedItems.value) {
    const err = (item.errorMessage || '').toLowerCase()
    let fix = ''
    if (err.includes('奇异') || err.includes('singular') || err.includes('jacobian')) {
      fix = '存在孤立母线或网络孤岛，请检查该对象关联的拓扑连通性'
    } else if (err.includes('收敛') || err.includes('converge')) {
      fix = '潮流计算未收敛，建议增大最大迭代次数或放宽收敛精度'
    } else if (err.includes('数据') || err.includes('参数') || err.includes('缺失') || err.includes('missing')) {
      fix = '设备参数不完整，请补充相关母线或线路的额定参数'
    } else if (err.includes('取消') || err.includes('cancel')) {
      fix = '批次被手动取消，无需处理'
    } else {
      fix = '错误原因未知，建议查看完整日志或联系技术人员'
    }
    suggests.push({ target: item.itemLabel, reason: item.errorMessage || '未知错误', fix })
  }
  return suggests
})

function handleSolution() {
  if (!hasAnomalies.value) {
    ElMessageBox.alert('当前没有异常，暂无方案', '解决方案', { confirmButtonText: '知道了', type: 'info' })
    return
  }
  const lines = solutions.value.map((s, i) =>
    `${i + 1}. ${s.target}\n   错误：${s.reason}\n   方案：${s.fix}`
  )
  ElMessageBox.alert(lines.join('\n\n'), '解决方案', { confirmButtonText: '知道了', type: 'warning', dangerouslyUseHTMLString: false })
}

function goResults() {
  router.push({ name: 'BatchResultAnalysis', query: { groupId: activeGroupId.value } })
}

onMounted(async () => {
  await loadBatchList()
  const qGroupId = route.query.groupId as string
  if (qGroupId) {
    activeGroupId.value = qGroupId
    startPoll()
  }
})

onUnmounted(() => stopPoll())
</script>

<template>
  <div class="batch-monitor">
    <div class="chart-panel-title">任务监控</div>
    <div class="monitor-grid">
      <div class="monitor-left">
        <div class="section-title">批次列表</div>
        <el-table :data="batchList" size="small" max-height="480" stripe highlight-current-row @row-click="selectBatch">
          <el-table-column prop="group_name" label="名称" min-width="140" show-overflow-tooltip />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'completed' ? 'success' : row.status === 'running' ? 'warning' : row.status === 'failed' ? 'danger' : 'info'" size="small">
                {{ row.status === 'completed' ? '完成' : row.status === 'running' ? '运行' : row.status === 'failed' ? '失败' : row.status === 'partial_failed' ? '部分失败' : row.status === 'cancelled' ? '取消' : '等待' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="100">
            <template #default="{ row }">
              <span>{{ row.completed_tasks || 0 }}/{{ row.total_tasks || 0 }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="monitor-right">
        <template v-if="activeGroupId && group">
          <div class="section-title">
            {{ group.group_name || '任务详情' }}
            <el-tag :type="statusTag.type" size="small" style="margin-left:8px">{{ statusTag.label }}</el-tag>
          </div>

          <div class="progress-area">
            <div class="progress-stats">
              <span>总计 {{ totalTasks }} / 完成 {{ completedTasks }} / 失败 {{ failedTasks }}</span>
              <span v-if="!isFinished && overallEtaMs">预计剩余 {{ formatEta(overallEtaMs) }}</span>
            </div>
            <el-progress :percentage="progressPct" :status="failedTasks > 0 && isFinished ? 'exception' : isFinished ? 'success' : ''" />

            <div v-if="hasAnomalies" class="anomaly-banner">
              {{ failedTasks }} 个子任务执行失败
            </div>

            <div class="action-row">
              <el-button v-if="!isFinished" type="danger" size="small" @click="handleCancel">取消批次</el-button>
              <el-button v-if="isFinished" type="primary" size="small" @click="goResults">查看结果</el-button>
              <el-button size="small" :type="hasAnomalies ? 'warning' : 'info'" plain @click="handleSolution">解决方案</el-button>
              <el-button type="danger" size="small" plain @click="handleDelete">删除批次</el-button>
            </div>
          </div>

          <el-table :data="items" size="small" max-height="320" stripe style="margin-top:12px">
            <el-table-column prop="itemLabel" label="对象" min-width="140" show-overflow-tooltip />
            <el-table-column prop="itemType" label="类型" width="60">
              <template #default="{ row }">
                {{ row.itemType === 'node' ? '母线' : '线路' }}
              </template>
            </el-table-column>
            <el-table-column label="进度" width="140">
              <template #default="{ row }">
                <el-progress :percentage="row.progressPct || 0" :status="row.status === 'failed' ? 'exception' : row.status === 'completed' ? 'success' : ''" :stroke-width="6" />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="70">
              <template #default="{ row }">
                <el-tag :type="row.status === 'completed' ? 'success' : row.status === 'running' ? 'warning' : row.status === 'failed' ? 'danger' : 'info'" size="small">
                  {{ row.status === 'completed' ? '完成' : row.status === 'running' ? '计算' : row.status === 'failed' ? '失败' : '排队' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="progressMessage" label="状态" min-width="160" show-overflow-tooltip />
          </el-table>
        </template>

        <el-empty v-else description="选择批次查看详情" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.batch-monitor { padding: 0; }
.monitor-grid { display: grid; grid-template-columns: 300px 1fr; gap: 16px; }
.monitor-left, .monitor-right { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
.progress-area { background: #f5f7fa; padding: 12px; border-radius: 4px; }
.progress-stats { display: flex; justify-content: space-between; font-size: 12px; color: #606266; margin-bottom: 8px; }
.anomaly-banner { margin-top: 8px; padding: 8px 12px; background: #fef0f0; border: 1px solid #fde2e2; border-radius: 4px; font-size: 12px; color: #e64242; }
.action-row { margin-top: 8px; display: flex; gap: 8px; }
</style>
