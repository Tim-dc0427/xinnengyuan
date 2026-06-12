<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchThresholds, updateThresholds, deleteThreshold } from '@/api/power-flow'
import type { ThresholdItem } from '@/api/power-flow'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useThresholds } from '@/composables/useThresholds'

const { load: refreshGlobalThresholds } = useThresholds()

const loading = ref(false)
const saving = ref(false)
const list = ref<ThresholdItem[]>([])

const filterVoltageLevel = ref('')
const filterRegion = ref('')

const dialogVisible = ref(false)
const form = ref<ThresholdItem>({
  indicatorName: 'voltage_deviation',
  indicatorLabel: '电压偏差',
  warningThreshold: 5,
  criticalThreshold: 10,
  unit: '%',
  voltageLevel: null,
  region: null,
  enabled: true,
  isCustom: true,
})

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ['', '余杭区', '萧山区', '滨江区', '西湖区', '拱墅区', '上城区', '钱塘区', '临平区', '富阳区', '临安区', '桐庐县', '建德市', '淳安县']

const indicatorOptions = [
  { value: 'voltage_deviation', label: '电压偏差', unit: '%' },
  { value: 'three_phase_imbalance', label: '三相不平衡度', unit: '%' },
  { value: 'equipment_load_rate', label: '设备负载率', unit: '%' },
  { value: 'frequency_deviation', label: '频率偏差', unit: 'Hz' },
]

function indicatorLabel(name: string) {
  return indicatorOptions.find(i => i.value === name)?.label || name
}

function formatCell(val: string | null) {
  return val || '全部'
}

