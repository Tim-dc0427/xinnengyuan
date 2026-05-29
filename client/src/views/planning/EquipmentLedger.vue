<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  fetchEquipmentByStation,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  fetchLifecycleRecords,
  createLifecycleRecord,
} from '@/api/planning'
import { fetchPowerPlants } from '@/api/resource'
import type { EquipmentLedgerItem, EquipmentLifecycleRecord } from '@new-energy/shared'
import {
  equipmentTypeOptions,
  equipmentTypeLabels,
  equipmentFieldConfigs,
  equipmentModelPresets,
} from '@/config/equipmentFields'
import type { EquipmentFieldDef, ModelPreset } from '@/config/equipmentFields'

const loading = ref(false)
const stations = ref<any[]>([])
const selectedStationId = ref('')
const equipment = ref<EquipmentLedgerItem[]>([])
const currentRecord = ref<EquipmentLedgerItem | null>(null)
const lifecycleRecords = ref<EquipmentLifecycleRecord[]>([])
const drawerVisible = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const formData = ref<any>({})
const isEditing = ref(false)
const recordDialogVisible = ref(false)
const newRecord = ref<Partial<EquipmentLifecycleRecord>>({})

const lifecycleEventOptions = [
  { value: 'design', label: '设计选型' },
  { value: 'procurement', label: '采购到货' },
  { value: 'commissioning', label: '安装投运' },
  { value: 'operation', label: '运行监测' },
  { value: 'maintenance', label: '检修维护' },
  { value: 'retirement', label: '退役报废' },
]

const statusOptions = [
  { value: 'installed', label: '已安装' },
  { value: 'operating', label: '运行中' },
  { value: 'fault', label: '故障' },
  { value: 'retired', label: '已退役' },
]

const statusLabels: Record<string, string> = {
  installed: '已安装', operating: '运行中', fault: '故障', retired: '已退役',
}
const statusTypes: Record<string, string> = {
  installed: 'info', operating: 'success', fault: 'danger', retired: 'info',
}

/** 筛选条件 */
const filterType = ref('')
const filterStatus = ref('')
const filterKeyword = ref('')

const filteredEquipment = computed(() => {
  let list = equipment.value
  if (filterType.value) {
    list = list.filter((e: any) => e.equipmentType === filterType.value)
  }
  if (filterStatus.value) {
    list = list.filter((e: any) => e.status === filterStatus.value)
  }
  if (filterKeyword.value) {
    const kw = filterKeyword.value.toLowerCase()
    list = list.filter((e: any) => {
      return (
        (e.equipmentCode && e.equipmentCode.toLowerCase().includes(kw)) ||
        (e.modelNumber && e.modelNumber.toLowerCase().includes(kw)) ||
        (e.manufacturer && e.manufacturer.toLowerCase().includes(kw)) ||
        (e.locationDesc && e.locationDesc.toLowerCase().includes(kw))
      )
    })
  }
  return list
})

/** 当前选中设备类型的字段配置 */
const currentFields = computed<EquipmentFieldDef[]>(() => {
  return equipmentFieldConfigs[formData.value?.equipmentType] || []
})

/** 是否有技术参数需要填 */
const hasTechFields = computed(() => currentFields.value.length > 0)

/** 当前设备类型的预置型号列表 */
const availableModels = computed<ModelPreset[]>(() => {
  return equipmentModelPresets[formData.value?.equipmentType] || []
})

/** 选中预置型号后自动填充技术参数，否则清空避免参数与型号不匹配 */
function onModelChange(modelNumber: string) {
  formData.value.ratedParams = initTypeParams(formData.value.equipmentType)
  const preset = availableModels.value.find((m: ModelPreset) => m.modelNumber === modelNumber)
  if (preset) {
    formData.value.ratedParams = { ...formData.value.ratedParams, ...preset.ratedParams }
  }
}

/** 根据设备类型初始化参数字段的默认值 */
function initTypeParams(type: string): Record<string, any> {
  const params: Record<string, any> = {}
  const fields = equipmentFieldConfigs[type] || []
  for (const f of fields) {
    params[f.key] = f.type === 'number' ? undefined : ''
  }
  return params
}

