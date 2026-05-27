<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlanningStore } from '@/stores/planning.store'
import { fetchConstraintRules, runSpatialAnalysis, fetchCandidatePoints, fetchEvaluation } from '@/api/planning'
import type { CandidatePoint, ConstraintRule, ComprehensiveEvaluation } from '@new-energy/shared'
import EvaluationTab from './EvaluationTab.vue'

const router = useRouter()
const planningStore = usePlanningStore()
const { candidates } = storeToRefs(planningStore)
const activeTab = ref('distribution')
const loading = ref(false)
const rules = ref<ConstraintRule[]>([])
const evaluations = ref<ComprehensiveEvaluation[]>([])
const selectedEval = ref<ComprehensiveEvaluation | null>(null)
const evalDialogVisible = ref(false)
const LNG_MIN = 119.75, LNG_MAX = 120.25, LNG_SPAN = LNG_MAX - LNG_MIN
const LAT_MIN = 30.15, LAT_MAX = 30.52, LAT_SPAN = LAT_MAX - LAT_MIN

function toPct(lng: number, lat: number) {
  return {
    x: ((lng - LNG_MIN) / LNG_SPAN) * 100,
    y: ((lat - LAT_MIN) / LAT_SPAN) * 100,
  }
}

const dotSize = 14

function scoreColor(s: number) {
  return s >= 85 ? '#67c23a' : s >= 75 ? '#e6a23c' : '#f56c6c'
}

async function loadRules() {
  try { rules.value = await fetchConstraintRules() } catch { /* ignore */ }
}

async function loadCandidates() {
  loading.value = true
  try {
    candidates.value = await fetchCandidatePoints()
    evaluations.value = await fetchEvaluation()
  } finally { loading.value = false }
}

async function runAnalysis() {
  loading.value = true
  try {
    const constraints: any = { minIrradiance: 1300, maxDistanceToSubstationKm: 20, landTypes: ['desert', 'gobi', 'agricultural', 'unused'] }
    if (rules.value.length > 0) {
      const resourceRule = rules.value.find(r => r.ruleType === 'resource' || r.ruleType === 'irradiance')
      const landRule = rules.value.find(r => r.ruleType === 'land')
      if (resourceRule?.params) constraints.annualIrradiance = (resourceRule.params as any).annualIrradiance ?? constraints.minIrradiance
      if (landRule?.params) {
        const lt = (landRule.params as any).landType
        if (lt && Array.isArray(lt) && lt.length > 0) constraints.landTypes = lt
      }
    }
    candidates.value = await runSpatialAnalysis({ constraints }) as CandidatePoint[]
    evaluations.value = await fetchEvaluation()
  } finally { loading.value = false }
}

function showEval(candidate: CandidatePoint) {
  const siteId = candidate.id.replace('cp-', '')
  selectedEval.value = evaluations.value.find(e => e.siteId === siteId) ?? null
  evalDialogVisible.value = true
}

function difficultyColor(d: string) {
  return d === '低' ? '#67c23a' : d === '中' ? '#e6a23c' : '#f56c6c'
}
function envColor(e: string) {
  return e === 'III' ? '#67c23a' : e === 'II' ? '#e6a23c' : '#f56c6c'
}

onMounted(() => {
  loadRules()
  loadCandidates()
})
</script>

