<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchPvStations, createPvStation, updatePvStation, deletePvStation,
  fetchCostLibrary, upsertCostLibraryItem,
  fetchPvModelTypes, createPvModelType, updatePvModelType, deletePvModelType,
  fetchModelTypeFields, saveModelTypeFields,
  fetchFieldLibrary, createFieldLibraryItem, deleteFieldLibraryItem,
} from '@/api/planning'
import type { PvModelType, PvModelTypeField } from '@new-energy/shared'
import { formatDate } from '@/utils/time'

const loading = ref(false)
const stations = ref<any[]>([])
const costData = ref<{ unitCostPerKw?: number; remark?: string } | null>(null)
const modelTypes = ref<PvModelType[]>([])
const dialogVisible = ref(false)
const costDialogVisible = ref(false)
const costEditForm = ref({ unitCostPerKw: 0, remark: '' })
const editingStation = ref<any>(null)
const stationForm = ref<Record<string, any>>({ name: '', modelTypeId: '', customFields: {} })
const activeTab = ref<'stations' | 'cost' | 'tools'>('stations')

// ==================== 规划工具 ====================
const selectedModelType = ref<PvModelType | null>(null)
const modelTypeFields = ref<PvModelTypeField[]>([])
const typeDialogVisible = ref(false)
const typeEditMode = ref(false)
const typeForm = ref({ name: '', code: '', description: '', sortOrder: 0 })

const fieldDialogVisible = ref(false)
const fieldEditIdx = ref(-1)
const fieldForm = ref({ fieldCode: '', fieldName: '', fieldType: 'text', fieldOptions: '', isRequired: false, category: '基础信息' })
const fieldPage = ref(1)
const fieldPageSize = ref(20)

const fieldTypeOptions = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '下拉选择', value: 'select' },
  { label: '日期', value: 'date' },
]

async function loadStations() {
  loading.value = true
  try {
    stations.value = await fetchPvStations()
  } finally {
    loading.value = false
  }
}

const costModelTypeId = ref('')

async function loadCostData() {
  if (!costModelTypeId.value) return
  try {
    const list = await fetchCostLibrary({ modelTypeId: costModelTypeId.value })
    if (list.length > 0) {
      const item: any = list[0]
      costData.value = { unitCostPerKw: item.unit_cost_per_kw ?? item.unitCostPerKw, remark: item.remark }
    } else {
      costData.value = null
    }
  } catch { costData.value = null }
}

function openCostEdit() {
  costEditForm.value = {
    unitCostPerKw: costData.value?.unitCostPerKw || 0,
    remark: costData.value?.remark || '',
  }
  costDialogVisible.value = true
}

async function saveCostEdit() {
  await upsertCostLibraryItem({
    modelTypeId: costModelTypeId.value,
    unitCostPerKw: costEditForm.value.unitCostPerKw,
    remark: costEditForm.value.remark,
  })
  costDialogVisible.value = false
  await loadCostData()
}

async function loadModelTypes() {
  try {
    modelTypes.value = await fetchPvModelTypes()
    if (!costModelTypeId.value && modelTypes.value.length > 0) {
      costModelTypeId.value = modelTypes.value[0].id
    }
  } catch { modelTypes.value = [] }
}

// ==================== 电站 CRUD ====================
const selectedTypeFields = computed(() => {
  const typeId = stationForm.value.modelTypeId
  if (!typeId) return []
  const t = modelTypes.value.find((mt: PvModelType) => mt.id === typeId)
  return t?.fields || []
})

watch(() => stationForm.value.modelTypeId, () => {
  stationForm.value.customFields = {}
})

watch(costModelTypeId, () => {
  loadCostData()
})

function openNewStation() {
  editingStation.value = null
  stationForm.value = { name: '', modelTypeId: '', customFields: {} }
  dialogVisible.value = true
}

function openEditStation(row: any) {
  editingStation.value = row
  stationForm.value = {
    name: row.name,
    modelTypeId: row.model_type_id || '',
    customFields: parseCustomFields(row),
  }
  dialogVisible.value = true
}

