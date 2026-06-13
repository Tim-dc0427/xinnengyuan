<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchHistory, compareHistoryVersions, reuseHistoryParams,
  lockHistory, deleteHistory, cleanupExpiredHistory, fetchHistoryRetentionDays,
} from '@/api/power-flow'
import type { HistoryListItem, VersionCompareResult } from '@/api/power-flow'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatDateTime } from '@/utils/time'

const router = useRouter()

const loading = ref(false)
const list = ref<HistoryListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectedIds = ref<string[]>([])

const filters = reactive({
  taskType: '',
  sceneType: '',
  status: '',
  keyword: '',
  dateRange: null as [string, string] | null,
})

const taskTypeOptions = [
  { label: '标准潮流', value: 'STANDARD' },
  { label: '反向潮流', value: 'REVERSE' },
  { label: '概率潮流', value: 'PROBABILISTIC' },
  { label: '三相潮流', value: 'THREE_PHASE' },
]

const sceneTypeOptions = [
  { label: '正常运行', value: 'normal' },
  { label: 'N-1故障', value: 'fault' },
  { label: '光伏接入', value: 'solar' },
]

const statusOptions = [
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '运行中', value: 'running' },
  { label: '排队中', value: 'queued' },
]

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.taskType) params.taskType = filters.taskType
    if (filters.sceneType) params.sceneType = filters.sceneType
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.dateRange) {
      params.dateFrom = filters.dateRange[0]
      params.dateTo = filters.dateRange[1]
    }
    const res = await fetchHistory(params)
    list.value = res.list
    total.value = res.total
  } catch (e: any) {
    ElMessage.error('查询失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadData()
}

function handleReset() {
  filters.taskType = ''
  filters.sceneType = ''
  filters.status = ''
  filters.keyword = ''
  filters.dateRange = null
  page.value = 1
  loadData()
}

function handlePageChange(p: number) {
  page.value = p
  loadData()
}

function handleSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
  loadData()
}

const selectable = (row: HistoryListItem) => row.status === 'completed'

function handleSelectionChange(rows: HistoryListItem[]) {
  if (rows.length > 2) {
    ElMessage.warning('版本对比最多选择 2 条记录')
    return
  }
  selectedIds.value = rows.map(r => r.id)
}

// ==================== 版本对比 ====================
const compareVisible = ref(false)
const compareResult = ref<VersionCompareResult | null>(null)
const compareLoading = ref(false)

async function doCompare() {
  if (selectedIds.value.length !== 2) {
    ElMessage.warning('请选择 2 条已完成记录进行对比')
    return
  }
  compareLoading.value = true
  try {
    compareResult.value = await compareHistoryVersions(selectedIds.value[0], selectedIds.value[1])
    compareVisible.value = true
  } catch (e: any) {
    ElMessage.error('版本对比失败: ' + (e.message || '未知错误'))
  } finally {
    compareLoading.value = false
  }
}

// ==================== 数据复用 ====================
async function doReuse(taskId: string) {
  try {
    const res = await reuseHistoryParams(taskId)
    const routeMap: Record<string, string> = {
      STANDARD: '/power-flow/online/standard',
      REVERSE: '/power-flow/online/reverse',
      PROBABILISTIC: '/power-flow/online/probabilistic',
      THREE_PHASE: '/power-flow/online/three-phase',
    }
    const path = routeMap[res.taskType]
    if (!path) {
      ElMessage.warning('不支持复用该计算类型的参数')
      return
    }
    router.push({ path, query: { reuseTaskId: taskId } })
  } catch (e: any) {
    ElMessage.error('复用失败: ' + (e.message || '未知错误'))
  }
}

// ==================== 锁定/解锁 ====================
async function doToggleLock(row: HistoryListItem) {
  try {
    const res = await lockHistory(row.id)
    row.is_locked = res.isLocked ? 1 : 0
    ElMessage.success(res.isLocked ? '已锁定' : '已解锁')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + (e.message || '未知错误'))
  }
}

