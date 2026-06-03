<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchProjects, createProject, updateProject,
  fetchProjectTypesWithFields, createProjectType, updateProjectType, deleteProjectType,
  fetchTypeFields, saveTypeFields,
  fetchProjectFieldLibrary, createProjectFieldLibraryItem, deleteProjectFieldLibraryItem,
  fetchProjectDocuments, uploadProjectDocument, deleteProjectDocument, getDocumentDownloadUrl,
} from '@/api/achievement'
import type { ProjectItem, ProjectType, ProjectTypeField, ProjectDocument } from '@/api/achievement'

// ==================== 标签页 ====================
const activeTab = ref('project-list')

// ==================== 项目类型管理 ====================
const types = ref<ProjectType[]>([])
const selectedType = ref<ProjectType | null>(null)
const fields = ref<ProjectTypeField[]>([])
const typeDialogVisible = ref(false)
const typeEditMode = ref(false)
const typeForm = ref({ name: '', code: '', description: '', sortOrder: 0 })

const fieldDialogVisible = ref(false)
const fieldEditIdx = ref(-1)
const fieldForm = ref({ fieldCode: '', fieldName: '', fieldType: 'text', fieldOptions: '', isRequired: false, category: '项目基础信息' })

// ==================== 字段库 ====================
const libraryDialogVisible = ref(false)
const fieldLibrary = ref<Array<{ id: string; field_code: string; field_name: string; field_type: string; field_options?: string; category?: string }>>([])
const librarySearch = ref('')
const libraryLoading = ref(false)
const librarySelected = ref<string[]>([])
const libraryCategories = ['项目基础信息', '规划阶段信息', '并网进度']
const libraryActiveCategory = ref('项目基础信息')
const filteredFieldLibrary = computed(() => {
  const usedCodes = new Set(fields.value.map((f: any) => f.field_code || f.fieldCode))
  return fieldLibrary.value.filter(f => !usedCodes.has(f.field_code) && f.category === libraryActiveCategory.value)
})

// 核心字段：不可从类型定义中删除
const systemFields = new Set([
  'project_name', 'capacity_mwp', 'land_type', 'grid_voltage',
  'annual_irradiance', 'sunshine_hours', 'solar_grade',
  'unit_cost', 'payback_years', 'irr_pct',
  'target_substation', 'filing_status',
])
function isSystemField(code: string) { return systemFields.has(code) }

const fieldTypeOptions = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '下拉选择', value: 'select' },
  { label: '日期', value: 'date' },
]

async function loadTypes() {
  types.value = await fetchProjectTypesWithFields()
}

function openTypeCreate() {
  typeEditMode.value = false
  typeForm.value = { name: '', code: '', description: '', sortOrder: 0 }
  typeDialogVisible.value = true
}

function openTypeEdit(row: ProjectType) {
  typeEditMode.value = true
  typeForm.value = { name: row.name, code: row.code, description: row.description || '', sortOrder: row.sort_order || 0 }
  typeDialogVisible.value = true
}

async function handleTypeSave() {
  try {
    if (typeEditMode.value && selectedType.value) {
      await updateProjectType(selectedType.value.id, typeForm.value)
      ElMessage.success('类型更新成功')
    } else {
      await createProjectType(typeForm.value)
      ElMessage.success('类型创建成功')
    }
    typeDialogVisible.value = false
    await loadTypes()
  } catch { ElMessage.error('操作失败') }
}

async function handleTypeDelete(row: ProjectType) {
  try {
    await ElMessageBox.confirm(`确定删除类型「${row.name}」？关联字段一并删除。`, '确认删除', { type: 'warning' })
    await deleteProjectType(row.id)
    ElMessage.success('已删除')
    if (selectedType.value?.id === row.id) selectedType.value = null
    await loadTypes()
  } catch { /* cancelled */ }
}

