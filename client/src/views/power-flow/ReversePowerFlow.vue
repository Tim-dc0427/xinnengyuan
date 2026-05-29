<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { submitReversePF, getTaskResult, fetchGridLoads, fetchGridBuses, fetchGridBranches, reuseHistoryParams } from '@/api/power-flow'
import { ElMessage } from 'element-plus'
import CalcProgress from '@/components/calculation/CalcProgress.vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import PowerFlowTopology from '@/components/power-flow/PowerFlowTopology.vue'
import { useFeederSelection } from '@/composables/useFeederSelection'

const route = useRoute()

const taskId = ref<string | null>(null)
const loading = ref(false)
const result: any = ref(null)
const viewMode = ref<'tables' | 'topology' | 'charts'>('tables')

// ==================== 输入：馈线选择 ====================
const feeder = useFeederSelection()
const calcMode = ref<'single_project' | 'all_pv'>('all_pv')
const selectedPVStationId = ref<string | null>(null)

// 出力曲线（标幺值 0~1，12小时光伏出力特征）
const pvOutputPu = [0, 0.04, 0.12, 0.29, 0.5, 0.75, 1.0, 0.92, 0.71, 0.46, 0.21, 0.07, 0]

const imported = ref(false)
function onImportClick() { imported.value = true }

// 根据选中馈线自动确定的光伏电站列表
const resolvedPVStations = computed(() => {
  if (feeder.selectedFeederIds.value.length === 0) return []
  const stations: any[] = []
  for (const fid of feeder.selectedFeederIds.value) {
    const fdr = feeder.feeders.value.find((f: any) => f.id === fid)
    if (fdr?.pvStations) stations.push(...fdr.pvStations)
  }
  if (calcMode.value === 'single_project' && selectedPVStationId.value) {
    return stations.filter((s: any) => s.id === selectedPVStationId.value)
  }
  return stations
})

// 全部可选光伏项目（当前选中馈线下）
const allFeedersPVOptions = computed(() => {
  const stations: any[] = []
  for (const fid of feeder.selectedFeederIds.value) {
    const fdr = feeder.feeders.value.find((f: any) => f.id === fid)
    if (fdr?.pvStations) stations.push(...fdr.pvStations)
  }
  return stations.map((s: any) => ({
    value: s.id,
    label: `${s.station_name} — ${s.bus_id} (${s.installed_capacity_mw}MW)`,
  }))
})

// ==================== 输入：负荷分布 ====================
const allLoads = ref<any[]>([])
const loadMap = ref<Record<string, { pdMw: number; qdMvar: number; busName: string }>>({})

const feederBusIds = computed(() => {
  const ids: string[] = []
  for (const fid of feeder.selectedFeederIds.value) {
    const fdr = feeder.feeders.value.find((f: any) => f.id === fid)
    if (fdr?.busIds) ids.push(...fdr.busIds)
  }
  return [...new Set(ids)]
})

const selectedLoads = computed(() => {
  return feederBusIds.value
    .filter(bid => loadMap.value[bid])
    .map(bid => ({ busId: bid, ...loadMap.value[bid] }))
})

// ==================== 输入：设备参数 ====================
const allBranches = ref<any[]>([])

const selectedEquipmentInfo = computed(() => {
  if (feeder.selectedFeederIds.value.length === 0) return null
  const busIds = new Set(feederBusIds.value)
  const totalCapacity = resolvedPVStations.value.reduce((sum: number, s: any) => sum + (s.installed_capacity_mw || 0), 0)
  const relatedBranches = allBranches.value.filter(
    (b: any) => busIds.has(b.from_bus_id) || busIds.has(b.to_bus_id)
  )
  const voltageLevels = [...new Set(
    relatedBranches.map((b: any) => b.voltage_level).filter(Boolean)
  )]
  return {
    stationCount: resolvedPVStations.value.length,
    totalCapacity,
    busCount: busIds.size,
    branchCount: relatedBranches.length,
    voltageLevels: voltageLevels.join(' / '),
  }
})

async function loadData() {
  await Promise.all([
    (async () => {
      const [loads, buses, branches] = await Promise.all([
        fetchGridLoads(),
        fetchGridBuses(),
        fetchGridBranches(),
      ])
      const map: Record<string, { pdMw: number; qdMvar: number; busName: string }> = {}
      for (const l of (loads || [])) {
        const bus = (buses || []).find((b: any) => b.id === l.bus_id)
        map[l.bus_id] = { pdMw: l.pd_mw || 0, qdMvar: l.qd_mvar || 0, busName: bus?.name || l.bus_id }
      }
      loadMap.value = map
      allBranches.value = branches || []
    })(),
    feeder.loadFeeders(),
  ])
}