<template>
  <div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="综合评估" name="evaluation">
        <EvaluationTab />
      </el-tab-pane>
      <el-tab-pane label="推荐布点规划" name="distribution">
        <div class="action-bar">
          <el-button type="primary" @click="runAnalysis" :loading="loading">执行空间分析</el-button>
          <el-button @click="router.push('/planning/distribution/constraint-settings')">约束条件配置</el-button>
        </div>

        <div class="chart-panel">
          <div class="chart-panel-title">候选接入点空间分布（余杭区）</div>
          <div class="coord-map" v-if="candidates.length > 0">
            <div class="grid-line gl-h" v-for="i in 5" :key="'h'+i" :style="{ top: (i * 20) + '%' }"></div>
            <div class="grid-line gl-v" v-for="i in 5" :key="'v'+i" :style="{ left: (i * 20) + '%' }"></div>
            <div class="tick tick-lng" v-for="i in 6" :key="'lx'+i" :style="{ left: ((i-1) * 20) + '%' }">
              {{ (LNG_MIN + LNG_SPAN * (i-1) / 5).toFixed(2) }}
            </div>
            <div class="tick tick-lat" v-for="i in 6" :key="'ly'+i" :style="{ top: ((i-1) * 20) + '%' }">
              {{ (LAT_MAX - LAT_SPAN * (i-1) / 5).toFixed(2) }}
            </div>
            <div class="axis-label al-lng">经度</div>
            <div class="axis-label al-lat">纬度</div>
            <div
              v-for="c in candidates"
              :key="c.id"
              class="candidate-dot"
              :style="{
                left: `calc(${toPct(c.longitude!, c.latitude!).x}% - ${dotSize/2}px)`,
                top: `calc(${100 - toPct(c.longitude!, c.latitude!).y}% - ${dotSize/2}px)`,
                width: dotSize + 'px', height: dotSize + 'px',
                background: scoreColor(c.comprehensiveScore),
              }"
              @click="showEval(c)"
            >
              <span class="dot-label">{{ c.locationDesc }}</span>
            </div>
          </div>
          <div v-else style="height:420px;display:flex;align-items:center;justify-content:center;color:#909399;font-size:13px;background:#fafafa;border:1px solid #eee;border-radius:4px">暂无数据，请执行空间分析</div>
        </div>

        <div class="chart-panel">
          <div class="chart-panel-title">候选接入点列表</div>
          <el-table :data="candidates" stripe size="small" v-loading="loading">
            <el-table-column prop="locationDesc" label="候选区域" min-width="150" />
            <el-table-column label="坐标" width="150">
              <template #default="{ row }">{{ row.longitude?.toFixed(2) }}, {{ row.latitude?.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="综合评分" width="90">
              <template #default="{ row }">
                <span :style="{ color: scoreColor(row.comprehensiveScore), fontWeight: 600 }">{{ row.comprehensiveScore }}</span>
              </template>
            </el-table-column>
            <el-table-column label="推荐容量" width="100">
              <template #default="{ row }">{{ (row.recommendedCapacityKw / 1000).toFixed(1) }} MW</template>
            </el-table-column>
            <el-table-column label="消纳能力" width="100">
              <template #default="{ row }">{{ (row.absorptionCapacityKw / 1000).toFixed(1) }} MW</template>
            </el-table-column>
            <el-table-column label="送出距离" width="90">
              <template #default="{ row }">{{ row.transmissionLineLengthKm }} km</template>
            </el-table-column>
            <el-table-column label="送出成本" width="100">
              <template #default="{ row }">{{ (row.transmissionCost / 10000).toFixed(0) }} 万元</template>
            </el-table-column>
            <el-table-column label="土地成本" width="110">
              <template #default="{ row }">{{ (row.landCost / 10000).toFixed(0) }} 万元</template>
            </el-table-column>
            <el-table-column label="评分详情" width="180">
              <template #default="{ row }">
                <el-space>
                  <el-tag size="small" type="primary">消纳{{ row.scores?.absorption }}</el-tag>
                  <el-tag size="small" type="success">通道{{ row.scores?.transmission }}</el-tag>
                  <el-tag size="small" type="warning">经济{{ row.scores?.economic }}</el-tag>
                </el-space>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="router.push('/planning/distribution/absorption-scheme?candidateId=' + row.id)">编制消纳方案</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="evalDialogVisible" :title="selectedEval?.locationDesc + ' — 综合指标评估'" width="680" top="5vh">
      <template v-if="selectedEval">
        <div class="eval-grid">
          <div class="eval-group">
            <div class="eval-group-title">消纳能力</div>
            <div class="eval-row"><span class="eval-label">本地最大负荷</span><span class="eval-value">{{ selectedEval.localMaxLoadKw?.toLocaleString() }} kW</span></div>
            <div class="eval-row"><span class="eval-label">本地最小负荷</span><span class="eval-value">{{ selectedEval.localMinLoadKw?.toLocaleString() }} kW</span></div>
            <div class="eval-row"><span class="eval-label">可调峰能力</span><span class="eval-value">{{ selectedEval.peakRegulationCapacityKw?.toLocaleString() }} kW</span></div>
            <div class="eval-row"><span class="eval-label">可接纳容量</span><span class="eval-value">{{ selectedEval.acceptableCapacityKw?.toLocaleString() }} kW</span></div>
          </div>
          <div class="eval-group">
            <div class="eval-group-title">送出通道</div>
            <div class="eval-row"><span class="eval-label">线路长度</span><span class="eval-value">{{ selectedEval.lineLengthKm }} km</span></div>
            <div class="eval-row"><span class="eval-label">施工难度</span><span class="eval-value" :style="{ color: difficultyColor(selectedEval.constructionDifficulty) }">{{ selectedEval.constructionDifficulty }}</span></div>
            <div class="eval-row"><span class="eval-label">建设成本</span><span class="eval-value">{{ selectedEval.constructionCostTenThousand?.toLocaleString() }} 万元</span></div>
          </div>
          <div class="eval-group">
            <div class="eval-group-title">经济性</div>
            <div class="eval-row"><span class="eval-label">征地成本</span><span class="eval-value">{{ selectedEval.landAcquisitionCostTenThousand?.toLocaleString() }} 万元</span></div>
            <div class="eval-row"><span class="eval-label">租赁费用</span><span class="eval-value">{{ selectedEval.rentalCostTenThousandPerYear?.toLocaleString() }} 万元/年</span></div>
            <div class="eval-row"><span class="eval-label">环评等级</span><span class="eval-value" :style="{ color: envColor(selectedEval.envAssessmentLevel) }">{{ selectedEval.envAssessmentLevel }}</span></div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.coord-map {
  position: relative;
  width: 100%;
  height: 440px;
  background: #fafbfc;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}

.grid-line {
  position: absolute;
  background: #eef0f4;
  pointer-events: none;
}
.gl-h { left: 0; right: 0; height: 1px; }
.gl-v { top: 0; bottom: 0; width: 1px; }

.tick {
  position: absolute;
  font-size: 11px;
  color: #909399;
  pointer-events: none;
}
.tick-lng { bottom: 18px; transform: translateX(-50%); }
.tick-lat { left: 4px; transform: translateY(-50%); }

.axis-label {
  position: absolute;
  font-size: 12px;
  color: #606266;
  font-weight: 500;
  pointer-events: none;
}
.al-lng { bottom: 0; left: 50%; transform: translateX(-50%); }
.al-lat { left: 2px; top: 50%; transform: translateY(-50%) rotate(-90deg); transform-origin: center; }

.candidate-dot {
  position: absolute;
  border-radius: 50%;
  cursor: pointer;
  z-index: 2;
  transition: transform 0.15s;
}
.candidate-dot:hover {
  transform: scale(1.6);
  z-index: 10;
}

.dot-label {
  position: absolute;
  left: 18px;
  top: -2px;
  white-space: nowrap;
  font-size: 11px;
  color: #303133;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  background: rgba(255,255,255,0.92);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #e4e7ed;
}
.candidate-dot:hover .dot-label {
  opacity: 1;
}

.eval-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.eval-group {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}
.eval-group-title {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  background: #f9fafb;
  border-bottom: 1px solid #e4e7ed;
}
.eval-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 13px;
}
.eval-row + .eval-row {
  border-top: 1px solid #f5f5f5;
}
.eval-label {
  color: #909399;
}
.eval-value {
  color: #303133;
  font-weight: 500;
}
</style>