async function saveStation() {
  if (!stationForm.value.modelTypeId) {
    ElMessage.warning('请选择模型类型')
    return
  }
  const payload: any = {
    name: stationForm.value.name,
    modelTypeId: stationForm.value.modelTypeId,
    customFields: stationForm.value.customFields || {},
  }
  if (editingStation.value?.id) {
    await updatePvStation(editingStation.value.id, payload)
  } else {
    await createPvStation(payload)
  }
  dialogVisible.value = false
  await loadStations()
}

async function removeStation(id: string) {
  await deletePvStation(id)
  await loadStations()
}

// ==================== 模型类型 CRUD ====================
function openTypeCreate() {
  typeEditMode.value = false
  typeForm.value = { name: '', code: 'TYPE_' + Date.now().toString(36).toUpperCase(), description: '', sortOrder: modelTypes.value.length }
  typeDialogVisible.value = true
}

function openTypeEdit(row: PvModelType) {
  typeEditMode.value = true
  typeForm.value = { name: row.name, code: row.code, description: row.description || '', sortOrder: row.sort_order || 0 }
  typeDialogVisible.value = true
}

async function handleTypeSave() {
  try {
    if (typeEditMode.value && selectedModelType.value) {
      await updatePvModelType(selectedModelType.value.id, typeForm.value)
      ElMessage.success('类型更新成功')
    } else {
      await createPvModelType(typeForm.value)
      ElMessage.success('类型创建成功')
    }
    typeDialogVisible.value = false
    await loadModelTypes()
  } catch { ElMessage.error('操作失败') }
}

async function handleTypeDelete(row: PvModelType) {
  try {
    await ElMessageBox.confirm(`确定删除类型「${row.name}」？关联字段一并删除。`, '确认删除', { type: 'warning' })
    await deletePvModelType(row.id)
    ElMessage.success('已删除')
    if (selectedModelType.value?.id === row.id) selectedModelType.value = null
    await loadModelTypes()
  } catch { /* cancelled */ }
}

async function selectTypeForFields(row: PvModelType) {
  selectedModelType.value = row
  fieldPage.value = 1
  modelTypeFields.value = await fetchModelTypeFields(row.id)
}

// ==================== 字段库 ====================
const libraryDialogVisible = ref(false)
const fieldLibrary = ref<Array<{ id: string; field_code: string; field_name: string; field_type: string; field_options?: string; category?: string }>>([])
const librarySearch = ref('')
const libraryLoading = ref(false)

const libraryCategories = ['基础信息', '电气参数', '地理坐标', '土地属性', '设备台账']
const libraryActiveCategory = ref('基础信息')

const filteredFieldLibrary = computed(() => {
  const usedCodes = new Set(modelTypeFields.value.map((f: any) => f.field_code || f.fieldCode))
  return fieldLibrary.value.filter(f => !usedCodes.has(f.field_code) && f.category === libraryActiveCategory.value)
})

async function openFieldLibrary() {
  librarySearch.value = ''
  libraryActiveCategory.value = '基础信息'
  librarySelected.value = []
  libraryLoading.value = true
  libraryDialogVisible.value = true
  try {
    fieldLibrary.value = await fetchFieldLibrary()
  } finally {
    libraryLoading.value = false
  }
}

async function handleLibrarySearch() {
  libraryLoading.value = true
  try {
    fieldLibrary.value = await fetchFieldLibrary(librarySearch.value || undefined)
  } finally {
    libraryLoading.value = false
  }
}

// ==================== 字段操作（自动保存） ====================
async function doSaveFields(fields: any[]) {
  if (!selectedModelType.value) return
  await saveModelTypeFields(selectedModelType.value.id, fields.map((f: any, i: number) => ({
    fieldCode: f.field_code || f.fieldCode,
    fieldName: f.field_name || f.fieldName,
    fieldType: f.field_type || f.fieldType,
    fieldOptions: f.field_options || f.fieldOptions,
    isRequired: (f.is_required === 1 || f.isRequired === true),
    sortOrder: f.sort_order ?? i,
    category: f.category || '基础信息',
  })))
  await loadModelTypes()
  modelTypeFields.value = await fetchModelTypeFields(selectedModelType.value.id)
  const maxPage = Math.max(1, Math.ceil(modelTypeFields.value.length / fieldPageSize.value))
  if (fieldPage.value > maxPage) fieldPage.value = maxPage
}

