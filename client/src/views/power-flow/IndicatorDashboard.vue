<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchIndicators, fetchThreePhase } from '@/api/power-flow'
import type { ThreePhaseItem } from '@/api/power-flow'

const loading = ref(false)
const autoRefresh = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const voltageLevel = ref('')
const region = ref('')

const indicators = ref<any>(null)
const threePhaseList = ref<ThreePhaseItem[]>([])
const filterText = ref('')

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ['', 'A（西部：仓前/未来城）', 'B（中部：余杭/闲林）', 'C（东部：乔司）']
const regionValueMap: Record<string, string> = {
  'A（西部：仓前/未来城）': 'A',
  'B（中部：余杭/闲林）': 'B',
  'C（东部：乔司）': 'C',
}

// 合并节点数据 + 三相不平衡数据为统一列表
const indicatorList = computed(() => {
  const nodes = indicators.value?.node_results || []
  const tpMap = new Map(threePhaseList.value.map(tp => [tp.id, tp]))
  return nodes.map((n: any) => {
    const tp = tpMap.get(n.busId) || tpMap.get(n.nodeId)
    return {
      busId: n.busId,
      name: n.name || n.nodeId,
      zone: n.zone,
      voltageLevel: n.voltageLevel,
      voltagePu: n.voltagePu,
      angleDeg: n.angleDeg,
      stabilityMargin: n.stabilityMargin,
      isWeakNode: n.isWeakNode,
      threePhaseImbalance: tp?.imbalancePct ?? n.threePhaseImbalance ?? 0,
      pvRelated: tp?.pvRelated ?? false,
      reversePower: n.reversePower,
      busType: n.busType,
      pdMw: n.pdMw ?? 0,
      pgMw: n.pgMw ?? 0,
    }
  })
})

// 搜索过滤
const filteredList = computed(() => {
  if (!filterText.value) return indicatorList.value
  const kw = filterText.value.toLowerCase()
  return indicatorList.value.filter((n: any) =>
    n.name.toLowerCase().includes(kw) || n.zone?.toLowerCase().includes(kw) || n.voltageLevel?.toLowerCase().includes(kw)
  )
})

// 汇总指标
const summary = computed(() => {
  const items = indicatorList.value
  const total = items.length
  if (!total) return { total, loss: 0, qualified: 0, weak: 0, reverse: 0, severeImbalance: 0, totalLoad: 0, totalGen: 0 }
  return {
    total,
    loss: indicators.value?.total_loss_kw ?? 0,
    qualified: items.filter((n: any) => !n.isWeakNode).length,
    weak: items.filter((n: any) => n.isWeakNode).length,
    reverse: typeof indicators.value?.reverse_power_detected === 'number'
      ? indicators.value.reverse_power_detected : items.filter((n: any) => n.reversePower).length,
    severeImbalance: items.filter((n: any) => n.threePhaseImbalance > 2).length,
    totalLoad: items.reduce((s: number, n: any) => s + n.pdMw, 0),
    totalGen: items.reduce((s: number, n: any) => s + n.pgMw, 0),
  }
})

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (voltageLevel.value) params.voltageLevel = voltageLevel.value
    if (region.value) params.region = regionValueMap[region.value] || region.value

    const [indRes, tpRes] = await Promise.all([
      fetchIndicators(params),
      fetchThreePhase(params),
    ])
    indicators.value = indRes
    threePhaseList.value = tpRes as any
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

onMounted(() => {
  loadData()
  refreshTimer = setInterval(loadData, 30000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div>
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:140px" @change="loadData">
        <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
      </el-select>
      <el-select v-model="region" placeholder="区域" clearable size="small" style="width:210px;margin-left:10px" @change="loadData">
        <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
      </el-select>
      <el-divider direction="vertical" />
      <el-input v-model="filterText" placeholder="搜索节点/区域/电压..." clearable size="small" style="width:200px" prefix-icon="Search" />
      <div style="flex:1" />
      <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" style="margin-right:12px" @change="toggleAutoRefresh" />
      <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <!-- 摘要行（替代4张大卡片） -->
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">筛选范围</span>
        <span class="summary-val">{{ summary.total }} 节点</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">网损</span>
        <span class="summary-val" style="color:#267F7B">{{ summary.loss.toFixed(1) }} kW</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">电压合格</span>
        <span class="summary-val" style="color:#67C23A">{{ summary.qualified }}/{{ summary.total }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">薄弱节点</span>
        <span class="summary-val" :style="{ color: summary.weak > 0 ? '#F56C6C' : '#909399' }">{{ summary.weak }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">反向潮流</span>
        <span class="summary-val" :style="{ color: summary.reverse > 0 ? '#E6A23C' : '#909399' }">{{ summary.reverse }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">不平衡 &gt;2%</span>
        <span class="summary-val" :style="{ color: summary.severeImbalance > 0 ? '#F56C6C' : '#909399' }">{{ summary.severeImbalance }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">总负荷</span>
        <span class="summary-val">{{ summary.totalLoad.toFixed(0) }} MW</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">总电源</span>
        <span class="summary-val" style="color:#267F7B">{{ summary.totalGen.toFixed(0) }} MW</span>
      </div>
    </div>

    <!-- 指标总览列表（单表整合所有指标） -->
    <div class="chart-panel">
      <div class="chart-panel-title">指标总览</div>
      <el-table :data="filteredList" stripe size="small" v-loading="loading" max-height="520"
        :row-class-name="({ row }: any) => row.isWeakNode ? 'weak-row' : row.threePhaseImbalance > 2 ? 'severe-row' : ''">
        <el-table-column prop="name" label="节点名称" min-width="140" fixed="left" />
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压(p.u.)" width="100">
          <template #default="{ row }">
            <span :style="{ fontWeight: 600, color: row.isWeakNode ? '#F56C6C' : '#303133' }">{{ row.voltagePu.toFixed(4) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="angleDeg" label="相角(°)" width="70" />
        <el-table-column label="稳定裕度" width="90">
          <template #default="{ row }">
            <span :style="{ color: row.stabilityMargin < 0.9 ? '#F56C6C' : row.stabilityMargin < 0.95 ? '#E6A23C' : '#67C23A', fontWeight: 600 }">
              {{ (row.stabilityMargin * 100).toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="三相不平衡" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.threePhaseImbalance > 2 ? '#F56C6C' : row.threePhaseImbalance > 1 ? '#E6A23C' : '#606266', fontWeight: 600 }">
              {{ row.threePhaseImbalance.toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="反向潮流" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.reversePower" size="small" type="danger">是</el-tag>
            <span v-else style="color:#c0c4cc">否</span>
          </template>
        </el-table-column>
        <el-table-column label="光伏关联" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.pvRelated" size="small" type="warning">是</el-tag>
            <span v-else style="color:#c0c4cc">否</span>
          </template>
        </el-table-column>
        <el-table-column label="负荷(MW)" width="90">
          <template #default="{ row }"><span v-if="row.pdMw">{{ row.pdMw }}</span><span v-else style="color:#c0c4cc">-</span></template>
        </el-table-column>
        <el-table-column label="电源(MW)" width="90">
          <template #default="{ row }"><span v-if="row.pgMw" style="color:#267F7B">{{ row.pgMw }}</span><span v-else style="color:#c0c4cc">-</span></template>
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
  padding: 12px 8px;
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
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}
:deep(.weak-row) { background-color: #fef0f0 !important; }
:deep(.severe-row) { background-color: #fdf6ec !important; }
</style>
