<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchIndicators, fetchThreePhase } from '@/api/power-flow'
import type { ThreePhaseItem } from '@/api/power-flow'
import { useThresholds } from '@/composables/useThresholds'

const { load: loadThresholds, getStatus, rowClass: thresholdRowClass } = useThresholds()

const loading = ref(false)
const autoRefresh = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const voltageLevel = ref('')
const region = ref('')
const physicalRoleFilter = ref('')

const indicators = ref<any>(null)
const threePhaseList = ref<ThreePhaseItem[]>([])
const filterText = ref('')

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ref<string[]>([''])
const allZones = ref<string[]>([])

const physicalRoleOptions = [
  { value: '', label: '全部类型' },
  { value: 'GENERATION', label: '电源节点' },
  { value: 'SUBSTATION', label: '变电站' },
  { value: 'DISTRIBUTION', label: '配电站' },
  { value: 'PV', label: '光伏接入点' },
]

const roleLabelMap: Record<string, string> = {
  GENERATION: '电源节点', SUBSTATION: '变电站', DISTRIBUTION: '配电站', PV: '光伏接入点',
}

const indicatorList = computed(() => {
  const nodes = indicators.value?.node_results || []
  const tpMap = new Map(threePhaseList.value.map((tp: any) => [tp.id || tp.nodeId, tp]))
  return nodes.map((n: any) => {
    const tp = tpMap.get(n.busId) || tpMap.get(n.nodeId)
    const voltageDeviation = Number((Math.abs((n.voltagePu || 1) - 1) * 100).toFixed(1))
    const imbalancePct = tp?.imbalancePct ?? 0
    return {
      busId: n.busId,
      name: n.name || n.nodeId,
      zone: n.zone,
      voltageLevel: n.voltageLevel,
      actualVoltageKv: n.actualVoltageKv ?? ((n.voltagePu || 1) * (n.baseKv || 10)).toFixed(2),
      voltageDeviation,
      voltageStatus: getStatus('voltage_deviation', voltageDeviation, n.voltageLevel, n.zone),
      isWeakNode: n.isWeakNode,
      reversePower: n.reversePower,
      physicalRole: n.physicalRole || 'SUBSTATION',
      flowDirection: n.flowDirection || 'forward',
      pgMw: n.pgMw ?? 0,
      pdMw: n.pdMw ?? 0,
      qgMvar: n.qgMvar ?? 0,
      qdMvar: n.qdMvar ?? 0,
      imbalancePct,
      imbalanceStatus: getStatus('three_phase_imbalance', imbalancePct, n.voltageLevel, n.zone),
    }
  })
})

const filteredList = computed(() => {
  let list = indicatorList.value
  if (region.value) list = list.filter((n: any) => n.zone === region.value)
  if (voltageLevel.value) list = list.filter((n: any) => n.voltageLevel === voltageLevel.value)
  if (physicalRoleFilter.value) list = list.filter((n: any) => n.physicalRole === physicalRoleFilter.value)
  if (!filterText.value) return list
  const kw = filterText.value.toLowerCase()
  return list.filter((n: any) =>
    n.name.toLowerCase().includes(kw) || n.zone?.toLowerCase().includes(kw) || n.voltageLevel?.toLowerCase().includes(kw)
  )
})

const summary = computed(() => {
  const items = filteredList.value
  const total = items.length
  if (!total) return { total, loss: 0, lineLoss: 0, transLoss: 0, qualified: 0, voltageWarn: 0, voltageCrit: 0, imbalanceWarn: 0, imbalanceCrit: 0, reverse: 0, lossRate: '0.0' }
  return {
    total,
    loss: indicators.value?.total_loss_kw ?? 0,
    lineLoss: indicators.value?.lineLossKw ?? 0,
    transLoss: indicators.value?.transformerLossKw ?? 0,
    qualified: items.filter((n: any) => !n.isWeakNode).length,
    voltageWarn: items.filter((n: any) => n.voltageStatus === 'warning').length,
    voltageCrit: items.filter((n: any) => n.voltageStatus === 'critical').length,
    imbalanceWarn: items.filter((n: any) => n.imbalanceStatus === 'warning').length,
    imbalanceCrit: items.filter((n: any) => n.imbalanceStatus === 'critical').length,
    reverse: typeof indicators.value?.reverse_power_detected === 'number'
      ? indicators.value.reverse_power_detected : items.filter((n: any) => n.reversePower).length,
    lossRate: (() => {
      const totalGen = items.reduce((s: number, n: any) => s + n.pgMw, 0)
      return totalGen > 0 ? ((indicators.value?.total_loss_kw ?? 0) / (totalGen * 1000) * 100).toFixed(1) : '0.0'
    })(),
  }
})

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (voltageLevel.value) params.voltageLevel = voltageLevel.value
    if (region.value) params.region = region.value

    const [indRes, tpRes] = await Promise.all([
      fetchIndicators(params),
      fetchThreePhase(params),
    ])
    indicators.value = indRes
    threePhaseList.value = tpRes as any

    const zones = new Set<string>()
    const nodes = indRes?.node_results || []
    nodes.forEach((n: any) => { if (n.zone) zones.add(n.zone) })
    allZones.value = Array.from(zones).sort()
    regionOptions.value = ['', ...allZones.value]
  } catch {
    // keep stale data
  } finally {
    loading.value = false
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    refreshTimer = setInterval(loadData, 30000)
  } else if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

const rowClass = ({ row }: any) => {
  if (row.voltageStatus === 'critical' || row.imbalanceStatus === 'critical') return 'critical-row'
  if (row.voltageStatus === 'warning' || row.imbalanceStatus === 'warning') return 'warning-row'
  return ''
}

