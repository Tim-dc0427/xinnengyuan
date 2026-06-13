<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchExecutionData, fetchEvaluations, generateEvaluation, exportEvaluation, fetchSimulations } from '@/api/scenario'
import { formatDateTime } from '@/utils/time'

const route = useRoute()

// 模拟列表
const simulations = ref<any[]>([])
const selectedSimId = ref('')

// 执行数据 (Tab1 — 只要有模拟就有)
const execData = ref<any>(null)
const execLoading = ref(false)

// 评估记录 (Tab2 — 需要生成才有)
const evaluations = ref<any[]>([])
const currentEval = ref<any>(null)
const evalLoading = ref(false)

// 操作
const tabValue = ref('execution-log')
const generating = ref(false)

// 加载模拟列表
async function loadSims() {
  simulations.value = await fetchSimulations()
}

// 选模拟后加载数据
async function onSimChange() {
  if (!selectedSimId.value) {
    execData.value = null
    evaluations.value = []
    currentEval.value = null
    return
  }
  // 并行加载执行数据和评估列表
  execLoading.value = true
  evalLoading.value = true
  try {
    const [exec, evals] = await Promise.all([
      fetchExecutionData(selectedSimId.value).catch(() => null),
      fetchEvaluations({ simulation_id: selectedSimId.value }).catch(() => []),
    ])
    execData.value = exec
    evaluations.value = evals || []
    currentEval.value = (evals && evals.length > 0) ? evals[0] : null
    // 如果有执行数据但没有评估，默认停在执行数据tab
    if (exec && !currentEval.value) tabValue.value = 'execution-log'
  } finally {
    execLoading.value = false
    evalLoading.value = false
  }
}

