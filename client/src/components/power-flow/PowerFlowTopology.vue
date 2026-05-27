<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { TrendCharts, Connection } from '@element-plus/icons-vue'

const props = defineProps<{
  nodes: any[]
  branches: any[]
}>()

const chartRef = ref<InstanceType<typeof ChartContainer> | null>(null)
const selectedNode = ref<any>(null)
const selectedEdge = ref<any>(null)
const detailVisible = ref(false)
const detailIsNode = ref(true)

// 固定布局坐标缓存，key 为 busId，只在拓扑结构变化时重新计算
const nodeCoords = ref<Record<string, { x: number; y: number }>>({})
// 记录上次拓扑指纹，用于判断是否需要重新布局
const lastTopoFingerprint = ref('')

// ==================== 固定布局算法 ====================
// 按电压等级纵向分层 + 区域内横向排列，模拟调度接线图
const VOLTAGE_LEVEL_ORDER = ['500kV', '220kV', '110kV', '35kV', '10kV', '6kV', '0.4kV']

function buildLayout() {
  const coords: Record<string, { x: number; y: number }> = {}
  const nodes = props.nodes
  if (nodes.length === 0) return coords

  // 按电压等级分组
  const byVoltage: Record<string, any[]> = {}
  for (const n of nodes) {
    const vl = n.voltageLevel || '10kV'
    if (!byVoltage[vl]) byVoltage[vl] = []
    byVoltage[vl].push(n)
  }

  // 按标准顺序排列电压等级
  const levels = VOLTAGE_LEVEL_ORDER.filter(l => byVoltage[l])
  // 加上未在标准顺序中的电压等级
  for (const l of Object.keys(byVoltage)) {
    if (!VOLTAGE_LEVEL_ORDER.includes(l)) levels.push(l)
  }

  const canvasWidth = Math.max(600, nodes.length * 80)
  const canvasHeight = Math.max(400, levels.length * 180)

  for (let li = 0; li < levels.length; li++) {
    const level = levels[li]
    const levelNodes = byVoltage[level]
    // Y: 等分纵向空间
    const y = canvasHeight * 0.1 + (li / Math.max(levels.length - 1, 1)) * canvasHeight * 0.8

    // 同一电压等级内按区域分组
    const zones = [...new Set(levelNodes.map(n => n.zone || '未知'))].sort()
    const zoneGroups: Record<string, any[]> = {}
    for (const z of zones) zoneGroups[z] = []
    for (const n of levelNodes) zoneGroups[n.zone || '未知'].push(n)

    // 横向排列各区域
    const zoneWidth = canvasWidth / Math.max(zones.length, 1)
    for (let zi = 0; zi < zones.length; zi++) {
      const zone = zones[zi]
      const zoneNodes = zoneGroups[zone]
      const cx = zoneWidth * (zi + 0.5)
      // 区域内节点纵向微调
      const spread = Math.min(60, zoneNodes.length * 30)
      for (let ni = 0; ni < zoneNodes.length; ni++) {
        const node = zoneNodes[ni]
        const offset = zoneNodes.length > 1 ? (ni - (zoneNodes.length - 1) / 2) * (spread / Math.max(zoneNodes.length - 1, 1)) : 0
        coords[node.busId] = {
          x: Math.round(cx + (Math.random() - 0.5) * 20),
          y: Math.round(y + offset),
        }
      }
    }
  }

  return coords
}

function getCoords(busId: string): { x?: number; y?: number } {
  const c = nodeCoords.value[busId]
  return c ? { x: c.x, y: c.y } : {}
}

// 拓扑指纹：busId 排序后拼接，拓扑变了才重新布局
const topoFingerprint = computed(() => {
  return props.nodes.map(n => n.busId).sort().join(',')
})

// 拓扑结构变化时重新计算布局
watch(topoFingerprint, (fp) => {
  if (fp && fp !== lastTopoFingerprint.value) {
    nodeCoords.value = buildLayout()
    lastTopoFingerprint.value = fp
  }
}, { immediate: true })

// ==================== 电压等级颜色映射 ====================
const VOLTAGE_COLORS: Record<string, string> = {
  '500kV': '#9B59B6',
  '220kV': '#5470C6',
  '110kV': '#91CC75',
  '35kV': '#FAC858',
  '10kV': '#EE6666',
  '6kV': '#73C0DE',
  '0.4kV': '#FC8452',
}
function voltageColor(level: string): string {
  return VOLTAGE_COLORS[level] || '#999999'
}

