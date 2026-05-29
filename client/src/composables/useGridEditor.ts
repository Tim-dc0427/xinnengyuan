import { ref, shallowRef, onBeforeUnmount, type Ref } from 'vue'
import { Graph, Shape, History, Selection, Keyboard, Clipboard, Scroller, Snapline } from '@antv/x6'
import type { ScenarioTopology, TopoNodeState, TopoEdgeState } from '@new-energy/shared'

const NODE_COLORS: Record<string, string> = {
  SOURCE: '#67C23A',
  GRID: '#267F7B',
  LOAD: '#F56C6C',
  STORAGE: '#E6A23C',
}

const NODE_LABELS: Record<string, string> = {
  SOURCE: '源',
  GRID: '网',
  LOAD: '荷',
  STORAGE: '储',
}

function makeNodeId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
function makeEdgeId() {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 注册自定义节点形状（每种类型一个）——x6需要在Graph创建前注册
let _registered = false
function registerCustomNodes() {
  if (_registered) return
  _registered = true
  const types = ['SOURCE', 'GRID', 'LOAD', 'STORAGE'] as const
  for (const t of types) {
    const c = NODE_COLORS[t]
    const l = NODE_LABELS[t]
    Graph.registerNode(`node-${t.toLowerCase()}`, {
      inherit: 'rect',
      width: 140,
      height: 56,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'badge' },
        { tagName: 'text', selector: 'badgeLabel' },
        { tagName: 'text', selector: 'nameLabel' },
        { tagName: 'text', selector: 'subLabel' },
      ],
      attrs: {
        body: {
          refWidth: '100%', refHeight: '100%',
          fill: '#fff', stroke: c, strokeWidth: 2,
          rx: 6, ry: 6,
        },
        badge: {
          x: 0, y: 0, width: 32, height: 28,
          fill: c, rx: 4, ry: 4,
          refX: 8, refY: 6,
        },
        badgeLabel: {
          text: l, fontSize: 12, fontWeight: 'bold',
          fill: '#fff', textAnchor: 'middle',
          refX: 24, refY: 22,
        },
        nameLabel: {
          text: '', fontSize: 13, fontWeight: 600,
          fill: '#303133', textAnchor: 'start',
          refX: 48, refY: 22,
        },
        subLabel: {
          text: '', fontSize: 10, fill: '#909399',
          textAnchor: 'start', refX: 48, refY: 40,
        },
      },
      ports: {
        groups: {
          top: { position: { name: 'top' }, attrs: { circle: { r: 5, magnet: true, stroke: c, strokeWidth: 1.5, fill: '#fff' } } },
          bottom: { position: { name: 'bottom' }, attrs: { circle: { r: 5, magnet: true, stroke: c, strokeWidth: 1.5, fill: '#fff' } } },
          left: { position: { name: 'left' }, attrs: { circle: { r: 5, magnet: true, stroke: c, strokeWidth: 1.5, fill: '#fff' } } },
          right: { position: { name: 'right' }, attrs: { circle: { r: 5, magnet: true, stroke: c, strokeWidth: 1.5, fill: '#fff' } } },
        },
        items: [
          { group: 'top' },
          { group: 'bottom' },
          { group: 'left' },
          { group: 'right' },
        ],
      },
    })
  }
}