// 生成评估报告
async function handleGenerate() {
  if (!selectedSimId.value) return
  generating.value = true
  try {
    await generateEvaluation(selectedSimId.value)
    const evals = await fetchEvaluations({ simulation_id: selectedSimId.value })
    evaluations.value = evals || []
    currentEval.value = (evals && evals.length > 0) ? evals[0] : null
    tabValue.value = 'evaluation'
    ElMessage.success('评估报告生成成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

// 导出
async function doExport(format: 'word' | 'pdf') {
  if (!currentEval.value?.id) return
  const blob = await exportEvaluation(currentEval.value.id, format)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `评估报告_${currentEval.value.id?.slice(0, 8)}.${format === 'word' ? 'docx' : 'pdf'}`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await loadSims()
  const simId = route.query.simulation_id as string
  if (simId) {
    selectedSimId.value = simId
    await onSimChange()
  }
})

watch(selectedSimId, () => { if (selectedSimId.value) onSimChange() })
</script>

<template>
  <div>
    <div class="chart-panel-title">场景执行效果评估</div>

    <!-- 模拟选择 -->
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
      <el-select v-model="selectedSimId" placeholder="选择模拟" clearable style="width:280px" size="small">
        <el-option v-for="s in simulations" :key="s.id" :label="`${s.scenario_name || s.id?.slice(0,12)} (${s.status})`" :value="s.id" />
      </el-select>
    </div>

    <template v-if="selectedSimId">
      <el-tabs v-model="tabValue">
        <!-- ==================== Tab 1: 执行数据记录 ==================== -->
        <el-tab-pane label="执行数据记录" name="execution-log">
          <div v-loading="execLoading">
            <template v-if="execData">
              <el-descriptions :column="4" border size="small" style="margin-bottom:16px">
                <el-descriptions-item label="状态">{{ execData.status }}</el-descriptions-item>
                <el-descriptions-item label="开始时间">{{ formatDateTime(execData.startedAt) }}</el-descriptions-item>
                <el-descriptions-item label="结束时间">{{ formatDateTime(execData.completedAt) }}</el-descriptions-item>
                <el-descriptions-item label="数据量">{{ execData.metricsCount }} 条指标 / {{ execData.violationsCount }} 越限</el-descriptions-item>
              </el-descriptions>

              <!-- 策略执行日志 -->
              <div class="sec-title">策略执行日志</div>
              <el-table v-if="execData.executionLog?.length" :data="execData.executionLog" stripe size="small" max-height="360">
                <el-table-column prop="time" label="时间" width="170">
                  <template #default="{ row: r }">{{ formatDateTime(r.time) }}</template>
                </el-table-column>
                <el-table-column prop="event" label="执行事件" min-width="240" />
                <el-table-column label="级别" width="80">
                  <template #default="{ row: r }">
                    <el-tag :type="r.level === 'error' ? 'danger' : r.level === 'warning' ? 'warning' : 'info'" size="small">{{ r.level }}</el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <div v-else class="empty-hint">暂无执行事件</div>

              <!-- 各单元调节量 -->
              <div class="sec-title">各单元调节量</div>
              <el-table v-if="execData.unitAdjustments?.length" :data="execData.unitAdjustments" stripe size="small">
                <el-table-column prop="unit" label="单元" width="120" />
                <el-table-column prop="type" label="类型" width="70" />
                <el-table-column prop="initial" label="初始值" width="120" />
                <el-table-column prop="final" label="终止值" width="120" />
                <el-table-column label="调节量" width="120">
                  <template #default="{ row: r }">
                    <span :style="{ color: Number(r.adjustment) > 0 ? '#e6a23c' : '#67c23a', fontWeight: 600 }">{{ r.adjustment }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="unit_" label="单位" width="70" />
              </el-table>
              <div v-else class="empty-hint">暂无调节数据</div>

              <!-- 电网指标变化 -->
              <div class="sec-title">电网指标变化</div>
              <el-descriptions v-if="execData.gridIndicators" :column="3" border size="small">
                <template v-if="execData.gridIndicators.voltage">
                  <el-descriptions-item label="电压 avg">{{ execData.gridIndicators.voltage.avg }} kV</el-descriptions-item>
                  <el-descriptions-item label="电压 min">{{ execData.gridIndicators.voltage.min }} kV</el-descriptions-item>
                  <el-descriptions-item label="电压 max">{{ execData.gridIndicators.voltage.max }} kV</el-descriptions-item>
                </template>
                <template v-if="execData.gridIndicators.frequency">
                  <el-descriptions-item label="频率 avg">{{ execData.gridIndicators.frequency.avg }} Hz</el-descriptions-item>
                  <el-descriptions-item label="频率 min">{{ execData.gridIndicators.frequency.min }} Hz</el-descriptions-item>
                  <el-descriptions-item label="频率 max">{{ execData.gridIndicators.frequency.max }} Hz</el-descriptions-item>
                </template>
                <template v-if="execData.gridIndicators.loadRate">
                  <el-descriptions-item label="负载率 avg">{{ execData.gridIndicators.loadRate.avg }}%</el-descriptions-item>
                  <el-descriptions-item label="负载率 max">{{ execData.gridIndicators.loadRate.max }}%</el-descriptions-item>
                  <el-descriptions-item label="—">—</el-descriptions-item>
                </template>
                <template v-if="execData.gridIndicators.consumptionRate">
                  <el-descriptions-item label="消纳率 avg">{{ execData.gridIndicators.consumptionRate.avg }}%</el-descriptions-item>
                  <el-descriptions-item label="消纳率 min">{{ execData.gridIndicators.consumptionRate.min }}%</el-descriptions-item>
                  <el-descriptions-item label="—">—</el-descriptions-item>
                </template>
                <template v-if="execData.gridIndicators.operationCost">
                  <el-descriptions-item label="运营成本 avg">¥{{ execData.gridIndicators.operationCost.avg }}/kWh</el-descriptions-item>
                  <el-descriptions-item label="运营成本 max">¥{{ execData.gridIndicators.operationCost.max }}/kWh</el-descriptions-item>
                  <el-descriptions-item label="—">—</el-descriptions-item>
                </template>
              </el-descriptions>
              <div v-else class="empty-hint">暂无指标数据</div>
            </template>
            <div v-else class="empty-hint">请选择一个已完成的模拟查看执行数据</div>
          </div>
        </el-tab-pane>

        <!-- ==================== Tab 2: 效果评估与分析 ==================== -->
        <el-tab-pane label="效果评估与分析" name="evaluation">
          <div v-loading="evalLoading">
            <template v-if="currentEval">
              <!-- 综合评分 + 评估结论 -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                <div class="score-panel">
                  <div class="sec-title">综合评分</div>
                  <div class="score-num" :style="{ color: Math.round(currentEval.effectiveness_score || 0) >= 80 ? '#67c23a' : Math.round(currentEval.effectiveness_score || 0) >= 60 ? '#e6a23c' : '#f56c6c' }">
                    {{ Math.round(currentEval.effectiveness_score || 0) }}
                  </div>
                </div>
                <div class="score-panel">
                  <div class="sec-title">评估结论</div>
                  <el-descriptions :column="1" border size="small" style="margin-top:8px">
                    <el-descriptions-item label="安全性">{{ currentEval.evaluation_report?.securityAssessment || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="经济性">{{ currentEval.evaluation_report?.economicAssessment || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="通过率">{{ currentEval.evaluation_report?.passRate ?? '-' }}%</el-descriptions-item>
                  </el-descriptions>
                </div>
              </div>

              <!-- 目标达成 -->
              <div v-if="currentEval.evaluation_report?.targetAchievement" style="margin-bottom:16px">
                <div class="sec-title">目标达成情况</div>
                <el-table :data="[
                  { k: '消纳率', t: currentEval.evaluation_report.targetAchievement.consumptionRate?.target + '%', a: currentEval.evaluation_report.targetAchievement.consumptionRate?.actual + '%', r: currentEval.evaluation_report.targetAchievement.consumptionRate?.achievement + '%' },
                  { k: '运营成本', t: '¥'+currentEval.evaluation_report.targetAchievement.operationCost?.target+'/kWh', a: '¥'+currentEval.evaluation_report.targetAchievement.operationCost?.actual+'/kWh', r: currentEval.evaluation_report.targetAchievement.operationCost?.achievement+'%' },
                ]" stripe size="small">
                  <el-table-column prop="k" label="指标" width="120" />
                  <el-table-column prop="t" label="目标值" width="160" />
                  <el-table-column prop="a" label="实际值" width="160" />
                  <el-table-column label="达成率" width="100">
                    <template #default="{ row: r2 }">
                      <span :style="{ color: parseInt(r2.r) >= 90 ? '#67c23a' : parseInt(r2.r) >= 70 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">{{ r2.r }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <!-- 经济明细 -->
              <div v-if="currentEval.evaluation_report?.economicDetails" style="margin-bottom:16px">
                <div class="sec-title">经济明细</div>
                <el-table :data="[currentEval.evaluation_report.economicDetails]" stripe size="small">
                  <el-table-column label="总购电成本" width="130"><template #default="{ row: r3 }">¥{{ r3.totalBuyCost ?? '-' }}</template></el-table-column>
                  <el-table-column label="总售电收入" width="130"><template #default="{ row: r3 }">¥{{ r3.totalSellIncome ?? '-' }}</template></el-table-column>
                  <el-table-column label="储能损耗" width="120"><template #default="{ row: r3 }">¥{{ r3.storageLoss ?? '-' }}</template></el-table-column>
                  <el-table-column label="净收益" width="120"><template #default="{ row: r3 }"><span :style="{ color: (r3.netBenefit ?? 0) >= 0 ? '#67c23a' : '#f56c6c', fontWeight: 600 }">¥{{ r3.netBenefit ?? '-' }}</span></template></el-table-column>
                  <el-table-column label="平均运营成本" width="140"><template #default="{ row: r3 }">¥{{ r3.avgCostPerKwh ?? '-' }}/kWh</template></el-table-column>
                </el-table>
              </div>

              <!-- 识别的问题 -->
              <div v-if="currentEval.issues?.length" style="margin-bottom:16px">
                <div class="sec-title">识别的问题</div>
                <el-table :data="currentEval.issues" stripe size="small" max-height="280">
                  <el-table-column prop="type" label="类型" width="100" />
                  <el-table-column prop="description" label="问题描述" min-width="220" />
                  <el-table-column prop="value" label="实际值" width="90" />
                  <el-table-column prop="threshold" label="阈值" width="90" />
                  <el-table-column prop="cause" label="推断原因" min-width="180" />
                </el-table>
              </div>

              <!-- 改进建议 -->
              <div v-if="currentEval.suggestions" class="suggest-box">
                <div class="sec-title">改进建议</div>
                <div style="font-size:12px;color:#606266;white-space:pre-line">{{ currentEval.suggestions }}</div>
              </div>

              <div style="margin-top:12px;text-align:right">
                <el-button size="small" @click="doExport('word')">导出Word</el-button>
                <el-button size="small" @click="doExport('pdf')">导出PDF</el-button>
              </div>
            </template>

            <!-- 无评估报告时显示生成入口 -->
            <div v-else style="text-align:center;padding:60px 20px">
              <div style="font-size:14px;color:#606266;margin-bottom:16px">该模拟尚未生成评估报告</div>
              <el-button type="primary" :loading="generating" @click="handleGenerate">生成评估报告</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>

    <div v-else style="text-align:center;color:#909399;padding:40px">请选择一个模拟查看执行数据和评估报告</div>
  </div>
</template>

<style scoped>
.sec-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  margin-top: 16px;
}
.score-panel {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
}
.score-num {
  font-size: 36px;
  font-weight: 700;
  text-align: center;
  padding: 16px 0;
}
.suggest-box {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}
.empty-hint {
  font-size: 12px;
  color: #909399;
  text-align: center;
  padding: 20px;
}
</style>
