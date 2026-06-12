<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchStations, fetchPowerReliability } from '@/api/grid-diagnosis'
import { fetchDataRanges } from '@/api/system'
import type { PowerSupplyReliability, FaultTreeNode } from '@new-energy/shared'

const selectedPoint = ref('')
const dateRange = ref<[string, string]>(['2025-01-01', '2026-06-02'])
const loading = ref(false)
const stations = ref<any[]>([])
const result = ref<PowerSupplyReliability | null>(null)
const topoConn = ref('')
const topoLine = ref('')

onMounted(async () => {
  const list = await fetchStations()
  stations.value = list || []
  if (list?.length) {
    selectedPoint.value = list[0].id
    try {
      const ranges = await fetchDataRanges()
      const pv = ranges.pv_output_measurements
      if (pv?.minTime && pv?.maxTime) {
        const today = new Date().toISOString().slice(0, 10)
        const endDate = today < pv.maxTime.slice(0, 10) ? today : pv.maxTime.slice(0, 10)
        dateRange.value = [pv.minTime.slice(0, 10), endDate]
      }
    } catch { /* 兜底 */ }
    await loadData()
  }
})

async function loadData() {
  if (!selectedPoint.value) return
  loading.value = true
  const data = await fetchPowerReliability({
    stationId: selectedPoint.value,
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    connectionType: topoConn.value || undefined,
    lineType: topoLine.value || undefined,
  } as any)
  result.value = data
  if (data) {
    topoConn.value = data.topologyConfig.connectionType
    topoLine.value = data.topologyConfig.lineType
  }
  loading.value = false
}

function buildTree(nodes: FaultTreeNode[], parentId: string | null): any[] {
  return nodes
    .filter(n => n.parent === parentId)
    .map(n => ({
      name: n.name + (n.failureRate ? `\n(λ=${n.failureRate}/yr, MTTR=${n.mttr}h)` : ''),
      children: buildTree(nodes, n.id),
    }))
}

function flattenTree(nodes: FaultTreeNode[], parentId: string | null, depth: number): Array<FaultTreeNode & { depth: number }> {
  const result: Array<FaultTreeNode & { depth: number }> = []
  for (const n of nodes.filter(n => n.parent === parentId)) {
    result.push({ ...n, depth })
    result.push(...flattenTree(nodes, n.id, depth + 1))
  }
  return result
}

const flatFaultTree = computed(() => {
  if (!result.value) return []
  return flattenTree(result.value.faultTree, null, 0)
})

const treeOption = computed(() => {
  if (!result.value) return {}
  const tree = buildTree(result.value.faultTree, null)
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => p.name.replace(/\\n/g, '<br/>') },
    series: [{
      type: 'tree',
      data: tree,
      top: '3%', left: '6%', bottom: '3%', right: '18%',
      symbol: 'roundRect',
      symbolSize: [10, 6],
      orient: 'LR',
      roam: true,
      expandAndCollapse: true,
      initialTreeDepth: 2,
      label: { position: 'right', verticalAlign: 'middle', align: 'left', fontSize: 11, color: '#303133', distance: 6 },
      leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left', fontSize: 10, color: '#606266', distance: 4 } },
      lineStyle: { color: '#c0c4cc', width: 1, curveness: 0.5 },
      itemStyle: { color: '#409EFF', borderColor: '#409EFF' },
    }],
  }
})

const comparisonSAIFIOption = computed(() => {
  if (!result.value) return {}
  const mc = result.value.monthlyComparison
  const threshold = result.value.saifi * 0.3
  return {
    tooltip: { trigger: 'axis', formatter: (p: any) => {
      const theo = p[0]?.value ?? '-', actual = p[1]?.value
      return `${p[0]?.axisValue}<br/>理论 SAIFI：${theo} 次/户·年<br/>实际 SAIFI：${actual ?? '无数据'} 次/户·年`
    }},
    legend: { data: ['理论 SAIFI', '实际 SAIFI'] },
    xAxis: { type: 'category', data: mc.map(d => d.month.slice(0, 7)), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '次/户·年' },
    series: [
      { name: '理论 SAIFI', type: 'line', data: mc.map(d => d.theoretical), smooth: true, symbol: 'none', lineStyle: { color: '#409EFF' } },
      { name: '实际 SAIFI', type: 'scatter', data: mc.map((d, i) => {
        if (d.actual == null) return null
        const dev = Math.abs(d.actual - d.theoretical)
        const isSignificant = dev > threshold
        return { value: [mc[i].month.slice(0, 7), d.actual], symbolSize: isSignificant ? 18 : 10, itemStyle: { color: isSignificant ? '#F56C6C' : '#E6A23C' }, dev }
      }).filter((v: any) => v != null), symbolSize: 12 },
    ],
    grid: { left: 60, right: 24, top: 32, bottom: 50 },
  }
})

const contributionsTableOption = computed(() => ({
  rowClass: ({ row }: any) => row.group && !row.group.startsWith('  ') ? 'aggregate-row' : '',
}))

