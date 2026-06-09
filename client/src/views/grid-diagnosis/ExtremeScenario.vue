<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { simulateExtremeScenario, exportExtremeReport, fetchStations } from '@/api/grid-diagnosis'
import type { StationOption, ExtremeScenarioResult, HighTempParams, RainstormParams } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const selectedStation = ref('')
const scenarioType = ref<'high_temperature' | 'rainstorm'>('high_temperature')
const loading = ref(false)
const result = ref<ExtremeScenarioResult | null>(null)

// 报告弹窗
const reportDialogVisible = ref(false)
const reportLoading = ref(false)

// 预设
const preset = ref<'mild' | 'moderate' | 'severe' | 'custom'>('moderate')

// 高温参数
const highTempParams = reactive<HighTempParams>({
  maxTemperatureC: 42,
  minTemperatureC: 25,
  peakTimeHour: 14,
  durationHalfHours: 3,
})

// 暴雨参数
const rainstormParams = reactive<RainstormParams>({
  rainfallIntensityMmh: 15,
  cloudCoverRatio: 0.8,
  durationHours: 6,
  peakTimeHour: 14,
})

// 预设填充
const highTempPresets: Record<string, HighTempParams> = {
  mild: { maxTemperatureC: 35, minTemperatureC: 22, peakTimeHour: 14, durationHalfHours: 2 },
  moderate: { maxTemperatureC: 42, minTemperatureC: 25, peakTimeHour: 14, durationHalfHours: 3 },
  severe: { maxTemperatureC: 50, minTemperatureC: 28, peakTimeHour: 14, durationHalfHours: 5 },
}

const rainstormPresets: Record<string, RainstormParams> = {
  mild: { rainfallIntensityMmh: 10, cloudCoverRatio: 0.65, durationHours: 4, peakTimeHour: 14 },
  moderate: { rainfallIntensityMmh: 25, cloudCoverRatio: 0.80, durationHours: 6, peakTimeHour: 14 },
  severe: { rainfallIntensityMmh: 40, cloudCoverRatio: 0.95, durationHours: 10, peakTimeHour: 14 },
}

function applyPreset(level: string) {
  preset.value = level as 'mild' | 'moderate' | 'severe'
  if (scenarioType.value === 'high_temperature') {
    const p = highTempPresets[level]
    if (p) Object.assign(highTempParams, p)
  } else {
    const p = rainstormPresets[level]
    if (p) Object.assign(rainstormParams, p)
  }
}

function onParamChange() {
  preset.value = 'custom'
}

async function loadStations() {
  stations.value = (await fetchStations()) || []
  if (stations.value.length > 0) selectedStation.value = stations.value[0].id
}

async function runSimulation() {
  if (!selectedStation.value) return
  loading.value = true
  try {
    const data = await simulateExtremeScenario({
      stationId: selectedStation.value,
      scenarioType: scenarioType.value,
      params: scenarioType.value === 'high_temperature' ? { ...highTempParams } : { ...rainstormParams },
    })
    result.value = data
  } finally {
    loading.value = false
  }
}

function onScenarioChange() {
  result.value = null
  preset.value = 'moderate'
  applyPreset('moderate')
}

// 下载报告
async function downloadReport(format: 'word' | 'pdf') {
  reportLoading.value = true
  try {
    const blob = await exportExtremeReport({
      stationId: selectedStation.value,
      scenarioType: scenarioType.value,
      params: scenarioType.value === 'high_temperature' ? { ...highTempParams } : { ...rainstormParams },
    }, format)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `极端场景应对方案报告_${new Date().toISOString().slice(0, 10)}.${format === 'word' ? 'docx' : 'pdf'}`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    reportLoading.value = false
  }
}