async function loadData() {
  loading.value = true
  try {
    const params: any = {}
    if (filterVoltageLevel.value) params.voltageLevel = filterVoltageLevel.value
    if (filterRegion.value) params.region = filterRegion.value
    const raw = await fetchThresholds(params)
    list.value = raw.map((t: ThresholdItem) => ({ ...t, enabled: t.enabled !== false }))
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// 阈值修改即时保存
async function autoSave(item: ThresholdItem) {
  if (!item.id || saving.value) return
  saving.value = true
  try {
    await updateThresholds([item])
    refreshGlobalThresholds()
  } catch {
    ElMessage.error('保存失败')
    await loadData()
  } finally {
    saving.value = false
  }
}

// 启用/禁用即时切换
async function toggleEnabled(item: ThresholdItem) {
  if (saving.value) return
  saving.value = true
  try {
    await updateThresholds([item])
    refreshGlobalThresholds()
    ElMessage.success(item.enabled ? '已启用' : '已禁用')
  } catch {
    item.enabled = !item.enabled
    ElMessage.error('操作失败')
  } finally {
    saving.value = false
  }
}

function openCreate() {
  form.value = {
    indicatorName: 'voltage_deviation',
    indicatorLabel: '电压偏差',
    warningThreshold: 5,
    criticalThreshold: 10,
    unit: '%',
    voltageLevel: filterVoltageLevel.value || null,
    region: filterRegion.value || null,
    enabled: true,
    isCustom: true,
  }
  dialogVisible.value = true
}

function onIndicatorChange(val: string) {
  const opt = indicatorOptions.find(i => i.value === val)
  if (opt) {
    form.value.indicatorLabel = opt.label
    form.value.unit = opt.unit
  }
}

async function confirmCreate() {
  if (form.value.warningThreshold >= form.value.criticalThreshold) {
    ElMessage.error('预警阈值必须小于严重阈值')
    return
  }
  saving.value = true
  try {
    await updateThresholds([form.value])
    dialogVisible.value = false
    refreshGlobalThresholds()
    ElMessage.success('规则已创建')
    await loadData()
  } catch {
    ElMessage.error('创建失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(item: ThresholdItem) {
  if (!item.isCustom) {
    ElMessage.warning('默认阈值不可删除')
    return
  }
  if (!item.id) return
  try {
    await ElMessageBox.confirm(
      `确认删除规则"${indicatorLabel(item.indicatorName)} - ${formatCell(item.voltageLevel)} - ${formatCell(item.region)}"？`,
      '删除确认',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteThreshold(item.id)
    refreshGlobalThresholds()
    ElMessage.success('已删除')
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

function filterChange() {
  loadData()
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">阈值配置</div>

    <div class="chart-panel">
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">电压等级</span>
          <el-select v-model="filterVoltageLevel" size="small" style="width:120px" clearable placeholder="全部" @change="filterChange">
            <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
          </el-select>
        </div>
        <div class="filter-group">
          <span class="filter-label">区域</span>
          <el-select v-model="filterRegion" size="small" style="width:140px" clearable placeholder="全部" @change="filterChange">
            <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
          </el-select>
        </div>
        <div style="flex:1" />
        <el-button size="small" type="primary" plain @click="openCreate">新建规则</el-button>
      </div>

      <el-table :data="list" stripe size="small" v-loading="loading" max-height="500">
        <el-table-column label="指标" min-width="130">
          <template #default="{ row }">
            {{ indicatorLabel(row.indicatorName) }}
          </template>
        </el-table-column>
        <el-table-column label="电压等级" width="110">
          <template #default="{ row }">
            {{ formatCell(row.voltageLevel) }}
          </template>
        </el-table-column>
        <el-table-column label="区域" width="110">
          <template #default="{ row }">
            {{ formatCell(row.region) }}
          </template>
        </el-table-column>
        <el-table-column label="预警阈值" width="180">
          <template #default="{ row }">
            <el-input-number
              v-model="row.warningThreshold"
              :min="0"
              :step="row.unit === 'Hz' ? 0.1 : 1"
              :precision="row.unit === 'Hz' ? 1 : 0"
              size="small"
              controls-position="right"
              style="width:120px"
              @change="autoSave(row)"
            />
            <span style="margin-left:6px;color:#909399">{{ row.unit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="严重阈值" width="180">
          <template #default="{ row }">
            <el-input-number
              v-model="row.criticalThreshold"
              :min="0"
              :step="row.unit === 'Hz' ? 0.1 : 1"
              :precision="row.unit === 'Hz' ? 1 : 0"
              size="small"
              controls-position="right"
              style="width:120px"
              @change="autoSave(row)"
            />
            <span style="margin-left:6px;color:#909399">{{ row.unit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" size="small" @change="toggleEnabled(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button
              v-if="row.isCustom"
              size="small"
              type="danger"
              link
              @click="handleDelete(row)"
            >删除</el-button>
            <span v-else style="color:#c0c4cc">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="list.length === 0 && !loading" style="padding:40px 0;text-align:center;color:#c0c4cc">
        该筛选条件下暂无阈值配置，可点击"新建规则"创建
      </div>
    </div>

    <!-- 新建规则对话框 -->
    <el-dialog v-model="dialogVisible" title="新建阈值规则" width="480px" :close-on-click-modal="false">
      <el-form label-width="100px" size="small">
        <el-form-item label="指标">
          <el-select v-model="form.indicatorName" style="width:100%" @change="onIndicatorChange">
            <el-option v-for="opt in indicatorOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="电压等级">
          <el-select v-model="form.voltageLevel" style="width:100%" clearable placeholder="全部电压等级">
            <el-option label="全部" :value="null" />
            <el-option v-for="v in voltageLevelOptions.slice(1)" :key="v" :label="v" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="form.region" style="width:100%" clearable placeholder="全部区域">
            <el-option label="全部" :value="null" />
            <el-option v-for="r in regionOptions.slice(1)" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警阈值">
          <el-input-number v-model="form.warningThreshold" :min="0" :step="form.unit === 'Hz' ? 0.1 : 1" :precision="form.unit === 'Hz' ? 1 : 0" style="width:160px" />
          <span style="margin-left:8px;color:#909399">{{ form.unit }}</span>
        </el-form-item>
        <el-form-item label="严重阈值">
          <el-input-number v-model="form.criticalThreshold" :min="0" :step="form.unit === 'Hz' ? 0.1 : 1" :precision="form.unit === 'Hz' ? 1 : 0" style="width:160px" />
          <span style="margin-left:8px;color:#909399">{{ form.unit }}</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" size="small" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmCreate" :loading="saving">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container {
  padding: 16px;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  padding: 10px 16px;
  background: #f5f7fa;
  border-radius: 4px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
</style>
