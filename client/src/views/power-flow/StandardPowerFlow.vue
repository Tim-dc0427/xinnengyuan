<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { submitStandardPF, getTaskResult, fetchGridBranches, fetchSolarPVStations, fetchZones, reuseHistoryParams } from '@/api/power-flow'
import { ElMessage } from 'element-plus'
import CalcProgress from '@/components/calculation/CalcProgress.vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const taskId = ref<string | null>(null)
const loading = ref(false)
const result: any = ref(null)
const scenario = ref<'normal' | 'fault' | 'solar'>('normal')
const faultBranchId = ref('')

// 光伏电站列表
const solarStations = ref<any[]>([])
const selectedSolarBusIds = ref<string[]>([])

// 区域筛选
const zones = ref<string[]>([])
const selectedZone = ref('')

// N-1 开断选项：仅 110kV 及以上线路/变压器
const allBranches = ref<any[]>([])
const faultBranchOptions = computed(() => {
  return allBranches.value.filter((b: any) =>
    (b.voltage_level === '110kV' || b.voltage_level === '220kV')
  )
})

const busTypeMap: Record<string, string> = {
  PQ: 'PQ节点',
  PV: 'PV节点',
  Slack: '平衡节点',
}

onMounted(async () => {
  const [branches, stations] = await Promise.all([
    fetchGridBranches(),
    fetchSolarPVStations(),
  ])
  allBranches.value = branches || []
  solarStations.value = (stations || []).map((s: any) => ({
    ...s,
    busId: s.bus_id,
  }))
  zones.value = await fetchZones()

  const tid = route.query.taskId as string
  if (tid) {
    taskId.value = tid
    await onCompleted()
  }
  const reuseId = route.query.reuseTaskId as string
  if (reuseId) {
    try {
      const { parameters: p } = await reuseHistoryParams(reuseId)
      if (p.scenario) {
        scenario.value = p.scenario.type || 'normal'
        if (p.scenario.faultBranchId) faultBranchId.value = p.scenario.faultBranchId
      }
      if (p.solarBusIds?.length) selectedSolarBusIds.value = p.solarBusIds
    } catch (_) {}
  }
})

// 场景切换时清空旧结果
function onScenarioChange() {
  result.value = null
  if (scenario.value !== 'fault') faultBranchId.value = ''
}

async function startCalculation() {
  if (scenario.value === 'solar' && selectedSolarBusIds.value.length === 0) {
    ElMessage.warning('请选择光伏电站')
    return
  }
  if (scenario.value === 'fault' && !faultBranchId.value) {
    ElMessage.warning('请选择开断元件')
    return
  }
  loading.value = true
  result.value = null
  try {
    const params: any = { scenario: { type: scenario.value } }
    if (scenario.value === 'fault') {
      params.scenario.faultBranchId = faultBranchId.value
    }
    if (scenario.value === 'solar') {
      params.scenario.pvBusIds = selectedSolarBusIds.value
    }
    const res = await submitStandardPF(params)
    taskId.value = res.taskId
  } catch (e: any) {
    ElMessage.error('提交计算失败: ' + (e.message || '未知错误'))
    loading.value = false
  }
}