async function selectTypeForFields(row: ProjectType) {
  selectedType.value = row
  fields.value = await fetchTypeFields(row.id)
}

async function doSaveFields(list: any[]) {
  if (!selectedType.value) return
  await saveTypeFields(selectedType.value.id, list.map((f: any, i: number) => ({
    fieldCode: f.field_code || f.fieldCode, fieldName: f.field_name || f.fieldName,
    fieldType: f.field_type || f.fieldType, fieldOptions: f.field_options || f.fieldOptions,
    isRequired: (f.is_required === 1 || f.isRequired === true), sortOrder: f.sort_order ?? i,
    category: f.category || (f as any).category || '项目基础信息',
  })))
  await loadTypes(); allTypes.value = types.value
  fields.value = await fetchTypeFields(selectedType.value.id)
}

async function openFieldLibrary() {
  librarySearch.value = ''; libraryActiveCategory.value = '项目基础信息'; librarySelected.value = []
  libraryLoading.value = true; libraryDialogVisible.value = true
  try { fieldLibrary.value = await fetchProjectFieldLibrary() } finally { libraryLoading.value = false }
}
async function handleLibrarySearch() { libraryLoading.value = true; try { fieldLibrary.value = await fetchProjectFieldLibrary(librarySearch.value || undefined) } finally { libraryLoading.value = false } }
function isLibrarySelected(code: string) { return librarySelected.value.includes(code) }
function toggleLibraryField(code: string) { const idx = librarySelected.value.indexOf(code); if (idx >= 0) librarySelected.value.splice(idx, 1); else librarySelected.value.push(code) }

async function handleBatchAddFields() {
  if (librarySelected.value.length === 0) return
  const list = [...fields.value]
  for (const code of librarySelected.value) {
    const f = fieldLibrary.value.find(item => item.field_code === code)
    if (!f) continue
    list.push({ field_code: f.field_code, field_name: f.field_name, field_type: f.field_type, field_options: f.field_options || null, is_required: 0, sort_order: list.length, category: (f as any).category || '项目基础信息' } as any)
  }
  libraryDialogVisible.value = false
  try { await doSaveFields(list) } catch { ElMessage.error('添加失败') }
}

async function handleDeleteLibraryField(id: string) {
  try { await ElMessageBox.confirm('确定从字段库中删除该字段？', '确认删除', { type: 'warning' }); await deleteProjectFieldLibraryItem(id); fieldLibrary.value = fieldLibrary.value.filter(f => f.id !== id); ElMessage.success('已删除') } catch {}
}

async function handleClearAllFields() {
  const remaining = fields.value.filter(f => isSystemField(f.field_code || (f as any).fieldCode))
  if (fields.value.length === remaining.length) return ElMessage.warning('无可删除的非核心字段')
  try {
    await ElMessageBox.confirm(`将删除 ${fields.value.length - remaining.length} 个非核心字段，核心字段保留`, '确认清空', { type: 'warning' })
    await doSaveFields(remaining); ElMessage.success('已清空非核心字段')
  } catch {}
}

function openFieldCreate() {
  fieldEditIdx.value = -1
  fieldForm.value = { fieldCode: '', fieldName: '', fieldType: 'text', fieldOptions: '', isRequired: false, category: '项目基础信息' }
  libraryDialogVisible.value = false; fieldDialogVisible.value = true
}

function openFieldEdit(idx: number, f: ProjectTypeField) {
  fieldEditIdx.value = idx
  fieldForm.value = { fieldCode: f.field_code, fieldName: f.field_name, fieldType: f.field_type, fieldOptions: f.field_options || '', isRequired: f.is_required === 1, category: (f as any).category || '项目基础信息' }
  fieldDialogVisible.value = true
}

