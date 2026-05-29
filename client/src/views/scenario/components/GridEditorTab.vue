<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useGridEditor } from '@/composables/useGridEditor'
import type { ScenarioTopology, TopoNodeState, TopoEdgeState } from '@new-energy/shared'

const props = defineProps<{
  config: any
  nodesByType: Record<string, any[]>
}>()

const emit = defineEmits<{
  'update:topology': [value: ScenarioTopology]
}>()

const NODE_TYPES = [
  { value: 'SOURCE', label: '源(光伏电站)', color: '#67C23A' },
  { value: 'GRID', label: '网(母线)', color: '#267F7B' },
  { value: 'LOAD', label: '荷(负荷)', color: '#F56C6C' },
  { value: 'STORAGE', label: '储(储能)', color: '#E6A23C' },
]

const containerRef = ref<HTMLElement>()!

const {
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
} = useGridEditor(containerRef)

watch(topology, (val) => {
  emit('update:topology', val)
}, { deep: true })

onMounted(async () => {
  await nextTick()
  initGraph()
  loadFromConfig(props.config || {})
})

function getNodesByType(type: string) {
  return props.nodesByType[type] || []
}

function handleAddNode(nodeType: string, realNode?: any) {
  addNode(nodeType, realNode)
}

function handleRemoveSelected() {
  removeSelected()
}

// 编辑抽屉
const drawerVisible = ref(false)
const editingNode = ref<TopoNodeState | null>(null)
const editingEdge = ref<TopoEdgeState | null>(null)

const drawerTitle = computed(() => {
  if (editingNode.value) return editingNode.value.nodeName
  if (editingEdge.value) return `连线: ${getNodeName(editingEdge.value.sourceId)} → ${getNodeName(editingEdge.value.targetId)}`
  return ''
})

watch(editNodeId, (id) => {
  if (id) {
    editingNode.value = getEditNode()
    editingEdge.value = null
    drawerVisible.value = true
  }
})
watch(editEdgeId, (id) => {
  if (id) {
    editingEdge.value = getEditEdge()
    editingNode.value = null
    drawerVisible.value = true
  }
})

// 点击页面其他地方关闭右键菜单
watch(contextMenuVisible, (v) => {
  if (v) {
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true })
    }, 0)
  }
})

function onNodeParamChange(key: string, value: any) {
  if (!editNodeId.value || !editingNode.value) return
  const params = { ...editingNode.value.params, [key]: value }
  updateNode(editNodeId.value, { params })
  editingNode.value = { ...editingNode.value, params }
}

function onNodeNameChange(name: string) {
  if (!editNodeId.value || !editingNode.value) return
  updateNode(editNodeId.value, { nodeName: name })
  editingNode.value = { ...editingNode.value, nodeName: name }
}
</script>

