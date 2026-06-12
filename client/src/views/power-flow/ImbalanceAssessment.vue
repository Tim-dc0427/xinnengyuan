<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fetchThreePhase, fetchThreePhaseTrend } from '@/api/power-flow'
import type { ThreePhaseItem, ThreePhaseTrendResult } from '@/api/power-flow'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { useThresholds } from '@/composables/useThresholds'

const { load: loadThresholds, getStatus } = useThresholds()

const loading = ref(false)
const activeTab = ref('calculation')

// 共用筛选
const voltageLevel = ref('')
const region = ref('')
const physicalRole = ref('')

// Tab2 专属
const chartGroupBy = ref<'zone' | 'voltage'>('zone')
const chartTopN = ref(20)
const timeRange = ref<string[]>([])
const chartTopNOptions = [
  { value: 10, label: 'Top 10' },
  { value: 20, label: 'Top 20' },
  { value: 30, label: 'Top 30' },
  { value: 0, label: '全部' },
]

// Tab2 趋势
const trendLoading = ref(false)
const trendData = ref<ThreePhaseTrendResult | null>(null)
const trendMetric = ref<'imbalance' | 'vuf' | 'cuf' | 'voltage'>('imbalance')
const trendNodeCount = ref(5)
const trendMetricOptions = [
  { value: 'imbalance', label: '不平衡度(%)' },
  { value: 'vuf', label: '电压不平衡度(%)' },
  { value: 'cuf', label: '电流不平衡度(%)' },
  { value: 'voltage', label: '三相电压(kV)' },
]

const list = ref<ThreePhaseItem[]>([])

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ref<string[]>([''])
const physicalRoleOptions = [
  { value: '', label: '全部' },
  { value: 'GENERATION', label: '发电' },
  { value: 'SUBSTATION', label: '变电' },
  { value: 'DISTRIBUTION', label: '配电' },
  { value: 'PV', label: '光伏' },
]

// 阈值状态辅助
function imbStatus(item: ThreePhaseItem) {
  const vl = (item as any).voltageLevel; const zn = (item as any).zone
  return getStatus('three_phase_imbalance', item.imbalancePct, vl, zn)
}
function imbRowClass(item: ThreePhaseItem) {
  const s = imbStatus(item); return s === 'critical' ? 'critical-row' : s === 'warning' ? 'warning-row' : ''
}
function imbColor(item: ThreePhaseItem) {
  const s = imbStatus(item); return s === 'critical' ? '#F56C6C' : s === 'warning' ? '#E6A23C' : '#606266'
}
function vufStatus(vuf: number, item: ThreePhaseItem) {
  const vl = (item as any).voltageLevel; const zn = (item as any).zone
  return getStatus('three_phase_imbalance', vuf, vl, zn)
}
function cufStatus(cuf: number, item: ThreePhaseItem) {
  const vl = (item as any).voltageLevel; const zn = (item as any).zone
  return getStatus('three_phase_imbalance', cuf * 0.4, vl, zn)
}

// Tab1: 台账筛选
const filteredList = computed(() => {
  let data = list.value
  if (region.value) data = data.filter(i => (i as any).zone === region.value)
  if (voltageLevel.value) data = data.filter(i => (i as any).voltageLevel === voltageLevel.value)
  if (physicalRole.value) data = data.filter(i => (i as any).physicalRole === physicalRole.value)
  return data
})

// Tab1: 统计（基于阈值）
const severeItems = computed(() => list.value.filter(i => imbStatus(i) === 'critical'))
const warningItems = computed(() => list.value.filter(i => imbStatus(i) === 'warning'))

// Tab3: 光伏关联
const pvRelatedItems = computed(() => list.value.filter(i => i.pvRelated))

