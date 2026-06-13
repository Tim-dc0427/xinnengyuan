<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchBatchList, fetchBatchResults, exportBatchResults } from '@/api/power-flow'
import { ElMessage } from 'element-plus'

const route = useRoute()

const groupId = ref('')
const batchList = ref<any[]>([])
const loading = ref(false)
const zoneFilter = ref('')
const activeResultTab = ref('summary')
const onlyAnomaly = ref(true)

const group = ref<any>(null)
const regionStats = ref<any[]>([])
const anomalyItems = ref<any[]>([])
const capacityRanking = ref<any[]>([])

const zones = computed(() => {
  return [...new Set(regionStats.value.map((r: any) => r.zone).filter(Boolean))] as string[]
})

const filteredStats = computed(() => {
  let list = regionStats.value
  if (zoneFilter.value) list = list.filter((r: any) => r.zone === zoneFilter.value)
  return list
})

// 仅异常设备（Tab 2 使用）
const anomalyTypeLabel: Record<string, string> = {
  overload: '过载',
  voltage_violation: '电压越限',
  stability_insufficient: '稳定性不足',
}

function formatAnomalyTypes(types: string[]) {
  return types.map(t => anomalyTypeLabel[t] || t).join('、')
}

const anomalyStats = computed(() => regionStats.value.filter((r: any) => r.isAnomaly))

// 区域级汇总报表
// 排名映射：equipmentId → rank
const rankByEquipmentId = computed(() => {
  const map = new Map<string, number>()
  capacityRanking.value.forEach((r: any) => map.set(r.equipmentId, r.rank))
  return map
})

const zoneSummary = computed(() => {
  const map = new Map<string, { total: number; anomaly: number; loadRates: number[]; overloaded: number }>()
  for (const r of regionStats.value) {
    const z = r.zone || '未知'
    if (!map.has(z)) map.set(z, { total: 0, anomaly: 0, loadRates: [], overloaded: 0 })
    const entry = map.get(z)!
    entry.total++
    if (r.isAnomaly) entry.anomaly++
    entry.loadRates.push(r.loadRate * 100)
    if (r.loadRate > 0.8) entry.overloaded++
  }
  return [...map.entries()].map(([zone, v]) => ({
    zone,
    total: v.total,
    anomaly: v.anomaly,
    avgLoadRate: v.loadRates.length > 0 ? (v.loadRates.reduce((a, b) => a + b, 0) / v.loadRates.length).toFixed(1) : '0',
    maxLoadRate: v.loadRates.length > 0 ? Math.max(...v.loadRates).toFixed(1) : '0',
    overloaded: v.overloaded,
  }))
})

const anomalyCount = computed(() => regionStats.value.filter((r: any) => r.isAnomaly).length)
const overloadCount = computed(() => anomalyItems.value.filter((a: any) => a.anomalyType === 'overload').length)
const voltageCount = computed(() => anomalyItems.value.filter((a: any) => a.anomalyType === 'voltage_violation').length)
const stabilityCount = computed(() => anomalyItems.value.filter((a: any) => a.anomalyType === 'stability_insufficient').length)

async function loadData() {
  if (!groupId.value) return
  loading.value = true
  try {
    const data = await fetchBatchResults(groupId.value)
    group.value = data.group
    regionStats.value = data.regionStats || []
    anomalyItems.value = data.anomalyItems || []
    capacityRanking.value = data.capacityRanking || []
  } catch {
    ElMessage.error('加载结果失败')
  } finally {
    loading.value = false
  }
}

async function loadBatchList() {
  try { batchList.value = (await fetchBatchList({ status: 'completed', limit: 20 })) || [] } catch { batchList.value = [] }
  try {
    const partial = (await fetchBatchList({ status: 'partial_failed', limit: 10 })) || []
    batchList.value = [...batchList.value, ...partial]
  } catch { /* ok */ }
}