async function handleFieldSave() {
  if (!selectedType.value) return
  const list = [...fields.value]; const item = { fieldCode: fieldForm.value.fieldCode, fieldName: fieldForm.value.fieldName, fieldType: fieldForm.value.fieldType, fieldOptions: fieldForm.value.fieldOptions || undefined, isRequired: fieldForm.value.isRequired, sortOrder: fieldEditIdx.value >= 0 ? list[fieldEditIdx.value].sort_order : list.length }
  if (fieldEditIdx.value >= 0) { list.splice(fieldEditIdx.value, 1, { ...list[fieldEditIdx.value], ...item } as any) }
  else { list.push(item as any); createProjectFieldLibraryItem({ fieldCode: item.fieldCode, fieldName: item.fieldName, fieldType: item.fieldType, fieldOptions: item.fieldOptions, category: fieldForm.value.category }).catch(() => {}) }
  fieldDialogVisible.value = false
  try { await doSaveFields(list) } catch { ElMessage.error('保存失败') }
}

async function handleFieldDelete(idx: number) {
  const f = fields.value[idx]
  if (f && isSystemField(f.field_code || (f as any).fieldCode)) return
  const list = [...fields.value]; list.splice(idx, 1)
  try { await doSaveFields(list) } catch { ElMessage.error('删除失败') }
}

// ==================== 项目列表 ====================
const projects = ref<ProjectItem[]>([])
const loading = ref(false)
const projectDialogVisible = ref(false)
const editMode = ref(false)
const currentProject = ref<ProjectItem | null>(null)
const allTypes = ref<ProjectType[]>([])

const filterStatus = ref('')
const filterType = ref('')
const filterProgress = ref('')
const filterVoltage = ref('')
const filterOpStatus = ref('')
const docDialogVisible = ref(false)
const docProjectId = ref('')
const docProjectName = ref('')
const documents = ref<ProjectDocument[]>([])
const docLoading = ref(false)
const progressOptions = ['未开工', '场平施工', '基础施工', '设备安装', '线路施工', '调试中', '已完工']
const voltageOptions = ['10kV', '35kV', '110kV', '220kV']
const opStatusOptions = ['在建', '并网调试', '正常运行', '停运检修', '报废']

const projectForm = ref({
  projectCode: '',
  projectName: '',
  projectType: '',
  customFields: {} as Record<string, any>,
})

const statusOptions = [
  { label: '全部', value: '' },
  { label: '可研阶段', value: 'feasibility' },
  { label: '已批复', value: 'approved' },
  { label: '建设中', value: 'construction' },
  { label: '已投运', value: 'operation' },
]

const statusTagType: Record<string, string> = {
  feasibility: 'info', approved: 'success', construction: 'warning', operation: '',
}

const selectedTypeFields = computed(() => {
  if (!projectForm.value.projectType) return []
  const t = allTypes.value.find(t => t.code === projectForm.value.projectType || t.id === projectForm.value.projectType)
  return t?.fields || []
})

const groupedTypeFields = computed(() => {
  const cats = ['项目基础信息', '规划阶段信息', '并网进度']
  return cats.map(cat => ({ category: cat, fields: selectedTypeFields.value.filter((f: any) => (f.category || '项目基础信息') === cat) })).filter(g => g.fields.length > 0)
})

// 选型时重置自定义字段
watch(() => projectForm.value.projectType, () => {
  projectForm.value.customFields = {}
})

async function loadProjects() {
  loading.value = true
  try {
    const params: any = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterType.value) params.projectType = filterType.value
    if (filterProgress.value) params.constructionProgress = filterProgress.value
    if (filterVoltage.value) params.gridVoltage = filterVoltage.value
    if (filterOpStatus.value) params.operationStatus = filterOpStatus.value
    projects.value = await fetchProjects(params)
  } catch { projects.value = [] } finally { loading.value = false }
}