onMounted(async () => {
  await loadData()
  const tid = route.query.taskId as string
  if (tid) {
    taskId.value = tid
    await onCompleted()
  }
  const reuseId = route.query.reuseTaskId as string
  if (reuseId) {
    try {
      const { parameters: p } = await reuseHistoryParams(reuseId)
      if (p.feederIds?.length) feeder.selectedFeederIds.value = p.feederIds
      if (p.mode) calcMode.value = p.mode
      if (p.solarStationIds?.length) selectedPVStationId.value = p.solarStationIds[0]
    } catch (_) {}
  }
})

watch(() => feeder.selectedFeederIds.value, () => {
  selectedPVStationId.value = null
})

// ==================== 提交计算 ====================
async function startCalculation() {
  if (feeder.selectedFeederIds.value.length === 0) {
    ElMessage.warning('请选择馈线')
    return
  }
  if (calcMode.value === 'single_project' && !selectedPVStationId.value) {
    ElMessage.warning('单项目模式下请选择光伏项目')
    return
  }
  loading.value = true
  result.value = null
  try {
    const params: any = {
      feederIds: feeder.selectedFeederIds.value,
      mode: calcMode.value,
      pvOutputPu: pvOutputPu,
    }
    if (calcMode.value === 'single_project' && selectedPVStationId.value) {
      params.solarStationIds = [selectedPVStationId.value]
    }
    const res = await submitReversePF(params)
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
      const summary = typeof res.summary === 'string' ? JSON.parse(res.summary) : (res.summary || {})
      const nodes = typeof res.node_results === 'string' ? JSON.parse(res.node_results) : (res.node_results || [])
      const branchRes = typeof res.branch_results === 'string' ? JSON.parse(res.branch_results) : (res.branch_results || [])
      result.value = {
        summary,
        nodes,
        branchRes,
        timePoints: summary.timePoints || [],
        maxReversePowerMw: summary.maxReversePowerMw || 0,
        maxReverseTime: summary.maxReverseTime || '',
      }
      selectedTimeIndex.value = -1
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

// ==================== 输出 ====================
const zoneFilter = ref('')
const zoneOptions = computed(() => {
  const zones = [...new Set(currentNodeResults.value.map((n: any) => n.zone).filter(Boolean))] as string[]
  return zones.sort()
})

const filteredNodes = computed(() => {
  if (!zoneFilter.value) return currentNodeResults.value
  return currentNodeResults.value.filter((n: any) => n.zone === zoneFilter.value)
})

const filteredBranches = computed(() => {
  const nodeIds = new Set(filteredNodes.value.map((n: any) => n.busId))
  if (!zoneFilter.value) return currentBranchResults.value
  return currentBranchResults.value.filter(
    (b: any) => nodeIds.has(b.fromBus) && nodeIds.has(b.toBus)
  )
})

const hasPV = computed(() => (result.value?.timePoints || []).length > 1)
const selectedTimeIndex = ref(-1)
const timeOptions = computed(() => {
  const tps = result.value?.timePoints || []
  return tps.map((tp: any, i: number) => ({
    value: i,
    label: tp.time,
  }))
})

function onTimeSelect(val: any) {
  selectedTimeIndex.value = Number(val)
}

const currentTimePoint = ref<any>(null)
const currentNodeResults = ref<any[]>([])
const currentBranchResults = ref<any[]>([])
const tableKey = ref(0)

function syncTimePoint() {
  const tps = result.value?.timePoints
  if (!tps || tps.length === 0) {
    currentTimePoint.value = null
    currentNodeResults.value = []
    currentBranchResults.value = []
    return
  }
  const idx = selectedTimeIndex.value
  let tp: any
  if (idx >= 0 && idx < tps.length) {
    tp = tps[idx]
  } else {
    tp = tps[0]
    selectedTimeIndex.value = 0
  }
  currentTimePoint.value = tp
  currentNodeResults.value = tp?.nodeResults || result.value?.nodes || []
  currentBranchResults.value = tp?.branchResults || result.value?.branchRes || []
  tableKey.value++
}

watch(() => [result.value?.timePoints, selectedTimeIndex.value], () => syncTimePoint(), { immediate: true })
watch(hasPV, (v) => { if (!v && viewMode.value === 'charts') viewMode.value = 'tables' })

const reverseBranches = computed(() => currentBranchResults.value.filter((b: any) => b.pFromMw < 0))

const branchFilter = ref<'all' | 'reverse' | 'forward'>('all')
const filteredBranchResults = computed(() => {
  const all = currentBranchResults.value
  if (branchFilter.value === 'reverse') return all.filter((b: any) => b.pFromMw < 0)
  if (branchFilter.value === 'forward') return all.filter((b: any) => b.pFromMw >= 0)
  return all
})

function calcCurrent(row: any): number {
  const s = Math.hypot(row.pFromMw, row.qFromMvar || 0)
  const kv = parseFloat(row.voltageLevel) || 110
  return (s * 1000) / (Math.sqrt(3) * kv)
}

// ==================== 曲线 ====================
const loadingTrendOption = computed(() => {
  const tps = result.value?.timePoints || []
  const maxLoadings = tps.map((tp: any) => {
    const branches = tp.branchResults || []
    if (branches.length === 0) return 0
    return Math.max(...branches.map((b: any) => b.loadingPct || 0))
  })
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['最大负载率'], top: 0 },
    xAxis: { type: 'category' as const, data: tps.map((tp: any) => tp.time) },
    yAxis: { type: 'value' as const, name: '%', max: 100 },
    series: [{
      name: '最大负载率', type: 'line', data: maxLoadings.map((v: number) => Number(v.toFixed(1))),
      smooth: true, symbol: 'circle',
      lineStyle: { color: '#F56C6C', width: 2 },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(245,108,108,0.3)' }, { offset: 1, color: 'rgba(245,108,108,0.01)' }] },
      },
      markLine: {
        silent: true,
        data: [
          { yAxis: 80, lineStyle: { color: '#E6A23C', type: 'dashed' }, label: { formatter: '重载线 80%' } },
          { yAxis: 100, lineStyle: { color: '#F56C6C', type: 'dashed' }, label: { formatter: '过载线 100%' } },
        ],
      },
    }],
    grid: { left: 55, right: 20, bottom: 30, top: 30 },
  }
})