// ==================== 分类（按电压等级） ====================
const categories = computed(() => {
  const levels = [...new Set(props.nodes.map((n: any) => n.voltageLevel))].sort().reverse()
  return levels.map((vl: string) => ({ name: vl, itemStyle: { color: voltageColor(vl) } }))
})

function categoryIndex(node: any): number {
  return categories.value.findIndex((c: any) => c.name === node.voltageLevel)
}

// ==================== 边样式 ====================
function edgeColor(b: any): string {
  if ((b.pFromMw || 0) < 0) return '#F56C6C'
  const pct = b.loadingPct || 0
  if (pct >= 100) return '#FF4444'
  if (pct >= 80) return '#E6A23C'
  if (pct >= 50) return '#FAC858'
  return '#67C23A'
}

// ==================== Tooltip ====================
function nodeTooltip(d: any): string {
  const kv = (d.voltagePu * d.baseKv).toFixed(2)
  const lines = [
    `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${d.name}  /  ${d.voltageLevel}</div>`,
    `<div>电压: ${d.voltagePu.toFixed(4)} p.u.  |  ${kv} kV</div>`,
    `<div>相角: ${d.angleDeg.toFixed(2)}°  |  类型: ${d.busType}</div>`,
    `<hr style="margin:4px 0;border:none;border-top:1px solid #e0e0e0">`,
    `<div>发电: P=${d.pgMw.toFixed(2)} MW  Q=${(d.qgMvar || 0).toFixed(2)} Mvar</div>`,
    `<div>负荷: P=${d.pdMw.toFixed(2)} MW  Q=${(d.qdMvar || 0).toFixed(2)} Mvar</div>`,
    `<hr style="margin:4px 0;border:none;border-top:1px solid #e0e0e0">`,
    `<div>稳定裕度: ${(d.stabilityMargin * 100).toFixed(1)}%</div>`,
  ]
  if (d.isWeakNode) lines.push(`<div style="color:#F56C6C;font-weight:700;margin-top:2px">⚠ 薄弱节点</div>`)
  return lines.join('')
}

function edgeTooltip(d: any): string {
  const lines = [
    `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${d.fromBusName}  →  ${d.toBusName}</div>`,
    `<div>类型: ${d.branchType}  |  ${d.voltageLevel}</div>`,
    `<hr style="margin:4px 0;border:none;border-top:1px solid #e0e0e0">`,
    `<div>首端: P=${d.pFromMw.toFixed(2)} MW  Q=${(d.qFromMvar || 0).toFixed(2)} Mvar</div>`,
    `<div>末端: P=${d.pToMw.toFixed(2)} MW  Q=${(d.qToMvar || 0).toFixed(2)} Mvar</div>`,
    `<hr style="margin:4px 0;border:none;border-top:1px solid #e0e0e0">`,
    `<div>线损: ${(d.lossMw || 0).toFixed(3)} MW  (${(d.lossPercent || 0).toFixed(2)}%)</div>`,
    `<div>负载率: ${(d.loadingPct || 0).toFixed(1)}%</div>`,
  ]
  if (d.isOverloaded) lines.push(`<div style="color:#F56C6C;font-weight:700;margin-top:2px">⚠ 过载</div>`)
  return lines.join('')
}

function tooltipFormatter(params: any): string {
  if (params.dataType === 'edge') return edgeTooltip(params.data)
  if (params.dataType === 'node') return nodeTooltip(params.data)
  return ''
}

