<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjects, fetchAccessConditions, saveAccessConditions } from '@/api/achievement'
import type { ProjectItem, AccessCondition } from '@/api/achievement'

const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref('')
const conditions = ref<AccessCondition[]>([])
const loading = ref(false)

const conditionTypes = ['光伏资源', '电网条件', '投资条件', '环境条件']

const formData = ref<Record<string, { requirement: string; actualValue: string; isSatisfied: boolean }>>({})

// 筛选
const filterType = ref('')
const filterSatisfied = ref<boolean | null>(null)
const irradianceMin = ref<number | null>(null)

onMounted(async () => {
  projects.value = await fetchProjects()
})

async function selectProject(id: string) {
  selectedProjectId.value = id
  await loadConditions()
}

async function loadConditions() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    conditions.value = await fetchAccessConditions(selectedProjectId.value)
    formData.value = {}
    for (const c of conditions.value) {
      formData.value[c.condition_type] = {
        requirement: c.requirement,
        actualValue: c.actual_value,
        isSatisfied: c.is_satisfied,
      }
    }
  } catch { conditions.value = [] } finally { loading.value = false }
}

async function handleSave() {
  if (!selectedProjectId.value) return
  const payload = conditionTypes.map(t => ({
    conditionType: t,
    requirement: formData.value[t]?.requirement || '',
    actualValue: formData.value[t]?.actualValue || '',
    isSatisfied: formData.value[t]?.isSatisfied ?? false,
  }))
  try {
    await saveAccessConditions(selectedProjectId.value, payload)
    ElMessage.success('接入条件保存成功')
    await loadConditions()
  } catch { ElMessage.error('保存失败') }
}

const filteredConditions = computed(() => {
  let list = conditions.value
  if (filterType.value) list = list.filter(c => c.condition_type === filterType.value)
  if (filterSatisfied.value !== null) list = list.filter(c => c.is_satisfied === filterSatisfied.value)
  return list
})

const qualityScore = computed(() => {
  if (conditions.value.length === 0) return 0
  const satisfied = conditions.value.filter(c => c.is_satisfied).length
  return Math.round((satisfied / conditions.value.length) * 100)
})

const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">接入条件数字化管理</div>

    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span>选择项目：</span>
        <el-select v-model="selectedProjectId" placeholder="请选择项目" size="small" style="width:280px" @change="selectProject">
          <el-option v-for="p in projects" :key="p.id" :label="p.project_name" :value="p.id" />
        </el-select>
      </div>
    </div>

    <template v-if="selectedProject">
      <div class="grid-2">
        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#303133">
            接入条件信息录入 - {{ selectedProject.project_name }}
          </div>
          <el-form label-width="120px" size="small">
            <template v-for="t in conditionTypes" :key="t">
              <div style="font-size:13px;font-weight:600;color:#267F7B;margin:8px 0 4px;padding-bottom:4px;border-bottom:1px solid #eee">
                {{ t }}
              </div>
              <el-form-item :label="'条件要求'">
                <el-input v-model="formData[t]!.requirement" :placeholder="'如：辐照度≥1500kWh/㎡·年'" />
              </el-form-item>
              <el-form-item :label="'实际值'">
                <el-input v-model="formData[t]!.actualValue" placeholder="如：1620 kWh/㎡·年" />
              </el-form-item>
              <el-form-item :label="'是否满足'">
                <el-switch v-model="formData[t]!.isSatisfied" />
              </el-form-item>
            </template>
          </el-form>
          <el-button type="primary" size="small" @click="handleSave" style="margin-top:8px">保存条件</el-button>
        </div>

        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#303133">多维度筛选与评估</div>

          <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <el-select v-model="filterType" placeholder="条件类型" size="small" style="width:120px" clearable>
              <el-option v-for="t in conditionTypes" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="filterSatisfied" placeholder="满足状态" size="small" style="width:120px" clearable>
              <el-option label="满足" :value="true" />
              <el-option label="不满足" :value="false" />
            </el-select>
          </div>

          <div style="margin-bottom:12px;padding:12px;background:#f5f7fa;border-radius:4px">
            <span style="font-size:14px;color:#303133">优质资源综合评分：</span>
            <span style="font-size:24px;font-weight:700;color:#267F7B">{{ qualityScore }}</span>
            <span style="font-size:14px;color:#909399"> / 100</span>
          </div>

          <el-table :data="filteredConditions" stripe size="small" v-loading="loading">
            <el-table-column prop="condition_type" label="条件类型" width="100" />
            <el-table-column prop="requirement" label="条件要求" min-width="180" />
            <el-table-column prop="actual_value" label="实际值" width="160" />
            <el-table-column label="满足" width="80">
              <template #default="{ row }">
                <el-tag :type="row.is_satisfied ? 'success' : 'danger'" size="small">
                  {{ row.is_satisfied ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