const librarySelected = ref<string[]>([])

function toggleLibraryField(code: string) {
  const idx = librarySelected.value.indexOf(code)
  if (idx >= 0) {
    librarySelected.value.splice(idx, 1)
  } else {
    librarySelected.value.push(code)
  }
}

function isLibrarySelected(code: string) {
  return librarySelected.value.includes(code)
}

async function handleDeleteLibraryField(id: string) {
  try {
    await ElMessageBox.confirm('确定从字段库中删除该字段？', '确认删除', { type: 'warning' })
    await deleteFieldLibraryItem(id)
    fieldLibrary.value = fieldLibrary.value.filter(f => f.id !== id)
    ElMessage.success('已删除')
  } catch { /* cancelled */ }
}

async function handleBatchAddFields() {
  if (librarySelected.value.length === 0) return
  const list = [...modelTypeFields.value]
  for (const code of librarySelected.value) {
    const f = fieldLibrary.value.find(item => item.field_code === code)
    if (!f) continue
    list.push({
      field_code: f.field_code,
      field_name: f.field_name,
      field_type: f.field_type,
      field_options: f.field_options || null,
      is_required: 0,
      sort_order: list.length,
      category: f.category || '基础信息',
    } as any)
  }
  libraryDialogVisible.value = false
  try {
    await doSaveFields(list)
    fieldPage.value = Math.ceil(modelTypeFields.value.length / fieldPageSize.value)
  } catch { ElMessage.error('添加失败') }
}

function openFieldCreate() {
  fieldEditIdx.value = -1
  fieldForm.value = { fieldCode: '', fieldName: '', fieldType: 'text', fieldOptions: '', isRequired: false, category: '基础信息' }
  libraryDialogVisible.value = false
  fieldDialogVisible.value = true
}

function openFieldEdit(idx: number, f: PvModelTypeField) {
  fieldEditIdx.value = idx
  fieldForm.value = {
    fieldCode: f.field_code,
    fieldName: f.field_name,
    fieldType: f.field_type,
    fieldOptions: f.field_options || '',
    isRequired: f.is_required === 1,
    category: (f as any).category || '基础信息',
  }
  fieldDialogVisible.value = true
}

async function handleFieldSave() {
  const list = [...modelTypeFields.value]
  const item = {
    fieldCode: fieldForm.value.fieldCode,
    fieldName: fieldForm.value.fieldName,
    fieldType: fieldForm.value.fieldType,
    fieldOptions: fieldForm.value.fieldOptions || undefined,
    isRequired: fieldForm.value.isRequired,
    sortOrder: fieldEditIdx.value >= 0 ? list[fieldEditIdx.value].sort_order : list.length,
    category: fieldForm.value.category,
  }
  const wasAdd = fieldEditIdx.value < 0
  if (fieldEditIdx.value >= 0) {
    list.splice(fieldEditIdx.value, 1, { ...list[fieldEditIdx.value], ...item } as any)
  } else {
    list.push(item as any)
    createFieldLibraryItem({
      fieldCode: item.fieldCode,
      fieldName: item.fieldName,
      fieldType: item.fieldType,
      fieldOptions: item.fieldOptions,
      category: fieldForm.value.category,
    }).catch(() => {})
  }
  fieldDialogVisible.value = false
  try {
    await doSaveFields(list)
    if (wasAdd) fieldPage.value = Math.ceil(modelTypeFields.value.length / fieldPageSize.value)
  } catch { ElMessage.error('保存失败') }
}

async function handleFieldDelete(idx: number) {
  const list = [...modelTypeFields.value]
  list.splice(idx, 1)
  try {
    await doSaveFields(list)
  } catch { ElMessage.error('删除失败') }
}

async function handleClearAllFields() {
  if (modelTypeFields.value.length === 0) return
  try {
    await ElMessageBox.confirm('确定清空该模型的所有字段？此操作不可恢复。', '确认清空', { type: 'warning' })
    await doSaveFields([])
    fieldPage.value = 1
    ElMessage.success('已清空')
  } catch { /* cancelled */ }
}

function getModelTypeName(typeId: string) {
  return modelTypes.value.find((mt: PvModelType) => mt.id === typeId)?.name || ''
}

