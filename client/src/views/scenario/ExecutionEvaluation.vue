<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchEvaluations, fetchEvaluation, generateEvaluation, fetchSimulations } from '@/api/scenario'

const evaluations = ref<any[]>([])
const simulations = ref<any[]>([])
const loading = ref(false)
const filterSimId = ref('')
const detailVisible = ref(false)
const detail = ref<any>(null)
const generating = ref(false)
const genSimId = ref('')

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
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  loadSimulations()
  loadData()
})
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterSimId" placeholder="筛选模拟" clearable style="width:180px" size="small" @change="loadData">
          <el-option v-for="s in simulations" :key="s.id" :label="s.id?.slice(0, 12)" :value="s.id" />
        </el-select>
        <el-select v-model="genSimId" placeholder="选择模拟生成报告" clearable style="width:200px" size="small">
          <el-option v-for="s in simulations.filter(x => x.status === 'completed')" :key="s.id" :label="s.id?.slice(0, 12)" :value="s.id" />
        </el-select>
        <el-button size="small" :loading="generating" @click="autoGenerate">生成评估报告</el-button>
      </div>
    </div>
    <el-table :data="evaluations" stripe size="small" v-loading="loading">
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

    <el-dialog v-model="detailVisible" title="评估详情" width="700px">
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
        <el-table :data="(detail.issues || [])" stripe size="small">
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="description" label="描述" min-width="200" />
          <el-table-column prop="value" label="实际值" width="90" />
          <el-table-column prop="threshold" label="阈值" width="90" />
        </el-table>

        <div v-if="detail.suggestions" style="margin-top:16px;padding:12px;background:#f5f7fa;border-radius:4px">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px">改进建议</div>
          <div style="font-size:12px;color:#606266;white-space:pre-line">{{ detail.suggestions }}</div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
