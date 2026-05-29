<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchEvaluations, generateEvaluation, exportEvaluation, fetchSimulations } from '@/api/scenario'

const evaluations = ref<any[]>([])
const simulations = ref<any[]>([])
const loading = ref(false)
const filterSimId = ref('')
const detailVisible = ref(false)
const detail = ref<any>(null)
const generating = ref(false)
const genSimId = ref('')
const selectedIds = ref<string[]>([])
const batchGenerating = ref(false)

async function loadData() {
  loading.value = true
  try {
    evaluations.value = await fetchEvaluations({ simulation_id: filterSimId.value || undefined })
  } finally {
    loading.value = false
  }
}

async function loadSimulations() {
  simulations.value = await fetchSimulations()
}

function openDetail(row: any) {
  detail.value = row
  detailVisible.value = true
}

async function autoGenerate() {
  if (!genSimId.value) return
  generating.value = true
  try {
    await generateEvaluation(genSimId.value)
    genSimId.value = ''
    await loadData()
    ElMessage.success('评估报告生成成功')
  } finally {
    generating.value = false
  }
}

async function batchGenerate() {
  if (!selectedIds.value.length) {
    ElMessage.warning('请先勾选目标')
    return
  }
  batchGenerating.value = true
  try {
    let ok = 0
    for (const id of selectedIds.value) {
      try { await generateEvaluation(id); ok++ } catch { /* skip */ }
    }
    selectedIds.value = []
    await loadData()
    ElMessage.success(`批量生成完成: ${ok}/${selectedIds.value.length + ok}`)
  } finally {
    batchGenerating.value = false
  }
}

function handleSelectionChange(rows: any[]) {
  selectedIds.value = rows.map((r: any) => r.simulation_id).filter(Boolean)
}

async function doExport(format: 'word' | 'pdf') {
  if (!detail.value?.id) return
  const blob = await exportEvaluation(detail.value.id, format)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `评估报告_${detail.value.id?.slice(0, 8)}.${format === 'word' ? 'docx' : 'pdf'}`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadSimulations()
  loadData()
})
</script>

