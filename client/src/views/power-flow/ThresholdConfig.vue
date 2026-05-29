<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchThresholds, updateThresholds } from '@/api/power-flow'
import type { ThresholdItem } from '@/api/power-flow'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const list = ref<ThresholdItem[]>([])
const original = ref<ThresholdItem[]>([])

const changedIndexes = ref<Set<number>>(new Set())

const indicatorLabelMap: Record<string, string> = {
  voltage_deviation: '电压偏差',
  three_phase_imbalance: '三相不平衡度',
  equipment_load_rate: '设备负载率',
  frequency_deviation: '频率偏差',
}

function isChanged(index: number) {
  return changedIndexes.value.has(index)
}

function markChanged(index: number) {
  const item = list.value[index]
  const orig = original.value[index]
  if (!orig || item.warningThreshold !== orig.warningThreshold || item.criticalThreshold !== orig.criticalThreshold) {
    changedIndexes.value.add(index)
  } else {
    changedIndexes.value.delete(index)
  }
}

function resetRow(index: number) {
  list.value[index] = { ...original.value[index] }
  changedIndexes.value.delete(index)
}

function rowClass({ rowIndex }: { rowIndex: number }) {
  return isChanged(rowIndex) ? 'changed-row' : ''
}

async function loadData() {
  loading.value = true
  try {
    list.value = await fetchThresholds()
    original.value = list.value.map(t => ({ ...t }))
    changedIndexes.value.clear()
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const changed = list.value.filter((_, i) => changedIndexes.value.has(i))
  if (changed.length === 0) {
    ElMessage.info('未检测到修改')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认保存 ${changed.length} 项阈值变更？`,
      '保存确认',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  saving.value = true
  try {
    await updateThresholds(list.value.map(t => ({
      ...t,
      isCustom: true,
    })))
    original.value = list.value.map(t => ({ ...t }))
    changedIndexes.value.clear()
    ElMessage.success('阈值配置已保存')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 验证：预警阈值必须 < 严重阈值
function validateThreshold(item: ThresholdItem): boolean {
  return item.warningThreshold < item.criticalThreshold
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">阈值配置</div>
    <div class="chart-panel">
      <div class="panel-header">
        <div class="chart-panel-title">指标阈值自定义配置</div>
        <div>
          <el-button size="small" @click="loadData" :loading="loading">重置</el-button>
          <el-button size="small" type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
        </div>
      </div>

      <el-alert
        title="修改预警阈值或严重阈值后，对应行将高亮显示。保存后配置立即生效。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom:16px"
      />

      <el-table :data="list" stripe size="small" v-loading="loading" :row-class-name="rowClass">
        <el-table-column label="指标">
          <template #default="{ row }">
            {{ indicatorLabelMap[row.indicatorName] || row.indicatorName }}
          </template>
        </el-table-column>
        <el-table-column label="预警阈值" width="200">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.warningThreshold"
              :min="0"
              :step="row.unit === '%' ? 0.1 : 0.01"
              :precision="2"
              size="small"
              controls-position="right"
              @change="markChanged($index)"
            />
            <span style="margin-left:6px;color:#909399">{{ row.unit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="严重阈值" width="200">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.criticalThreshold"
              :min="0"
              :step="row.unit === '%' ? 0.1 : 0.01"
              :precision="2"
              size="small"
              controls-position="right"
              @change="markChanged($index)"
            />
            <span style="margin-left:6px;color:#909399">{{ row.unit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row, $index }">
            <el-tag v-if="isChanged($index)" type="warning" size="small">已修改</el-tag>
            <el-tag v-else-if="row.isCustom" type="info" size="small">自定义</el-tag>
            <el-tag v-else type="success" size="small">默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ $index }">
            <el-button
              v-if="isChanged($index)"
              size="small"
              type="warning"
              link
              @click="resetRow($index)"
            >还原</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
:deep(.changed-row) {
  background-color: #fdf6ec !important;
}
</style>