// 高温场景图: 出力 + 负荷 + 供需缺口 + 环境温度(双Y轴)
const highTempChartOption = computed(() => {
  if (!result.value || scenarioType.value !== 'high_temperature') return {}
  const d = result.value.timeSeriesData
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['正常出力', '极端出力', '本地负荷', '供需缺口', '环境温度'] },
    xAxis: { type: 'category', data: d.map(p => p.time), name: '时间' },
    yAxis: [
      { type: 'value', name: 'MW' },
      { type: 'value', name: '℃', min: 10, max: 60 },
    ],
    series: [
      { name: '正常出力', type: 'line', smooth: true, data: d.map(p => p.outputKw), lineStyle: { width: 1, type: 'dashed' }, itemStyle: { color: '#91cc75' } },
      { name: '极端出力', type: 'line', smooth: true, data: d.map(p => p.degradedOutputKw), areaStyle: { opacity: 0.08 }, itemStyle: { color: '#ee6666' } },
      { name: '本地负荷', type: 'line', smooth: true, data: d.map(p => p.loadMw), itemStyle: { color: '#5470c6' } },
      { name: '供需缺口', type: 'bar', data: d.map(p => p.supplyGapMw > 0 ? +p.supplyGapMw.toFixed(2) : 0), itemStyle: { color: '#fc8452' }, barWidth: '60%' },
      { name: '环境温度', type: 'line', yAxisIndex: 1, smooth: true, data: d.map(p => p.temperatureC), itemStyle: { color: '#fac858' } },
    ],
  }
})

// 暴雨场景图: 出力 + 负荷 + 供需缺口 + 降雨强度(双Y轴)
const rainstormChartOption = computed(() => {
  if (!result.value || scenarioType.value !== 'rainstorm') return {}
  const d = result.value.timeSeriesData
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['正常出力', '极端出力', '本地负荷', '供需缺口', '降雨强度'] },
    xAxis: { type: 'category', data: d.map(p => p.time), name: '时间' },
    yAxis: [
      { type: 'value', name: 'MW' },
      { type: 'value', name: 'mm/h', min: 0, max: 50 },
    ],
    series: [
      { name: '正常出力', type: 'line', smooth: true, data: d.map(p => p.outputKw), lineStyle: { width: 1, type: 'dashed' }, itemStyle: { color: '#91cc75' } },
      { name: '极端出力', type: 'line', smooth: true, data: d.map(p => p.degradedOutputKw), areaStyle: { opacity: 0.08 }, itemStyle: { color: '#ee6666' } },
      { name: '本地负荷', type: 'line', smooth: true, data: d.map(p => p.loadMw), itemStyle: { color: '#5470c6' } },
      { name: '供需缺口', type: 'bar', data: d.map(p => p.supplyGapMw > 0 ? +p.supplyGapMw.toFixed(2) : 0), itemStyle: { color: '#fc8452' }, barWidth: '60%' },
      { name: '降雨强度', type: 'line', yAxisIndex: 1, smooth: true, data: d.map(p => p.rainfallIntensityMmh ?? 0), itemStyle: { color: '#73c0de' } },
    ],
  }
})