<template>
  <div style="display:flex;height:520px;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden">
    <!-- 左面板：节点库 -->
    <div style="width:200px;border-right:1px solid #e0e0e0;overflow-y:auto;padding:8px;background:#fafafa;flex-shrink:0">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:#606266">节点库</div>
      <div v-for="nt in NODE_TYPES" :key="nt.value" style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#909399">{{ nt.label }}</div>
        <div
          v-for="n in getNodesByType(nt.value)"
          :key="n.node_id"
          @click="handleAddNode(nt.value, n)"
          style="padding:4px 8px;margin-bottom:3px;font-size:12px;color:#303133;background:#fff;border:1px solid #e0e0e0;border-radius:3px;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"
          :title="n.node_name"
        >
          {{ n.node_name }}
        </div>
        <div
          @click="handleAddNode(nt.value)"
          style="padding:4px 8px;font-size:11px;color:#267F7B;background:#fff;border:1px dashed #c0c4cc;border-radius:3px;cursor:pointer;text-align:center"
        >
          + 虚拟节点
        </div>
      </div>
    </div>

    <!-- 画布 -->
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
      <div style="display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #e0e0e0;background:#fafafa;align-items:center">
        <el-button size="small" :disabled="!canUndo" @click="undo()">撤销</el-button>
        <el-button size="small" :disabled="!canRedo" @click="redo()">重做</el-button>
        <el-divider direction="vertical" />
        <el-button size="small" @click="zoomIn()">放大</el-button>
        <el-button size="small" @click="zoomOut()">缩小</el-button>
        <el-button size="small" @click="fitToContent()">适应</el-button>
        <el-divider direction="vertical" />
        <el-button size="small" type="danger" @click="handleRemoveSelected">删除选中</el-button>
        <span style="font-size:11px;color:#909399;margin-left:auto">
          节点:{{ topology.nodes.length }} 连线:{{ topology.edges.length }}
        </span>
      </div>
      <div ref="containerRef" style="flex:1;min-height:0" />
    </div>
  </div>

  <!-- 右键菜单 -->
  <teleport to="body">
    <div
      v-if="contextMenuVisible"
      :style="{ position:'fixed', left: contextMenuX + 'px', top: contextMenuY + 'px', zIndex: 3000, background:'#fff', border:'1px solid #e0e0e0', borderRadius:'4px', padding:'4px 0', minWidth:'100px', boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }"
    >
      <div @click="contextEdit()" style="padding:6px 16px;font-size:12px;cursor:pointer;color:#303133;white-space:nowrap" @mouseenter="(e:MouseEvent) => (e.target as HTMLElement).style.background='#f5f7fa'" @mouseleave="(e:MouseEvent) => (e.target as HTMLElement).style.background=''">编辑</div>
      <div @click="contextDelete()" style="padding:6px 16px;font-size:12px;cursor:pointer;color:#f56c6c;white-space:nowrap" @mouseenter="(e:MouseEvent) => (e.target as HTMLElement).style.background='#fef0f0'" @mouseleave="(e:MouseEvent) => (e.target as HTMLElement).style.background=''">删除</div>
    </div>
  </teleport>

  <!-- 属性编辑抽屉 -->
  <el-drawer v-model="drawerVisible" :title="drawerTitle" direction="rtl" size="280px" :with-header="true">
    <template v-if="editingNode">
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">名称</span>
        <el-input :model-value="editingNode!.nodeName" size="small" @update:model-value="(v: string) => onNodeNameChange(v)" />
      </div>
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">类型</span>
        <div style="font-size:12px">{{ NODE_TYPES.find(t => t.value === editingNode!.nodeType)?.label || editingNode!.nodeType }}</div>
      </div>
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">电压等级</span>
        <el-input v-model="editingNode.voltageLevel" size="small" @input="(v:string) => updateNode(editingNode!.id, { voltageLevel: v || undefined })" />
      </div>
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">接入容量(kW)</span>
        <el-input-number v-model="editingNode.connectedCapacity" :min="0" size="small" style="width:100%" @change="(v:number|undefined) => updateNode(editingNode!.id, { connectedCapacity: v || 0 })" />
      </div>
      <div style="font-size:12px;font-weight:600;margin:12px 0 8px;color:#606266">运行参数</div>
      <template v-if="editingNode.nodeType === 'SOURCE'">
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">出力上限(%)</span><el-input-number v-model="editingNode.params.outputUpperLimit" :min="0" :max="100" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('outputUpperLimit', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">出力下限(%)</span><el-input-number v-model="editingNode.params.outputLowerLimit" :min="0" :max="100" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('outputLowerLimit', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">功率因数</span><el-input-number v-model="editingNode.params.powerFactor" :min="0.8" :max="1" :step="0.01" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('powerFactor', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">调节延迟(s)</span><el-input-number v-model="editingNode.params.regulationDelay" :min="0" :max="300" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('regulationDelay', v)" /></div>
      </template>
      <template v-if="editingNode.nodeType === 'GRID'">
        <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:#909399">分接头自动调节</span>
          <el-switch v-model="editingNode.params.tapRegulation" size="small" @change="(v:boolean) => onNodeParamChange('tapRegulation', v)" />
        </div>
        <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:#909399">无功补偿</span>
          <el-switch v-model="editingNode.params.reactiveCompensation" size="small" @change="(v:boolean) => onNodeParamChange('reactiveCompensation', v)" />
        </div>
      </template>
      <template v-if="editingNode.nodeType === 'LOAD'">
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">削峰比例(%)</span><el-input-number v-model="editingNode.params.peakClippingRate" :min="0" :max="50" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('peakClippingRate', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">填谷比例(%)</span><el-input-number v-model="editingNode.params.valleyFillingRate" :min="0" :max="50" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('valleyFillingRate', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">可中断比例(%)</span><el-input-number v-model="editingNode.params.interruptibleLoadRatio" :min="0" :max="30" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('interruptibleLoadRatio', v)" /></div>
      </template>
      <template v-if="editingNode.nodeType === 'STORAGE'">
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">额定功率(kW)</span><el-input-number v-model="editingNode.params.ratedPowerKw" :min="0" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('ratedPowerKw', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">额定容量(kWh)</span><el-input-number v-model="editingNode.params.ratedCapacityKwh" :min="0" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('ratedCapacityKwh', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">SOC上限(%)</span><el-input-number v-model="editingNode.params.socUpper" :min="50" :max="100" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('socUpper', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">SOC下限(%)</span><el-input-number v-model="editingNode.params.socLower" :min="0" :max="50" size="small" style="width:100%" @change="(v:number) => onNodeParamChange('socLower', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">充电时段</span><el-input v-model="editingNode.params.chargeSchedule" size="small" @input="(v:string) => onNodeParamChange('chargeSchedule', v)" /></div>
        <div style="margin-bottom:8px"><span style="font-size:11px;color:#909399">放电时段</span><el-input v-model="editingNode.params.dischargeSchedule" size="small" @input="(v:string) => onNodeParamChange('dischargeSchedule', v)" /></div>
      </template>
    </template>
    <template v-if="editingEdge">
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">源节点</span>
        <div style="font-size:12px">{{ getNodeName(editingEdge.sourceId) }}</div>
      </div>
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">目标节点</span>
        <div style="font-size:12px">{{ getNodeName(editingEdge.targetId) }}</div>
      </div>
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">连接类型</span>
        <el-select v-model="editingEdge.edgeType" size="small" style="width:100%" @change="(v:string) => updateEdge(editingEdge!.id, { edgeType: v as any })">
          <el-option label="物理连接" value="PHYSICAL" />
          <el-option label="逻辑连接" value="LOGICAL" />
          <el-option label="控制连接" value="CONTROL" />
        </el-select>
      </div>
      <div style="margin-bottom:12px">
        <span style="font-size:11px;color:#909399">潮流方向</span>
        <el-select v-model="editingEdge.flowDirection" size="small" style="width:100%" @change="(v:string) => updateEdge(editingEdge!.id, { flowDirection: v as any })">
          <el-option label="正向" value="FORWARD" />
          <el-option label="反向" value="REVERSE" />
          <el-option label="双向" value="BIDIRECTIONAL" />
        </el-select>
      </div>
    </template>
  </el-drawer>
</template>