function getImbalanceCause(row: ThreePhaseItem): string {
  const ia = row.phaseACurrent ?? 0
  const ib = row.phaseBCurrent ?? 0
  const ic = row.phaseCCurrent ?? 0
  const total = ia + ib + ic
  if (total < 0.01) {
    // 无电流数据时根据电压判断
    const va = row.phaseA ?? 0; const vb = row.phaseB ?? 0; const vc = row.phaseC ?? 0
    const vMax = Math.max(va, vb, vc); const vMin = Math.min(va, vb, vc)
    if (vMin > 0 && vMax / vMin > 1.03) {
      const phases = ['A', 'B', 'C']
      const vals = [va, vb, vc]
      const lowPhase = phases[vals.indexOf(vMin)]
      return `疑似单相接入（${lowPhase}相电压偏低 ${((1 - vMin/vMax)*100).toFixed(1)}%）`
    }
    return '出力波动导致不平衡'
  }

  const ratios = [ia / total, ib / total, ic / total]
  const maxRatio = Math.max(...ratios)
  const phases = ['A', 'B', 'C']
  const maxPhase = phases[ratios.indexOf(maxRatio)]

  // 单相出力集中（某相占比>60%）
  if (maxRatio > 0.6) return `${maxPhase}相单相接入，出力集中（占比${(maxRatio*100).toFixed(0)}%）`

  // 装机容量过大
  const capacity = row.installedCapacity ?? 0
  if (capacity > 10 && imbStatus(row) !== 'normal') return `接入容量过大（${capacity}MW），台区消纳不足`

  // 三相出力不均（最大相>最小相2倍）
  const minRatio = Math.min(...ratios)
  if (minRatio > 0 && maxRatio / minRatio > 2) return `三相出力不均（${maxPhase}相偏重）`

  // 光伏出力与负载不匹配
  if (row.loadType && imbStatus(row) !== 'normal') return `${row.loadType}负载与光伏出力不匹配`
  return '光伏出力波动'
}

// Tab2: 节点级三相电压幅值对比
interface ChartNodeEntry {
  __type: 'header' | 'node'
  label: string
  item: ThreePhaseItem | null
  groupName?: string
}

const chartNodes = computed(() => {
  const data = filteredList.value.filter(n => n.phaseA != null && n.phaseB != null && n.phaseC != null)
  if (!data.length) return [] as ChartNodeEntry[]

  const groupKey = chartGroupBy.value === 'zone' ? 'zone' : 'voltageLevel'
  const groups = new Map<string, ThreePhaseItem[]>()
  for (const n of data) {
    const key = (n as any)[groupKey] || '未知'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }

  // 每组内按不平衡度降序排列
  for (const [_, nodes] of groups) {
    nodes.sort((a, b) => b.imbalancePct - a.imbalancePct)
  }

  // 组按最大不平衡度降序排列
  const sortedGroups = [...groups.entries()]
    .sort((a, b) => {
      const maxA = a[1][0]?.imbalancePct ?? 0
      const maxB = b[1][0]?.imbalancePct ?? 0
      return maxB - maxA
    })

  const entries: ChartNodeEntry[] = []
  const limit = chartTopN.value > 0 ? chartTopN.value : 999
  let total = 0
  for (const [groupName, nodes] of sortedGroups) {
    if (total >= limit) break
    entries.push({ __type: 'header', label: `▍${groupName}`, item: null, groupName })
    const take = Math.min(nodes.length, limit - total)
    for (const n of nodes.slice(0, take)) {
      entries.push({ __type: 'node', label: '', item: n, groupName })
      total++
    }
  }
  return entries
})

const chartHeight = computed(() => {
  const count = chartNodes.value.filter(e => e.__type === 'node').length
  return Math.max(300, Math.min(800, count * 30 + 80)) + 'px'
})