loadStations()
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">极端场景模拟分析</div>

    <!-- 基础选择 -->
    <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center">
      <el-select v-model="selectedStation" size="small" style="width:320px" filterable>
        <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
      </el-select>
      <el-select v-model="scenarioType" size="small" style="width:120px" @change="onScenarioChange">
        <el-option label="高温场景" value="high_temperature" />
        <el-option label="暴雨场景" value="rainstorm" />
      </el-select>
    </div>

    <!-- 场景参数面板 -->
    <div class="chart-panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:13px;color:#606266;width:60px">预设：</span>
        <el-button size="small" :type="preset === 'mild' ? 'primary' : ''" @click="applyPreset('mild')">轻度</el-button>
        <el-button size="small" :type="preset === 'moderate' ? 'primary' : ''" @click="applyPreset('moderate')">中度</el-button>
        <el-button size="small" :type="preset === 'severe' ? 'primary' : ''" @click="applyPreset('severe')">重度</el-button>
        <span v-if="preset === 'custom'" style="font-size:12px;color:#909399">自定义</span>
      </div>

      <!-- 高温参数 -->
      <template v-if="scenarioType === 'high_temperature'">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">最高温度</span>
            <el-slider v-model="highTempParams.maxTemperatureC" :min="30" :max="55" :step="1" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:38px;text-align:right">{{ highTempParams.maxTemperatureC }}℃</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">最低温度</span>
            <el-slider v-model="highTempParams.minTemperatureC" :min="18" :max="32" :step="1" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:38px;text-align:right">{{ highTempParams.minTemperatureC }}℃</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">峰值时刻</span>
            <el-slider v-model="highTempParams.peakTimeHour" :min="12" :max="16" :step="1" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:38px;text-align:right">{{ highTempParams.peakTimeHour }}:00</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">高温持续</span>
            <el-slider v-model="highTempParams.durationHalfHours" :min="2" :max="6" :step="0.5" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:38px;text-align:right">{{ highTempParams.durationHalfHours }}h</span>
          </div>
        </div>
      </template>

      <!-- 暴雨参数 -->
      <template v-else>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">降雨强度</span>
            <el-slider v-model="rainstormParams.rainfallIntensityMmh" :min="5" :max="50" :step="5" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:50px;text-align:right">{{ rainstormParams.rainfallIntensityMmh }}mm/h</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">云层覆盖</span>
            <el-slider v-model="rainstormParams.cloudCoverRatio" :min="0.5" :max="1" :step="0.05" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:42px;text-align:right">{{ (rainstormParams.cloudCoverRatio * 100).toFixed(0) }}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">持续时长</span>
            <el-slider v-model="rainstormParams.durationHours" :min="2" :max="12" :step="1" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:38px;text-align:right">{{ rainstormParams.durationHours }}h</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;color:#606266;width:70px;text-align:right">中心时刻</span>
            <el-slider v-model="rainstormParams.peakTimeHour" :min="10" :max="18" :step="1" style="flex:1" @input="onParamChange" />
            <span style="font-size:12px;color:#303133;width:38px;text-align:right">{{ rainstormParams.peakTimeHour }}:00</span>
          </div>
        </div>
      </template>
    </div>

    <div style="margin-bottom:16px">
      <el-button type="primary" size="small" @click="runSimulation" :loading="loading">运行模拟</el-button>
    </div>

    <!-- 电站基础信息 -->
    <div v-if="result" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title" style="font-size:14px">电站基础信息</div>
      <div style="display:flex;gap:32px;flex-wrap:wrap;font-size:13px;color:#606266;padding:8px 0">
        <span>电站名称：<b style="color:#303133">{{ result.stationInfo.stationName }}</b></span>
        <span>装机容量：<b style="color:#303133">{{ result.stationInfo.installedCapacityMw }} MW</b></span>
        <span>电压等级：<b style="color:#303133">{{ result.stationInfo.gridConnectionVoltageKv }} kV</b></span>
        <span>区域：<b style="color:#303133">{{ result.stationInfo.zone }}</b></span>
        <span>储能：<b style="color:#303133">{{ result.stationInfo.storagePowerMw }}MW / {{ result.stationInfo.storageCapacityMwh }}MWh</b></span>
      </div>
    </div>

    <!-- 高温场景图: 出力+负荷+供需缺口+环境温度 -->
    <div v-if="result && scenarioType === 'high_temperature'" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title" style="font-size:14px">极端场景模拟结果 — 高温</div>
      <ChartContainer :option="highTempChartOption" height="420px" :loading="loading" />
    </div>

    <!-- 暴雨场景图: 出力+负荷+供需缺口+降雨强度 -->
    <div v-if="result && scenarioType === 'rainstorm'" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title" style="font-size:14px">极端场景模拟结果 — 暴雨</div>
      <ChartContainer :option="rainstormChartOption" height="420px" :loading="loading" />
    </div>

    <!-- 24h 时序详表 -->
    <div v-if="result" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title" style="font-size:14px">24小时时序详情</div>
      <el-table :data="result.timeSeriesData" size="small" stripe max-height="450">
        <el-table-column prop="time" label="时间" width="80" />
        <el-table-column v-if="scenarioType === 'high_temperature'" label="温度(℃)" width="80">
          <template #default="{ row }">{{ row.temperatureC }}</template>
        </el-table-column>
        <el-table-column label="正常出力(MW)" width="100">
          <template #default="{ row }">{{ row.outputKw }}</template>
        </el-table-column>
        <el-table-column label="极端出力(MW)" width="100">
          <template #default="{ row }">{{ row.degradedOutputKw }}</template>
        </el-table-column>
        <el-table-column label="骤降(%)" width="80">
          <template #default="{ row }">{{ row.dropPct }}</template>
        </el-table-column>
        <el-table-column label="负荷(MW)" width="85">
          <template #default="{ row }">{{ row.loadMw }}</template>
        </el-table-column>
        <el-table-column label="供需缺口(MW)" width="105">
          <template #default="{ row }">
            <span :style="{ color: row.supplyGapMw > 0 ? '#f56c6c' : '#67c23a' }">{{ row.supplyGapMw > 0 ? '+' + row.supplyGapMw : row.supplyGapMw }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备用需求(MW)" width="105">
          <template #default="{ row }">{{ row.backupNeededMw }}</template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 报告按钮 -->
    <div v-if="result" style="margin-bottom:16px">
      <el-button type="primary" size="small" @click="reportDialogVisible = true">生成应对方案报告</el-button>
    </div>

    <!-- 报告预览弹窗 -->
    <el-dialog v-model="reportDialogVisible" title="应对方案报告" width="800px" top="5vh">
      <template v-if="result">
        <!-- 一、电站基础信息 -->
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px 0;font-size:15px;color:#303133">一、模拟电站基础信息</h4>
          <div style="font-size:13px;color:#606266;line-height:2">
            <div>电站名称：{{ result.report.stationInfo.stationName }}</div>
            <div>装机容量：{{ result.report.stationInfo.installedCapacityMw }} MW</div>
            <div>并网电压等级：{{ result.report.stationInfo.gridConnectionVoltageKv }} kV</div>
            <div>所属区域：{{ result.report.stationInfo.zone }}</div>
            <div>关联母线：{{ result.report.stationInfo.busName }}</div>
            <div>储能配置：{{ result.report.stationInfo.storagePowerMw }}MW / {{ result.report.stationInfo.storageCapacityMwh }}MWh</div>
          </div>
          <div style="font-size:13px;color:#606266;margin-top:8px;line-height:2">
            <div style="font-weight:600;color:#303133">本次模拟场景参数：</div>
            <div v-for="(v, k) in result.report.scenarioParams" :key="k">{{ k }}：{{ v }}</div>
          </div>
        </div>

        <!-- 二、模拟数据分析 -->
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px 0;font-size:15px;color:#303133">二、模拟数据分析</h4>
          <div style="font-size:13px;color:#606266;line-height:2">

            <!-- 出力骤降 -->
            <div style="font-weight:600;color:#303133;margin-top:6px">出力骤降分析</div>
            <div>全天出力平均骤降 <b style="color:#f56c6c">{{ result.report.dataAnalysis.outputDrop.overallDropPct }}%</b>，最大骤降发生在 <b>{{ result.report.dataAnalysis.outputDrop.peakDropHour }}</b>，骤降幅度达 <b style="color:#f56c6c">{{ result.report.dataAnalysis.outputDrop.peakDropPct }}%</b>，最严重时段为 {{ result.report.dataAnalysis.outputDrop.worstPeriod }}</div>

            <!-- 供需保障分析 -->
            <div style="font-weight:600;color:#303133;margin-top:10px">供电保障分析</div>
            <div>全天供电保障率 <b :style="{ color: result.report.dataAnalysis.supplyGuarantee.avgRate >= 95 ? '#67c23a' : '#e6a23c' }">{{ result.report.dataAnalysis.supplyGuarantee.avgRate }}%</b>，供电最紧张时段出现在 <b>{{ result.report.dataAnalysis.supplyGuarantee.minRateHour }}</b></div>

            <!-- 供需缺口 -->
            <div style="font-weight:600;color:#303133;margin-top:10px">供需缺口分析</div>
            <div>最大供需缺口 <b style="color:#fc8452">{{ result.report.dataAnalysis.supplyGap.maxGapMw }} MW</b>（{{ result.report.dataAnalysis.supplyGap.maxGapHour }}），全天累计缺电量 <b>{{ result.report.dataAnalysis.supplyGap.totalShortfallMwh }} MWh</b>，缺口时段：{{ result.report.dataAnalysis.supplyGap.gapPeriod }}</div>

            <!-- 温度/暴雨 -->
            <template v-if="result.report.dataAnalysis.temperature">
              <div style="font-weight:600;color:#303133;margin-top:10px">温度分析</div>
              <div>最高环境温度 <b style="color:#ff7875">{{ result.report.dataAnalysis.temperature.maxTempC }}℃</b>（{{ result.report.dataAnalysis.temperature.maxTempHour }}），光伏面板峰值温度约 <b style="color:#f56c6c">{{ result.report.dataAnalysis.temperature.peakPanelTempC }}℃</b>，高温窗口：{{ result.report.dataAnalysis.temperature.highTempWindow }}</div>
            </template>
            <template v-if="result.report.dataAnalysis.rainstorm">
              <div style="font-weight:600;color:#303133;margin-top:10px">暴雨影响分析</div>
              <div>最大降雨强度 <b>{{ result.report.dataAnalysis.rainstorm.maxIntensityMmh }} mm/h</b>，云层覆盖率 {{ result.report.dataAnalysis.rainstorm.cloudCoverPct }}%，影响时长 {{ result.report.dataAnalysis.rainstorm.affectedHours }}h，最严重时段：{{ result.report.dataAnalysis.rainstorm.worstPeriod }}</div>
            </template>

            <!-- 备用需求 -->
            <div style="font-weight:600;color:#303133;margin-top:10px">备用需求分析</div>
            <div>峰值备用需求 <b style="color:#f56c6c">{{ result.report.dataAnalysis.backup.peakRequiredMw }} MW</b>（{{ result.report.dataAnalysis.backup.peakRequiredHour }}），推荐 <b>{{ result.report.dataAnalysis.backup.recommendedType }}</b> 配置容量 <b>{{ result.report.dataAnalysis.backup.recommendedCapacityMw }} MW</b></div>
          </div>
        </div>

        <!-- 三、策略分析 -->
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px 0;font-size:15px;color:#303133">三、策略分析</h4>

          <!-- 散热策略 -->
          <template v-if="result.report.strategyAnalysis.cooling">
            <h5 style="margin:0 0 6px 0;font-size:13px;color:#303133">散热策略</h5>
            <div style="font-size:13px;color:#606266;line-height:2">{{ result.report.strategyAnalysis.cooling.panelTempEstimate }}</div>
            <div style="font-size:13px;color:#606266;line-height:2">{{ result.report.strategyAnalysis.cooling.inverterRiskPeriods }}</div>
            <div style="font-size:13px;color:#606266;font-weight:600;margin-top:6px">散热措施：</div>
            <div v-for="(m, i) in result.report.strategyAnalysis.cooling.measures" :key="i" style="font-size:13px;color:#606266;line-height:2;padding-left:12px">{{ i + 1 }}. {{ m }}</div>
            <div style="font-size:13px;color:#303133;margin-top:4px;line-height:2"><b>预期效果：</b>{{ result.report.strategyAnalysis.cooling.expectedEffect }}</div>
          </template>

          <!-- 防护策略 -->
          <template v-if="result.report.strategyAnalysis.protection">
            <h5 style="margin:0 0 6px 0;font-size:13px;color:#303133">防护策略</h5>
            <div style="font-size:13px;color:#606266;line-height:2">{{ result.report.strategyAnalysis.protection.waterproofAssessment }}</div>
            <div style="font-size:13px;color:#606266;line-height:2">{{ result.report.strategyAnalysis.protection.lineProtectionAdvice }}</div>
            <div style="font-size:13px;color:#606266;line-height:2">{{ result.report.strategyAnalysis.protection.drainageAdvice }}</div>
            <div style="font-size:13px;color:#606266;font-weight:600;margin-top:6px">应急物资清单：</div>
            <div v-for="(s, i) in result.report.strategyAnalysis.protection.emergencySupplies" :key="i" style="font-size:13px;color:#606266;line-height:2;padding-left:12px">• {{ s }}</div>
          </template>

          <!-- 调度策略 -->
          <template v-if="result.report.strategyAnalysis.scheduling">
            <h5 style="margin:12px 0 6px 0;font-size:13px;color:#303133">调度策略</h5>
            <div style="font-size:13px;color:#606266;line-height:2"><b>储能调度：</b>{{ result.report.strategyAnalysis.scheduling.storageStrategy }}</div>
            <div style="font-size:13px;color:#606266;line-height:2"><b>光伏建议：</b>{{ result.report.strategyAnalysis.scheduling.pvLimitAdvice }}</div>
            <div style="font-size:13px;color:#606266;line-height:2"><b>负荷调度：</b>{{ result.report.strategyAnalysis.scheduling.loadShedAdvice }}</div>
            <div style="font-size:13px;color:#606266;line-height:2"><b>检修建议：</b>{{ result.report.strategyAnalysis.scheduling.maintenanceAdvice }}</div>
          </template>
        </div>

        <!-- 三、总结报告 -->
        <div>
          <h4 style="margin:0 0 10px 0;font-size:15px;color:#303133">四、总结报告</h4>
          <div style="font-size:13px;color:#606266;font-weight:600">关键结论：</div>
          <div v-for="(f, i) in result.report.conclusion.keyFindings" :key="i" style="font-size:13px;color:#606266;line-height:2;padding-left:12px">• {{ f }}</div>
          <div style="font-size:13px;color:#606266;font-weight:600;margin-top:8px">量化指标：</div>
          <div style="font-size:13px;color:#606266;line-height:2;padding-left:12px">
            总缺电量：{{ result.report.conclusion.quantitativeMetrics.totalEnergyShortfallMwh }} MWh |
            峰值备用需求：{{ result.report.conclusion.quantitativeMetrics.peakBackupRequiredMw }} MW |
            供电保障率：{{ result.report.conclusion.quantitativeMetrics.avgSupplyGuaranteeRate }}% |
            最大供需缺口：{{ result.report.conclusion.quantitativeMetrics.maxSupplyGapMw }} MW
          </div>
          <div style="font-size:13px;color:#303133;margin-top:6px;line-height:2"><b>备用电源配置建议：</b>{{ result.report.conclusion.backupRecommendation }}</div>
          <div style="font-size:14px;color:#303133;margin-top:4px;font-weight:600">
            综合风险评级：
            <span :style="{ color: result.report.conclusion.riskLevel === 'high' ? '#f56c6c' : result.report.conclusion.riskLevel === 'medium' ? '#e6a23c' : '#67c23a' }">{{ result.report.conclusion.riskLevelLabel }}</span>
          </div>
        </div>
      </template>

      <template #footer>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <el-button size="small" @click="downloadReport('word')" :loading="reportLoading">下载Word</el-button>
          <el-button size="small" @click="downloadReport('pdf')" :loading="reportLoading">下载PDF</el-button>
          <el-button size="small" @click="reportDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.chart-panel-title { font-size: 14px; color: #303133; font-weight: 600; margin-bottom: 12px; }
</style>
