<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchProjects, runFeasibility, fetchFeasibility } from '@/api/achievement'
import type { ProjectItem, FeasibilityResult } from '@/api/achievement'

const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref('')
const feasibility = ref<FeasibilityResult | null>(null)
const loading = ref(false)

const weights = ref({ technical: 0.35, economic: 0.30, environmental: 0.20, social: 0.15 })
const threshold = ref(70)

onMounted(async () => {
  projects.value = await fetchProjects()
})

async function selectProject(id: string) {
  selectedProjectId.value = id
  feasibility.value = await fetchFeasibility(id)
}

async function handleRun() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    feasibility.value = await runFeasibility(selectedProjectId.value, weights.value)
    ElMessage.success('可行性评估完成')
  } catch { ElMessage.error('评估失败') } finally { loading.value = false }
}

const radarOption = computed(() => {
  if (!feasibility.value) return {}
  const f = feasibility.value
  return {
    radar: {
      indicator: [
        { name: '技术', max: 100 },
        { name: '经济', max: 100 },
        { name: '环境', max: 100 },
        { name: '社会', max: 100 },
      ],
      shape: 'circle',
      center: ['50%', '55%'],
      radius: '65%',
    },
    series: [{
      type: 'radar',
      data: [{ value: [f.technical_score, f.economic_score, f.environmental_score, f.social_score], name: '得分' }],
      areaStyle: { color: 'rgba(38,127,123,0.2)' },
      lineStyle: { color: '#267F7B' },
      itemStyle: { color: '#267F7B' },
    }],
  }
})

const scoreItems = computed(() => {
  if (!feasibility.value) return []
  const f = feasibility.value
  return [
    { label: '技术得分', score: f.technical_score, weight: weights.value.technical },
    { label: '经济得分', score: f.economic_score, weight: weights.value.economic },
    { label: '环境得分', score: f.environmental_score, weight: weights.value.environmental },
    { label: '社会得分', score: f.social_score, weight: weights.value.social },
  ]
})

const constraints = computed(() => {
  return scoreItems.value
    .filter(s => s.score < threshold.value)
    .map(s => ({
      dimension: s.label,
      score: s.score,
      gap: threshold.value - s.score,
      suggestion: `建议提升${s.label}相关指标，当前得分${s.score.toFixed(1)}低于阈值${threshold.value}，差距${(threshold.value - s.score).toFixed(1)}分`,
    }))
})

const isAboveThreshold = computed(() => {
  if (!feasibility.value) return false
  return feasibility.value.comprehensive_score >= threshold.value
})

const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">并网可行性综合分析</div>

    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span>选择项目：</span>
        <el-select v-model="selectedProjectId" placeholder="请选择项目" size="small" style="width:280px" @change="selectProject">
          <el-option v-for="p in projects" :key="p.id" :label="p.project_name" :value="p.id" />
        </el-select>
      </div>
    </div>

    <template v-if="selectedProject">
      <div class="chart-panel">
        <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">维度权重配置</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
          <div v-for="(_, k) in weights" :key="k" style="display:flex;align-items:center;gap:6px">
            <span style="font-size:13px;color:#909399;width:40px">{{ { technical: '技术', economic: '经济', environmental: '环境', social: '社会' }[k as string] }}</span>
            <el-input-number v-model="weights[k as keyof typeof weights]" :min="0" :max="1" :step="0.05" size="small" style="width:100px" />
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:13px;color:#909399">通过阈值</span>
            <el-input-number v-model="threshold" :min="0" :max="100" size="small" style="width:100px" />
          </div>
          <el-button type="primary" size="small" @click="handleRun" :loading="loading">运行评估</el-button>
        </div>
      </div>

      <template v-if="feasibility">
        <div class="grid-2">
          <div class="chart-panel">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:4px">四维评估雷达图</div>
            <ChartContainer :option="radarOption" height="320px" />
          </div>
          <div class="chart-panel">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:12px">得分明细</div>
            <div style="margin-bottom:12px;padding:12px;background:#f5f7fa;border-radius:4px;text-align:center">
              <div style="font-size:12px;color:#909399">综合得分</div>
              <div :style="{ fontSize: '32px', fontWeight: 700, color: isAboveThreshold ? '#67C23A' : '#F56C6C' }">
                {{ feasibility.comprehensive_score.toFixed(1) }}
              </div>
              <div style="font-size:12px" :style="{ color: isAboveThreshold ? '#67C23A' : '#F56C6C' }">
                {{ isAboveThreshold ? '通过阈值' : '未通过阈值' }}（阈值 {{ threshold }}）
              </div>
            </div>
            <el-table :data="scoreItems" stripe size="small">
              <el-table-column prop="label" label="维度" width="80" />
              <el-table-column label="得分" width="80">
                <template #default="{ row }">{{ row.score.toFixed(1) }}</template>
              </el-table-column>
              <el-table-column label="权重" width="80">
                <template #default="{ row }">{{ (row.weight * 100).toFixed(0) }}%</template>
              </el-table-column>
              <el-table-column label="加权得分" width="100">
                <template #default="{ row }">{{ (row.score * row.weight).toFixed(1) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div class="chart-panel" v-if="constraints.length > 0">
          <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">关键制约因素分析</div>
          <el-table :data="constraints" stripe size="small">
            <el-table-column prop="dimension" label="制约维度" width="100" />
            <el-table-column label="得分" width="80">
              <template #default="{ row }">{{ row.score.toFixed(1) }}</template>
            </el-table-column>
            <el-table-column label="差距" width="80">
              <template #default="{ row }">{{ row.gap.toFixed(1) }}</template>
            </el-table-column>
            <el-table-column prop="suggestion" label="改进建议" min-width="300" />
          </el-table>
        </div>

        <div class="chart-panel" v-else-if="feasibility">
          <div style="padding:12px;color:#67C23A;font-size:14px">全部维度均通过阈值，无制约因素。</div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