function openCreate() {
  editMode.value = false
  currentProject.value = null
  const year = new Date().getFullYear()
  let maxSeq = 0
  for (const p of projects.value) {
    const m = p.project_code?.match(/^PV-\d{4}-(\d+)$/)
    if (m && p.project_code?.includes(String(year))) maxSeq = Math.max(maxSeq, parseInt(m[1]))
  }
  const nextCode = `PV-${year}-${String(maxSeq + 1).padStart(3, '0')}`
  projectForm.value = { projectCode: nextCode, projectName: '', projectType: '', customFields: {} }
  projectDialogVisible.value = true
}

function openEdit(row: ProjectItem) {
  editMode.value = true
  currentProject.value = row
  let cf: Record<string, any> = {}
  try { cf = row.custom_fields ? JSON.parse(row.custom_fields) : {} } catch { /* ignore */ }
  projectForm.value = {
    projectCode: row.project_code,
    projectName: row.project_name,
    projectType: row.project_type,
    customFields: cf,
  }
  projectDialogVisible.value = true
}

async function handleProjectSave() {
  try {
    if (editMode.value && currentProject.value) {
      await updateProject(currentProject.value.id, { projectName: projectForm.value.projectName })
      ElMessage.success('项目更新成功')
    } else {
      await createProject({
        projectCode: projectForm.value.projectCode,
        projectName: projectForm.value.projectName,
        projectType: projectForm.value.projectType,
        customFields: projectForm.value.customFields,
      })
      ElMessage.success('项目创建成功')
    }
    projectDialogVisible.value = false
    await loadProjects()
  } catch { ElMessage.error('操作失败') }
}

function parseCustomFields(row: any): Record<string, any> { try { return row.custom_fields ? JSON.parse(row.custom_fields) : {} } catch { return {} } }
function renderCustomFieldValue(row: any, fieldCode: string): string { return parseCustomFields(row)[fieldCode] ?? '-' }