const threePhaseChartOption = computed(() => {
  const entries = chartNodes.value
  if (!entries.length) return {}

  const nodeIndices: number[] = []
  const nodeLabels: string[] = []
  const yIndexes: number[] = []
  entries.forEach((e, i) => {
    if (e.__type === 'header') {
      nodeLabels.push(e.label)
    } else if (e.item) {
      nodeIndices.push(i)
      const n = e.item
      const s = imbStatus(n); const imblTag = s === 'critical' ? '⚠' : s === 'warning' ? '⚡' : '  '
      const pct = n.imbalancePct.toFixed(1) + '%'
      nodeLabels.push(`{imbl|${imblTag}${pct}} {name|${n.name || n.nodeId}} {zone|${n.zone || ''}}`)
      yIndexes.push(i)
    }
  })

  const phaseA: (number | null)[] = new Array(entries.length).fill(null)
  const phaseB: (number | null)[] = new Array(entries.length).fill(null)
  const phaseC: (number | null)[] = new Array(entries.length).fill(null)
  const markAreas: any[] = []

  let areaStart = -1
  let currentGroup = ''
  entries.forEach((e, i) => {
    if (e.__type === 'header') {
      if (areaStart >= 0) {
        markAreas.push([
          { yAxis: areaStart, itemStyle: { color: 'rgba(0,0,0,0.03)' } },
          { yAxis: i - 1 },
        ])
      }
      areaStart = i + 1
      currentGroup = e.label
    } else if (e.item) {
      phaseA[i] = e.item.phaseA ?? null
      phaseB[i] = e.item.phaseB ?? null
      phaseC[i] = e.item.phaseC ?? null
    }
  })
  if (areaStart >= 0 && areaStart < entries.length) {
    markAreas.push([
      { yAxis: areaStart, itemStyle: { color: 'rgba(0,0,0,0.03)' } },
      { yAxis: entries.length - 1 },
    ])
  }

  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any[]) => {
        const p = params[0]
        if (!p) return ''
        const idx = p.dataIndex
        const entry = entries[idx]
        if (!entry || entry.__type === 'header') return ''
        const n = entry.item!
        const differ = n.phaseA != null && n.phaseB != null && n.phaseC != null
          ? (Math.max(n.phaseA, n.phaseB, n.phaseC) - Math.min(n.phaseA, n.phaseB, n.phaseC)).toFixed(4)
          : '-'
        const si = imbStatus(n); const sev = si === 'critical' ? '严重' : si === 'warning' ? '预警' : '正常'
        const sevColor = si === 'critical' ? '#F56C6C' : si === 'warning' ? '#E6A23C' : '#67C23A'
        return `<b>${n.name || n.nodeId}</b><br/>
          区域: ${n.zone || '-'}  |  电压等级: ${n.voltageLevel || '-'}<br/>
          节点类型: ${(n as any).physicalRole || '-'}  |  不平衡度: <b style="color:${sevColor}">${n.imbalancePct.toFixed(2)}%</b> (${sev})<br/>
          A 相: <b>${(n.phaseA ?? 0).toFixed(4)} kV</b><br/>
          B 相: <b>${(n.phaseB ?? 0).toFixed(4)} kV</b><br/>
          C 相: <b>${(n.phaseC ?? 0).toFixed(4)} kV</b><br/>
          相间最大差: <b>${differ} kV</b><br/>
          <span style="color:#909399">${n.pvRelated ? '☀ 光伏关联' : ''}</span>`
      },
    },
    legend: {
      data: ['A 相', 'B 相', 'C 相'],
      top: 0,
      textStyle: { fontSize: 12 },
    },
    grid: { left: 160, right: 40, top: 40, bottom: 30 },
    xAxis: {
      type: 'value' as const,
      name: '电压 (kV)',
      splitLine: { lineStyle: { type: 'dashed', color: '#e8e8e8' } },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'category' as const,
      data: nodeLabels,
      inverse: true,
      axisLabel: {
        fontSize: 11,
        rich: {
          imbl: { width: 60, align: 'right', padding: [0, 4, 0, 0], fontWeight: 'bold' },
          name: { width: 70, align: 'left', color: '#303133' },
          zone: { width: 50, align: 'left', color: '#909399', fontSize: 10 },
        },
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      { name: 'A 相', type: 'bar', data: phaseA, itemStyle: { color: '#F56C6C' }, barWidth: 6, barGap: '10%', markArea: { silent: true, data: markAreas } },
      { name: 'B 相', type: 'bar', data: phaseB, itemStyle: { color: '#E6A23C' }, barWidth: 6 },
      { name: 'C 相', type: 'bar', data: phaseC, itemStyle: { color: '#267F7B' }, barWidth: 6 },
    ],
  }
})