// ==================== ECharts Option ====================
const graphOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: tooltipFormatter,
    extraCssText: 'max-width:360px;white-space:nowrap',
  },
  legend: [{
    data: categories.value.map((c: any) => c.name),
    top: 0,
    left: 'center',
    textStyle: { fontSize: 11 },
    icon: 'circle',
  }],
  series: [{
    type: 'graph',
    layout: 'none',
    roam: true,
    draggable: true,
    symbolSize: 50,

    data: props.nodes.map((n: any) => {
      const coords = getCoords(n.busId)
      return {
      id: n.busId,
      name: n.name,
      value: n.voltagePu,
      category: categoryIndex(n),
      symbolSize: 30,
      x: coords.x ?? 0,
      y: coords.y ?? 0,
      itemStyle: {
        color: voltageColor(n.voltageLevel),
        ...(n.isWeakNode ? { borderColor: '#F56C6C', borderWidth: 3 } : {}),
      },
      busId: n.busId,
      zone: n.zone,
      voltageLevel: n.voltageLevel,
      baseKv: n.baseKv,
      busType: n.busType,
      voltagePu: n.voltagePu,
      angleDeg: n.angleDeg,
      pgMw: n.pgMw,
      qgMvar: n.qgMvar,
      pdMw: n.pdMw,
      qdMvar: n.qdMvar,
      stabilityMargin: n.stabilityMargin,
      isWeakNode: n.isWeakNode,
      }
    }),

    links: props.branches.map((b: any) => ({
      source: b.fromBus,
      target: b.toBus,
      value: b.loadingPct,
      lineStyle: {
        width: 1.5,
        color: edgeColor(b),
        curveness: 0.2,
        opacity: 0.9,
      },
      edgeSymbol: (b.pFromMw || 0) >= 0 ? ['none', 'arrow'] : ['arrow', 'none'],
      edgeSymbolSize: (b.pFromMw || 0) < 0 ? [12, 12] : [8, 8],
      branchId: b.branchId,
      fromBus: b.fromBus,
      toBus: b.toBus,
      fromBusName: b.fromBusName,
      toBusName: b.toBusName,
      branchType: b.branchType,
      voltageLevel: b.voltageLevel,
      pFromMw: b.pFromMw,
      qFromMvar: b.qFromMvar,
      pToMw: b.pToMw,
      qToMvar: b.qToMvar,
      lossMw: b.lossMw,
      lossPercent: b.lossPercent,
      loadingPct: b.loadingPct,
      isOverloaded: b.isOverloaded,
      ampacityMva: b.ampacityMva,
    })),

    categories: categories.value,

    label: {
      show: true,
      position: 'right',
      fontSize: 11,
      formatter: '{b}',
    },

    emphasis: {
      focus: 'adjacency',
      lineStyle: { width: 4 },
    },
    blur: {
      opacity: 0.25,
      lineStyle: { opacity: 0.15 },
    },
  }],
}))

// ==================== Click Handler ====================
function saveDraggedCoords() {
  const vchart = chartRef.value?.chartRef
  const chartInstance = (vchart as any)?.chart
  if (!chartInstance) return
  try {
    const option = chartInstance.getOption()
    const seriesData = option?.series?.[0]?.data
    if (!seriesData) return
    for (const item of seriesData) {
      if (item.x != null && item.y != null && item.id) {
        const prev = nodeCoords.value[item.id]
        if (!prev || prev.x !== item.x || prev.y !== item.y) {
          nodeCoords.value[item.id] = { x: item.x, y: item.y }
        }
      }
    }
  } catch { /* ignore */ }
}

onMounted(async () => {
  await nextTick()
  await nextTick()
  const vchart = chartRef.value?.chartRef
  const chartInstance = (vchart as any)?.chart
  if (!chartInstance) return
  chartInstance.on('click', (params: any) => {
    if (params.dataType === 'node') {
      selectedNode.value = params.data
      detailIsNode.value = true
      detailVisible.value = true
    } else if (params.dataType === 'edge') {
      selectedEdge.value = params.data
      detailIsNode.value = false
      detailVisible.value = true
    }
  })
  chartInstance.on('mouseup', () => {
    setTimeout(() => saveDraggedCoords(), 50)
  })
})

watch(() => [props.nodes, props.branches], () => {
  detailVisible.value = false
  selectedNode.value = null
  selectedEdge.value = null
})
</script>

