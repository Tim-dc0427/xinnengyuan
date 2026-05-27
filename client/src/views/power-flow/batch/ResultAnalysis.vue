<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchBatchList, fetchBatchResults, exportBatchResults } from '@/api/power-flow'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()

const groupId = ref('')
const batchList = ref<any[]>([])
const loading = ref(false)
const onlyAnomaly = ref(false)
const zoneFilter = ref('')

const group = ref<any>(null)
const regionStats = ref<any[]>([])
const anomalyItems = ref<any[]>([])
const capacityRanking = ref<any[]>([])

const zones = computed(() => {
  return [...new Set(regionStats.value.map((r: any) => r.zone).filter(Boolean))] as string[]
})

const filteredStats = computed(() => {
  let list = regionStats.value
  if (onlyAnomaly.value) list = list.filter((r: any) => r.isAnomaly)
  if (zoneFilter.value) list = list.filter((r: any) => r.zone === zoneFilter.value)
  return list
})

const anomalyCount = computed(() => regionStats.value.filter((r: any) => r.isAnomaly).length)

const capacityChartOption = computed(() => {
  const data = capacityRanking.value.slice(0, 20)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '负载率(%)', max: 100 },
    yAxis: {
      type: 'category',
      data: data.map((d: any) => d.equipmentName || d.equipmentId).reverse(),
      inverse: true,
      axisLabel: { width: 110, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      data: data.map((d: any) => ({
        value: (d.loadRate * 100).toFixed(1),
        itemStyle: { color: d.loadRate > 0.8 ? '#f56c6c' : d.loadRate > 0.6 ? '#e6a23c' : '#67c23a' },
      })).reverse(),
    }],
  }
})

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
  // 也包含部分失败的
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
    <div class="results-top">
      <div class="top-row">
        <el-select v-model="groupId" placeholder="选择批次" size="small" style="width:280px" @change="loadData">
          <el-option v-for="b in batchList" :key="b.id" :label="b.group_name" :value="b.id">
            <span>{{ b.group_name }}</span>
            <el-tag size="small" :type="b.status === 'completed' ? 'success' : 'warning'" style="margin-left:8px">{{ b.status === 'completed' ? '完成' : '部分失败' }}</el-tag>
          </el-option>
        </el-select>
        <el-select v-model="zoneFilter" placeholder="区域" clearable size="small" style="width:120px" :disabled="zones.length === 0">
          <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
        </el-select>
        <el-checkbox v-model="onlyAnomaly" size="small">仅显示异常 ({{ anomalyCount }})</el-checkbox>
        <el-button size="small" :disabled="!groupId" @click="handleExport">导出CSV</el-button>
      </div>
    </div>

    <template v-if="groupId && group">
      <div class="results-grid">
        <div class="panel">
          <div class="section-title">设备统计 ({{ regionStats.length }})</div>
          <el-table :data="filteredStats" v-loading="loading" size="small" max-height="400" stripe :row-style="(row: any) => row.row.isAnomaly ? { backgroundColor: '#fef0f0' } : {}">
            <el-table-column prop="name" label="设备名称" min-width="120" show-overflow-tooltip />
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
                <el-tag v-if="row.isAnomaly" type="danger" size="small">{{ row.anomalyTypes.join(',') }}</el-tag>
                <span v-else style="color:#67c23a">正常</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="panel">
          <div class="section-title">异常详情 ({{ anomalyItems.length }})</div>
          <el-table :data="anomalyItems" size="small" max-height="300" stripe>
            <el-table-column prop="equipmentName" label="设备" min-width="120" show-overflow-tooltip />
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
        </div>
      </div>

      <div class="panel" v-if="capacityRanking.length > 0" style="margin-top:16px">
        <div class="section-title">承载能力排名</div>
        <ChartContainer :option="capacityChartOption" height="400px" />
      </div>
    </template>

    <el-empty v-else description="选择已完成批次查看结果" />
  </div>
</template>

<style scoped>
.batch-results { padding: 0; }
.results-top { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px 16px; margin-bottom: 16px; }
.top-row { display: flex; gap: 12px; align-items: center; }
.results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
</style>