// Tab2 趋势图表
const trendChartOption = computed(() => {
  if (!trendData.value?.nodes?.length) return {}

  const nodes = trendData.value.nodes.slice(0, trendNodeCount.value)
  const dates = trendData.value.dates.map((d: string) => d.substring(5, 10)) // MM-DD

  const colors = ['#F56C6C', '#E6A23C', '#267F7B', '#409EFF', '#909399']
  const series: any[] = []

  nodes.forEach((node, ni) => {
    const color = colors[ni % colors.length]
    const roleLabel = node.info.physicalRole === 'PV' ? '光伏' : node.info.physicalRole === 'DISTRIBUTION' ? '配电' : node.info.physicalRole === 'GENERATION' ? '发电' : '变电'
    const label = `${node.info.name || node.info.busId} [${roleLabel}]`

    if (trendMetric.value === 'voltage') {
      // 三相电压：每个节点3条线
      ;[['A相', 'phaseA'], ['B相', 'phaseB'], ['C相', 'phaseC']].forEach(([phase, key]) => {
        series.push({
          name: `${label} ${phase}`,
          type: 'line',
          data: node.series.map((s: any) => s[key]),
          lineStyle: { width: key === 'phaseA' ? 1.5 : key === 'phaseB' ? 1.5 : 1.5 },
          itemStyle: { color: phase === 'A相' ? '#F56C6C' : phase === 'B相' ? '#E6A23C' : '#267F7B' },
          symbol: 'none',
        })
      })
    } else {
      const keyMap: Record<string, string> = { imbalance: 'imbalancePct', vuf: 'vuf', cuf: 'cuf' }
      const key = keyMap[trendMetric.value] || trendMetric.value
      const labelMap: Record<string, string> = { imbalance: '不平衡度', vuf: '电压不平衡度', cuf: '电流不平衡度' }
      series.push({
        name: `${label} ${labelMap[key] || key}`,
        type: 'line',
        data: node.series.map((s: any) => s[key]),
        lineStyle: { width: 2, color },
        itemStyle: { color },
        symbol: 'circle',
        symbolSize: 4,
      })
    }
  })

  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any[]) => {
        if (!params.length) return ''
        let html = `<b>${params[0].axisValue}</b><br/>`
        params.forEach((p: any) => {
          html += `${p.marker} ${p.seriesName}: <b>${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</b><br/>`
        })
        return html
      },
    },
    legend: {
      type: 'scroll' as const,
      bottom: 0,
      textStyle: { fontSize: 10 },
      itemWidth: 14,
      itemHeight: 8,
    },
    grid: { left: 50, right: 30, top: 20, bottom: 50 },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { fontSize: 10, rotate: 30 },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value' as const,
      name: trendMetricOptions.find(o => o.value === trendMetric.value)?.label || '',
      splitLine: { lineStyle: { type: 'dashed', color: '#e8e8e8' } },
      axisLabel: { fontSize: 11 },
    },
    series,
  }
})

async function loadTrend() {
  if (!timeRange.value?.length || timeRange.value.length !== 2) {
    trendData.value = null
    return
  }
  trendLoading.value = true
  try {
    // 从全量数据中选节点：每种类型取不平衡度最高的，再补足到 N 个
    const allValid = list.value.filter(n => n.phaseA != null && n.id)
    const roles = ['DISTRIBUTION', 'SUBSTATION', 'PV', 'GENERATION']
    const picked = new Set<string>()
    // 每种类型取1个最差的
    for (const role of roles) {
      const worst = allValid.filter(n => n.physicalRole === role).sort((a, b) => b.imbalancePct - a.imbalancePct)[0]
      if (worst) picked.add(worst.id!)
    }
    // 补足到 trendNodeCount
    const rest = allValid.filter(n => !picked.has(n.id!)).sort((a, b) => b.imbalancePct - a.imbalancePct)
    for (const n of rest) {
      if (picked.size >= trendNodeCount.value) break
      picked.add(n.id!)
    }
    const topNodes = [...picked]
    if (!topNodes.length) { trendData.value = null; return }

    trendData.value = await fetchThreePhaseTrend({
      startDate: timeRange.value[0],
      endDate: timeRange.value[1],
      busIds: topNodes.join(','),
    })
  } catch {
    trendData.value = null
  } finally {
    trendLoading.value = false
  }
}

