<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAssessmentModelFields,
  createAssessmentModelField,
  updateAssessmentModelField,
  deleteAssessmentModelField,
  resetAssessmentModelDefaults,
} from '@/api/achievement'
import type { AssessmentModelField } from '@/api/achievement'

// ==================== 数据 ====================
const fields = ref<AssessmentModelField[]>([])
const selectedId = ref('')
const loading = ref(false)

onMounted(async () => {
  await loadFields()
})

async function loadFields() {
  loading.value = true
  try {
    fields.value = await fetchAssessmentModelFields()
  } catch { fields.value = [] }
  finally { loading.value = false }
}

// ==================== 维度分组 ====================
const dimLabels: Record<string, string> = {
  resource: '资源', grid: '电网', investment: '投资', environment: '环境',
}

const groupedFields = computed(() => {
  const groups: Record<string, AssessmentModelField[]> = {
    resource: [], grid: [], investment: [], environment: [],
  }
  for (const f of fields.value) {
    if (groups[f.dimension]) groups[f.dimension].push(f)
  }
  return groups
})

const selectedField = computed(() => fields.value.find(f => f.id === selectedId.value))

// ==================== 表单 ====================
const isNew = ref(false)
const form = ref({
  field_code: '',
  field_name: '',
  field_desc: '',
  field_type: 'numeric' as 'numeric' | 'text',
  dimension: 'resource' as 'resource' | 'grid' | 'investment' | 'environment',
  score_rule: 'direct_ratio' as string,
  base_value: null as number | null,
  max_score: 100,
  fail_score: 0,
  match_value: '' as string | null,
})
const textMapRows = ref<{ key: string; value: number }[]>([])

const scoreRuleOptions = computed(() => {
  if (form.value.field_type === 'numeric') {
    return [
      { label: '正比得分', value: 'direct_ratio' },
      { label: '反比得分', value: 'inverse_ratio' },
      { label: '达标满分', value: 'threshold_full' },
    ]
  }
  return [
    { label: '映射正比', value: 'map_direct' },
    { label: '映射反比', value: 'map_inverse' },
    { label: '分级固定分', value: 'map_fixed' },
    { label: '符合满分', value: 'match_full' },
  ]
})

const showBaseValue = computed(() => {
  const r = form.value.score_rule
  return form.value.field_type === 'numeric' || r === 'map_direct' || r === 'map_inverse'
})
const showTextMap = computed(() => form.value.field_type === 'text' && form.value.score_rule !== 'match_full')
const showMatchValue = computed(() => form.value.score_rule === 'match_full')
const showFailScore = computed(() => form.value.score_rule === 'threshold_full' || form.value.score_rule === 'match_full')

// ==================== 编辑操作 ====================
function selectField(id: string) {
  selectedId.value = id
  isNew.value = false
  const f = selectedField.value
  if (!f) return
  form.value = {
    field_code: f.field_code,
    field_name: f.field_name,
    field_desc: f.field_desc || '',
    field_type: f.field_type,
    dimension: f.dimension,
    score_rule: f.score_rule,
    base_value: f.base_value ?? null,
    max_score: f.max_score,
    fail_score: f.fail_score,
    match_value: f.match_value ?? '',
  }
  // 解析 text_map
  textMapRows.value = []
  if (f.text_map) {
    try {
      const m = JSON.parse(f.text_map)
      textMapRows.value = Object.entries(m).map(([k, v]) => ({ key: k, value: Number(v) }))
    } catch { /* ignore */ }
  }
}

function startNew() {
  selectedId.value = ''
  isNew.value = true
  form.value = {
    field_code: '',
    field_name: '',
    field_desc: '',
    field_type: 'numeric',
    dimension: 'resource',
    score_rule: 'direct_ratio',
    base_value: null,
    max_score: 100,
    fail_score: 0,
    match_value: '',
  }
  textMapRows.value = []
}

function cancelEdit() {
  selectedId.value = ''
  isNew.value = false
}

function addTextMapRow() {
  textMapRows.value.push({ key: '', value: 0 })
}

function removeTextMapRow(index: number) {
  textMapRows.value.splice(index, 1)
}

// ==================== 保存/删除 ====================
async function handleSave() {
  if (!form.value.field_code || !form.value.field_name) {
    ElMessage.warning('字段编码和名称为必填')
    return
  }
  const textMap: Record<string, number> = {}
  if (showTextMap.value && textMapRows.value.length > 0) {
    for (const row of textMapRows.value) {
      if (row.key) textMap[row.key] = row.value
    }
  }
  const data = {
    fieldCode: form.value.field_code,
    fieldName: form.value.field_name,
    fieldDesc: form.value.field_desc || undefined,
    fieldType: form.value.field_type,
    dimension: form.value.dimension as 'resource' | 'grid' | 'investment' | 'environment',
    baseValue: showBaseValue.value ? form.value.base_value : null,
    scoreRule: form.value.score_rule,
    textMap: Object.keys(textMap).length > 0 ? textMap : null,
    matchValue: showMatchValue.value ? form.value.match_value : null,
    maxScore: form.value.max_score,
    failScore: showFailScore.value ? form.value.fail_score : 0,
    sortOrder: 0,
  }
  try {
    if (isNew.value) {
      await createAssessmentModelField(data)
      ElMessage.success('新增成功')
    } else {
      await updateAssessmentModelField(selectedId.value, data)
      ElMessage.success('保存成功')
    }
    await loadFields()
    cancelEdit()
  } catch { ElMessage.error('保存失败') }
}

