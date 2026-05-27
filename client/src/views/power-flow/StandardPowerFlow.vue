<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { submitStandardPF, getTaskResult, fetchGridBranches, fetchGridBuses, reuseHistoryParams } from '@/api/power-flow'
import { ElMessage } from 'element-plus'
import CalcProgress from '@/components/calculation/CalcProgress.vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import PowerFlowTopology from '@/components/power-flow/PowerFlowTopology.vue'
import FeederSelector from '@/components/calculation/FeederSelector.vue'
import { useRoute } from 'vue-router'
import { useFeederSelection } from '@/composables/useFeederSelection'

const route = useRoute()

const taskId = ref<string | null>(null)
const loading = ref(false)
const result: any = ref(null)
const viewMode = ref<'topology' | 'tables'>('topology')
const allBranches = ref<any[]>([])
const allBuses = ref<any[]>([])
const scenario = ref<'normal' | 'fault' | 'solar'>('normal')
const faultBranchId = ref('')
const weatherScenario = ref<'actual' | 'sunny' | 'cloudy' | 'rainy'>('actual')

const feeder = useFeederSelection()

// 客户端 BFS，与后端 trimTopology 算法一致
function getReachableBusIds(startBusIds: string[], branches: any[], buses: any[]): Set<string> {
  const busMap = new Map<string, any>()
  for (const bus of buses) {
    busMap.set(bus.id, bus)
  }

  const byToBus = new Map<string, any[]>()
  const byFromBus = new Map<string, any[]>()
  for (const b of branches) {
    if (!byToBus.has(b.to_bus_id)) byToBus.set(b.to_bus_id, [])
    byToBus.get(b.to_bus_id)!.push(b)
    if (!byFromBus.has(b.from_bus_id)) byFromBus.set(b.from_bus_id, [])
    byFromBus.get(b.from_bus_id)!.push(b)
  }

  const reachable = new Set<string>()

  // 阶段1：只沿变压器向上追溯（10kV→110kV→220kV→500kV），遇跨区节点停止
  const startZones = new Set(startBusIds.map(id => busMap.get(id)?.zone).filter(Boolean))
  const frontier = [...startBusIds]
  while (frontier.length > 0) {
    const busId = frontier.pop()!
    if (reachable.has(busId)) continue
    if (!busMap.has(busId)) continue
    reachable.add(busId)
    for (const br of (byToBus.get(busId) || [])) {
      if (!reachable.has(br.from_bus_id) && br.branch_type === 'TRANSFORMER') {
        const targetZone = busMap.get(br.from_bus_id)?.zone
        if (targetZone && startZones.has(targetZone)) {
          frontier.push(br.from_bus_id)
        }
      }
    }
  }

  // 阶段2：10kV 起点层级同级互联（仅同区域）
  for (const busId of startBusIds) {
    for (const br of (byToBus.get(busId) || [])) {
      if (br.branch_type !== 'TRANSFORMER' && !reachable.has(br.from_bus_id)) {
        const tz = busMap.get(br.from_bus_id)?.zone
        if (tz && startZones.has(tz)) reachable.add(br.from_bus_id)
      }
    }
    for (const br of (byFromBus.get(busId) || [])) {
      if (br.branch_type !== 'TRANSFORMER' && !reachable.has(br.to_bus_id)) {
        const tz = busMap.get(br.to_bus_id)?.zone
        if (tz && startZones.has(tz)) reachable.add(br.to_bus_id)
      }
    }
  }

  // 阶段3：从起点向下游1跳（仅同区域）
  for (const busId of startBusIds) {
    for (const br of (byFromBus.get(busId) || [])) {
      if (!reachable.has(br.to_bus_id)) {
        const tz = busMap.get(br.to_bus_id)?.zone
        if (tz && startZones.has(tz)) reachable.add(br.to_bus_id)
      }
    }
  }

  return reachable
}

// 根据选中馈线过滤的故障支路选项
const faultBranchOptions = computed(() => {
  if (feeder.selectedFeederIds.value.length === 0) return allBranches.value
  // 从选中馈线获取 10kV 母线 ID
  const startBusIds: string[] = []
  for (const fid of feeder.selectedFeederIds.value) {
    const f = feeder.feeders.value.find((x: any) => x.id === fid)
    if (f?.busIds) startBusIds.push(...f.busIds)
  }
  if (startBusIds.length === 0) return allBranches.value

  const reachable = getReachableBusIds(startBusIds, allBranches.value, allBuses.value)
  const filtered = allBranches.value.filter(b => reachable.has(b.from_bus_id) && reachable.has(b.to_bus_id))

  // 如果当前选中的故障支路不在过滤后列表中，清空
  if (faultBranchId.value && !filtered.find((b: any) => b.id === faultBranchId.value)) {
    faultBranchId.value = ''
  }

  return filtered
})

