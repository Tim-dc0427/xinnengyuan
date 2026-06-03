<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchConstraintRules, saveConstraintRules } from '@/api/planning'
import { CONSTRAINT_CATEGORIES, getDefaultCategoryValues } from '@/config/constraintCategories'
import type { ConstraintCategoryValue } from '@new-energy/shared'

const emit = defineEmits<{
  close: []
  saved: []
}>()

const loading = ref(false)
const categories = ref<ConstraintCategoryValue[]>(getDefaultCategoryValues())

function getCategoryMeta(type: string) {
  return CONSTRAINT_CATEGORIES.find((c) => c.type === type)
}

async function loadConfig() {
  loading.value = true
  try {
    const rules = await fetchConstraintRules()
    if (rules.length > 0) {
      categories.value.forEach((cat) => {
        const rule = rules.find((r) => r.ruleType === cat.categoryType || isLegacyRuleMatch(cat.categoryType, r.ruleType))
        if (rule && rule.params && Object.keys(rule.params).length > 0) {
          Object.keys(rule.params).forEach((key) => {
            if (key in cat.paramValues) {
              cat.paramValues[key] = rule.params![key]
            }
          })
        }
      })
    }
  } catch {
    // 使用默认值
  } finally {
    loading.value = false
  }
}

function isLegacyRuleMatch(categoryType: string, ruleType: string): boolean {
  return ({ resource: 'irradiance', grid: 'grid', land: 'land' })[categoryType] === ruleType
}

async function saveConfig() {
  loading.value = true
  try {
    const payload = categories.value.map((cat) => {
      const meta = getCategoryMeta(cat.categoryType)
      return {
        ruleName: meta?.name ?? cat.categoryType,
        ruleType: cat.categoryType,
        weight: 1,
        enabled: true,
        params: cat.paramValues,
        description: `${meta?.name ?? ''}约束配置`,
      }
    })
    await saveConstraintRules(payload as any)
    ElMessage.success('约束条件配置已保存')
    emit('saved')
    emit('close')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    loading.value = false
  }
}

function resetDefaults() {
  categories.value = getDefaultCategoryValues()
  ElMessage.info('已恢复默认配置')
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="constraint-page">
    <div class="page-header">
      <div class="header-left">布点约束条件配置</div>
      <div class="header-actions">
        <el-button size="small" @click="resetDefaults">恢复默认</el-button>
        <el-button size="small" type="primary" @click="saveConfig" :loading="loading">保存配置</el-button>
      </div>
    </div>

    <div class="section" v-for="catMeta in CONSTRAINT_CATEGORIES" :key="catMeta.type">
      <div class="section-title">{{ catMeta.name }}</div>
      <div class="param-grid">
        <div class="param-row" v-for="param in catMeta.params" :key="param.key">
          <span class="param-label">{{ param.label }}</span>
          <div class="param-control">
            <el-input-number
              v-if="param.type === 'number'"
              :model-value="categories.find(c => c.categoryType === catMeta.type)!.paramValues[param.key]"
              @update:model-value="(v: number) => { const c = categories.find(x => x.categoryType === catMeta.type); if (c) c.paramValues[param.key] = v }"
              :min="param.min" :max="param.max" :step="param.step ?? 1"
              size="small" controls-position="right"
            />
            <el-select
              v-else-if="param.type === 'select'"
              :model-value="categories.find(c => c.categoryType === catMeta.type)!.paramValues[param.key]"
              @update:model-value="(v: any) => { const c = categories.find(x => x.categoryType === catMeta.type); if (c) c.paramValues[param.key] = v }"
              size="small"
            >
              <el-option v-for="opt in param.options" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <el-select
              v-else-if="param.type === 'multiSelect'"
              :model-value="categories.find(c => c.categoryType === catMeta.type)!.paramValues[param.key]"
              @update:model-value="(v: any) => { const c = categories.find(x => x.categoryType === catMeta.type); if (c) c.paramValues[param.key] = v }"
              multiple collapse-tags collapse-tags-tooltip size="small"
            >
              <el-option v-for="opt in param.options" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <span class="param-unit" v-if="param.unit">{{ param.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.constraint-page {
  /* dialog内使用 */
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.header-actions {
  display: flex;
  gap: 8px;
}

.section {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
}
.section-title {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  background: #f9fafb;
  border-bottom: 1px solid #ebeef5;
}

.param-grid {
  padding: 12px 16px;
}
.param-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  gap: 12px;
}
.param-row + .param-row {
  border-top: 1px solid #f5f5f5;
}
.param-label {
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
}
.param-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.param-unit {
  font-size: 12px;
  color: #909399;
  min-width: 56px;
}

:deep(.el-input-number--small) { width: 130px; }
:deep(.el-select--small) { width: 130px; }
</style>
