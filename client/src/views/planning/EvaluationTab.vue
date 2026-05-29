<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import { fetchEvaluation } from '@/api/planning'
import type { ComprehensiveEvaluation } from '@new-energy/shared'

const loading = ref(false)
const evaluated = ref(false)
const evalTime = ref('')
const evaluations = ref<ComprehensiveEvaluation[]>([])

async function runEval() {
  loading.value = true
  try {
    evaluations.value = await fetchEvaluation()
    if (evaluations.value.length > 0) {
      evalTime.value = dayjs(evaluations.value[0].evaluationTime).format('YYYY-MM-DD HH:mm')
    }
    evaluated.value = true
  } finally {
    loading.value = false
  }
}

function difficultyColor(d: string) {
  return d === '低' ? '#67c23a' : d === '中' ? '#e6a23c' : '#f56c6c'
}
function envColor(e: string) {
  return e === 'III' ? '#67c23a' : e === 'II' ? '#e6a23c' : '#f56c6c'
}
</script>

<template>
  <div>
    <div class="chart-panel-title">综合评估</div>
    <div class="action-bar">
      <el-button disabled>导入数据</el-button>
      <el-button type="primary" @click="runEval" :loading="loading">综合评估</el-button>
      <span v-if="evaluated" class="eval-time">评估时间：{{ evalTime }}</span>
    </div>

    <div class="section" v-if="evaluated">
      <div class="section-title">接入点综合指标评估</div>
      <el-table :data="evaluations" stripe size="small" v-loading="loading" max-height="520">
        <el-table-column prop="locationDesc" label="接入点名称" min-width="110" fixed />
        <el-table-column label="消纳能力">
          <el-table-column prop="localMaxLoadKw" label="本地最大负荷" width="110">
            <template #default="{ row }">{{ row.localMaxLoadKw?.toLocaleString() }} kW</template>
          </el-table-column>
          <el-table-column prop="localMinLoadKw" label="本地最小负荷" width="110">
            <template #default="{ row }">{{ row.localMinLoadKw?.toLocaleString() }} kW</template>
          </el-table-column>
          <el-table-column prop="peakRegulationCapacityKw" label="可调峰能力" width="100">
            <template #default="{ row }">{{ row.peakRegulationCapacityKw?.toLocaleString() }} kW</template>
          </el-table-column>
          <el-table-column prop="acceptableCapacityKw" label="可接纳容量" width="100">
            <template #default="{ row }">{{ row.acceptableCapacityKw?.toLocaleString() }} kW</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="送出通道">
          <el-table-column prop="lineLengthKm" label="线路长度" width="80">
            <template #default="{ row }">{{ row.lineLengthKm }} km</template>
          </el-table-column>
          <el-table-column prop="constructionDifficulty" label="施工难度" width="80">
            <template #default="{ row }">
              <span :style="{ color: difficultyColor(row.constructionDifficulty), fontWeight: 600 }">{{ row.constructionDifficulty }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="constructionCostTenThousand" label="建设成本" width="100">
            <template #default="{ row }">{{ row.constructionCostTenThousand?.toLocaleString() }} 万元</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="经济性">
          <el-table-column prop="landAcquisitionCostTenThousand" label="征地成本" width="100">
            <template #default="{ row }">{{ row.landAcquisitionCostTenThousand?.toLocaleString() }} 万元</template>
          </el-table-column>
          <el-table-column prop="rentalCostTenThousandPerYear" label="租赁费用" width="110">
            <template #default="{ row }">{{ row.rentalCostTenThousandPerYear?.toLocaleString() }} 万元/年</template>
          </el-table-column>
          <el-table-column prop="envAssessmentLevel" label="环评等级" width="80">
            <template #default="{ row }">
              <span :style="{ color: envColor(row.envAssessmentLevel), fontWeight: 600 }">{{ row.envAssessmentLevel }}</span>
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="!evaluated" class="empty-state">
      <p style="margin:0">暂无评估数据</p>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.section {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
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
.empty-state {
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 6px;
  color: #909399;
  font-size: 13px;
}
:deep(.el-table .el-table__body-wrapper) {
  overflow-x: auto;
}
.eval-time {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}
</style>