<template>
  <div class="topology-container">
    <ChartContainer
      ref="chartRef"
      :option="graphOption"
      :height="`${Math.min(500, Math.max(400, nodes.length * 30))}px`"
    />
    <div class="topology-hint">拖拽节点调整布局 · 滚轮缩放 · 悬浮查看详情 · 点击查看完整数据</div>
  </div>

  <!-- 节点详情抽屉 -->
  <el-drawer
    v-model="detailVisible"
    :title="detailIsNode ? `${selectedNode?.name}（${selectedNode?.voltageLevel}）` : `${selectedEdge?.fromBusName} → ${selectedEdge?.toBusName}`"
    size="380px"
    direction="rtl"
  >
    <template v-if="detailIsNode && selectedNode">
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon color="#267F7B"><TrendCharts /></el-icon>
          基本信息
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="节点ID">{{ selectedNode.busId }}</el-descriptions-item>
          <el-descriptions-item label="区域">{{ selectedNode.zone }}</el-descriptions-item>
          <el-descriptions-item label="电压等级">{{ selectedNode.voltageLevel }}</el-descriptions-item>
          <el-descriptions-item label="基准电压">{{ selectedNode.baseKv }} kV</el-descriptions-item>
          <el-descriptions-item label="节点类型">{{ selectedNode.busType }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon color="#E6A23C"><TrendCharts /></el-icon>
          电压 / 相角
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="实际电压">
            <span class="value-primary">{{ (selectedNode.voltagePu * selectedNode.baseKv).toFixed(2) }} kV</span>
          </el-descriptions-item>
          <el-descriptions-item label="标幺电压">{{ selectedNode.voltagePu.toFixed(4) }} p.u.</el-descriptions-item>
          <el-descriptions-item label="相角">{{ selectedNode.angleDeg.toFixed(2) }}°</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon color="#67C23A"><Connection /></el-icon>
          功率
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="有功发电">
            <span class="value-success">{{ selectedNode.pgMw.toFixed(2) }} MW</span>
          </el-descriptions-item>
          <el-descriptions-item label="无功发电">
            <span class="value-success">{{ (selectedNode.qgMvar || 0).toFixed(2) }} Mvar</span>
          </el-descriptions-item>
          <el-descriptions-item label="有功负荷">
            <span class="value-danger">{{ selectedNode.pdMw.toFixed(2) }} MW</span>
          </el-descriptions-item>
          <el-descriptions-item label="无功负荷">
            <span class="value-danger">{{ (selectedNode.qdMvar || 0).toFixed(2) }} Mvar</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon color="#F56C6C"><TrendCharts /></el-icon>
          安全评估
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="稳定裕度">
            <el-tag :type="selectedNode.stabilityMargin < 0.9 ? 'danger' : 'success'" size="small">
              {{ (selectedNode.stabilityMargin * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="薄弱节点">
            <el-tag v-if="selectedNode.isWeakNode" type="danger" size="small">是</el-tag>
            <span v-else class="null-value">否</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </template>

    <template v-if="!detailIsNode && selectedEdge">
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon color="#267F7B"><Connection /></el-icon>
          支路信息
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="支路ID">{{ selectedEdge.branchId }}</el-descriptions-item>
          <el-descriptions-item label="首端节点">
            <span style="font-weight:600">{{ selectedEdge.fromBusName }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="末端节点">
            <span style="font-weight:600">{{ selectedEdge.toBusName }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="类型">{{ selectedEdge.branchType }}</el-descriptions-item>
          <el-descriptions-item label="电压等级">{{ selectedEdge.voltageLevel }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon :color="selectedEdge.pFromMw < 0 ? '#F56C6C' : '#67C23A'"><TrendCharts /></el-icon>
          潮流
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="潮流方向">
            <el-tag :type="selectedEdge.pFromMw < 0 ? 'danger' : 'success'" size="small">
              {{ selectedEdge.pFromMw < 0 ? '反向' : '正向' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="首端有功">{{ selectedEdge.pFromMw.toFixed(2) }} MW</el-descriptions-item>
          <el-descriptions-item label="首端无功">{{ (selectedEdge.qFromMvar || 0).toFixed(2) }} Mvar</el-descriptions-item>
          <el-descriptions-item label="末端有功">{{ selectedEdge.pToMw.toFixed(2) }} MW</el-descriptions-item>
          <el-descriptions-item label="末端无功">{{ (selectedEdge.qToMvar || 0).toFixed(2) }} Mvar</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">
          <el-icon color="#E6A23C"><TrendCharts /></el-icon>
          网损 / 负载
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="线损">
            <span class="value-warning">{{ (selectedEdge.lossMw || 0).toFixed(3) }} MW</span>
          </el-descriptions-item>
          <el-descriptions-item label="线损率">{{ (selectedEdge.lossPercent || 0).toFixed(2) }}%</el-descriptions-item>
          <el-descriptions-item label="负载率">
            <el-tag :type="selectedEdge.isOverloaded ? 'danger' : selectedEdge.loadingPct > 80 ? 'warning' : 'success'" size="small">
              {{ (selectedEdge.loadingPct || 0).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="过载">
            <el-tag v-if="selectedEdge.isOverloaded" type="danger" size="small">是</el-tag>
            <span v-else class="null-value">否</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.topology-container {
  position: relative;
}
.topology-hint {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
.detail-section {
  margin-bottom: 20px;
}
.detail-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.value-primary { color: #267F7B; font-weight: 600; }
.value-success { color: #67C23A; font-weight: 600; }
.value-danger { color: #F56C6C; font-weight: 600; }
.value-warning { color: #E6A23C; font-weight: 600; }
.null-value { color: #dcdfe6; }
</style>