export function useGridEditor(containerRef: Ref<HTMLElement | undefined>) {
  const graph = shallowRef<Graph | null>(null)
  const topology = ref<ScenarioTopology>({ nodes: [], edges: [], topologyVersion: 1 })
  const selectedNodeId = ref<string | null>(null)
  const selectedEdgeId = ref<string | null>(null)
  const editNodeId = ref<string | null>(null)
  const editEdgeId = ref<string | null>(null)
  // 右键菜单
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuType = ref<'node' | 'edge' | null>(null)
  const contextMenuTargetId = ref<string | null>(null)
  const canUndo = ref(false)
  const canRedo = ref(false)

  registerCustomNodes()

  function initGraph() {
    if (!containerRef.value) return
    const g = new Graph({
      container: containerRef.value,
      autoResize: true,
      grid: { visible: true, size: 10, type: 'dot', args: { color: '#e0e0e0', thickness: 1 } },
      connecting: {
        snap: { radius: 20 },
        allowBlank: false,
        allowLoop: false,
        connector: { name: 'smooth' },
        createEdge() {
          return new Shape.Edge({
            attrs: {
              line: { stroke: '#909399', strokeWidth: 2, targetMarker: { name: 'block', width: 10, height: 6 } },
            },
          })
        },
      },
      mousewheel: { enabled: true, zoomAtMousePosition: true },
    })

    g.use(new History({ enabled: true, ignoreAdd: false }))
    g.use(new Selection({ enabled: true, multiple: true, rubberband: true, movable: true }))
    g.use(new Keyboard({ enabled: true }))
    g.use(new Clipboard({ enabled: true }))
    g.use(new Scroller({ enabled: true, pageVisible: false, autoResize: true }))
    g.use(new Snapline({ enabled: true, sharp: true }))

    // 历史状态跟踪
    g.on('history:change', () => {
      canUndo.value = g.canUndo()
      canRedo.value = g.canRedo()
    })

    // 左键选中
    g.on('node:click', ({ node }) => {
      selectedNodeId.value = (node as any).id
      selectedEdgeId.value = null
    })
    g.on('edge:click', ({ edge }) => {
      selectedEdgeId.value = (edge as any).id
      selectedNodeId.value = null
    })
    g.on('blank:click', () => {
      selectedNodeId.value = null
      selectedEdgeId.value = null
    })

    // 右键弹出菜单
    g.on('node:contextmenu', ({ node, e }: any) => {
      e.preventDefault()
      contextMenuType.value = 'node'
      contextMenuTargetId.value = (node as any).id
      contextMenuX.value = e.pageX
      contextMenuY.value = e.pageY
      contextMenuVisible.value = true
    })
    g.on('edge:contextmenu', ({ edge, e }: any) => {
      e.preventDefault()
      contextMenuType.value = 'edge'
      contextMenuTargetId.value = (edge as any).id
      contextMenuX.value = e.pageX
      contextMenuY.value = e.pageY
      contextMenuVisible.value = true
    })
    g.on('blank:contextmenu', ({ e }: any) => {
      contextMenuVisible.value = false
    })
    g.on('blank:click', () => {
      contextMenuVisible.value = false
    })

    // 边连接完成
    g.on('edge:connected', ({ edge, isNew }) => {
      if (!isNew) return
      const sourceId = edge.getSourceCellId()
      const targetId = edge.getTargetCellId()
      if (!sourceId || !targetId) return
      const eid = makeEdgeId()
      ;(edge as any).id = eid
      const topoEdge: TopoEdgeState = {
        id: eid,
        sourceId: String(sourceId),
        targetId: String(targetId),
        edgeType: 'PHYSICAL',
        flowDirection: 'FORWARD',
      }
      topology.value = {
        ...topology.value,
        edges: [...topology.value.edges, topoEdge],
      }
    })

    // 节点/边删除时同步数据
    g.on('node:removed', ({ node }) => {
      const nid = (node as any).id as string
      topology.value = {
        ...topology.value,
        nodes: topology.value.nodes.filter((n: TopoNodeState) => n.id !== nid),
        edges: topology.value.edges.filter((e: TopoEdgeState) => e.sourceId !== nid && e.targetId !== nid),
      }
    })
    g.on('edge:removed', ({ edge }) => {
      const eid = (edge as any).id as string
      topology.value = {
        ...topology.value,
        edges: topology.value.edges.filter((e: TopoEdgeState) => e.id !== eid),
      }
    })

    // 节点移动同步坐标
    g.on('node:moved', ({ node }) => {
      const nid = (node as any).id as string
      const pos = node.getPosition()
      const idx = topology.value.nodes.findIndex((n: TopoNodeState) => n.id === nid)
      if (idx >= 0) {
        const nodes = [...topology.value.nodes]
        nodes[idx] = { ...nodes[idx], x: pos.x, y: pos.y }
        topology.value = { ...topology.value, nodes }
      }
    })

    graph.value = g
  }

  function addNode(nodeType: string, realNode?: any) {
    if (!graph.value) return
    const id = makeNodeId()
    const color = NODE_COLORS[nodeType] || '#267F7B'
    const gapX = Object.keys(NODE_COLORS).indexOf(nodeType) * 20
    const posX = 200 + topology.value.nodes.length * 30 + gapX
    const posY = 150 + (topology.value.nodes.length % 4) * 100

    const nodeName = realNode?.node_name || realNode?.name || '未命名'
    const voltageLevel = realNode?.voltage_level || realNode?.voltageLevel || ''
    const capacity = realNode?.capacity_kw || realNode?.connectedCapacity || 0
    const subText = voltageLevel ? `${voltageLevel}kV` : (capacity > 0 ? `${capacity}kW` : '')

    const node = graph.value.addNode({
      id,
      shape: `node-${nodeType.toLowerCase()}`,
      x: posX,
      y: posY,
      attrs: {
        body: { stroke: color },
        badge: { fill: color },
        badgeLabel: { text: NODE_LABELS[nodeType] || nodeType },
        nameLabel: { text: nodeName.length > 8 ? nodeName.slice(0, 7) + '…' : nodeName },
        subLabel: { text: subText },
      },
    })

    const topoNode: TopoNodeState = {
      id,
      nodeType: nodeType as any,
      nodeId: realNode?.node_id || realNode?.id || undefined,
      nodeName,
      voltageLevel: voltageLevel || undefined,
      connectedCapacity: capacity > 0 ? capacity : undefined,
      x: posX,
      y: posY,
      params: getDefaultParams(nodeType),
    }

    topology.value = {
      ...topology.value,
      nodes: [...topology.value.nodes, topoNode],
    }
    return topoNode
  }

  function removeSelected() {
    if (!graph.value) return
    const cells = graph.value.getSelectedCells()
    if (cells.length) {
      graph.value.removeCells(cells)
      selectedNodeId.value = null
      selectedEdgeId.value = null
    }
  }

  function undo() { graph.value?.undo() }
  function redo() { graph.value?.redo() }
  function zoomIn() { graph.value?.zoom(0.1) }
  function zoomOut() { graph.value?.zoom(-0.1) }
  function fitToContent() { graph.value?.zoomToFit({ padding: 40 }) }

  function loadFromConfig(config: any) {
    if (!graph.value) return
    graph.value.cleanHistory()
    graph.value.resetCells([])

    let nodes: TopoNodeState[] = []
    let edges: TopoEdgeState[] = []

    if (config.topology && config.topology.nodes?.length) {
      nodes = config.topology.nodes
      edges = config.topology.edges || []
    } else if (config.accessPoints?.length) {
      // 从旧 accessPoints 自动生成拓扑
      nodes = config.accessPoints.map((ap: any, i: number) => ({
        id: makeNodeId(),
        nodeType: ap.nodeType || 'GRID',
        nodeId: ap.nodeId || undefined,
        nodeName: ap.nodeName || '未命名',
        voltageLevel: ap.voltageLevel ? `${ap.voltageLevel}kV` : undefined,
        connectedCapacity: ap.connectedCapacity || undefined,
        x: 200 + (i % 4) * 200,
        y: 150 + Math.floor(i / 4) * 150,
        params: ap.params || {},
      }))
    }

    topology.value = { nodes: [...nodes], edges: [...edges], topologyVersion: 1 }

    // 渲染到画布
    for (const n of nodes) {
      const color = NODE_COLORS[n.nodeType] || '#267F7B'
      const subText = n.voltageLevel || (n.connectedCapacity ? `${n.connectedCapacity}kW` : '')
      graph.value.addNode({
        id: n.id,
        shape: `node-${n.nodeType.toLowerCase()}`,
        x: n.x, y: n.y,
        attrs: {
          body: { stroke: color },
          badge: { fill: color },
          badgeLabel: { text: NODE_LABELS[n.nodeType] || n.nodeType },
          nameLabel: { text: n.nodeName.length > 8 ? n.nodeName.slice(0, 7) + '…' : n.nodeName },
          subLabel: { text: subText },
        },
      })
    }
    for (const e of edges) {
      const ec = graph.value.addEdge({
        id: e.id,
        source: { cell: e.sourceId },
        target: { cell: e.targetId },
        attrs: {
          line: { stroke: '#909399', strokeWidth: 2, targetMarker: { name: 'block', width: 10, height: 6 } },
        },
      })
      if (!ec) {
        topology.value = {
          ...topology.value,
          edges: topology.value.edges.filter((ee: TopoEdgeState) => ee.id !== e.id),
        }
      }
    }

    graph.value.centerContent()
  }

  function syncToAccessPoints(): any[] {
    return topology.value.nodes.map((n: TopoNodeState) => ({
      nodeType: n.nodeType,
      nodeId: n.nodeId || '',
      nodeName: n.nodeName,
      connectedCapacity: n.connectedCapacity || 0,
      voltageLevel: parseInt((n.voltageLevel || '110').replace('kV', ''), 10) || 110,
      connectionType: 'AC',
      params: n.params || getDefaultParams(n.nodeType),
    }))
  }

  function getSelectedNode(): TopoNodeState | null {
    if (!selectedNodeId.value) return null
    return topology.value.nodes.find((n: TopoNodeState) => n.id === selectedNodeId.value) || null
  }

  function getSelectedEdge(): TopoEdgeState | null {
    if (!selectedEdgeId.value) return null
    return topology.value.edges.find((e: TopoEdgeState) => e.id === selectedEdgeId.value) || null
  }

  function updateNode(id: string, changes: Partial<TopoNodeState>) {
    const idx = topology.value.nodes.findIndex((n: TopoNodeState) => n.id === id)
    if (idx < 0) return
    const nodes = [...topology.value.nodes]
    nodes[idx] = { ...nodes[idx], ...changes }
    topology.value = { ...topology.value, nodes }

    // 同步更新画布上的标签
    const cell = graph.value?.getCellById(id)
    if (cell && cell.isNode()) {
      const node = cell as any
      const subText = nodes[idx].voltageLevel || (nodes[idx].connectedCapacity ? `${nodes[idx].connectedCapacity}kW` : '')
      node.setAttrs({
        nameLabel: { text: nodes[idx].nodeName.length > 8 ? nodes[idx].nodeName.slice(0, 7) + '…' : nodes[idx].nodeName },
        subLabel: { text: subText },
      })
    }
  }

  function updateEdge(id: string, changes: Partial<TopoEdgeState>) {
    const idx = topology.value.edges.findIndex((e: TopoEdgeState) => e.id === id)
    if (idx < 0) return
    const edges = [...topology.value.edges]
    edges[idx] = { ...edges[idx], ...changes }
    topology.value = { ...topology.value, edges }
  }

  function dispose() {
    graph.value?.dispose()
    graph.value = null
  }

  function getNodeName(nid: string): string {
    return topology.value.nodes.find((n: TopoNodeState) => n.id === nid)?.nodeName || '?'
  }

  function closeContextMenu() {
    contextMenuVisible.value = false
  }

  function contextEdit() {
    if (contextMenuType.value === 'node') {
      editNodeId.value = contextMenuTargetId.value
      editEdgeId.value = null
    } else if (contextMenuType.value === 'edge') {
      editEdgeId.value = contextMenuTargetId.value
      editNodeId.value = null
    }
    contextMenuVisible.value = false
  }

  function contextDelete() {
    const cell = graph.value?.getCellById(contextMenuTargetId.value || '')
    if (cell) {
      graph.value?.removeCell(cell)
    }
    contextMenuVisible.value = false
  }

  function getEditNode(): TopoNodeState | null {
    if (!editNodeId.value) return null
    return topology.value.nodes.find((n: TopoNodeState) => n.id === editNodeId.value) || null
  }

  function getEditEdge(): TopoEdgeState | null {
    if (!editEdgeId.value) return null
    return topology.value.edges.find((e: TopoEdgeState) => e.id === editEdgeId.value) || null
  }

  onBeforeUnmount(dispose)

  return {
    graph, topology, selectedNodeId, selectedEdgeId,
    editNodeId, editEdgeId,
    contextMenuVisible, contextMenuX, contextMenuY, contextMenuType,
    canUndo, canRedo,
    initGraph, addNode, removeSelected, undo, redo, zoomIn, zoomOut, fitToContent,
    loadFromConfig, syncToAccessPoints,
    getSelectedNode, getSelectedEdge, updateNode, updateEdge,
    getEditNode, getEditEdge,
    closeContextMenu, contextEdit, contextDelete,
    dispose, getNodeName,
  }
}

function getDefaultParams(nodeType: string): Record<string, any> {
  switch (nodeType) {
    case 'SOURCE': return { outputUpperLimit: 95, outputLowerLimit: 10, powerFactor: 0.95, regulationDelay: 30 }
    case 'GRID': return { tapRegulation: true, reactiveCompensation: true }
    case 'LOAD': return { peakClippingRate: 15, valleyFillingRate: 12, interruptibleLoadRatio: 5 }
    case 'STORAGE': return { chargeSchedule: '00:00-06:00', dischargeSchedule: '10:00-12:00,18:00-21:00', socUpper: 90, socLower: 20, ratedPowerKw: 5000, ratedCapacityKwh: 10000 }
    default: return {}
  }
}