watch(timeRange, () => { if (timeRange.value?.length === 2) loadTrend() })
watch(trendMetric, () => { if (trendData.value) loadTrend() })

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (voltageLevel.value) params.voltageLevel = voltageLevel.value
    if (region.value) params.region = region.value
    list.value = await fetchThreePhase(params) || []
    const zones = new Set<string>()
    list.value.forEach((n: any) => { if (n.zone) zones.add(n.zone) })
    regionOptions.value = ['', ...Array.from(zones).sort()]
    // 如果已选时间范围，自动加载趋势
    if (timeRange.value?.length === 2) loadTrend()
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadThresholds(); loadData() })
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">三相不平衡度</div>

    <el-tabs v-model="activeTab" @tab-change="loadData">
      <!-- ==================== Tab1: 三相不平衡度计算 ==================== -->
      <el-tab-pane label="三相不平衡度计算" name="calculation">
        <div class="filter-bar">
          <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:140px" @change="loadData">
            <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
          </el-select>
          <el-select v-model="region" placeholder="区域" clearable size="small" style="width:210px;margin-left:10px" @change="loadData">
            <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
          </el-select>
          <el-select v-model="physicalRole" placeholder="节点类型" clearable size="small" style="width:120px;margin-left:10px">
            <el-option v-for="p in physicalRoleOptions" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <div style="flex:1" />
          <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
        </div>

        <!-- 统计卡片 -->
        <div class="grid-3">
          <el-card shadow="hover" class="stat-mini">
            <div class="stat-mini-label">总节点数</div>
            <div class="stat-mini-val" style="color:#267F7B">{{ list.length }}</div>
          </el-card>
          <el-card shadow="hover" class="stat-mini" style="border-left:3px solid #F56C6C">
            <div class="stat-mini-label">严重不平衡 >2%</div>
            <div class="stat-mini-val" style="color:#F56C6C">{{ severeItems.length }}</div>
          </el-card>
          <el-card shadow="hover" class="stat-mini" style="border-left:3px solid #E6A23C">
            <div class="stat-mini-label">预警 (1%~2%)</div>
            <div class="stat-mini-val" style="color:#E6A23C">{{ warningItems.length }}</div>
          </el-card>
        </div>

        <!-- 台账表格 -->
        <div class="chart-panel">
          <div class="chart-panel-title">三相不平衡度台账</div>
          <el-table :data="filteredList" stripe size="small" v-loading="loading" max-height="450"
            :row-class-name="({ row }: any) => imbRowClass(row)">
            <el-table-column label="节点" min-width="120">
              <template #default="{ row }">{{ row.name || row.nodeId }}</template>
            </el-table-column>
            <el-table-column label="区域" width="60">
              <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
            </el-table-column>
            <el-table-column label="电压等级" width="80">
              <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
            </el-table-column>
            <el-table-column label="节点类型" width="75">
              <template #default="{ row }">
                <el-tag size="small" :type="row.physicalRole === 'PV' ? 'warning' : row.physicalRole === 'GENERATION' ? 'danger' : row.physicalRole === 'DISTRIBUTION' ? 'info' : ''">{{ physicalRoleOptions.find(p => p.value === row.physicalRole)?.label || row.physicalRole }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="不平衡度%" width="100">
              <template #default="{ row }">
                <span :style="{ fontWeight: 600, color: imbColor(row) }">
                  {{ row.imbalancePct.toFixed(2) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="A 相(kV)" width="85">
              <template #default="{ row }">{{ row.phaseA?.toFixed(4) || '-' }}</template>
            </el-table-column>
            <el-table-column label="B 相(kV)" width="85">
              <template #default="{ row }">{{ row.phaseB?.toFixed(4) || '-' }}</template>
            </el-table-column>
            <el-table-column label="C 相(kV)" width="85">
              <template #default="{ row }">{{ row.phaseC?.toFixed(4) || '-' }}</template>
            </el-table-column>
            <el-table-column label="相间最大差(kV)" width="120">
              <template #default="{ row }">
                <span v-if="row.phaseA != null && row.phaseB != null && row.phaseC != null" style="font-weight:600">
                  {{ (Math.max(row.phaseA, row.phaseB, row.phaseC) - Math.min(row.phaseA, row.phaseB, row.phaseC)).toFixed(4) }}
                </span>
                <span v-else style="color:#c0c4cc">-</span>
              </template>
            </el-table-column>
            <el-table-column label="电压不平衡度(%)" width="120">
              <template #default="{ row }">
                <span :style="{ fontWeight: 600, color: vufStatus(row.vuf ?? 0, row) === 'critical' ? '#F56C6C' : vufStatus(row.vuf ?? 0, row) === 'warning' ? '#E6A23C' : '#606266' }">{{ row.vuf != null ? row.vuf.toFixed(2) : '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="电流不平衡度(%)" width="120">
              <template #default="{ row }">
                <span :style="{ fontWeight: 600, color: cufStatus(row.cuf ?? 0, row) === 'critical' ? '#F56C6C' : cufStatus(row.cuf ?? 0, row) === 'warning' ? '#E6A23C' : '#606266' }">{{ row.cuf != null ? row.cuf.toFixed(2) : '-' }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ==================== Tab2: 三相幅值差异可视化展示 ==================== -->
      <el-tab-pane label="三相幅值差异可视化展示" name="visualization">
        <div class="filter-bar">
          <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:140px" @change="loadData">
            <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
          </el-select>
          <el-select v-model="region" placeholder="区域" clearable size="small" style="width:210px;margin-left:10px" @change="loadData">
            <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
          </el-select>
          <el-select v-model="physicalRole" placeholder="节点类型" clearable size="small" style="width:120px;margin-left:10px" @change="loadData">
            <el-option v-for="p in physicalRoleOptions" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <el-divider direction="vertical" />
          <span style="font-size:12px;color:#909399;margin-right:6px">分层：</span>
          <el-radio-group v-model="chartGroupBy" size="small">
            <el-radio-button value="zone">按区域</el-radio-button>
            <el-radio-button value="voltage">按电压等级</el-radio-button>
          </el-radio-group>
          <span style="font-size:12px;color:#909399;margin:0 6px 0 16px">显示：</span>
          <el-select v-model="chartTopN" size="small" style="width:100px">
            <el-option v-for="o in chartTopNOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <div style="flex:1" />
          <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
        </div>

        <div class="chart-panel">
          <div class="chart-panel-title">各节点三相电压幅值对比</div>
          <ChartContainer :option="threePhaseChartOption" :height="chartHeight" :loading="loading" />
          <div style="font-size:12px;color:#909399;margin-top:6px;padding:0 12px">
            <span style="display:inline-block;width:12px;height:12px;background:#F56C6C;margin-right:4px;border-radius:2px;vertical-align:middle" />
            A 相
            <span style="display:inline-block;width:12px;height:12px;background:#E6A23C;margin-right:4px;margin-left:16px;border-radius:2px;vertical-align:middle" />
            B 相
            <span style="display:inline-block;width:12px;height:12px;background:#267F7B;margin-right:4px;margin-left:16px;border-radius:2px;vertical-align:middle" />
            C 相
            <span style="margin:0 4px">|</span>
            <span style="color:#F56C6C">⚠ >2%</span>
            <span style="color:#E6A23C;margin-left:8px">⚡ 1~2%</span>
            <span style="margin-left:24px;color:#c0c4cc">按不平衡度降序排列，三色柱高差=三相幅值差异</span>
          </div>
        </div>

        <!-- 长期趋势 -->
        <div class="chart-panel" style="margin-top:16px">
          <div class="chart-panel-title">
            长期不平衡趋势
            <span style="font-weight:400;font-size:12px;color:#909399;margin-left:12px">
              时间段内不平衡度最高的节点趋势对比
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span style="font-size:12px;color:#909399">指标：</span>
            <el-radio-group v-model="trendMetric" size="small">
              <el-radio-button v-for="o in trendMetricOptions" :key="o.value" :value="o.value">{{ o.label }}</el-radio-button>
            </el-radio-group>
            <span style="font-size:12px;color:#909399;margin-left:16px">节点数：</span>
            <el-select v-model="trendNodeCount" size="small" style="width:80px" @change="loadTrend">
              <el-option :value="3" label="3" />
              <el-option :value="5" label="5" />
              <el-option :value="10" label="10" />
            </el-select>
            <div style="flex:1" />
            <el-date-picker
              v-model="timeRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="small"
              style="width:240px"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </div>
          <ChartContainer v-if="trendData?.nodes?.length" :option="trendChartOption" height="350px" :loading="trendLoading" />
          <div v-else-if="!timeRange?.length || timeRange.length < 2" style="padding:40px;text-align:center;color:#909399">
            请先选择时间范围查看趋势
          </div>
          <div v-else style="padding:40px;text-align:center;color:#909399">
            {{ trendLoading ? '加载中...' : '所选时间段内无趋势数据' }}
          </div>
        </div>
      </el-tab-pane>

      <!-- ==================== Tab3: 光伏接入导致的不平衡问题识别 ==================== -->
      <el-tab-pane label="光伏接入导致的不平衡问题识别" name="pv-issues">
        <div class="filter-bar">
          <el-select v-model="region" placeholder="区域" clearable size="small" style="width:210px" @change="loadData">
            <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
          </el-select>
          <div style="flex:1" />
          <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
        </div>

        <div class="chart-panel">
          <div class="chart-panel-title">光伏相关不平衡问题清单（{{ pvRelatedItems.length }} 个节点）</div>
          <el-table v-if="pvRelatedItems.length" :data="pvRelatedItems" stripe size="small" max-height="500"
            :row-class-name="({ row }: any) => imbRowClass(row)">
            <el-table-column label="节点" min-width="100">
              <template #default="{ row }">{{ row.name || row.nodeId }}</template>
            </el-table-column>
            <el-table-column label="所属台区" width="100">
              <template #default="{ row }">{{ row.transformerArea || row.zone || '-' }}</template>
            </el-table-column>
            <el-table-column label="电压等级" width="75">
              <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
            </el-table-column>
            <el-table-column label="光伏电站" min-width="110">
              <template #default="{ row }">{{ row.plantName || '-' }}</template>
            </el-table-column>
            <el-table-column label="装机(MW)" width="80">
              <template #default="{ row }">{{ row.installedCapacity != null ? row.installedCapacity : '-' }}</template>
            </el-table-column>
            <el-table-column label="负载类型" width="90">
              <template #default="{ row }">{{ row.loadType || '-' }}</template>
            </el-table-column>
            <el-table-column label="不平衡度" width="90" sortable prop="imbalancePct">
              <template #default="{ row }">
                <span :style="{ color: imbColor(row), fontWeight: 600 }">{{ row.imbalancePct.toFixed(2) }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="电压不平衡度(%)" width="100">
              <template #default="{ row }">
                <span :style="{ color: vufStatus(row.vuf ?? 0, row) === 'critical' ? '#F56C6C' : '#606266' }">{{ row.vuf?.toFixed(2) ?? '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="三相电流(A)" width="140">
              <template #default="{ row }">
                <span v-if="row.phaseACurrent != null" style="font-size:11px">
                  A{{ row.phaseACurrent?.toFixed(1) }} B{{ row.phaseBCurrent?.toFixed(1) }} C{{ row.phaseCCurrent?.toFixed(1) }}
                </span>
                <span v-else style="color:#c0c4cc">-</span>
              </template>
            </el-table-column>
            <el-table-column label="不平衡原因" min-width="200">
              <template #default="{ row }">
                <span :style="{ color: imbStatus(row) === 'critical' ? '#F56C6C' : imbStatus(row) === 'warning' ? '#E6A23C' : '#606266', fontSize: '12px' }">
                  {{ getImbalanceCause(row) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
          <div v-else style="padding:30px;text-align:center;color:#909399">无光伏关联不平衡节点</div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; margin-bottom:16px; padding:12px 16px; background:#fff; border-radius:8px; }
.grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:16px; }
.stat-mini { padding:8px 16px; }
.stat-mini-label { font-size:12px; color:#909399; margin-bottom:4px; }
.stat-mini-val { font-size:20px; font-weight:700; }
:deep(.critical-row) { background-color:#fef0f0 !important; }
:deep(.warning-row) { background-color:#fdf6ec !important; }
</style>
