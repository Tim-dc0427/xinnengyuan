<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchNodeStability } from '@/api/power-flow'
import { useThresholds } from '@/composables/useThresholds'

const { load: loadThresholds, getStatus } = useThresholds()

function volStatus(n: any) {
  const dev = Math.abs((n.voltagePu || 1) - 1) * 100
  return getStatus('voltage_deviation', dev, n.voltageLevel, n.zone)
}
function volDeviation(n: any) {
  return (Math.abs((n.voltagePu || 1) - 1) * 100).toFixed(1)
}
function volRowClass(n: any) {
  const s = volStatus(n); return s === 'critical' ? 'critical-row' : s === 'warning' ? 'warning-row' : ''
}

const loading = ref(false)
const voltageLevel = ref('')
const region = ref('')
const physicalRole = ref('')

const nodeList = ref<any[]>([])
const filterText = ref('')

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ref<string[]>([''])
const physicalRoleOptions = [
  { value: '', label: '全部' },
  { value: 'GENERATION', label: '发电' },
  { value: 'SUBSTATION', label: '变电' },
  { value: 'DISTRIBUTION', label: '配电' },
  { value: 'PV', label: '光伏' },
]
const roleLabelMap: Record<string, string> = { GENERATION: '发电', SUBSTATION: '变电', DISTRIBUTION: '配电', PV: '光伏' }

const weakNodes = computed(() =>
  nodeList.value.filter((n: any) => n.isWeakNode).sort((a: any, b: any) => (a.stabilityMargin || 0) - (b.stabilityMargin || 0))
)
const filteredList = computed(() => {
  let list = nodeList.value
  if (region.value) list = list.filter((n: any) => n.zone === region.value)
  if (voltageLevel.value) list = list.filter((n: any) => n.voltageLevel === voltageLevel.value)
  if (physicalRole.value) list = list.filter((n: any) => n.physicalRole === physicalRole.value)
  if (!filterText.value) return list
  const kw = filterText.value.toLowerCase()
  return list.filter((n: any) =>
    n.nodeId?.toLowerCase().includes(kw) || n.name?.toLowerCase().includes(kw) || n.zone?.toLowerCase().includes(kw)
  )
})

const summaryStats = computed(() => {
  const nodes = nodeList.value
  const total = nodes.length
  if (!total) return { avgVoltage: 0, maxAngleDiff: 0, weakCount: 0, qualifiedRate: 0 }
  const avg = nodes.reduce((s: number, n: any) => s + n.voltagePu, 0) / total
  const maxAngle = Math.max(...nodes.map((n: any) => Math.abs(n.angleDeg)))
  const weak = nodes.filter((n: any) => n.isWeakNode).length
  const qualified = nodes.filter((n: any) => !n.isWeakNode).length
  return { avgVoltage: (avg * 100).toFixed(1), maxAngleDiff: maxAngle.toFixed(2), weakCount: weak, qualifiedRate: (qualified / total * 100).toFixed(1) }
})

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (voltageLevel.value) params.voltageLevel = voltageLevel.value
    if (region.value) params.region = region.value
    nodeList.value = (await fetchNodeStability(params)) || []
    // 从数据中提取所有区县
    const zones = new Set<string>()
    nodeList.value.forEach((n: any) => { if (n.zone) zones.add(n.zone) })
    regionOptions.value = ['', ...Array.from(zones).sort()]
  } catch {
    nodeList.value = []
  } finally {
    loading.value = false
  }
}