async function handleDelete() {
  if (!selectedId.value) return
  try {
    await ElMessageBox.confirm('确定删除该字段？', '确认', { type: 'warning' })
    await deleteAssessmentModelField(selectedId.value)
    ElMessage.success('已删除')
    await loadFields()
    cancelEdit()
  } catch { /* 取消 */ }
}

async function handleReset() {
  try {
    await ElMessageBox.confirm('将恢复为系统默认的 14 个评估指标，当前修改将丢失。确定继续？', '恢复默认', { type: 'warning' })
    const data = await resetAssessmentModelDefaults()
    fields.value = data
    ElMessage.success('已恢复默认')
    cancelEdit()
  } catch { /* 取消 */ }
}

// ==================== 规则名映射 ====================
const ruleNameMap: Record<string, string> = {
  direct_ratio: '正比得分',
  inverse_ratio: '反比得分',
  threshold_full: '达标满分',
  map_direct: '映射正比',
  map_inverse: '映射反比',
  map_fixed: '分级固定分',
  match_full: '符合满分',
}
</script>

<template>
  <div style="display:flex;gap:16px;min-height:480px">
    <!-- 左侧：字段列表 -->
    <div style="width:320px;flex-shrink:0">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <el-button size="small" type="primary" @click="startNew">新增字段</el-button>
        <el-button size="small" @click="handleReset">恢复默认</el-button>
      </div>
      <div v-loading="loading" style="max-height:520px;overflow-y:auto">
        <template v-for="dim in ['resource','grid','investment','environment']" :key="dim">
          <div style="font-size:13px;font-weight:600;color:#267F7B;padding:6px 0 4px;border-bottom:1px solid #eee;margin-bottom:4px">
            {{ dimLabels[dim] }}（{{ groupedFields[dim]?.length || 0 }}）
          </div>
          <div
            v-for="f in groupedFields[dim]"
            :key="f.id"
            :style="{
              padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', marginBottom: '2px',
              fontSize: '13px',
              background: selectedId === f.id ? '#e6f7f6' : 'transparent',
              borderLeft: selectedId === f.id ? '3px solid #267F7B' : '3px solid transparent',
            }"
            @click="selectField(f.id)"
          >
            <div>{{ f.field_name }}</div>
            <div style="font-size:11px;color:#909399">{{ f.field_code }} · {{ ruleNameMap[f.score_rule] || f.score_rule }}</div>
          </div>
        </template>
        <div v-if="fields.length === 0 && !loading" style="color:#909399;text-align:center;padding:20px">
          暂无字段，请点击"恢复默认"初始化
        </div>
      </div>
    </div>

    <!-- 右侧：编辑表单 -->
    <div style="flex:1;background:#fff;border-radius:4px;padding:16px;min-height:400px">
      <template v-if="isNew || selectedField">
        <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:12px">
          {{ isNew ? '新增字段' : '编辑字段' }}
        </div>
        <el-form label-width="90px" size="small">
          <el-form-item label="字段编码">
            <el-input v-model="form.field_code" :disabled="!isNew" style="width:240px" />
          </el-form-item>
          <el-form-item label="字段名称">
            <el-input v-model="form.field_name" style="width:240px" />
          </el-form-item>
          <el-form-item label="字段含义">
            <el-input v-model="form.field_desc" type="textarea" :rows="2" style="width:360px" />
          </el-form-item>
          <el-form-item label="字段类型">
            <el-radio-group v-model="form.field_type">
              <el-radio value="numeric">数值</el-radio>
              <el-radio value="text">文本</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="所属维度">
            <el-select v-model="form.dimension" style="width:160px">
              <el-option v-for="(label, key) in dimLabels" :key="key" :label="label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="得分规则">
            <el-select v-model="form.score_rule" style="width:200px">
              <el-option v-for="opt in scoreRuleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="showBaseValue" label="基准值">
            <el-input-number v-model="form.base_value" style="width:160px" controls-position="right" />
          </el-form-item>
          <el-form-item label="满分值">
            <el-input-number v-model="form.max_score" :min="0" :max="100" style="width:160px" controls-position="right" />
          </el-form-item>
          <el-form-item v-if="showFailScore" label="不达标/不符合得分">
            <el-input-number v-model="form.fail_score" :min="0" :max="100" style="width:160px" controls-position="right" />
          </el-form-item>
          <el-form-item v-if="showMatchValue" label="符合条件值">
            <el-input v-model="form.match_value" style="width:240px" placeholder="如：可用" />
          </el-form-item>
          <el-form-item v-if="showTextMap" label="选项映射">
            <div>
              <div v-for="(row, i) in textMapRows" :key="i" style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
                <el-input v-model="row.key" placeholder="选项" style="width:120px" />
                <span style="color:#909399">→</span>
                <el-input-number v-model="row.value" :min="0" :max="100" style="width:100px" controls-position="right" />
                <el-button size="small" type="danger" text @click="removeTextMapRow(i)">×</el-button>
              </div>
              <el-button size="small" @click="addTextMapRow" style="margin-top:4px">+ 添加选项</el-button>
            </div>
          </el-form-item>
        </el-form>
        <div style="display:flex;gap:8px;margin-top:16px">
          <el-button size="small" type="primary" @click="handleSave">保存</el-button>
          <el-button size="small" @click="cancelEdit">取消</el-button>
          <el-button v-if="!isNew" size="small" type="danger" @click="handleDelete">删除</el-button>
        </div>
      </template>
      <div v-else style="color:#909399;text-align:center;padding:60px 0">
        从左侧列表选择字段进行编辑
      </div>
    </div>
  </div>
</template>