<template>
  <div>
    <div class="chart-panel-title">场景执行效果评估</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterSimId" placeholder="筛选模拟" clearable style="width:180px" size="small" @change="loadData">
          <el-option v-for="s in simulations" :key="s.id" :label="s.id?.slice(0, 12)" :value="s.id" />
        </el-select>
        <el-select v-model="genSimId" placeholder="选择模拟生成报告" clearable style="width:200px" size="small">
          <el-option v-for="s in simulations.filter(x => x.status === 'completed')" :key="s.id" :label="s.id?.slice(0, 12)" :value="s.id" />
        </el-select>
        <el-button size="small" :loading="generating" @click="autoGenerate">生成评估报告</el-button>
        <el-button size="small" :loading="batchGenerating" :disabled="!selectedIds.length" @click="batchGenerate">
          批量生成 ({{ selectedIds.length }})
        </el-button>
      </div>
    </div>
    <el-table :data="evaluations" stripe size="small" v-loading="loading" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="36" />
      <el-table-column label="关联模拟" min-width="140">
        <template #default="{ row }">
          {{ row.simulation_id?.slice(0, 12) }}...
        </template>
      </el-table-column>
      <el-table-column label="效果评分" width="100">
        <template #default="{ row }">
          <span :style="{ color: row.effectiveness_score >= 80 ? '#67c23a' : row.effectiveness_score >= 60 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">
            {{ Math.round(row.effectiveness_score) }} 分
          </span>
        </template>
      </el-table-column>
      <el-table-column label="评估概要" min-width="260">
        <template #default="{ row }">
          {{ row.evaluation_report?.summary || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="建议" min-width="200">
        <template #default="{ row }">
          {{ row.suggestions || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="评估时间" width="150" />
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailVisible" title="评估详情" width="800px">
      <template v-if="detail">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="chart-panel">
            <div class="chart-panel-title">综合评分</div>
            <div style="font-size:36px;font-weight:700;text-align:center;padding:16px 0"
              :style="{ color: (detail.effectiveness_score || 0) >= 80 ? '#67c23a' : (detail.effectiveness_score || 0) >= 60 ? '#e6a23c' : '#f56c6c' }">
              {{ Math.round(detail.effectiveness_score || 0) }}
            </div>
          </div>
          <div class="chart-panel">
            <div class="chart-panel-title">评估结论</div>
            <el-descriptions :column="1" border size="small" style="margin-top:8px">
              <el-descriptions-item label="安全性">{{ detail.evaluation_report?.securityAssessment || '-' }}</el-descriptions-item>
              <el-descriptions-item label="经济性">{{ detail.evaluation_report?.economicAssessment || '-' }}</el-descriptions-item>
              <el-descriptions-item label="通过率">{{ detail.evaluation_report?.passRate }}%</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>

        <!-- 目标达成情况 -->
        <div v-if="detail.evaluation_report?.targetAchievement" style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px">目标达成情况</div>
          <el-table :data="[
            {
              name: '消纳率',
              target: detail.evaluation_report.targetAchievement.consumptionRate?.target + '%',
              actual: detail.evaluation_report.targetAchievement.consumptionRate?.actual + '%',
              achievement: detail.evaluation_report.targetAchievement.consumptionRate?.achievement + '%',
            },
            {
              name: '运营成本',
              target: '¥' + detail.evaluation_report.targetAchievement.operationCost?.target + '/kWh',
              actual: '¥' + detail.evaluation_report.targetAchievement.operationCost?.actual + '/kWh',
              achievement: detail.evaluation_report.targetAchievement.operationCost?.achievement + '%',
            },
          ]" stripe size="small">
            <el-table-column prop="name" label="指标" width="100" />
            <el-table-column prop="target" label="目标值" width="140" />
            <el-table-column prop="actual" label="实际值" width="140" />
            <el-table-column prop="achievement" label="达成率" width="100">
              <template #default="{ row }">
                <span :style="{ color: parseInt(row.achievement) >= 90 ? '#67c23a' : parseInt(row.achievement) >= 70 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">
                  {{ row.achievement }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 经济明细 -->
        <div v-if="detail.evaluation_report?.economicDetails" style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px">经济明细</div>
          <el-table :data="[detail.evaluation_report.economicDetails]" stripe size="small">
            <el-table-column label="总购电成本" width="120">
              <template #default="{ row }">¥{{ row.totalBuyCost ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="总售电收入" width="120">
              <template #default="{ row }">¥{{ row.totalSellIncome ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="储能损耗" width="110">
              <template #default="{ row }">¥{{ row.storageLoss ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="净收益" width="110">
              <template #default="{ row }">
                <span :style="{ color: (row.netBenefit ?? 0) >= 0 ? '#67c23a' : '#f56c6c', fontWeight: 600 }">
                  ¥{{ row.netBenefit ?? '-' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="平均运营成本" width="130">
              <template #default="{ row }">¥{{ row.avgCostPerKwh ?? '-' }}/kWh</template>
            </el-table-column>
          </el-table>
        </div>

        <div style="margin-bottom:8px;font-size:13px;font-weight:600">执行日志</div>
        <el-table :data="(detail.execution_log?.events || [])" stripe size="small" style="margin-bottom:16px">
          <el-table-column prop="time" label="时间" width="160" />
          <el-table-column prop="event" label="事件" min-width="160" />
          <el-table-column prop="level" label="级别" width="80">
            <template #default="{ row }">
              <el-tag :type="row.level === 'error' ? 'danger' : 'warning'" size="small">{{ row.level }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="detail.issues?.length" style="margin-bottom:8px;font-size:13px;font-weight:600">识别的问题</div>
        <el-table v-if="detail.issues?.length" :data="(detail.issues || [])" stripe size="small">
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="description" label="描述" min-width="180" />
          <el-table-column prop="value" label="实际值" width="90" />
          <el-table-column prop="threshold" label="阈值" width="90" />
          <el-table-column prop="cause" label="推断原因" min-width="200" />
        </el-table>

        <div v-if="detail.suggestions" style="margin-top:16px;padding:12px;background:#f5f7fa;border-radius:4px">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px">改进建议</div>
          <div style="font-size:12px;color:#606266;white-space:pre-line">{{ detail.suggestions }}</div>
        </div>
      </template>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="doExport('word')">导出Word</el-button>
        <el-button type="primary" @click="doExport('pdf')">导出PDF</el-button>
      </template>
    </el-dialog>
  </div>
</template>