function handleExport() {
  const data = filteredList.value
  const csv = '﻿节点编号,电压幅值(p.u.),电压相角(°),稳定裕度(%),关联设备\n'
    + data.map((n: any) =>
      `"${n.nodeId || n.name}",${n.voltagePu},${n.angleDeg},${((n.stabilityMargin || 0) * 100).toFixed(2)},"${(n.connectedDevices || []).join('; ')}"`
    ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `voltage-stability-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

onMounted(() => { loadThresholds(); loadData() })
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">节点电压稳定性</div>
    <div class="filter-bar">
      <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:150px" @change="loadData">
        <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
      </el-select>
      <el-select v-model="region" placeholder="区域" clearable size="small" style="width:220px;margin-left:12px" @change="loadData">
        <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
      </el-select>
      <el-select v-model="physicalRole" placeholder="节点类型" clearable size="small" style="width:120px;margin-left:12px">
        <el-option v-for="p in physicalRoleOptions" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
      <el-divider direction="vertical" />
      <el-input v-model="filterText" placeholder="搜索节点..." clearable size="small" style="width:200px" prefix-icon="Search" />
      <div style="flex:1" />
      <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
      <el-button size="small" type="primary" @click="handleExport">导出 CSV</el-button>
    </div>

    <div class="grid-4">
      <el-card shadow="hover" class="stat-mini">
        <div class="stat-mini-label">平均电压</div>
        <div class="stat-mini-val" style="color:#267F7B">{{ summaryStats.avgVoltage }}%</div>
      </el-card>
      <el-card shadow="hover" class="stat-mini">
        <div class="stat-mini-label">最大电压相角差</div>
        <div class="stat-mini-val" style="color:#E6A23C">{{ summaryStats.maxAngleDiff }}°</div>
      </el-card>
      <el-card shadow="hover" class="stat-mini">
        <div class="stat-mini-label">薄弱节点</div>
        <div class="stat-mini-val" style="color:#F56C6C">{{ summaryStats.weakCount }} 个</div>
      </el-card>
      <el-card shadow="hover" class="stat-mini">
        <div class="stat-mini-label">电压合格率</div>
        <div class="stat-mini-val" style="color:#67C23A">{{ summaryStats.qualifiedRate }}%</div>
      </el-card>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">节点电压幅值/电压相角一览</div>
      <el-table :data="filteredList" stripe size="small" v-loading="loading" max-height="400"
        :row-class-name="({ row }: any) => volRowClass(row)">
        <el-table-column prop="name" label="节点名称" min-width="140" />
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="节点类型" width="75">
          <template #default="{ row }">
            <el-tag size="small">{{ roleLabelMap[row.physicalRole] || row.physicalRole }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="电压(p.u.)" width="110">
          <template #default="{ row }">
            <span :style="{ fontWeight: 600, color: volStatus(row) === 'critical' ? '#F56C6C' : volStatus(row) === 'warning' ? '#E6A23C' : '#303133' }">{{ row.voltagePu?.toFixed(4) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="电压相角(°)" width="90">
          <template #default="{ row }">{{ row.angleDeg }}°</template>
        </el-table-column>
        <el-table-column label="稳定裕度" width="130">
          <template #default="{ row }">
            <el-progress :percentage="Number(((row.stabilityMargin || 0) * 100).toFixed(1))" :stroke-width="14"
              :status="row.isWeakNode ? 'exception' : row.stabilityMargin < 0.95 ? 'warning' : 'success'" :text-inside="true" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="volStatus(row) === 'critical' ? 'danger' : volStatus(row) === 'warning' ? 'warning' : 'success'">{{ volStatus(row) === 'critical' ? '严重' : volStatus(row) === 'warning' ? '预警' : '正常' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">电压稳定薄弱节点风险清单（裕度 &lt; 95%）</div>
      <el-table v-if="weakNodes.length" :data="weakNodes" stripe size="small" max-height="250">
        <el-table-column type="index" label="排名" width="55" />
        <el-table-column prop="name" label="节点" min-width="140" />
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="节点类型" width="75">
          <template #default="{ row }">
            <el-tag size="small">{{ roleLabelMap[row.physicalRole] || row.physicalRole }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前电压" width="110">
          <template #default="{ row }"><span style="color:#F56C6C;font-weight:600">{{ row.voltagePu?.toFixed(4) }} p.u.</span></template>
        </el-table-column>
        <el-table-column label="越限幅度" width="110">
          <template #default="{ row }"><span style="color:#E6A23C">{{ (Math.abs((row.voltagePu || 1) - 1) * 100).toFixed(2) }}%</span></template>
        </el-table-column>
        <el-table-column label="稳定裕度" width="130">
          <template #default="{ row }">
            <el-progress :percentage="Number(((row.stabilityMargin || 0) * 100).toFixed(1))" :stroke-width="14" status="exception" :text-inside="true" />
          </template>
        </el-table-column>
      </el-table>
      <div v-else style="padding:30px;text-align:center;color:#909399">当前筛选条件下无薄弱节点</div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; margin-bottom:16px; padding:12px 16px; background:#fff; border-radius:8px; }
.grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:16px; }
.stat-mini { padding:8px 16px; }
.stat-mini-label { font-size:12px; color:#909399; margin-bottom:4px; }
.stat-mini-val { font-size:20px; font-weight:700; }
:deep(.critical-row) { background-color:#fef0f0 !important; }
:deep(.warning-row) { background-color:#fdf6ec !important; }
</style>