function directionTag(dir: string) {
  if (dir === 'reverse') return { text: '反向', type: 'danger' }
  return { text: '正向', type: '' }
}

function statusColor(s: string) {
  if (s === 'critical') return '#F56C6C'
  if (s === 'warning') return '#E6A23C'
  return ''
}

onMounted(() => {
  loadThresholds()
  loadData()
  refreshTimer = setInterval(loadData, 30000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div>
    <div class="chart-panel-title">综合概览</div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:120px" @change="loadData">
        <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部电压'" :value="v" />
      </el-select>
      <el-select v-model="region" placeholder="区域" clearable size="small" style="width:180px;margin-left:10px" @change="loadData">
        <el-option v-for="r in regionOptions" :key="r" :label="r || '全部区域'" :value="r" />
      </el-select>
      <el-select v-model="physicalRoleFilter" placeholder="节点类型" clearable size="small" style="width:140px;margin-left:10px">
        <el-option v-for="opt in physicalRoleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-divider direction="vertical" />
      <el-input v-model="filterText" placeholder="搜索节点/区域..." clearable size="small" style="width:200px" prefix-icon="Search" />
      <div style="flex:1" />
      <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" style="margin-right:12px" @change="toggleAutoRefresh" />
      <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <!-- 摘要行 -->
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">筛选范围</span>
        <span class="summary-val">{{ summary.total }} 节点</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">总网损</span>
        <span class="summary-val" style="color:#267F7B">{{ (summary.loss / 1000).toFixed(2) }} MW <span style="font-size:11px;color:#909399">{{ summary.lossRate }}%</span></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">电压预警/严重</span>
        <span class="summary-val">
          <span :style="{ color: summary.voltageWarn > 0 ? '#E6A23C' : '#909399' }">{{ summary.voltageWarn }}</span>
          /
          <span :style="{ color: summary.voltageCrit > 0 ? '#F56C6C' : '#909399' }">{{ summary.voltageCrit }}</span>
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">不平衡预警/严重</span>
        <span class="summary-val">
          <span :style="{ color: summary.imbalanceWarn > 0 ? '#E6A23C' : '#909399' }">{{ summary.imbalanceWarn }}</span>
          /
          <span :style="{ color: summary.imbalanceCrit > 0 ? '#F56C6C' : '#909399' }">{{ summary.imbalanceCrit }}</span>
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">反向潮流</span>
        <span class="summary-val" :style="{ color: summary.reverse > 0 ? '#E6A23C' : '#909399' }">{{ summary.reverse }}</span>
      </div>
    </div>

    <!-- 节点指标总表 -->
    <div class="chart-panel">
      <div class="chart-panel-title">节点指标</div>
      <el-table :data="filteredList" stripe size="small" v-loading="loading" max-height="520" :row-class-name="rowClass">
        <el-table-column prop="name" label="节点名称" min-width="140" fixed="left" />
        <el-table-column label="节点类型" min-width="90">
          <template #default="{ row }">
            <el-tag size="small">{{ roleLabelMap[row.physicalRole] || row.physicalRole }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="区域" min-width="80">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压(kV)" min-width="100">
          <template #default="{ row }">
            <span :style="{ fontWeight: 600, color: statusColor(row.voltageStatus) || '#303133' }">
              {{ row.actualVoltageKv }}
              <span v-if="row.voltageStatus !== 'normal'" style="font-size:10px;margin-left:2px">
                ({{ row.voltageDeviation }}%)
              </span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="偏差%" min-width="70">
          <template #default="{ row }">
            <el-tag v-if="row.voltageStatus === 'critical'" type="danger" size="small">{{ row.voltageDeviation }}%</el-tag>
            <el-tag v-else-if="row.voltageStatus === 'warning'" type="warning" size="small">{{ row.voltageDeviation }}%</el-tag>
            <span v-else style="color:#909399">{{ row.voltageDeviation }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="三相不平衡" min-width="100">
          <template #default="{ row }">
            <el-tag v-if="row.imbalanceStatus === 'critical'" type="danger" size="small">{{ row.imbalancePct }}%</el-tag>
            <el-tag v-else-if="row.imbalanceStatus === 'warning'" type="warning" size="small">{{ row.imbalancePct }}%</el-tag>
            <span v-else style="color:#909399">{{ row.imbalancePct }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="有功功率(MW)" min-width="85">
          <template #default="{ row }">
            <span v-if="row.pgMw" style="color:#267F7B;font-weight:600">{{ row.pgMw.toFixed(2) }}</span>
            <span v-else-if="row.pdMw">{{ row.pdMw.toFixed(2) }}</span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="无功功率(Mvar)" min-width="85">
          <template #default="{ row }">
            <span v-if="row.qgMvar" style="color:#267F7B;font-weight:600">{{ row.qgMvar.toFixed(2) }}</span>
            <span v-else-if="row.qdMvar">{{ row.qdMvar.toFixed(2) }}</span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="潮流方向" min-width="85">
          <template #default="{ row }">
            <el-tag size="small" :type="directionTag(row.flowDirection).type as any">{{ directionTag(row.flowDirection).text }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!filteredList.length && !loading" style="padding:40px;text-align:center;color:#909399">
        当前筛选条件下无数据
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
}
.summary-bar {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.summary-item {
  flex: 1;
  padding: 10px 6px;
  text-align: center;
  border-right: 1px solid #f0f0f0;
}
.summary-item:last-child { border-right: none; }
.summary-label {
  display: block;
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}
.summary-val {
  font-size: 17px;
  font-weight: 700;
  color: #303133;
}
:deep(.critical-row) { background-color: #fef0f0 !important; }
:deep(.warning-row) { background-color: #fdf6ec !important; }
</style>