async function openDocDialog(row: ProjectItem) {
  docProjectId.value = row.id; docProjectName.value = row.project_name; docDialogVisible.value = true; docLoading.value = true
  try { documents.value = await fetchProjectDocuments(row.id) } catch { documents.value = [] } finally { docLoading.value = false }
}
async function handleDocUpload(file: any) { try { await uploadProjectDocument(docProjectId.value, file.raw, '其他'); documents.value = await fetchProjectDocuments(docProjectId.value); ElMessage.success('上传成功') } catch { ElMessage.error('上传失败') } }
async function handleDocDelete(docId: string) { try { await ElMessageBox.confirm('确定删除该文档？', '确认删除', { type: 'warning' }); await deleteProjectDocument(docProjectId.value, docId); documents.value = documents.value.filter(d => d.id !== docId); ElMessage.success('已删除') } catch {} }
function handleDownload(docId: string) { window.open(getDocumentDownloadUrl(docId, docProjectId.value)) }
function formatFileSize(bytes: number) { if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB' }

function getStatusLabel(s: string) {
  const m: Record<string, string> = { feasibility: '可研阶段', approved: '已批复', construction: '建设中', operation: '已投运' }
  return m[s] || s
}

function getTypeName(code: string) {
  return allTypes.value.find(t => t.code === code)?.name || code
}

function renderFieldValue(row: ProjectItem, fieldCode: string): string {
  try {
    const cf = row.custom_fields ? JSON.parse(row.custom_fields) : {}
    return cf[fieldCode] ?? '-'
  } catch { return '-' }
}

onMounted(async () => {
  await loadTypes()
  allTypes.value = types.value
  await loadProjects()
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">光伏项目类型兼容</div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="项目列表" name="project-list" />
      <el-tab-pane label="项目类型维护" name="type-mgmt" />
    </el-tabs>

    <!-- ==================== 项目类型维护 ==================== -->
    <template v-if="activeTab === 'type-mgmt'">
      <div class="grid-2">
        <div class="chart-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:14px;font-weight:600;color:#303133">项目类型</span>
            <el-button type="primary" size="small" @click="openTypeCreate">新增类型</el-button>
          </div>
          <el-table :data="types" stripe size="small" highlight-current-row @row-click="selectTypeForFields">
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

        <div class="chart-panel" v-if="selectedType">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:14px;font-weight:600;color:#303133">
              {{ selectedType.name }} — 自定义字段
            </span>
            <div style="display:flex;gap:8px">
              <el-button type="primary" size="small" @click="openFieldLibrary">添加字段</el-button>
              <el-button size="small" @click="handleClearAllFields" :disabled="fields.length === 0">一键删除</el-button>
            </div>
          </div>
          <el-table :data="fields" stripe size="small">
            <el-table-column prop="field_name" label="字段名" width="130" />
            <el-table-column prop="field_code" label="字段编码" width="130" />
            <el-table-column label="字段类型" width="100">
              <template #default="{ row }">
                {{ fieldTypeOptions.find(o => o.value === row.field_type)?.label || row.field_type }}
              </template>
            </el-table-column>
            <el-table-column label="必填" width="60">
              <template #default="{ row }">{{ row.is_required ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row, $index }">
                <el-button size="small" link type="primary" @click="openFieldEdit($index, row)">编辑</el-button>
                <el-button v-if="!isSystemField(row.field_code)" size="small" link @click="handleFieldDelete($index)">删除</el-button>
                <el-tag v-else size="small" type="info">核心</el-tag>
              </template>
            </el-table-column>
          </el-table>

        </div>
        <div class="chart-panel" v-else style="display:flex;align-items:center;justify-content:center;color:#909399;font-size:14px">
          选择左侧类型以查看和管理其字段
        </div>
      </div>
    </template>

    <!-- ==================== 项目列表 ==================== -->
    <template v-if="activeTab === 'project-list'">
      <div class="chart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="display:flex;gap:12px">
            <el-select v-model="filterType" placeholder="项目类型" size="small" style="width:160px" @change="loadProjects" clearable>
              <el-option v-for="t in allTypes" :key="t.code" :label="t.name" :value="t.code" />
            </el-select>
            <el-select v-model="filterStatus" placeholder="规划阶段" size="small" style="width:120px" @change="loadProjects" clearable>
              <el-option v-for="o in statusOptions.filter(s => s.value)" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-select v-model="filterProgress" placeholder="建设进度" size="small" style="width:120px" @change="loadProjects" clearable>
              <el-option v-for="p in progressOptions" :key="p" :label="p" :value="p" />
            </el-select>
            <el-select v-model="filterVoltage" placeholder="电压等级" size="small" style="width:110px" @change="loadProjects" clearable>
              <el-option v-for="v in voltageOptions" :key="v" :label="v" :value="v" />
            </el-select>
            <el-select v-model="filterOpStatus" placeholder="运营状态" size="small" style="width:120px" @change="loadProjects" clearable>
              <el-option v-for="o in opStatusOptions" :key="o" :label="o" :value="o" />
            </el-select>
          </div>
          <el-button type="primary" size="small" @click="openCreate">新增项目</el-button>
        </div>

        <el-table :data="projects" stripe v-loading="loading" size="small">
          <el-table-column prop="project_code" label="项目编号" width="140" />
          <el-table-column prop="project_name" label="项目名称" min-width="160" />
          <el-table-column label="项目类型" width="140">
            <template #default="{ row }">
              <el-tag size="small">{{ getTypeName(row.project_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="装机容量" width="120">
            <template #default="{ row }">{{ row.capacity_kw ? row.capacity_kw + 'kW' : '-' }}</template>
          </el-table-column>
          <el-table-column label="阶段" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType[row.status]" size="small">{{ getStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="并网进度" width="100">
            <template #default="{ row }">{{ renderCustomFieldValue(row, 'construction_progress') }}</template>
          </el-table-column>
          <el-table-column label="电压等级" width="100">
            <template #default="{ row }">{{ renderCustomFieldValue(row, 'grid_voltage') }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" link type="primary" @click="openDocDialog(row)">文档</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- ==================== 类型编辑弹窗 ==================== -->
    <el-dialog :title="typeEditMode ? '编辑类型' : '新增类型'" v-model="typeDialogVisible" width="480px">
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

    <!-- ==================== 字段库弹窗 ==================== -->
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
        <el-table-column label="字段类型" width="90">
          <template #default="{ row }">
            {{ fieldTypeOptions.find(o => o.value === row.field_type)?.label || row.field_type }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-button size="small" link @click.stop="handleDeleteLibraryField(row.id)">删除</el-button>
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

    <!-- ==================== 字段编辑弹窗 ==================== -->
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

    <!-- ==================== 项目编辑弹窗（动态表单） ==================== -->
    <el-dialog :title="editMode ? '编辑项目' : '新增项目'" v-model="projectDialogVisible" width="600px">
      <el-form :model="projectForm" label-width="110px" size="small">
        <el-form-item label="项目编号" required>
          <el-input v-model="projectForm.projectCode" :disabled="editMode" />
        </el-form-item>
        <el-form-item label="项目名称" required>
          <el-input v-model="projectForm.projectName" />
        </el-form-item>
        <el-form-item label="项目类型" required>
          <el-select v-model="projectForm.projectType" style="width:100%">
            <el-option v-for="t in allTypes" :key="t.code" :label="t.name" :value="t.code" />
          </el-select>
        </el-form-item>

        <!-- 动态字段（按维度分组） -->
        <template v-for="group in groupedTypeFields" :key="group.category">
          <el-divider style="margin:12px 0 4px" />
          <div style="font-size:13px;font-weight:600;color:#303133;margin-bottom:8px">{{ group.category }}</div>
          <template v-for="f in group.fields" :key="f.field_code">
            <el-form-item :label="f.field_name" :required="f.is_required === 1">
              <template v-if="f.field_type === 'number'">
                <el-input-number v-model="projectForm.customFields[f.field_code]" :precision="2" style="width:100%" />
              </template>
              <template v-else-if="f.field_type === 'date'">
                <el-date-picker v-model="projectForm.customFields[f.field_code]" type="date" style="width:100%" value-format="YYYY-MM-DD" />
              </template>
              <template v-else-if="f.field_type === 'select'">
                <el-select v-model="projectForm.customFields[f.field_code]" style="width:100%" clearable>
                  <el-option
                    v-for="opt in (() => { try { return JSON.parse(f.field_options || '[]') } catch { return [] } })()"
                    :key="opt" :label="opt" :value="opt"
                  />
                </el-select>
              </template>
              <template v-else>
                <el-input v-model="projectForm.customFields[f.field_code]" />
              </template>
            </el-form-item>
          </template>
        </template>
      </el-form>
      <template #footer>
        <el-button size="small" @click="projectDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleProjectSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 文档管理弹窗 ==================== -->
    <el-dialog :title="'项目文档 - ' + docProjectName" v-model="docDialogVisible" width="650px">
      <el-upload
        class="doc-upload"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleDocUpload"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.dwg,.zip"
      >
        <el-button size="small" type="primary">上传文档</el-button>
      </el-upload>
      <el-table :data="documents" stripe size="small" v-loading="docLoading" style="margin-top:12px">
        <el-table-column prop="doc_name" label="文档名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="doc_type" label="类型" width="100" />
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formatFileSize(row.file_size) }}</template>
        </el-table-column>
        <el-table-column prop="uploaded_at" label="上传时间" width="160" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleDownload(row.id)">下载</el-button>
            <el-button size="small" link @click="handleDocDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sub-tabs { display: flex; gap: 0; }
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
.sub-tab.active { background: #267F7B; color: #fff; border-color: #267F7B; }
.sub-tab.active + .sub-tab { border-left-color: #267F7B; }
:deep(.lib-row-selected) { background-color: #ecf5ff; }
</style>