const comparisonSAIDIOption = computed(() => {
  if (!result.value) return {}
  const mc = result.value.monthlyComparison
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['理论 SAIDI', '实际 SAIDI'] },
    xAxis: { type: 'category', data: mc.map(d => d.month.slice(0, 7)), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '小时/户·年' },
    series: [
      { name: '理论 SAIDI', type: 'line', data: mc.map(() => result.value!.saidi), smooth: true, symbol: 'none', lineStyle: { color: '#409EFF' } },
      { name: '实际 SAIDI', type: 'scatter', data: mc.map((d, i) => {
        if (d.actualSAIDI == null) return null
        return { value: [mc[i].month.slice(0, 7), d.actualSAIDI], symbolSize: d.actualSAIDI > result.value!.saidi * 1.3 ? 16 : 10, itemStyle: { color: d.actualSAIDI > result.value!.saidi * 1.3 ? '#F56C6C' : '#E6A23C' } }
      }).filter((v: any) => v != null) },
    ],
    grid: { left: 60, right: 24, top: 32, bottom: 50 },
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">供电可靠性计算</div>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">并网点</span>
        <el-select v-model="selectedPoint" size="small" style="width:200px" @change="loadData">
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期范围</span>
        <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadData" style="width:130px" />
        <span style="color:#909399;margin:0 4px">至</span>
        <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadData" style="width:130px" />
      </div>
      <div class="filter-group" v-if="result">
        <span class="filter-label">接线</span>
        <el-radio-group v-model="topoConn" size="small" @change="loadData">
          <el-radio-button value="single">单回</el-radio-button>
          <el-radio-button value="double">双回</el-radio-button>
          <el-radio-button value="loop">环网</el-radio-button>
        </el-radio-group>
        <span class="filter-label" style="margin-left:12px">线路</span>
        <el-radio-group v-model="topoLine" size="small" @change="loadData">
          <el-radio-button value="dedicated">专线</el-radio-button>
          <el-radio-button value="tap">T接</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="chart-panel" style="margin-bottom:16px" v-if="result">
      <div style="font-size:14px;font-weight:600;padding:8px 0 0 16px;color:#303133">理论供电可靠率（{{ result.voltageKv }}kV · {{ result.topologyConfig.connectionType === 'loop' ? '环网' : result.topologyConfig.connectionType === 'double' ? '双回' : '单回' }} · {{ result.topologyConfig.lineType === 'tap' ? 'T接' : '专线' }}）</div>
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-value">{{ result.saifi }}</div>
          <div class="metric-label">SAIFI（次/户·年）</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{ result.saidi }}</div>
          <div class="metric-label">SAIDI（小时/户·年）</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color:#67C23A">{{ (result.theoreticalReliability * 100).toFixed(6) }}%</div>
          <div class="metric-label">理论可靠率</div>
        </div>
        <div class="metric-card" v-if="result.deviationPct != null">
          <div class="metric-value" :style="{ color: result.deviationPct > 20 ? '#F56C6C' : '#E6A23C' }">{{ result.deviationPct }}%</div>
          <div class="metric-label">理论vs实际偏差</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{ result.actualOutageCount }}</div>
          <div class="metric-label">实际停电次数</div>
        </div>
      </div>
    </div>

    <div class="chart-panel" style="margin-bottom:16px" v-if="result">
      <div style="font-size:14px;font-weight:600;padding:8px 0 0 16px;color:#303133">网架故障树模型</div>
      <div style="display:flex;gap:16px">
        <div style="flex:2">
          <ChartContainer :option="treeOption" height="380px" :loading="loading" />
        </div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:#606266;margin-bottom:8px">理论贡献值分解</div>
          <el-table :data="result.contributions" size="small" :row-class-name="contributionsTableOption.rowClass">
            <el-table-column prop="group" label="故障类型" />
            <el-table-column prop="saifi" label="SAIFI贡献" width="90" />
            <el-table-column label="占比" width="70">
              <template #default="{ row }">{{ row.saidiPct >= 0 ? row.saidiPct + '%' : '-' }}</template>
            </el-table-column>
          </el-table>
          <div style="padding:6px 0;font-size:12px;color:#303133;font-weight:600">合计 SAIFI：{{ result.saifi }} 次/户·年</div>
        </div>
      </div>
      <!-- 故障树节点数据列表 -->
      <div style="margin-top:12px">
        <div style="font-size:12px;font-weight:600;color:#606266;margin-bottom:8px">故障树节点数据</div>
        <el-table :data="flatFaultTree" size="small" max-height="320" stripe>
          <el-table-column label="层级" width="50">
            <template #default="{ row }">{{ row.depth }}</template>
          </el-table-column>
          <el-table-column prop="name" label="节点名称" min-width="180">
            <template #default="{ row }">
              <span :style="{ paddingLeft: row.depth * 16 + 'px' }">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="故障率" width="120">
            <template #default="{ row }">
              {{ row.failureRate != null ? row.failureRate + ' 次/年' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="MTTR" width="100">
            <template #default="{ row }">
              {{ row.mttr != null ? row.mttr + ' h' : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="id" label="ID" width="100" />
        </el-table>
      </div>
    </div>

    <div class="chart-panel" v-if="result" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;padding:8px 0 0 16px;color:#303133">理论与实际 SAIFI 对比（偏差 >30% 标注红点）</div>
      <ChartContainer :option="comparisonSAIFIOption" height="260px" :loading="loading" />
    </div>

    <div class="chart-panel" v-if="result">
      <div style="font-size:14px;font-weight:600;padding:8px 0 0 16px;color:#303133">理论与实际 SAIDI 对比（停电时长）</div>
      <ChartContainer :option="comparisonSAIDIOption" height="260px" :loading="loading" />
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
.metrics-row { display:flex; gap:0; padding:12px 16px 16px 16px }
.metric-card { flex:1; text-align:center; padding:8px 0; border-right:1px solid #ebeef5 }
.metric-card:last-child { border-right:none }
.metric-value { font-size:22px; font-weight:700; color:#303133; line-height:1.4 }
.metric-label { font-size:12px; color:#909399; margin-top:2px }

:deep(.aggregate-row) { font-weight:700; background:#f5f7fa }
:deep(.aggregate-row) td { border-bottom: 1px solid #dcdfe6 }
</style>