async function onCompleted() {
  if (!taskId.value) return
  try {
    const res = await getTaskResult(taskId.value)
    if (res) {
      const summary = typeof res.summary === 'string' ? JSON.parse(res.summary) : res.summary
      const nodes = typeof res.node_results === 'string' ? JSON.parse(res.node_results) : (res.node_results || [])
      const branchRes = typeof res.branch_results === 'string' ? JSON.parse(res.branch_results) : (res.branch_results || [])
      result.value = { summary, nodes, branchRes }
    }
  } catch (e: any) {
    ElMessage.error('获取结果失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function onFailed(err: string) {
  ElMessage.error('计算失败: ' + err)
  loading.value = false
}

// 线路/变压器表格行样式：反向潮流高亮
function branchRowStyle({ row }: any) {
  if (row.pFromMw < 0) return { backgroundColor: '#fff5f5' }
  if (row.isOverloaded) return { backgroundColor: '#fff5f5' }
  if (row.loadingPct > 80) return { backgroundColor: '#fffbe6' }
  return {}
}

// 按区域过滤结果
const filteredNodes = computed(() => {
  if (!result.value || !selectedZone.value) return result.value.nodes
  return result.value.nodes.filter((n: any) => n.zone === selectedZone.value)
})

const filteredBranches = computed(() => {
  if (!result.value || !selectedZone.value) return result.value.branchRes
  const zoneBusIds = new Set(
    result.value.nodes
      .filter((n: any) => n.zone === selectedZone.value)
      .map((n: any) => n.busId)
  )
  return result.value.branchRes.filter(
    (b: any) => zoneBusIds.has(b.fromBus) || zoneBusIds.has(b.toBus)
  )
})
</script>

<template>
  <div class="online-page">
    <div class="chart-panel-title">潮流计算支持</div>
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">场景类型：</span>
        <el-radio-group v-model="scenario" @change="onScenarioChange">
          <el-radio value="normal">正常运行</el-radio>
          <el-radio value="fault">N-1故障</el-radio>
          <el-radio value="solar">光伏接入</el-radio>
        </el-radio-group>
      </div>
      <div v-if="scenario === 'fault'" class="filter-group">
        <span class="filter-label">N-1开断：</span>
        <el-select v-model="faultBranchId" placeholder="选择开断元件" size="small" style="width:280px">
          <el-option v-for="b in faultBranchOptions" :key="b.id" :label="b.remark || `${b.from_bus_id} → ${b.to_bus_id}`" :value="b.id" />
        </el-select>
      </div>
      <div v-if="scenario === 'solar'" class="filter-group">
        <span class="filter-label">光伏电站：</span>
        <el-select v-model="selectedSolarBusIds" multiple collapse-tags collapse-tags-tooltip placeholder="选择电站" size="small" style="width:340px">
          <el-option v-for="s in solarStations" :key="s.busId" :label="`${s.station_name}（${s.installed_capacity_mw}MW / ${s.grid_connection_voltage_kv || '-'}kV）`" :value="s.busId" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">区域：</span>
        <el-select v-model="selectedZone" placeholder="全部区域" clearable size="small" style="width:160px">
          <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
        </el-select>
      </div>
      <el-button type="primary" :loading="loading" @click="startCalculation">
        {{ result ? '重新计算' : '开始计算' }}
      </el-button>
    </div>

    <CalcProgress
      :task-id="taskId"
      :show-pause-resume="false"
      @completed="onCompleted"
      @failed="onFailed"
    />

    <template v-if="result">

      <!-- 节点潮流结果表：实际电压 + 有功/无功 -->
      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><List /></el-icon>
          <span>节点潮流结果 — 电压幅值/相角、有功/无功功率</span>
        </div>
        <el-table :data="filteredNodes" stripe size="small" max-height="500" style="width: 100%">
          <el-table-column label="节点名称" min-width="110">
            <template #default="{ row }">{{ row.name }}</template>
          </el-table-column>
          <el-table-column label="电压等级" width="80">
            <template #default="{ row }">{{ row.voltageLevel }}</template>
          </el-table-column>
          <el-table-column label="节点类型" width="80">
            <template #default="{ row }">{{ busTypeMap[row.busType] || row.busType }}</template>
          </el-table-column>
          <el-table-column label="实际电压(kV)" width="110">
            <template #default="{ row }">
              <el-tag :type="Math.abs(row.voltagePu - 1) > 0.05 ? 'danger' : Math.abs(row.voltagePu - 1) > 0.03 ? 'warning' : 'success'" size="small">
                {{ (row.voltagePu * row.baseKv).toFixed(2) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="标幺(p.u.)" width="90">
            <template #default="{ row }">{{ Number(row.voltagePu).toFixed(4) }}</template>
          </el-table-column>
          <el-table-column label="相角(°)" width="80">
            <template #default="{ row }">{{ Number(row.angleDeg).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="有功发电(MW)" width="110">
            <template #default="{ row }">
              <span v-if="row.pgMw > 0" style="color:#67C23A;font-weight:600">{{ Number(row.pgMw).toFixed(2) }}</span>
              <span v-else class="null-value">—</span>
            </template>
          </el-table-column>
          <el-table-column label="无功发电(Mvar)" width="115">
            <template #default="{ row }">
              <span v-if="row.qgMvar !== 0" style="color:#67C23A">{{ Number(row.qgMvar).toFixed(2) }}</span>
              <span v-else class="null-value">—</span>
            </template>
          </el-table-column>
          <el-table-column label="有功负荷(MW)" width="110">
            <template #default="{ row }">
              <span v-if="row.pdMw > 0" style="color:#F56C6C">{{ Number(row.pdMw).toFixed(2) }}</span>
              <span v-else class="null-value">—</span>
            </template>
          </el-table-column>
          <el-table-column label="无功负荷(Mvar)" width="115">
            <template #default="{ row }">
              <span v-if="row.qdMvar > 0" style="color:#F56C6C">{{ Number(row.qdMvar).toFixed(2) }}</span>
              <span v-else class="null-value">—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 线路/变压器潮流 -->
      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><Connection /></el-icon>
          <span>线路/变压器潮流 — 有功/无功功率、潮流方向、网损</span>
        </div>
        <el-table :data="filteredBranches" stripe size="small" max-height="500" style="width: 100%" :row-style="branchRowStyle">
          <el-table-column label="线路/变压器名称" min-width="130">
            <template #default="{ row }">{{ row.remark || `${row.fromBusName}→${row.toBusName}` }}</template>
          </el-table-column>
          <el-table-column label="类型" width="70">
            <template #default="{ row }">{{ row.branchType === 'LINE' ? '线路' : row.branchType === 'TRANSFORMER' ? '变压器' : row.branchType }}</template>
          </el-table-column>
          <el-table-column label="电压等级" width="80">
            <template #default="{ row }">{{ row.voltageLevel }}</template>
          </el-table-column>
          <el-table-column label="潮流方向" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.pFromMw < 0" type="danger" size="small">反向</el-tag>
              <el-tag v-else type="success" size="small">正向</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="首端有功(MW)" width="105">
            <template #default="{ row }">
              <span :style="{ color: row.pFromMw < 0 ? '#F56C6C' : '#303133', fontWeight: 'bold' }">
                {{ Number(row.pFromMw).toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="首端无功(Mvar)" width="110">
            <template #default="{ row }">{{ Number(row.qFromMvar).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="末端有功(MW)" width="105">
            <template #default="{ row }">{{ Number(row.pToMw).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="末端无功(Mvar)" width="110">
            <template #default="{ row }">{{ Number(row.qToMvar).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="网损(MW)" width="80">
            <template #default="{ row }">
              <span style="color:#E6A23C;font-weight:600">{{ Number(row.lossMw).toFixed(3) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="负载率(%)" width="85">
            <template #default="{ row }">
              <el-tag :type="row.loadingPct > 80 ? 'warning' : 'success'" size="small">
                {{ Number(row.loadingPct).toFixed(1) }}%
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template> <!-- end result -->
  </div>
</template>

<script lang="ts">
import { List, Connection } from '@element-plus/icons-vue'
export default { components: { List, Connection } }
</script>

<style scoped>
.online-page { padding: 0; }
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #606266; white-space: nowrap; }
.chart-panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.null-value { color: #dcdfe6; user-select: none; }
.view-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
:deep(.el-table .warning-row) { background: #fffbe6; }
:deep(.el-table .danger-row) { background: #fff5f5; }
</style>