watch(() => formData.value?.equipmentType, (newType) => {
  if (!newType) return
  // 切换类型时重新初始化参数，保留已有的 common 字段
  const oldParams = formData.value.ratedParams || {}
  formData.value.ratedParams = initTypeParams(newType)
  // 如果切换回已有数据的类型，把旧参数合并回来
  for (const key of Object.keys(oldParams)) {
    if (formData.value.ratedParams.hasOwnProperty(key)) {
      formData.value.ratedParams[key] = oldParams[key]
    }
  }
})

async function loadStations() {
  try {
    const rows = await fetchPowerPlants()
    stations.value = rows.map((r: any) => ({
      id: r.id,
      name: r.station_name || r.name,
      capacityKw: (r.installed_capacity_mw || 0) * 1000,
    }))
  } catch {
    stations.value = []
  }
}

async function onStationChange(val: string) {
  if (!val) {
    equipment.value = []
    return
  }
  loading.value = true
  try {
    equipment.value = await fetchEquipmentByStation(val)
  } catch {
    equipment.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEditing.value = false
  dialogTitle.value = '新增设备'
  const defaultType = 'pv_module'
  formData.value = {
    stationId: selectedStationId.value,
    equipmentType: defaultType,
    equipmentCode: '',
    modelNumber: '',
    manufacturer: '',
    quantity: 1,
    installDate: '',
    status: 'installed',
    locationDesc: '',
    ratedParams: initTypeParams(defaultType),
  }
  dialogVisible.value = true
}

function openEdit(row: EquipmentLedgerItem) {
  isEditing.value = true
  dialogTitle.value = '编辑设备'
  // 解构现有数据
  formData.value = {
    ...row,
    ratedParams: { ...initTypeParams(row.equipmentType), ...(row.ratedParams || {}) },
  }
  dialogVisible.value = true
}

async function confirmDelete(row: EquipmentLedgerItem) {
  try {
    await ElMessageBox.confirm('确定要删除该设备吗？', '确认删除', { type: 'warning' })
    await deleteEquipmentItem(row.id)
    ElMessage.success('删除成功')
    equipment.value = equipment.value.filter((e: any) => e.id !== row.id)
  } catch {
    // cancelled
  }
}

async function saveEquipment() {
  if (!formData.value.modelNumber) {
    ElMessage.warning('请填写设备型号')
    return
  }
  try {
    // ratedParams 已经存在 formData 中，直接提交
    if (isEditing.value && formData.value.id) {
      const updated = await updateEquipmentItem(formData.value.id, formData.value)
      const idx = equipment.value.findIndex((e: any) => e.id === formData.value.id)
      if (idx >= 0) equipment.value[idx] = updated
      ElMessage.success('更新成功')
    } else {
      const created = await createEquipmentItem(formData.value)
      equipment.value.push(created)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
  } catch {
    ElMessage.error('操作失败')
  }
}

async function openDetail(row: EquipmentLedgerItem) {
  currentRecord.value = row
  try {
    lifecycleRecords.value = await fetchLifecycleRecords(row.id)
  } catch {
    lifecycleRecords.value = []
  }
  drawerVisible.value = true
}

/** 根据 field key 获取该字段的中文标签，用于详情展示 */
function getParamLabel(key: string): string {
  for (const fields of Object.values(equipmentFieldConfigs)) {
    const found = fields.find((f: EquipmentFieldDef) => f.key === key)
    if (found) return found.label
  }
  return key
}

function getParamUnit(key: string): string {
  for (const fields of Object.values(equipmentFieldConfigs)) {
    const found = fields.find((f: EquipmentFieldDef) => f.key === key)
    if (found && found.unit) return found.unit
  }
  return ''
}

/** 获取每类设备的关键参数摘要 */
const keyParamKeys: Record<string, string[]> = {
  pv_module: ['peakPower', 'efficiency'],
  inverter: ['ratedPower'],
  transformer: ['ratedCapacity'],
  cable: ['conductorSection'],
  switchgear: ['ratedVoltage', 'ratedCurrent'],
  other: [],
}

function getKeyParamSummary(row: any): string {
  const keys = keyParamKeys[row.equipmentType] || []
  return keys
    .map((k: string) => {
      const val = row.ratedParams?.[k]
      if (val === undefined || val === null || val === '') return ''
      const unit = getParamUnit(k)
      return `${getParamLabel(k)}: ${val}${unit ? ' ' + unit : ''}`
    })
    .filter(Boolean)
    .join(' | ')
}

function openNewRecord() {
  newRecord.value = {
    equipmentId: currentRecord.value?.id || '',
    eventType: 'maintenance',
    eventTypeLabel: '检修维护',
    eventTime: new Date().toISOString().slice(0, 10),
    operator: '',
    description: '',
    attachments: [],
    eventData: {},
  }
  recordDialogVisible.value = true
}

async function saveRecord() {
  if (!newRecord.value) return
  try {
    await createLifecycleRecord(newRecord.value)
    recordDialogVisible.value = false
    if (currentRecord.value) {
      lifecycleRecords.value = await fetchLifecycleRecords(currentRecord.value.id)
    }
    ElMessage.success('记录已添加')
  } catch {
    ElMessage.error('添加记录失败')
  }
}

onMounted(() => {
  loadStations()
})
</script>

<template>
  <div>
    <div class="chart-panel-title">设备台账动态管理</div>
    <!-- Station Selector -->
    <div class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title">选择光伏电站</div>
      <div style="display:flex;align-items:center;gap:16px;padding:8px 0">
        <el-select
          v-model="selectedStationId"
          placeholder="请选择光伏电站"
          size="large"
          style="width:360px"
          clearable
          filterable
          @change="onStationChange"
        >
          <el-option
            v-for="s in stations"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          >
            <div style="display:flex;justify-content:space-between">
              <span>{{ s.name }}</span>
              <span style="color:#909399;font-size:12px">{{ s.capacityKw }}kW</span>
            </div>
          </el-option>
        </el-select>
        <span v-if="!selectedStationId" style="color:#909399;font-size:13px">
          请先选择一个光伏电站，查看和管理该站的设备台账
        </span>
      </div>
    </div>

    <!-- Stats & Equipment -->
    <template v-if="selectedStationId">
      <!-- Filter Bar -->
      <div class="chart-panel" style="margin-bottom:16px">
        <div class="chart-panel-title">筛选条件</div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:4px 0">
          <el-select v-model="filterType" placeholder="设备类型" clearable style="width:140px" size="default">
            <el-option v-for="o in equipmentTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" size="default">
            <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-input
            v-model="filterKeyword"
            placeholder="搜索设备编码 / 型号 / 制造商"
            clearable
            style="width:280px"
            size="default"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <span v-if="filterKeyword || filterType || filterStatus" style="color:#909399;font-size:13px">
            共匹配 <strong>{{ filteredEquipment.length }}</strong> 条
          </span>
        </div>
      </div>

      <div class="chart-panel">
        <div class="chart-panel-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>设备台账列表 ({{ equipment.length }})</span>
          <el-button type="primary" size="small" @click="openCreate">新增设备</el-button>
        </div>
        <el-table :data="filteredEquipment" v-loading="loading" stripe size="small">
          <el-table-column type="expand" width="36">
            <template #default="{ row }">
              <div style="padding:8px 16px">
                <div v-if="row.ratedParams && Object.keys(row.ratedParams).length > 0" style="display:flex;flex-wrap:wrap;gap:8px">
                  <div
                    v-for="(val, key) in row.ratedParams"
                    :key="key"
                    style="background:#f5f7fa;border-radius:4px;padding:4px 12px;font-size:13px;white-space:nowrap"
                  >
                    <span style="color:#909399">{{ getParamLabel(key) }}:</span>
                    <span style="color:#303133;margin-left:4px">{{ val }}{{ getParamUnit(key) ? ' ' + getParamUnit(key) : '' }}</span>
                  </div>
                </div>
                <div v-else style="color:#909399;font-size:13px;padding:4px 0">暂无技术参数</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="设备类型" width="110">
            <template #default="{ row }">
              <el-tag size="small">
                {{ equipmentTypeLabels[row.equipmentType] || row.equipmentType }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="equipmentCode" label="设备编码" width="150" />
          <el-table-column label="关键参数" min-width="180">
            <template #default="{ row }">
              <span style="font-size:13px">{{ getKeyParamSummary(row) || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="modelNumber" label="型号" width="130" />
          <el-table-column prop="manufacturer" label="制造商" width="140" />
          <el-table-column label="数量" width="70">
            <template #default="{ row }">{{ row.quantity?.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="installDate" label="投运日期" width="100" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="statusTypes[row.status] || 'info'" size="small">
                {{ statusLabels[row.status] || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="locationDesc" label="位置" min-width="120" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button size="small" link type="warning" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="confirmDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- Empty state -->
    <el-empty v-else description="请先选择一个光伏电站" :image-size="120" />

    <!-- ==================== Create / Edit Dialog ==================== -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="750px" destroy-on-close>
      <el-form :model="formData" label-width="110px" size="small">
        <!-- Row 1: 设备类型 + 设备编码 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="设备类型" required>
              <el-select v-model="formData.equipmentType" style="width:100%">
                <el-option v-for="o in equipmentTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备编码">
              <el-input v-model="formData.equipmentCode" placeholder="留空自动生成" />
            </el-form-item>
          </el-col>
        </el-row>
        <!-- Row 2: 型号 + 制造商 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="型号" required>
              <el-select
                v-model="formData.modelNumber"
                filterable
                allow-create
                clearable
                placeholder="选择或输入型号"
                style="width:100%"
                @change="onModelChange"
              >
                <el-option label="── 自定义 ──" value="__custom__" />
                <el-option
                  v-for="m in availableModels"
                  :key="m.modelNumber"
                  :label="m.modelNumber"
                  :value="m.modelNumber"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="制造商">
              <el-input v-model="formData.manufacturer" placeholder="请输入制造商" />
            </el-form-item>
          </el-col>
        </el-row>
        <!-- Row 3: 数量 + 投运日期 + 状态 -->
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="数量">
              <el-input-number v-model="formData.quantity" :min="1" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="投运日期">
              <el-date-picker v-model="formData.installDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-select v-model="formData.status" style="width:100%">
                <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Divider: 技术参数 -->
        <el-divider v-if="hasTechFields" content-position="left">
          <span style="font-weight:600;font-size:14px">技术参数 ({{ equipmentTypeLabels[formData.equipmentType] || formData.equipmentType }})</span>
        </el-divider>

        <!-- Dynamic fields per equipment type -->
        <template v-if="hasTechFields">
          <el-row :gutter="20" v-for="(field, idx) in currentFields" :key="field.key">
            <el-col :span="field.type === 'string' && !field.options ? 24 : 12">
              <el-form-item
                :label="field.label"
                :required="field.required"
                :prop="'ratedParams.' + field.key"
              >
                <!-- select -->
                <el-select
                  v-if="field.options"
                  v-model="formData.ratedParams[field.key]"
                  :placeholder="field.placeholder || '请选择'"
                  style="width:100%"
                  clearable
                >
                  <el-option
                    v-for="opt in field.options"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <!-- number with unit suffix -->
                <el-input
                  v-else-if="field.type === 'number'"
                  v-model.number="formData.ratedParams[field.key]"
                  :placeholder="field.placeholder || '请输入'"
                  style="width:100%"
                >
                  <template v-if="field.unit" #suffix>
                    <span style="color:#909399;font-size:12px">{{ field.unit }}</span>
                  </template>
                </el-input>
                <!-- string -->
                <el-input
                  v-else
                  v-model="formData.ratedParams[field.key]"
                  :placeholder="field.placeholder || '请输入'"
                  style="width:100%"
                />
              </el-form-item>
            </el-col>
            <!-- number fields occupy 2 cols (12 each), string occupies full width (24) -->
            <el-col v-if="field.type === 'number' && idx + 1 < currentFields.length && currentFields[idx + 1].type === 'number'" :span="12">
              <!-- 如果是两个 number 挨着，前一个占左12，当前占右12。用下一个迭代处理 -->
            </el-col>
          </el-row>
        </template>

        <!-- 位置 -->
        <el-form-item label="位置" style="margin-top:8px">
          <el-input v-model="formData.locationDesc" placeholder="设备安装位置描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEquipment">保存</el-button>
      </template>
    </el-dialog>

    <!-- ==================== Detail Drawer ==================== -->
    <el-drawer v-model="drawerVisible" :title="currentRecord?.equipmentCode || '设备详情'" size="620px" destroy-on-close>
      <template v-if="currentRecord">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="设备编码">{{ currentRecord.equipmentCode }}</el-descriptions-item>
          <el-descriptions-item label="设备类型">
            {{ equipmentTypeLabels[currentRecord.equipmentType] || currentRecord.equipmentType }}
          </el-descriptions-item>
          <el-descriptions-item label="型号">{{ currentRecord.modelNumber }}</el-descriptions-item>
          <el-descriptions-item label="制造商">{{ currentRecord.manufacturer }}</el-descriptions-item>
          <el-descriptions-item label="数量">{{ currentRecord.quantity }}</el-descriptions-item>
          <el-descriptions-item label="投运日期">{{ currentRecord.installDate }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTypes[currentRecord.status] || 'info'" size="small">
              {{ statusLabels[currentRecord.status] || currentRecord.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="位置">{{ currentRecord.locationDesc }}</el-descriptions-item>
        </el-descriptions>

        <!-- 技术参数展示 -->
        <el-divider content-position="left" v-if="currentRecord.ratedParams && Object.keys(currentRecord.ratedParams).length > 0">
          <span style="font-weight:600;font-size:14px">技术参数 ({{ equipmentTypeLabels[currentRecord.equipmentType] || currentRecord.equipmentType }})</span>
        </el-divider>
        <el-descriptions
          v-if="currentRecord.ratedParams && Object.keys(currentRecord.ratedParams).length > 0"
          :column="2"
          border
          size="small"
        >
          <el-descriptions-item
            v-for="(val, key) in currentRecord.ratedParams"
            :key="key"
          >
            <template #label>
              <span style="white-space:nowrap">{{ getParamLabel(key) }}</span>
            </template>
            {{ val }}{{ getParamUnit(key) ? ' ' + getParamUnit(key) : '' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 全生命周期记录 -->
        <el-divider content-position="left">
          <span style="font-weight:600;font-size:14px">全生命周期记录</span>
        </el-divider>
        <el-timeline>
          <el-timeline-item
            v-for="rec in lifecycleRecords"
            :key="rec.id"
            :timestamp="rec.eventTime"
            :type="
              rec.eventType === 'design' ? 'primary'
                : rec.eventType === 'procurement' ? 'success'
                : rec.eventType === 'commissioning' ? 'warning'
                : rec.eventType === 'operation' ? 'info'
                : 'danger'
            "
          >
            <div style="font-weight:600">{{ rec.eventTypeLabel }}</div>
            <div style="font-size:13px;color:#606266;margin:4px 0">{{ rec.description }}</div>
            <div style="font-size:12px;color:#909399">操作人: {{ rec.operator }}</div>
          </el-timeline-item>
        </el-timeline>
        <div v-if="lifecycleRecords.length === 0" style="text-align:center;color:#909399;font-size:13px;padding:16px">
          暂无记录
        </div>

        <div style="text-align:center;margin-top:12px">
          <el-button type="primary" size="small" @click="openNewRecord">新增记录</el-button>
        </div>

        <el-divider content-position="left">
          <span style="font-weight:600;font-size:14px">台账关联查询</span>
        </el-divider>
        <el-form size="small" label-width="100px">
          <el-form-item label="设备编码">
            <el-input :model-value="currentRecord.equipmentCode" disabled />
          </el-form-item>
          <el-form-item label="关联电网设备">
            <el-tag type="info" style="margin-right:6px">母线: BUS-110-01</el-tag>
            <el-tag type="info">馈线: FDR-03</el-tag>
          </el-form-item>
        </el-form>
      </template>
    </el-drawer>

    <!-- ==================== New Lifecycle Record Dialog ==================== -->
    <el-dialog v-model="recordDialogVisible" title="新增生命周期记录" width="550px" destroy-on-close>
      <el-form :model="newRecord" label-width="100px" size="small">
        <el-form-item label="事件类型">
          <el-select v-model="newRecord.eventType" style="width:100%">
            <el-option v-for="o in lifecycleEventOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="事件时间">
          <el-date-picker v-model="newRecord.eventTime" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="newRecord.operator" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newRecord.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="recordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