async function handleExport() {
  try {
    const data = await exportBatchResults(groupId.value)
    const blob = new Blob(['﻿' + data.content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.groupName || '批量计算结果'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
}

function selectGroup(row: any) {
  groupId.value = row.id
}

watch(groupId, loadData)

onMounted(async () => {
  await loadBatchList()
  const qId = route.query.groupId as string
  if (qId) {
    groupId.value = qId
  }
})
</script>

<template>
  <div class="batch-results">
    <div class="chart-panel-title">批量结果汇总分析</div>

    <div class="results-top">
      <div class="top-row">
        <el-select v-model="groupId" placeholder="选择批次" size="small" style="width:280px" @change="loadData">
          <el-option v-for="b in batchList" :key="b.id" :label="b.group_name" :value="b.id">
            <span>{{ b.group_name }}</span>
            <el-tag size="small" :type="b.status === 'completed' ? 'success' : 'warning'" style="margin-left:8px">{{ b.status === 'completed' ? '完成' : '部分失败' }}</el-tag>
          </el-option>
        </el-select>
        <el-select v-if="activeResultTab === 'summary'" v-model="zoneFilter" placeholder="区域筛选" clearable size="small" style="width:120px" :disabled="zones.length === 0">
          <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
        </el-select>
        <el-button size="small" :disabled="!groupId" @click="handleExport">导出CSV</el-button>
      </div>
    </div>

    <template v-if="groupId && group">
      <el-tabs v-model="activeResultTab">
        <el-tab-pane label="批量结果汇总" name="summary">
          <div class="panel" v-if="zoneSummary.length > 0">
            <div class="section-title">区域统计报表 ({{ zoneSummary.length }} 个区域)</div>
            <el-table :data="zoneSummary" size="small" max-height="320" stripe>
              <el-table-column prop="zone" label="区域" width="100" />
              <el-table-column prop="total" label="设备总数" width="80" />
              <el-table-column prop="anomaly" label="异常设备" width="80">
                <template #default="{ row }">
                  <span :style="{ color: row.anomaly > 0 ? '#f56c6c' : '#67c23a', fontWeight: row.anomaly > 0 ? 'bold' : 'normal' }">
                    {{ row.anomaly }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="avgLoadRate" label="平均负载率(%)" width="110" />
              <el-table-column prop="maxLoadRate" label="最高负载率(%)" width="110">
                <template #default="{ row }">
                  <span :style="{ color: Number(row.maxLoadRate) > 80 ? '#f56c6c' : Number(row.maxLoadRate) > 60 ? '#e6a23c' : '#303133' }">
                    {{ row.maxLoadRate }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="overloaded" label="过载设备" width="80">
                <template #default="{ row }">
                  <span :style="{ color: row.overloaded > 0 ? '#f56c6c' : '#909399' }">{{ row.overloaded }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="panel" style="margin-top:16px">
            <div class="section-title">设备统计 ({{ filteredStats.length }})</div>
            <el-table :data="filteredStats" v-loading="loading" size="small" max-height="400" stripe :row-style="(row: any) => row.row.isAnomaly ? { backgroundColor: '#fef0f0' } : {}">
              <el-table-column prop="name" label="设备名称" min-width="140" show-overflow-tooltip />
              <el-table-column prop="zone" label="区域" width="80" />
              <el-table-column prop="voltageLevel" label="电压等级" width="80" />
              <el-table-column label="负载率" width="80">
                <template #default="{ row }">
                  <span :style="{ color: row.loadRate > 0.8 ? '#f56c6c' : row.loadRate > 0.6 ? '#e6a23c' : '#303133', fontWeight: row.isAnomaly ? 'bold' : 'normal' }">
                    {{ (row.loadRate * 100).toFixed(1) }}%
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="电压偏差" width="80">
                <template #default="{ row }">
                  <span :style="{ color: row.voltageDeviationPct > 5 ? '#f56c6c' : '#303133' }">
                    {{ row.voltageDeviationPct.toFixed(2) }}%
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="异常" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.isAnomaly" type="danger" size="small">{{ formatAnomalyTypes(row.anomalyTypes) }}</el-tag>
                  <span v-else style="color:#67c23a">正常</span>
                </template>
              </el-table-column>
              <el-table-column label="承载排名" width="70">
                <template #default="{ row }">
                  <span :style="{ color: rankByEquipmentId.has(row.busId) ? '#303133' : '#c0c4cc' }">
                    {{ rankByEquipmentId.get(row.busId) || '-' }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="异常结果标记" name="anomaly">
          <div v-if="anomalyCount === 0" class="panel">
            <el-empty description="当前批次无异常结果" />
          </div>

          <template v-else>
            <div class="anomaly-summary">
              <span class="sum-item">异常设备 <b>{{ anomalyCount }}</b></span>
              <span class="sum-item" v-if="overloadCount">过载 <b>{{ overloadCount }}</b></span>
              <span class="sum-item" v-if="voltageCount">电压越限 <b>{{ voltageCount }}</b></span>
              <span class="sum-item" v-if="stabilityCount">稳定性不足 <b>{{ stabilityCount }}</b></span>
              <el-checkbox v-model="onlyAnomaly" size="small" style="margin-left:auto">仅显示异常</el-checkbox>
            </div>

            <!-- 勾选仅显示异常 → 异常明细；取消 → 全部设备列表（异常红底） -->
            <div class="panel">
              <div class="section-title">
                {{ onlyAnomaly ? `异常明细 (${anomalyItems.length})` : `全部设备 (${regionStats.length})` }}
              </div>

              <el-table
                v-if="onlyAnomaly"
                :data="anomalyItems"
                size="small"
                max-height="440"
                stripe
                :row-style="{ backgroundColor: '#fef0f0' }"
              >
                <el-table-column prop="equipmentName" label="设备" min-width="130" show-overflow-tooltip />
                <el-table-column prop="anomalyType" label="异常类型" width="110">
                  <template #default="{ row }">
                    <el-tag :type="row.anomalyType === 'voltage_violation' ? 'danger' : row.anomalyType === 'overload' ? 'warning' : 'info'" size="small">
                      {{ row.anomalyType === 'voltage_violation' ? '电压越限' : row.anomalyType === 'overload' ? '过载' : row.anomalyType === 'stability_insufficient' ? '稳定性不足' : row.anomalyType }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="severity" label="严重级别" width="80">
                  <template #default="{ row }">
                    <span :style="{ color: row.severity === 'critical' ? '#f56c6c' : '#e6a23c' }">
                      {{ row.severity === 'critical' ? '严重' : '警告' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="currentValue" label="当前值" width="130" show-overflow-tooltip />
                <el-table-column prop="thresholdValue" label="阈值" width="90" />
                <el-table-column prop="description" label="说明" min-width="140" show-overflow-tooltip />
              </el-table>

              <el-table
                v-else
                :data="regionStats"
                size="small"
                max-height="440"
                stripe
                :row-style="(row: any) => row.row.isAnomaly ? { backgroundColor: '#fef0f0' } : {}"
              >
                <el-table-column prop="name" label="设备名称" min-width="140" show-overflow-tooltip />
                <el-table-column prop="zone" label="区域" width="80" />
                <el-table-column prop="voltageLevel" label="电压等级" width="80" />
                <el-table-column label="负载率" width="80">
                  <template #default="{ row }">
                    <span :style="{ color: row.loadRate > 0.8 ? '#f56c6c' : row.loadRate > 0.6 ? '#e6a23c' : '#303133', fontWeight: row.isAnomaly ? 'bold' : 'normal' }">
                      {{ (row.loadRate * 100).toFixed(1) }}%
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="电压偏差" width="80">
                  <template #default="{ row }">
                    <span :style="{ color: row.voltageDeviationPct > 5 ? '#f56c6c' : '#303133' }">{{ row.voltageDeviationPct.toFixed(2) }}%</span>
                  </template>
                </el-table-column>
                <el-table-column label="异常" width="100">
                  <template #default="{ row }">
                    <el-tag v-if="row.isAnomaly" type="danger" size="small">{{ formatAnomalyTypes(row.anomalyTypes) }}</el-tag>
                    <span v-else style="color:#67c23a">正常</span>
                  </template>
                </el-table-column>
                <el-table-column label="承载排名" width="70">
                  <template #default="{ row }">
                    <span :style="{ color: rankByEquipmentId.has(row.busId) ? '#303133' : '#c0c4cc' }">
                      {{ rankByEquipmentId.get(row.busId) || '-' }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-tab-pane>
      </el-tabs>
    </template>

    <el-empty v-else description="选择已完成批次查看结果" />
  </div>
</template>

<style scoped>
.batch-results { padding: 0; }
.results-top { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px 16px; margin-bottom: 16px; }
.top-row { display: flex; gap: 12px; align-items: center; }
.results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
.panel { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
.anomaly-summary { display: flex; gap: 16px; padding: 10px 16px; background: #fef0f0; border: 1px solid #fde2e2; border-radius: 4px; margin-bottom: 16px; font-size: 13px; color: #606266; }
.sum-item b { color: #e64242; }
</style>
