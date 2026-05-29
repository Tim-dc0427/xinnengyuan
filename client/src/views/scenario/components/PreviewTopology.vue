<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { Graph, Shape } from '@antv/x6'
import type { ScenarioTopology } from '@new-energy/shared'

const props = defineProps<{
  topology: ScenarioTopology
  liveMetrics?: Record<string, { voltage: number; loadRate: number }>
}>()

const NODE_COLORS: Record<string, string> = {
  SOURCE: '#67C23A', GRID: '#267F7B', LOAD: '#F56C6C', STORAGE: '#E6A23C',
}

const containerRef = ref<HTMLElement>()
let graph: Graph | null = null

onMounted(async () => {
  await nextTick()
  if (!containerRef.value) return

  graph = new Graph({
    container: containerRef.value,
    width: containerRef.value.clientWidth,
    height: 320,
    grid: { visible: true, size: 10, type: 'dot', args: { color: '#e0e0e0', thickness: 1 } },
    interacting: { nodeMovable: false, edgeMovable: false },
    connecting: { allowBlank: false, allowLoop: false, allowNode: false, allowEdge: false },
    mousewheel: { enabled: true, zoomAtMousePosition: true, minScale: 0.3, maxScale: 3 },
  })

  renderTopology()
})

function getNodeColor(n: any): string {
  const baseColor = NODE_COLORS[n.nodeType] || '#267F7B'
  const metrics = props.liveMetrics?.[n.nodeName]
  if (!metrics) return baseColor
  // 电压越限 → 红色边框
  if (metrics.voltage > 1.07 || metrics.voltage < 0.93) return '#F56C6C'
  if (metrics.voltage > 1.05 || metrics.voltage < 0.95) return '#E6A23C'
  return baseColor
}

function getEdgeColor(e: any): string {
  // 从 sourceId + targetId 拼出 edgeName 查 liveMetrics
  const srcNode = props.topology.nodes.find((n: any) => n.id === e.sourceId)
  const tgtNode = props.topology.nodes.find((n: any) => n.id === e.targetId)
  const edgeName = `${srcNode?.nodeName || '?'}-${tgtNode?.nodeName || '?'}`
  const metrics = props.liveMetrics?.[edgeName]
  if (!metrics) return '#909399'
  if (metrics.loadRate > 90) return '#F56C6C'
  if (metrics.loadRate > 70) return '#E6A23C'
  if (metrics.loadRate > 50) return '#FAC858'
  return '#67C23A'
}

function renderTopology() {
  if (!graph) return
  graph.resetCells([])

  for (const n of props.topology.nodes) {
    const color = getNodeColor(n)
    const strokeWidth = props.liveMetrics?.[n.nodeName] ? 3 : 2
    graph.addNode({
      id: n.id,
      shape: 'rect',
      x: n.x, y: n.y,
      width: 140, height: 56,
      attrs: {
        body: { fill: '#fff', stroke: color, strokeWidth, rx: 6, ry: 6 },
        label: {
          text: n.nodeName,
          fontSize: 12, fill: '#303133',
          textAnchor: 'middle',
          refX: 70, refY: 22,
        },
      },
    })
  }
  for (const e of props.topology.edges) {
    const ec = getEdgeColor(e)
    graph.addEdge({
      id: e.id,
      source: { cell: e.sourceId },
      target: { cell: e.targetId },
      attrs: { line: { stroke: ec, strokeWidth: 2, targetMarker: { name: 'block', width: 8, height: 5 } } },
    })
  }
  if (props.topology.nodes.length > 0) {
    graph.centerContent()
  }
}

function zoomIn() { graph?.zoom(0.2) }
function zoomOut() { graph?.zoom(-0.2) }
function fitToContent() { graph?.zoomToFit({ padding: 20 }) }

onBeforeUnmount(() => {
  graph?.dispose()
  graph = null
})
</script>

<template>
  <div>
    <div style="display:flex;gap:2px;margin-bottom:4px">
      <el-button size="small" @click="zoomIn()">放大</el-button>
      <el-button size="small" @click="zoomOut()">缩小</el-button>
      <el-button size="small" @click="fitToContent()">适应</el-button>
    </div>
    <div ref="containerRef" style="width:100%;height:320px;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden" />
  </div>
</template>