const lossTrendOption = computed(() => {
  const tps = result.value?.timePoints || []
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['网损'], top: 0 },
    xAxis: { type: 'category' as const, data: tps.map((tp: any) => tp.time) },
    yAxis: { type: 'value' as const, name: 'MW' },
    series: [{
      name: '网损', type: 'line', data: tps.map((tp: any) => tp.lossMw),
      smooth: true, symbol: 'diamond',
      lineStyle: { color: '#E6A23C', width: 2 },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(230,162,60,0.3)' }, { offset: 1, color: 'rgba(230,162,60,0.01)' }] },
      },
    }],
    grid: { left: 55, right: 20, bottom: 30, top: 30 },
  }
})

function nodeRowStyle({ row }: any) {
  if (row.isWeakNode) return { backgroundColor: '#fff5f5' }
  if (row.stabilityMargin < 0.9) return { backgroundColor: '#fffbe6' }
  return {}
}

function branchRowStyle({ row }: any) {
  if (row.pFromMw < 0) return { backgroundColor: '#fff0f0' }
  if (row.isOverloaded) return { backgroundColor: '#fff5f5' }
  if (row.loadingPct > 80) return { backgroundColor: '#fffbe6' }
  return {}
}
</script>

<template>
  <div class="online-page">
    <div class="chart-panel-title">反向潮流计算支持</div>
    <!-- ========== 输入区 ========== -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">区域：</span>
        <el-select
          v-model="feeder.feederZoneFilter.value"
          size="small"
          clearable
          placeholder="全部区域"
          style="width: 110px"
          @change="feeder.deselectAllFeeders()"
        >
          <el-option v-for="z in feeder.feederZoneOptions.value" :key="z" :label="z" :value="z" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">馈线：</span>
        <el-select
          v-model="feeder.selectedFeederIds.value"
          multiple
          collapse-tags
          collapse-tags-tooltip
          size="small"
          style="width: 340px"
          placeholder="选择馈线"
        >
          <el-option v-for="opt in feeder.feederOptions.value" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button size="small" @click="feeder.selectAllFeeders()">全选</el-button>
        <el-button size="small" @click="feeder.deselectAllFeeders()">清空</el-button>
      </div>
      <div class="filter-group">
        <span class="filter-label">模式：</span>
        <el-radio-group v-model="calcMode" size="small">
          <el-radio-button value="all_pv">全部光伏</el-radio-button>
          <el-radio-button value="single_project">单项目</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="calcMode === 'single_project'" class="filter-group">
        <el-select
          v-model="selectedPVStationId"
          placeholder="选择光伏项目"
          size="small"
          style="width: 260px"
          :disabled="feeder.selectedFeederIds.value.length === 0"
        >
          <el-option v-for="opt in allFeedersPVOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </div>
      <el-button type="danger" :loading="loading" @click="startCalculation">
        {{ result ? '重新计算' : '开始反向潮流计算' }}
      </el-button>
    </div>

    <!-- 出力曲线 + 负荷分布 + 设备参数 -->
    <div class="input-row">
      <div class="input-panel">
        <div class="panel-header">光伏出力曲线</div>
        <div class="curve-tags">
          <el-tag v-for="(v, i) in pvOutputPu" :key="i" size="small" :type="v > 0.6 ? 'danger' : v > 0.2 ? 'warning' : 'info'">
            T+{{ i }}h: {{ (v * 100).toFixed(0) }}%
          </el-tag>
        </div>
        <el-button size="small" :type="imported ? 'success' : 'default'" @click="onImportClick" style="margin-top:8px">
          {{ imported ? '已导入' : '导入出力曲线' }}
        </el-button>
      </div>

      <div class="input-panel">
        <div class="panel-header">负荷分布（接入点本地负荷）</div>
        <div v-if="resolvedPVStations.length === 0" style="color:#909399;font-size:13px">选择馈线后自动展示</div>
        <div v-for="item in selectedLoads" :key="item.busId" class="load-row">
          <span class="load-bus">{{ item.busName }} ({{ item.busId }})</span>
          <span class="load-input">P: <b>{{ item.pdMw.toFixed(1) }}</b> MW</span>
          <span class="load-input">Q: <b>{{ item.qdMvar.toFixed(1) }}</b> Mvar</span>
        </div>
      </div>

      <div class="input-panel">
        <div class="panel-header">设备参数</div>
        <div v-if="selectedEquipmentInfo" class="param-grid">
          <span>光伏电站 <b>{{ selectedEquipmentInfo.stationCount }}</b> 座</span>
          <span>总装机 <b>{{ selectedEquipmentInfo.totalCapacity.toFixed(2) }}</b> MW</span>
          <span>接入母线 <b>{{ selectedEquipmentInfo.busCount }}</b> 条</span>
          <span>关联支路 <b>{{ selectedEquipmentInfo.branchCount }}</b> 条</span>
          <span>电压等级 <b>{{ selectedEquipmentInfo.voltageLevels || '—' }}</b></span>
        </div>
        <div v-else style="color:#909399;font-size:13px">选择馈线后展示</div>
      </div>
    </div>

    <CalcProgress :task-id="taskId" :show-pause-resume="false" @completed="onCompleted" @failed="onFailed" />

    <!-- ========== 输出区 ========== -->
    <template v-if="result">
      <div class="view-toggle">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="tables">数据表</el-radio-button>
          <el-radio-button value="topology">拓扑图</el-radio-button>
          <el-radio-button v-if="hasPV" value="charts">趋势曲线</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="hasPV && viewMode !== 'charts'" class="time-selector">
        <span class="filter-label">时间点：</span>
        <el-select :model-value="selectedTimeIndex" @update:model-value="onTimeSelect" size="small" style="width:120px">
          <el-option v-for="opt in timeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </div>

      <div v-if="viewMode === 'topology'" class="chart-panel topo-panel">
        <div class="panel-header">
          <span>电网拓扑 — {{ currentTimePoint?.time }}</span>
          <el-select v-model="zoneFilter" size="small" style="width:140px;margin-left:12px">
            <el-option label="全杭州" value="" />
            <el-option v-for="z in zoneOptions" :key="z" :label="z" :value="z" />
          </el-select>
        </div>
        <PowerFlowTopology :nodes="filteredNodes" :branches="filteredBranches" />
      </div>

      <div v-if="viewMode === 'charts'">
        <div class="chart-panel"><div class="panel-header">负载率变化趋势</div><ChartContainer :option="loadingTrendOption" height="280px" /></div>
        <div class="chart-panel"><div class="panel-header">网损变化趋势</div><ChartContainer :option="lossTrendOption" height="280px" /></div>
      </div>

      <template v-if="viewMode === 'tables'">
        <div class="chart-panel">
          <div class="panel-header">节点电压 — {{ currentTimePoint?.time }}</div>
          <el-table :key="`nodes-${tableKey}`" :data="currentNodeResults" stripe size="small" max-height="450" style="width:100%" :row-style="nodeRowStyle">
            <el-table-column label="节点" min-width="100"><template #default="{ row }">{{ row.name }}</template></el-table-column>
            <el-table-column label="电压等级" width="80"><template #default="{ row }">{{ row.voltageLevel }}</template></el-table-column>
            <el-table-column label="类型" width="55"><template #default="{ row }">{{ row.busType }}</template></el-table-column>
            <el-table-column label="电压幅值(kV)" width="110">
              <template #default="{ row }">
                <el-tag :type="Math.abs(row.voltagePu - 1) > 0.05 ? 'danger' : Math.abs(row.voltagePu - 1) > 0.03 ? 'warning' : 'success'" size="small">
                  {{ (row.voltagePu * row.baseKv).toFixed(2) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="相角(°)" width="75"><template #default="{ row }">{{ Number(row.angleDeg).toFixed(2) }}</template></el-table-column>
            <el-table-column label="发电(MW)" width="90"><template #default="{ row }">{{ row.pgMw > 0 ? Number(row.pgMw).toFixed(2) : '—' }}</template></el-table-column>
            <el-table-column label="负荷(MW)" width="90"><template #default="{ row }">{{ row.pdMw > 0 ? Number(row.pdMw).toFixed(2) : '—' }}</template></el-table-column>
          </el-table>
        </div>

        <div class="chart-panel">
          <div class="panel-header">
            <span>支路结果 — {{ currentTimePoint?.time }}</span>
            <el-radio-group v-model="branchFilter" size="small" style="margin-left:12px">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="reverse">反向 ({{ reverseBranches.length }})</el-radio-button>
              <el-radio-button value="forward">正向</el-radio-button>
            </el-radio-group>
          </div>
          <el-table :key="`branches-${tableKey}`" :data="filteredBranchResults" stripe size="small" max-height="450" style="width:100%" :row-style="branchRowStyle">
            <el-table-column label="支路" min-width="130"><template #default="{ row }">{{ row.fromBusName }}→{{ row.toBusName }}</template></el-table-column>
            <el-table-column label="电压等级" width="80"><template #default="{ row }">{{ row.voltageLevel }}</template></el-table-column>
            <el-table-column label="方向" width="65">
              <template #default="{ row }">
                <el-tag v-if="row.pFromMw < 0" type="danger" size="small">反向</el-tag>
                <el-tag v-else type="success" size="small">正向</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="首端P(MW)" width="100">
              <template #default="{ row }"><span :style="{ color: row.pFromMw < 0 ? '#F56C6C' : '#303133', fontWeight:'bold' }">{{ Number(row.pFromMw).toFixed(2) }}</span></template>
            </el-table-column>
            <el-table-column label="首端Q(Mvar)" width="100"><template #default="{ row }">{{ Number(row.qFromMvar).toFixed(2) }}</template></el-table-column>
            <el-table-column label="反向电流(A)" width="105">
              <template #default="{ row }">
                <span :style="{ color: row.pFromMw < 0 ? '#F56C6C' : '#909399', fontWeight: row.pFromMw < 0 ? 'bold' : 'normal' }">
                  {{ row.pFromMw < 0 ? calcCurrent(row).toFixed(1) : '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="线损(MW)" width="85"><template #default="{ row }"><span style="color:#E6A23C;font-weight:600">{{ Number(row.lossMw).toFixed(3) }}</span></template></el-table-column>
            <el-table-column label="线损率(%)" width="80"><template #default="{ row }">{{ Number(row.lossPercent).toFixed(2) }}%</template></el-table-column>
            <el-table-column label="负载率(%)" width="85">
              <template #default="{ row }">
                <el-tag :type="row.isOverloaded ? 'danger' : row.loadingPct > 80 ? 'warning' : 'success'" size="small">{{ Number(row.loadingPct).toFixed(1) }}%</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="过载" width="55">
              <template #default="{ row }"><el-tag v-if="row.isOverloaded" type="danger" size="small">是</el-tag><span v-else class="null-value">—</span></template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.online-page { padding: 0; }
.filter-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 16px;
  background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #606266; white-space: nowrap; }

.input-row { display: flex; gap: 16px; margin-bottom: 16px; }
.input-panel {
  flex: 1; background: #fff; border-radius: 8px; padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); min-width: 0;
}

.chart-panel {
  background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.panel-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  font-size: 14px; font-weight: 600; color: #303133;
}

.curve-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.load-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
.load-row:last-child { border-bottom: none; }
.load-bus { font-size: 12px; color: #606266; min-width: 140px; }
.load-input { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #909399; }

.param-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; font-size: 13px; color: #606266; }
.param-grid b { color: #303133; }

.null-value { color: #dcdfe6; user-select: none; }
.view-toggle { display: flex; justify-content: center; margin-bottom: 16px; }
.time-selector { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; }
.topo-panel { max-height: 500px; overflow: hidden; }
:deep(.el-table .warning-row) { background: #fffbe6; }
:deep(.el-table .danger-row) { background: #fff5f5; }
</style>