onMounted(async () => {
  allBranches.value = (await fetchGridBranches()) || []
  allBuses.value = (await fetchGridBuses()) || []
  feeder.loadFeeders()
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
        if (p.scenario.weatherScenario) weatherScenario.value = p.scenario.weatherScenario
      }
      if (p.feederIds?.length) feeder.selectedFeederIds.value = p.feederIds
    } catch (_) {}
  }
})

// 馈线选择变化时清空旧计算结果，避免拓扑图与断开支路下拉不一致
watch(() => feeder.selectedFeederIds.value, () => {
  result.value = null
})

async function startCalculation() {
  if (scenario.value === 'solar' && feeder.selectedFeederIds.value.length === 0) {
    ElMessage.warning('光伏接入场景请先选择馈线')
    return
  }
  loading.value = true
  result.value = null
  try {
    const useFeeder = feeder.selectedFeederIds.value.length > 0
    const params: any = { scenario: { type: scenario.value } }
    if (scenario.value === 'fault') params.scenario.faultBranchId = faultBranchId.value
    if (scenario.value === 'solar') {
      params.scenario.pvBusIds = feeder.feederPVBusIds.value
      params.scenario.weatherScenario = weatherScenario.value
    }
    if (useFeeder) {
      params.feederIds = feeder.selectedFeederIds.value
      params.pvBusIds = feeder.feederPVBusIds.value
    }
    console.log('[StandardPowerFlow] submitting params:', JSON.stringify(params))
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


// 拓扑区域筛选
const zoneFilter = ref('')
const zoneOptions = computed(() => {
  if (!result.value?.nodes) return []
  const zones = [...new Set(result.value.nodes.map((n: any) => n.zone).filter(Boolean))] as string[]
  return zones.sort()
})
const filteredTopoNodes = computed(() => {
  if (!result.value?.nodes) return []
  if (!zoneFilter.value) return result.value.nodes
  return result.value.nodes.filter((n: any) => n.zone === zoneFilter.value)
})
const filteredTopoBranches = computed(() => {
  if (!result.value?.branchRes) return []
  if (!zoneFilter.value) return result.value.branchRes
  const nodeIds = new Set(filteredTopoNodes.value.map((n: any) => n.busId))
  return result.value.branchRes.filter((b: any) => nodeIds.has(b.fromBus) && nodeIds.has(b.toBus))
})

// 节点表格行样式：弱节点高亮
function nodeRowStyle({ row }: any) {
  if (row.isWeakNode) return { backgroundColor: '#fff5f5' }
  if (row.stabilityMargin < 0.9) return { backgroundColor: '#fffbe6' }
  return {}
}

// 支路表格行样式：反向潮流高亮
function branchRowStyle({ row }: any) {
  if (row.pFromMw < 0) return { backgroundColor: '#fff5f5' }
  if (row.isOverloaded) return { backgroundColor: '#fff5f5' }
  if (row.loadingPct > 80) return { backgroundColor: '#fffbe6' }
  return {}
}

</script>

<template>
  <div class="online-page">
    <div class="filter-bar">
      <FeederSelector
        v-if="feeder.feeders.value.length > 0"
        :feeder-zone-options="feeder.feederZoneOptions.value"
        :feeder-options="feeder.feederOptions.value"
        :selected-feeder-ids="feeder.selectedFeederIds.value"
        :feeder-zone-filter="feeder.feederZoneFilter.value"
        @update:selected-feeder-ids="feeder.selectedFeederIds.value = $event"
        @update:feeder-zone-filter="feeder.feederZoneFilter.value = $event"
        @select-all="feeder.selectAllFeeders()"
        @deselect-all="feeder.deselectAllFeeders()"
      />
      <div class="filter-group">
        <span class="filter-label">场景类型：</span>
        <el-radio-group v-model="scenario">
          <el-radio value="normal">正常运行</el-radio>
          <el-radio value="fault">N-1故障</el-radio>
          <el-radio value="solar">光伏接入</el-radio>
        </el-radio-group>
      </div>
      <div v-if="scenario === 'fault'" class="filter-group">
        <span class="filter-label">断开支路：</span>
        <el-select v-model="faultBranchId" placeholder="选择断开支路" size="small" style="width:200px">
          <el-option v-for="b in faultBranchOptions" :key="b.id" :label="`${b.from_bus_id} → ${b.to_bus_id}`" :value="b.id" />
        </el-select>
      </div>
      <div v-if="scenario === 'solar' && feeder.selectedFeederIds.value.length > 0" class="filter-group">
        <span class="filter-label">天气场景：</span>
        <el-select v-model="weatherScenario" size="small" style="width:160px">
          <el-option value="actual" label="实际测量值" />
          <el-option value="sunny" label="典型晴天" />
          <el-option value="cloudy" label="多云天气" />
          <el-option value="rainy" label="阴雨天气" />
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
      <!-- 视图切换 -->
      <div class="view-toggle">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="topology">
            <el-icon><Monitor /></el-icon>
            拓扑图
          </el-radio-button>
          <el-radio-button value="tables">
            <el-icon><List /></el-icon>
            数据表
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 拓扑图视图 -->
      <div v-if="viewMode === 'topology'" class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><Connection /></el-icon>
          <span>电网拓扑潮流图</span>
          <el-select v-model="zoneFilter" size="small" style="width:140px;margin-left:12px" clearable placeholder="全部区域">
            <el-option v-for="z in zoneOptions" :key="z" :label="z" :value="z" />
          </el-select>
        </div>
        <PowerFlowTopology
          :nodes="filteredTopoNodes"
          :branches="filteredTopoBranches"
        />
      </div>

      <!-- 数据表视图 -->
      <template v-if="viewMode === 'tables'">
      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><TrendCharts /></el-icon>
          <span>节点电压分布（标幺值）</span>
        </div>
        <ChartContainer
          :option="{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const p = params[0];
                const row = result.nodes[p.dataIndex];
                return `${row.name}（${row.voltageLevel}）<br/>标幺电压: ${p.value} p.u.<br/>实际电压: ${(row.voltagePu * row.baseKv).toFixed(2)} kV<br/>相角: ${row.angleDeg}°<br/>类型: ${row.busType}`;
              }
            },
            xAxis: { type: 'category', data: result.nodes.map((n: any) => n.name || n.busId), axisLabel: { rotate: 45, fontSize: 11 } },
            yAxis: { type: 'value', name: '电压(p.u.)', min: 0.9, max: 1.1 },
            series: [{
              type: 'bar', data: result.nodes.map((n: any) => ({
                value: Number(n.voltagePu.toFixed(4)),
                itemStyle: { color: Math.abs(n.voltagePu - 1) > 0.05 ? '#F56C6C' : Math.abs(n.voltagePu - 1) > 0.03 ? '#E6A23C' : '#67C23A' },
              })),
              barWidth: '40%',
            }],
            grid: { left: 50, right: 20, bottom: 80, top: 20 },
          }"
          style="height: 300px"
        />
      </div>

      <!-- 节点潮流结果表：实际电压 + 有功/无功 -->
      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><List /></el-icon>
          <span>节点潮流结果 — 电压幅值/相角、有功/无功功率</span>
        </div>
        <el-table :data="result.nodes" stripe size="small" max-height="500" style="width: 100%" :row-style="nodeRowStyle">
          <el-table-column label="节点名称" min-width="110">
            <template #default="{ row }">{{ row.name }}</template>
          </el-table-column>
          <el-table-column label="电压等级" width="80">
            <template #default="{ row }">{{ row.voltageLevel }}</template>
          </el-table-column>
          <el-table-column label="类型" width="60">
            <template #default="{ row }">{{ row.busType }}</template>
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
          <el-table-column label="稳定裕度" width="85">
            <template #default="{ row }">
              <span :style="{ color: row.stabilityMargin < 0.9 ? '#F56C6C' : '#67C23A', fontWeight: row.isWeakNode ? 'bold' : 'normal' }">
                {{ (row.stabilityMargin * 100).toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column label="薄弱节点" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.isWeakNode" type="danger" size="small">是</el-tag>
              <span v-else class="null-value">—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 支路潮流结果表：有功/无功 + 潮流方向 + 网损 -->
      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><Connection /></el-icon>
          <span>支路潮流结果 — 有功/无功功率、潮流方向、网损</span>
        </div>
        <el-table :data="result.branchRes" stripe size="small" max-height="500" style="width: 100%" :row-style="branchRowStyle">
          <el-table-column label="支路" min-width="130">
            <template #default="{ row }">{{ row.fromBusName }}→{{ row.toBusName }}</template>
          </el-table-column>
          <el-table-column label="类型" width="70">
            <template #default="{ row }">{{ row.branchType }}</template>
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
          <el-table-column label="线损(MW)" width="80">
            <template #default="{ row }">
              <span style="color:#E6A23C;font-weight:600">{{ Number(row.lossMw).toFixed(3) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="线损率(%)" width="85">
            <template #default="{ row }">
              <span :style="{ color: row.lossPercent > 3 ? '#F56C6C' : '#909399' }">{{ Number(row.lossPercent).toFixed(2) }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="负载率(%)" width="85">
            <template #default="{ row }">
              <el-tag :type="row.isOverloaded ? 'danger' : row.loadingPct > 80 ? 'warning' : 'success'" size="small">
                {{ Number(row.loadingPct).toFixed(1) }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="过载" width="60">
            <template #default="{ row }">
              <el-tag v-if="row.isOverloaded" type="danger" size="small">是</el-tag>
              <span v-else class="null-value">—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template> <!-- end tables -->
    </template> <!-- end result -->
  </div>
</template>

<script lang="ts">
import { TrendCharts, List, Connection, Monitor } from '@element-plus/icons-vue'
export default { components: { TrendCharts, List, Connection, Monitor } }
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