// ==================== 删除 ====================
async function doDelete(row: HistoryListItem) {
  try {
    await ElMessageBox.confirm('确定删除该历史记录？删除后不可恢复。', '确认删除', { type: 'warning' })
  } catch { return }
  try {
    await deleteHistory(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch (e: any) {
    ElMessage.error('删除失败: ' + (e.message || '未知错误'))
  }
}

// ==================== 清理过期 ====================
const cleanupVisible = ref(false)
const cleanupDays = ref(30)
const savedRetentionDays = ref(30)

async function openCleanup() {
  try {
    savedRetentionDays.value = await fetchHistoryRetentionDays()
    cleanupDays.value = savedRetentionDays.value
  } catch { savedRetentionDays.value = 30; cleanupDays.value = 30 }
  cleanupVisible.value = true
}

async function doCleanup() {
  try {
    const res = await cleanupExpiredHistory(cleanupDays.value)
    savedRetentionDays.value = res.retentionDays || cleanupDays.value
    ElMessage.success(`已清理 ${res.deletedCount} 条过期记录`)
    cleanupVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error('清理失败: ' + (e.message || '未知错误'))
  }
}

function taskTypeTag(type: string) {
  const m: Record<string, string> = { STANDARD: '', REVERSE: 'warning', PROBABILISTIC: 'success', THREE_PHASE: 'info' }
  return m[type] || ''
}

function sceneTypeTag(scene: string) {
  const m: Record<string, string> = { normal: 'info', fault: 'danger', solar: 'success' }
  return m[scene] || ''
}

function sceneTypeLabel(scene: string) {
  const m: Record<string, string> = { normal: '正常', fault: 'N-1故障', solar: '光伏' }
  return m[scene] || scene || '-'
}

function taskTypeLabel(type: string) {
  const m: Record<string, string> = { STANDARD: '标准潮流', REVERSE: '反向潮流', PROBABILISTIC: '概率潮流', THREE_PHASE: '三相潮流' }
  return m[type] || type
}

function diffColor(v: number | null) {
  if (v == null || Math.abs(v) < 0.001) return '#909399'
  return v > 0 ? '#F56C6C' : '#67C23A'
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="online-page">
    <div class="chart-panel-title">历史记录管理</div>
    <div class="filter-bar">
      <el-select v-model="filters.taskType" placeholder="计算类型" size="small" style="width:130px" clearable @change="handleSearch">
        <el-option v-for="t in taskTypeOptions" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
      <el-select v-model="filters.sceneType" placeholder="场景类型" size="small" style="width:120px" clearable @change="handleSearch">
        <el-option v-for="s in sceneTypeOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" size="small" style="width:110px" clearable @change="handleSearch">
        <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-date-picker v-model="filters.dateRange" type="daterange" size="small" style="width:240px"
        start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD"
        @change="handleSearch" />
      <el-input v-model="filters.keyword" placeholder="搜索任务ID/操作人" size="small" style="width:200px" clearable
        @keyup.enter="handleSearch" @clear="handleSearch" />
      <el-button size="small" type="primary" @click="handleSearch" :loading="loading">查询</el-button>
      <el-button size="small" @click="handleReset">重置</el-button>
    </div>

    <div class="chart-panel">
      <el-table :data="list" stripe size="small" max-height="520" v-loading="loading"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" :selectable="selectable" />
        <el-table-column prop="id" label="任务ID" width="110" show-overflow-tooltip />
        <el-table-column label="计算类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="taskTypeTag(row.task_type)">{{ taskTypeLabel(row.task_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="场景" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="sceneTypeTag(row.scene_type)">{{ sceneTypeLabel(row.scene_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'">
              {{ row.status === 'completed' ? '已完成' : row.status === 'failed' ? '失败' : row.status === 'running' ? '运行中' : '排队中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="90" />
        <el-table-column label="时间" width="160">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
        <el-table-column label="数据来源" width="80">
          <template #default="{ row }">
            <span style="font-size:12px;color:#909399">{{ row.data_source === 'feeder' ? '馈线' : row.data_source === 'batch' ? '批量' : '手动' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="锁定" width="60" align="center">
          <template #default="{ row }">
            <span v-if="row.is_locked" style="color:#F56C6C">🔒</span>
            <span v-else style="color:#909399">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" :disabled="row.status !== 'completed'"
              @click="doReuse(row.id)">回填</el-button>
            <el-button size="small" link @click="doToggleLock(row)">
              {{ row.is_locked ? '解锁' : '锁定' }}
            </el-button>
            <el-button size="small" link type="danger" @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;gap:10px">
          <el-button size="small" :disabled="selectedIds.length !== 2" @click="doCompare" :loading="compareLoading">
            版本对比（{{ selectedIds.length }}/2）
          </el-button>
          <el-button size="small" type="danger" @click="openCleanup">清理过期记录</el-button>
        </div>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          small
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 版本对比弹窗 -->
    <el-dialog v-model="compareVisible" title="版本对比" width="1000px" top="30px">
      <template v-if="compareResult">
        <div style="display:flex;gap:16px;margin-bottom:16px">
          <div style="flex:1;background:#fafafa;padding:12px;border-radius:4px">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px">版本A</div>
            <div style="font-size:12px;color:#909399">任务ID: {{ compareResult.versionA.taskId?.substring(0, 12) }}...</div>
            <div style="font-size:12px;color:#909399">类型: {{ taskTypeLabel(compareResult.versionA.taskType) }}</div>
            <div style="font-size:12px;color:#909399">时间: {{ formatDateTime(compareResult.versionA.createdAt) }}</div>
          </div>
          <div style="flex:1;background:#fafafa;padding:12px;border-radius:4px">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px">版本B</div>
            <div style="font-size:12px;color:#909399">任务ID: {{ compareResult.versionB.taskId?.substring(0, 12) }}...</div>
            <div style="font-size:12px;color:#909399">类型: {{ taskTypeLabel(compareResult.versionB.taskType) }}</div>
            <div style="font-size:12px;color:#909399">时间: {{ formatDateTime(compareResult.versionB.createdAt) }}</div>
          </div>
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:8px">节点电压差异 (A版本 - B版本)</div>
        <el-table :data="compareResult.nodeDiff" stripe size="small" max-height="200" style="margin-bottom:16px">
          <el-table-column prop="name" label="节点" width="100" />
          <el-table-column prop="voltageLevel" label="电压等级" width="80" />
          <el-table-column label="ΔV(pu)" width="90">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.voltagePuDiff), fontWeight: 'bold' }">{{ Number(row.voltagePuDiff).toFixed(4) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Δ角度(°)" width="90">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.angleDegDiff), fontWeight: 'bold' }">{{ Number(row.angleDegDiff).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="裕度Δ(%)" width="90">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.marginDiff), fontWeight: 'bold' }">{{ (row.marginDiff * 100).toFixed(1) }}%</span>
            </template>
          </el-table-column>
          <template v-if="compareResult.isThreePhase">
            <el-table-column label="A相Δ" width="80">
              <template #default="{ row }">
                <span :style="{ color: diffColor(row.phaseADiff), fontWeight: 'bold' }">{{ Number(row.phaseADiff).toFixed(4) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="B相Δ" width="80">
              <template #default="{ row }">
                <span :style="{ color: diffColor(row.phaseBDiff), fontWeight: 'bold' }">{{ Number(row.phaseBDiff).toFixed(4) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="C相Δ" width="80">
              <template #default="{ row }">
                <span :style="{ color: diffColor(row.phaseCDiff), fontWeight: 'bold' }">{{ Number(row.phaseCDiff).toFixed(4) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="VUFΔ" width="80">
              <template #default="{ row }">
                <span :style="{ color: diffColor(row.vufDiff), fontWeight: 'bold' }">{{ Number(row.vufDiff).toFixed(3) }}</span>
              </template>
            </el-table-column>
          </template>
          <el-table-column prop="note" label="备注" width="110" />
        </el-table>

        <div style="font-size:14px;font-weight:600;margin-bottom:8px">支路功率差异 (A版本 - B版本)</div>
        <el-table :data="compareResult.branchDiff" stripe size="small" max-height="200">
          <el-table-column label="支路" width="160">
            <template #default="{ row }">{{ row.fromBusName }} → {{ row.toBusName }}</template>
          </el-table-column>
          <el-table-column prop="voltageLevel" label="电压等级" width="80" />
          <el-table-column label="ΔP(MW)" width="90">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.pFromMwDiff), fontWeight: 'bold' }">{{ Number(row.pFromMwDiff).toFixed(3) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ΔQ(Mvar)" width="90">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.qFromMvarDiff), fontWeight: 'bold' }">{{ Number(row.qFromMvarDiff).toFixed(3) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Δ负载率(%)" width="100">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.loadingPctDiff), fontWeight: 'bold' }">{{ Number(row.loadingPctDiff).toFixed(1) }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="Δ损耗(MW)" width="90">
            <template #default="{ row }">
              <span :style="{ color: diffColor(row.lossMwDiff), fontWeight: 'bold' }">{{ Number(row.lossMwDiff).toFixed(3) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="note" label="备注" width="110" />
        </el-table>
      </template>
    </el-dialog>

    <!-- 清理过期弹窗 -->
    <el-dialog v-model="cleanupVisible" title="清理过期记录" width="420px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:13px;color:#606266">删除</span>
        <el-input-number v-model="cleanupDays" :min="1" :max="365" size="small" style="width:100px" />
        <span style="font-size:13px;color:#606266">天前的未锁定历史记录</span>
      </div>
      <div style="font-size:12px;color:#909399;line-height:1.6">
        系统每天凌晨自动清理超过 {{ savedRetentionDays }} 天的未锁定记录，已锁定的记录不受影响。修改天数并执行清理后将同步更新自动清理阈值。
      </div>
      <template #footer>
        <el-button size="small" @click="cleanupVisible = false">取消</el-button>
        <el-button size="small" type="danger" @click="doCleanup">确认清理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.online-page { padding: 0; }
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  background: #fff;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.chart-panel {
  background: #fff;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
</style>
