<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchProjects, createProject, updateProject,
  fetchProjectTypesWithFields, createProjectType, updateProjectType, deleteProjectType,
  fetchTypeFields, saveTypeFields,
} from '@/api/achievement'
import type { ProjectItem, ProjectType, ProjectTypeField } from '@/api/achievement'

// ==================== 标签页 ====================
const activeTab = ref('type-mgmt')

// ==================== 项目类型管理 ====================
const types = ref<ProjectType[]>([])
const selectedType = ref<ProjectType | null>(null)
const fields = ref<ProjectTypeField[]>([])
const typeDialogVisible = ref(false)
const typeEditMode = ref(false)
const typeForm = ref({ name: '', code: '', description: '', sortOrder: 0 })

const fieldDialogVisible = ref(false)
const fieldEditIdx = ref(-1)
const fieldForm = ref({ fieldCode: '', fieldName: '', fieldType: 'text', fieldOptions: '', isRequired: false })

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

function openFieldCreate() {
  fieldEditIdx.value = -1
  fieldForm.value = { fieldCode: '', fieldName: '', fieldType: 'text', fieldOptions: '', isRequired: false }
  fieldDialogVisible.value = true
}

function openFieldEdit(idx: number, f: ProjectTypeField) {
  fieldEditIdx.value = idx
  fieldForm.value = {
    fieldCode: f.field_code,
    fieldName: f.field_name,
    fieldType: f.field_type,
    fieldOptions: f.field_options || '',
    isRequired: f.is_required === 1,
  }
  fieldDialogVisible.value = true
}

function handleFieldSave() {
  if (!selectedType.value) return
  const list = [...fields.value]
  const item = {
    fieldCode: fieldForm.value.fieldCode,
    fieldName: fieldForm.value.fieldName,
    fieldType: fieldForm.value.fieldType,
    fieldOptions: fieldForm.value.fieldOptions || undefined,
    isRequired: fieldForm.value.isRequired,
    sortOrder: fieldEditIdx.value >= 0 ? list[fieldEditIdx.value].sort_order : list.length,
  }
  if (fieldEditIdx.value >= 0) {
    list.splice(fieldEditIdx.value, 1, { ...list[fieldEditIdx.value], ...item } as any)
  } else {
    list.push(item as any)
  }
  fields.value = list as any
  fieldDialogVisible.value = false
}

function handleFieldDelete(idx: number) {
  fields.value.splice(idx, 1)
}

async function handleFieldsSave() {
  if (!selectedType.value) return
  try {
    await saveTypeFields(selectedType.value.id, fields.value.map((f, i) => ({
      fieldCode: f.field_code || (f as any).fieldCode,
      fieldName: f.field_name || (f as any).fieldName,
      fieldType: f.field_type || (f as any).fieldType,
      fieldOptions: f.field_options || (f as any).fieldOptions,
      isRequired: (f.is_required === 1 || (f as any).isRequired === true),
      sortOrder: f.sort_order ?? i,
    })))
    ElMessage.success('字段保存成功')
    await loadTypes()
  } catch { ElMessage.error('保存失败') }
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

const projectForm = ref({
  projectCode: '',
  projectName: '',
  projectType: '',
  pvType: '',
  capacityKw: undefined as number | undefined,
  budget: '',
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
    projects.value = await fetchProjects(params)
  } catch { projects.value = [] } finally { loading.value = false }
}

function openCreate() {
  editMode.value = false
  currentProject.value = null
  projectForm.value = { projectCode: '', projectName: '', projectType: '', pvType: '', capacityKw: undefined, budget: '', customFields: {} }
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
    pvType: row.pv_type || '',
    capacityKw: row.capacity_kw,
    budget: row.budget || '',
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
        pvType: projectForm.value.pvType,
        capacityKw: projectForm.value.capacityKw,
        budget: projectForm.value.budget,
        customFields: projectForm.value.customFields,
      })
      ElMessage.success('项目创建成功')
    }
    projectDialogVisible.value = false
    await loadProjects()
  } catch { ElMessage.error('操作失败') }
}

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
      <el-tab-pane label="项目类型维护" name="type-mgmt" />
      <el-tab-pane label="项目列表" name="project-list" />
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
            <el-button type="primary" size="small" @click="openFieldCreate">添加字段</el-button>
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
                <el-button size="small" link @click="handleFieldDelete($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" @click="handleFieldsSave" style="margin-top:12px">保存字段</el-button>
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
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
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
        <el-form-item label="光伏类型">
          <el-input v-model="projectForm.pvType" placeholder="如：单晶硅/多晶硅" />
        </el-form-item>
        <el-form-item label="装机容量(kW)">
          <el-input-number v-model="projectForm.capacityKw" :min="0" style="width:100%" />
        </el-form-item>
        <el-form-item label="预算">
          <el-input v-model="projectForm.budget" placeholder="如：2.1亿" />
        </el-form-item>

        <!-- 动态字段 -->
        <template v-for="f in selectedTypeFields" :key="f.field_code">
          <el-divider style="margin:8px 0" />
          <div style="font-size:12px;color:#909399;margin-bottom:6px">
            {{ f.field_name }} <span v-if="f.is_required" style="color:#F56C6C">*</span>
          </div>
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
      </el-form>
      <template #footer>
        <el-button size="small" @click="projectDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleProjectSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
