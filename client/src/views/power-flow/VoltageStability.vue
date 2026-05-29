<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchNodeStability } from '@/api/power-flow'

const loading = ref(false)
const voltageLevel = ref('')
const region = ref('')

const nodeList = ref<any[]>([])
const filterText = ref('')

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ref<string[]>([''])

const weakNodes = computed(() => nodeList.value.filter((n: any) => n.isWeakNode))
const filteredList = computed(() => {
  let list = nodeList.value
  if (region.value) list = list.filter((n: any) => n.zone === region.value)
  if (voltageLevel.value) list = list.filter((n: any) => n.voltageLevel === voltageLevel.value)
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
  const csv = '﻿节点名称,区域,电压等级,电压(p.u.),相角(°),稳定裕度(%),薄弱节点\n'
    + data.map((n: any) =>
      `"${n.nodeId || n.name}",${n.zone},${n.voltageLevel},${n.voltagePu},${n.angleDeg},${((n.stabilityMargin || 0) * 100).toFixed(2)},${n.isWeakNode ? '是' : '否'}`
    ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `voltage-stability-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

onMounted(loadData)
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
        <div class="stat-mini-label">最大相角差</div>
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
      <div class="chart-panel-title">节点电压幅值/相角一览</div>
      <el-table :data="filteredList" stripe size="small" v-loading="loading" max-height="400"
        :row-class-name="({ row }: any) => row.isWeakNode ? 'weak-row' : ''">
        <el-table-column prop="name" label="节点名称" min-width="140" />
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压(p.u.)" width="110">
          <template #default="{ row }">
            <span :style="{ fontWeight: 600, color: row.isWeakNode ? '#F56C6C' : '#303133' }">{{ row.voltagePu?.toFixed(4) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="angleDeg" label="相角(°)" width="80" />
        <el-table-column label="稳定裕度" width="130">
          <template #default="{ row }">
            <el-progress :percentage="Number(((row.stabilityMargin || 0) * 100).toFixed(1))" :stroke-width="14"
              :status="row.isWeakNode ? 'exception' : row.stabilityMargin < 0.95 ? 'warning' : 'success'" :text-inside="true" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.isWeakNode ? 'danger' : 'success'">{{ row.isWeakNode ? '薄弱' : '正常' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">电压稳定薄弱节点风险清单（裕度 &lt; 95%）</div>
      <el-table v-if="weakNodes.length" :data="weakNodes" stripe size="small" max-height="250">
        <el-table-column prop="name" label="节点" min-width="140" />
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
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
:deep(.weak-row) { background-color:#fef0f0 !important; }
</style>