function parseCustomFields(row: any): Record<string, any> {
  try { return row.custom_fields ? JSON.parse(row.custom_fields) : {} } catch { return {} }
}

function renderCustomFieldValue(row: any, fieldCode: string): string {
  const cf = parseCustomFields(row)
  return cf[fieldCode] ?? '-'
}

onMounted(async () => {
  loadStations()
  await loadModelTypes()
  loadCostData()
})
</script>

<template>
  <div>
    <div class="chart-panel-title">集中式光伏模型集成</div>
    <div class="chart-panel">
      <div class="panel-header">
        <div class="sub-tabs">
          <span :class="['sub-tab', { active: activeTab === 'stations' }]" @click="activeTab = 'stations'">光伏电站管理</span>
          <span :class="['sub-tab', { active: activeTab === 'cost' }]" @click="activeTab = 'cost'">设备综合造价库</span>
          <span :class="['sub-tab', { active: activeTab === 'tools' }]" @click="activeTab = 'tools'">规划工具</span>
        </div>
        <el-button v-if="activeTab === 'stations'" type="primary" size="small" @click="openNewStation">新建电站</el-button>
      </div>

      <!-- Station Table -->
      <el-table v-if="activeTab === 'stations'" :data="stations" v-loading="loading" stripe size="small">
        <el-table-column prop="name" label="电站名称" min-width="160" />
        <el-table-column label="模型类型" width="150">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ getModelTypeName(row.model_type_id) || '未设置' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="装机容量" width="120">
          <template #default="{ row }">{{ renderCustomFieldValue(row, 'total_capacity') }} MWp</template>
        </el-table-column>
        <el-table-column label="并网电压" width="90">
          <template #default="{ row }">{{ renderCustomFieldValue(row, 'grid_voltage') }}</template>
        </el-table-column>
        <el-table-column label="项目状态" width="100">
          <template #default="{ row }">{{ renderCustomFieldValue(row, 'project_status') }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="110">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="openEditStation(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="removeStation(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Cost Library -->
      <template v-if="activeTab === 'cost'">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <span style="font-size:13px;color:#606266">光伏模型：</span>
          <el-select v-model="costModelTypeId" size="small" style="width:200px">
            <el-option v-for="t in modelTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </div>
        <div class="inner-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-size:14px;font-weight:600;color:#303133">综合造价评估</span>
            <el-button size="small" type="primary" @click="openCostEdit">编辑</el-button>
          </div>
          <div style="display:flex;gap:40px">
            <div>
              <div style="font-size:12px;color:#909399;margin-bottom:4px">综合单位造价</div>
              <div style="font-size:22px;font-weight:600;color:#303133">
                {{ costData?.unitCostPerKw != null ? costData.unitCostPerKw.toLocaleString() : '-' }}
                <span style="font-size:13px;font-weight:400;color:#909399">元/kW</span>
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:#909399;margin-bottom:4px">备注</div>
              <div style="font-size:14px;color:#606266">{{ costData?.remark || '-' }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- 规划工具 -->
      <template v-if="activeTab === 'tools'">
        <div class="grid-2">
          <div class="inner-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:14px;font-weight:600;color:#303133">光伏模型类型</span>
              <el-button type="primary" size="small" @click="openTypeCreate">新增类型</el-button>
            </div>
            <el-table :data="modelTypes" stripe size="small" highlight-current-row @row-click="selectTypeForFields">
              <el-table-column prop="name" label="类型名称" width="140" />
              <el-table-column prop="code" label="编码" width="180" />
              <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
              <el-table-column label="操作" width="140">
                <template #default="{ row }">
                  <el-button size="small" link type="primary" @click.stop="openTypeEdit(row)">编辑</el-button>
                  <el-button size="small" link @click.stop="handleTypeDelete(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="inner-panel" v-if="selectedModelType">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:14px;font-weight:600;color:#303133">
                {{ selectedModelType.name }} — 自定义字段
              </span>
              <div style="display:flex;gap:8px">
                <el-button type="primary" size="small" @click="openFieldLibrary">添加字段</el-button>
                <el-button size="small" @click="handleClearAllFields" :disabled="modelTypeFields.length === 0">一键删除</el-button>
              </div>
            </div>
            <el-table :data="modelTypeFields.slice((fieldPage - 1) * fieldPageSize, fieldPage * fieldPageSize)" stripe size="small" row-style="height:42px">
              <el-table-column prop="field_name" label="字段名" width="120" />
              <el-table-column prop="field_code" label="字段编码" width="120" />
              <el-table-column label="字段属性" width="120">
                <template #default="{ row }">{{ (row as any).category || '基础信息' }}</template>
              </el-table-column>
              <el-table-column label="字段类型" width="80">
                <template #default="{ row }">
                  {{ fieldTypeOptions.find(o => o.value === row.field_type)?.label || row.field_type }}
                </template>
              </el-table-column>
              <el-table-column label="必填" width="60">
                <template #default="{ row }">{{ row.is_required ? '是' : '否' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="{ row, $index }">
                  <el-button size="small" link type="primary" @click="openFieldEdit((fieldPage - 1) * fieldPageSize + $index, row)">编辑</el-button>
                  <el-button size="small" link @click="handleFieldDelete((fieldPage - 1) * fieldPageSize + $index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-pagination
              v-if="modelTypeFields.length > fieldPageSize"
              style="margin-top:12px;justify-content:flex-end"
              layout="total, prev, pager, next"
              :total="modelTypeFields.length"
              :page-size="fieldPageSize"
              v-model:current-page="fieldPage"
              small
            />
          </div>
          <div class="inner-panel" v-else style="display:flex;align-items:center;justify-content:center;color:#909399;font-size:14px">
            选择左侧类型以查看和管理其字段
          </div>
        </div>
      </template>
    </div>

    <!-- Station Dialog -->
    <el-dialog v-model="dialogVisible" :title="editingStation ? '编辑光伏电站' : '新建光伏电站'" width="650px" destroy-on-close>
      <el-form :model="stationForm" label-width="120px" size="small">
        <el-form-item label="电站名称" required>
          <el-input v-model="stationForm.name" placeholder="请输入电站名称" />
        </el-form-item>
        <el-form-item label="模型类型" required>
          <el-select v-model="stationForm.modelTypeId" style="width:100%" placeholder="请选择模型类型">
            <el-option v-for="t in modelTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>

        <!-- 动态字段 -->
        <template v-if="selectedTypeFields.length > 0">
          <el-divider style="margin:8px 0" />
          <el-form-item v-for="f in selectedTypeFields" :key="f.field_code" :label="f.field_name" :required="f.is_required === 1">
            <template v-if="f.field_type === 'number'">
              <el-input-number v-model="stationForm.customFields[f.field_code]" :precision="2" style="width:100%" />
            </template>
            <template v-else-if="f.field_type === 'date'">
              <el-date-picker v-model="stationForm.customFields[f.field_code]" type="date" style="width:100%" value-format="YYYY-MM-DD" />
            </template>
            <template v-else-if="f.field_type === 'select'">
              <el-select v-model="stationForm.customFields[f.field_code]" style="width:100%" clearable>
                <el-option
                  v-for="opt in (() => { try { return JSON.parse(f.field_options || '[]') } catch { return [] } })()"
                  :key="opt" :label="opt" :value="opt"
                />
              </el-select>
            </template>
            <template v-else>
              <el-input v-model="stationForm.customFields[f.field_code]" />
            </template>
          </el-form-item>
        </template>
        <div v-else-if="stationForm.modelTypeId" style="color:#909399;font-size:13px;text-align:center;padding:20px 0">
          该模型类型暂无自定义字段
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStation">保存</el-button>
      </template>
    </el-dialog>

    <!-- Cost Edit Dialog -->
    <el-dialog v-model="costDialogVisible" title="编辑综合造价" width="450px" destroy-on-close>
      <el-form :model="costEditForm" label-width="130px" size="small">
        <el-form-item label="综合单位造价" required>
          <el-input-number v-model="costEditForm.unitCostPerKw" :min="0" style="width:100%" />
          <span style="font-size:12px;color:#909399">元/kW</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="costEditForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="costDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveCostEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 模型类型编辑弹窗 -->
    <el-dialog :title="typeEditMode ? '编辑模型类型' : '新增模型类型'" v-model="typeDialogVisible" width="480px">
      <el-form :model="typeForm" label-width="80px" size="small">
        <el-form-item label="类型名称" required>
          <el-input v-model="typeForm.name" />
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-model="typeForm.code" :disabled="typeEditMode" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="typeForm.description" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="typeForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="typeDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleTypeSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 字段库弹窗 -->
    <el-dialog title="从字段库选取" v-model="libraryDialogVisible" width="700px">
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <el-input v-model="librarySearch" placeholder="搜索字段编码或名称" size="small" clearable @clear="handleLibrarySearch" @keyup.enter="handleLibrarySearch" style="width:280px" />
        <el-button size="small" type="primary" @click="handleLibrarySearch">搜索</el-button>
      </div>
      <div class="sub-tabs" style="margin-bottom:12px">
        <span v-for="cat in libraryCategories" :key="cat"
          :class="['sub-tab', { active: libraryActiveCategory === cat }]"
          @click="libraryActiveCategory = cat">{{ cat }}</span>
      </div>
      <el-table :data="filteredFieldLibrary" stripe size="small" max-height="360" v-loading="libraryLoading"
        @row-click="(row: any) => toggleLibraryField(row.field_code)" :row-class-name="({ row }: any) => isLibrarySelected(row.field_code) ? 'lib-row-selected' : ''">
        <el-table-column width="50">
          <template #default="{ row }">
            <el-checkbox :model-value="isLibrarySelected(row.field_code)" @change="toggleLibraryField(row.field_code)" />
          </template>
        </el-table-column>
        <el-table-column prop="field_code" label="字段编码" width="180" />
        <el-table-column prop="field_name" label="字段名称" width="200" />
        <el-table-column label="字段类型" width="80">
          <template #default="{ row }">
            {{ fieldTypeOptions.find(o => o.value === row.field_type)?.label || row.field_type }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="60">
          <template #default="{ row }">
            <el-button size="small" link type="danger" @click.stop="handleDeleteLibraryField(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:#909399;font-size:13px">已选 {{ librarySelected.length }} 个字段</span>
        <div style="display:flex;gap:8px">
          <el-button size="small" @click="openFieldCreate">新建字段</el-button>
          <el-button size="small" type="primary" @click="handleBatchAddFields" :disabled="librarySelected.length === 0">批量添加</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 字段编辑弹窗 -->
    <el-dialog :title="fieldEditIdx >= 0 ? '编辑字段' : '添加字段'" v-model="fieldDialogVisible" width="480px">
      <el-form :model="fieldForm" label-width="90px" size="small">
        <el-form-item label="字段编码" required>
          <el-input v-model="fieldForm.fieldCode" placeholder="如：voltage_level" />
        </el-form-item>
        <el-form-item label="字段名称" required>
          <el-input v-model="fieldForm.fieldName" placeholder="如：并网电压等级(kV)" />
        </el-form-item>
        <el-form-item label="字段类型" required>
          <el-select v-model="fieldForm.fieldType" style="width:100%">
            <el-option v-for="o in fieldTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属分类" required>
          <el-select v-model="fieldForm.category" style="width:100%">
            <el-option v-for="cat in libraryCategories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="fieldForm.fieldType === 'select'" label="选项列表">
          <el-input v-model="fieldForm.fieldOptions" type="textarea" :rows="2" placeholder='JSON数组，如：["35","110","220"]' />
        </el-form-item>
        <el-form-item label="是否必填">
          <el-switch v-model="fieldForm.isRequired" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="fieldDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleFieldSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.sub-tabs {
  display: flex;
  gap: 0;
}
.sub-tab {
  padding: 6px 18px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-right: none;
  transition: all 0.2s;
}
.sub-tab:first-child { border-radius: 4px 0 0 4px; }
.sub-tab:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #dcdfe6; }
.sub-tab.active {
  background: #267F7B;
  color: #fff;
  border-color: #267F7B;
}
.sub-tab.active + .sub-tab { border-left-color: #267F7B; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.inner-panel { background: #fff; border: 1px solid #ebeef5; border-radius: 4px; padding: 16px; }
:deep(.lib-row-selected) { background-color: #ecf5ff; }
</style>
