<script setup lang="ts">
import { ref } from 'vue'

const calcType = ref('ONLINE')
const isCalculating = ref(false)
const progress = ref(0)
const resultSummary = ref<any>(null)

function startCalculation() {
  isCalculating.value = true
  progress.value = 0
  resultSummary.value = null
  const interval = setInterval(() => {
    progress.value += Math.random() * 30
    if (progress.value >= 100) {
      progress.value = 100
      isCalculating.value = false
      resultSummary.value = {
        totalLossKw: 52.3,
        maxVoltageDeviation: 0.048,
        maxLoadRate: 0.92,
        reversePowerBranches: 2,
        violatedConstraints: 1,
      }
      clearInterval(interval)
    }
  }, 500)
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel">
      <div class="chart-panel-title">潮流计算配置</div>
      <el-form label-width="120px">
        <el-form-item label="计算类型">
          <el-radio-group v-model="calcType">
            <el-radio-button value="ONLINE">标准潮流</el-radio-button>
            <el-radio-button value="REVERSE">反向潮流</el-radio-button>
            <el-radio-button value="PROBABILISTIC">概率潮流</el-radio-button>
            <el-radio-button value="THREE_PHASE">三相潮流</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="时间窗口">
          <el-date-picker type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" />
        </el-form-item>
        <el-form-item label="收敛精度"><el-input-number :model-value="1e-5" :step="1e-5" :min="1e-8" /></el-form-item>
        <el-form-item label="最大迭代次数"><el-input-number :model-value="100" :min="1" :max="1000" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="startCalculation" :loading="isCalculating">开始计算</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div v-if="isCalculating" class="chart-panel">
      <div class="chart-panel-title">计算进度</div>
      <el-progress :percentage="Math.round(progress)" :stroke-width="20" :text-inside="true" />
      <div style="margin-top:8px;color:#909399">正在执行潮流计算，请稍候...</div>
    </div>

    <div v-if="resultSummary" class="chart-panel">
      <div class="chart-panel-title">计算结果汇总</div>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="总网损">{{ resultSummary.totalLossKw }} kW</el-descriptions-item>
        <el-descriptions-item label="最大电压偏差">{{ (resultSummary.maxVoltageDeviation * 100).toFixed(1) }}%</el-descriptions-item>
        <el-descriptions-item label="最大负载率">{{ (resultSummary.maxLoadRate * 100).toFixed(1) }}%</el-descriptions-item>
        <el-descriptions-item label="反向潮流支路">{{ resultSummary.reversePowerBranches }}条</el-descriptions-item>
        <el-descriptions-item label="约束越限">{{ resultSummary.violatedConstraints }}处</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>
