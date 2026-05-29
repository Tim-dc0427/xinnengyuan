<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { submitProbabilisticPF, getTaskResult, reuseHistoryParams } from '@/api/power-flow'
import { ElMessage } from 'element-plus'
import CalcProgress from '@/components/calculation/CalcProgress.vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import FeederSelector from '@/components/calculation/FeederSelector.vue'
import { useFeederSelection } from '@/composables/useFeederSelection'

const route = useRoute()

const taskId = ref<string | null>(null)
const loading = ref(false)
const result: any = ref(null)
const sampleCount = ref(200)
const loadVariationPct = ref(10)
const pvConcentration = ref(20)
const progressData = ref<any>(null)

const weatherScenario = ref<'actual' | 'sunny' | 'cloudy' | 'rainy'>('actual')

const feeder = useFeederSelection()

onMounted(async () => {
  feeder.loadFeeders()
  const tid = route.query.taskId as string
  if (tid) {
    taskId.value = tid
    await onCompleted()
  }
  const reuseId = route.query.reuseTaskId as string
  if (reuseId) {
    try {
      const { parameters: p } = await reuseHistoryParams(reuseId)
      if (p.sampleCount) sampleCount.value = p.sampleCount
      if (p.loadVariationPct != null) loadVariationPct.value = p.loadVariationPct
      if (p.pvConcentration != null) pvConcentration.value = p.pvConcentration
      if (p.weatherScenario) weatherScenario.value = p.weatherScenario
      if (p.feederIds?.length) feeder.selectedFeederIds.value = p.feederIds
    } catch (_) {}
  }
})

async function startCalculation() {
  if (feeder.selectedFeederIds.value.length === 0) {
    ElMessage.warning('请选择馈线')
    return
  }
  loading.value = true
  result.value = null
  try {
    const params: any = {
      sampleCount: sampleCount.value,
      loadVariationPct: loadVariationPct.value,
      pvConcentration: pvConcentration.value,
      weatherScenario: weatherScenario.value,
      feederIds: feeder.selectedFeederIds.value,
      pvBusIds: feeder.feederPVBusIds.value,
    }
    const res = await submitProbabilisticPF(params)
    taskId.value = res.taskId
  } catch (e: any) {
    ElMessage.error('提交计算失败: ' + (e.message || '未知错误'))
    loading.value = false
  }
}

async function onCompleted() {
  if (!taskId.value) return
  try {
    const res = await getTaskResult(taskId.value)
    if (res) {
      const nodes = typeof res.node_results === 'string' ? JSON.parse(res.node_results) : (res.node_results || [])
      const branchRes = typeof res.branch_results === 'string' ? JSON.parse(res.branch_results) : (res.branch_results || [])
      const summary = typeof res.summary === 'string' ? JSON.parse(res.summary) : (res.summary || {})
      result.value = { nodes, branchRes, summary }
      const maxNode = nodes.reduce((a: any, b: any) =>
        Math.max(a.violationProbabilityLower || 0, a.violationProbabilityUpper || 0) >
        Math.max(b.violationProbabilityLower || 0, b.violationProbabilityUpper || 0) ? a : b
      , nodes[0])
      cdfSelectedNode.value = maxNode?.busId || ''
      const maxBranch = branchRes.reduce((a: any, b: any) =>
        (a.overloadProbability || 0) > (b.overloadProbability || 0) ? a : b
      , branchRes[0])
      cdfSelectedBranch.value = maxBranch?.branchId || ''
    }
  } catch (e: any) {
    ElMessage.error('获取结果失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function onFailed(err: string) {
  ElMessage.error('计算失败: ' + err)
  loading.value = false
}

const cdfMode = ref<'voltage' | 'power'>('voltage')
const cdfSelectedNode = ref('')
const cdfSelectedBranch = ref('')

function buildCdfOption(hist: Array<{ x: number; count: number }>, xName: string, markLines: Array<{ value: number; label: string }>) {
  const total = hist.reduce((s, b) => s + b.count, 0)
  let cum = 0
  const cdfData = hist.map(b => { cum += b.count; return [b.x, Number(((cum / total) * 100).toFixed(1))] })
  return {
    tooltip: { trigger: 'axis', formatter: (params: any) => `${xName} ${params[0].data[0]}<br/>累积概率 ${params[0].data[1]}%` },
    xAxis: { type: 'value', name: xName, nameLocation: 'center', nameGap: 32, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '累积概率 (%)', max: 100, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'line', data: cdfData, smooth: true, symbol: 'none',
      lineStyle: { color: '#267F7B', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.15)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }] } },
      markLine: markLines.length > 0 ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: '#F56C6C', width: 1.5 }, label: { fontSize: 11 }, data: markLines.map(m => ({ xAxis: m.value, name: m.label, label: { formatter: m.label } })) } : undefined,
    }],
    grid: { left: 60, right: 40, bottom: 50, top: 30 },
  }
}

const cdfChartOption = computed(() => {
  if (!result.value?.nodes) return {}
  const nodes = result.value.nodes as any[]
  const node = nodes.find((n: any) => n.busId === cdfSelectedNode.value) || nodes[0]
  if (!node?.histogram?.length) return {}

  const hist = node.histogram.map((b: any) => ({ x: b.voltageKv, count: b.count }))
  const lowerLimit = Number((node.baseKv * 0.95).toFixed(2))
  const upperLimit = Number((node.baseKv * 1.05).toFixed(2))
  return buildCdfOption(hist, '电压 (kV)', [
    { value: lowerLimit, label: `下限 ${lowerLimit}kV` },
    { value: upperLimit, label: `上限 ${upperLimit}kV` },
  ])
})

const branchCdfChartOption = computed(() => {
  if (!result.value?.branchRes) return {}
  const branches = result.value.branchRes as any[]
  const branch = branches.find((b: any) => b.branchId === cdfSelectedBranch.value) || branches[0]
  if (!branch?.histogram?.length) return {}

  const hist = branch.histogram.map((b: any) => ({ x: b.powerMw, count: b.count }))
  const ampacity = branch.ampacityMva || 0
  return buildCdfOption(hist, '有功功率 (MW)',
    ampacity > 0 ? [{ value: ampacity, label: `限额 ${ampacity}MW` }] : [],
  )
})
</script>

<template>
  <div class="online-page">
    <div class="chart-panel-title">概率潮流计算支持</div>
    <div class="filter-bar">
      <FeederSelector
        v-if="feeder.feeders.value.length > 0"
        :feeder-zone-options="feeder.feederZoneOptions.value"
        :feeder-options="feeder.feederOptions.value"
        :selected-feeder-ids="feeder.selectedFeederIds.value"
        :feeder-zone-filter="feeder.feederZoneFilter.value"
        @update:selected-feeder-ids="feeder.selectedFeederIds.value = $event"
        @update:feeder-zone-filter="feeder.feederZoneFilter.value = $event"
        @select-all="feeder.selectAllFeeders()"
        @deselect-all="feeder.deselectAllFeeders()"
      />
      <div class="filter-group">
        <el-tooltip content="蒙特卡洛模拟的随机场景采样次数，次数越多结果越精确" placement="top">
          <span class="filter-label">采样次数：</span>
        </el-tooltip>
        <el-input-number v-model="sampleCount" :min="100" :max="2000" :step="100" size="small" />
      </div>

      <div class="dist-config">
        <div class="dist-section">
          <div class="dist-title">负荷不确定性（正态分布）</div>
          <div class="dist-row">
            <el-tooltip content="负荷波动的标准差与均值之比，反映负荷不确定程度" placement="top">
              <span class="filter-label">变异系数 σ/μ：</span>
            </el-tooltip>
            <el-slider v-model="loadVariationPct" :min="1" :max="30" :step="1" style="width: 140px" show-input size="small" />
            <span class="filter-unit">%</span>
          </div>
        </div>

        <div class="dist-section">
          <div class="dist-title">光伏出力模型 — Beta 分布 B(α, β)</div>
          <div class="dist-row">
            <el-tooltip content="Beta分布的集中度参数，ν越大出力越集中在预测值附近，ν越小波动越大" placement="top">
              <span class="filter-label">集中度 ν = α+β：</span>
            </el-tooltip>
            <el-slider v-model="pvConcentration" :min="5" :max="100" :step="5" style="width: 140px" show-input size="small" />
          </div>
        </div>

      </div>
      <div v-if="feeder.selectedFeederIds.value.length > 0" class="filter-group">
        <el-tooltip content="光伏出力计算的基准天气条件" placement="top">
          <span class="filter-label">天气场景：</span>
        </el-tooltip>
        <el-select v-model="weatherScenario" size="small" style="width:130px">
          <el-option value="actual" label="实际测量值" />
          <el-option value="sunny" label="典型晴天" />
          <el-option value="cloudy" label="多云天气" />
          <el-option value="rainy" label="阴雨天气" />
        </el-select>
      </div>
      <el-button type="primary" :loading="loading" @click="startCalculation">
        {{ result ? '重新计算' : '开始概率潮流计算' }}
      </el-button>
    </div>

    <CalcProgress
      :task-id="taskId"
      :show-pause-resume="true"
      @completed="onCompleted"
      @failed="onFailed"
    />

    <template v-if="result">
      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#267F7B"><Histogram /></el-icon>
          <span>累积分布函数（CDF）</span>
          <el-radio-group v-model="cdfMode" size="small" style="margin-left:12px">
            <el-radio-button value="voltage">电压</el-radio-button>
            <el-radio-button value="power">线路功率</el-radio-button>
          </el-radio-group>
          <el-select v-if="cdfMode === 'voltage'" v-model="cdfSelectedNode" size="small" style="width:200px;margin-left:12px">
            <el-option v-for="n in result.nodes" :key="n.busId" :label="`${n.name} (${n.baseKv}kV)`" :value="n.busId" />
          </el-select>
          <el-select v-else v-model="cdfSelectedBranch" size="small" style="width:200px;margin-left:12px">
            <el-option v-for="b in result.branchRes" :key="b.branchId" :label="b.name" :value="b.branchId" />
          </el-select>
        </div>
        <ChartContainer :option="cdfMode === 'voltage' ? cdfChartOption : branchCdfChartOption" style="height: 360px" />
      </div>

      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#F56C6C"><WarningFilled /></el-icon>
          <span>电压越限风险节点</span>
        </div>
        <el-table :data="result.nodes.filter((n: any) => n.violationProbabilityLower > 0 || n.violationProbabilityUpper > 0)" stripe size="small" max-height="300" style="width: 100%">
          <el-table-column prop="name" min-width="100">
            <template #header><el-tooltip content="母线节点名称" placement="top"><span>节点</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="baseKv" width="75">
            <template #header><el-tooltip content="节点额定电压等级" placement="top"><span>基准(kV)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="expectedKv" width="85">
            <template #header><el-tooltip content="概率潮流采样的电压期望值" placement="top"><span>均值(kV)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="stdDevKv" width="85">
            <template #header><el-tooltip content="电压波动的标准差，反映离散程度" placement="top"><span>标准差(kV)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="p5Kv" width="75">
            <template #header><el-tooltip content="5%的采样结果低于此电压值" placement="top"><span>P5(kV)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="p95Kv" width="75">
            <template #header><el-tooltip content="95%的采样结果低于此电压值" placement="top"><span>P95(kV)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="电压低于0.95倍基准电压的概率" placement="top"><span>P(V<下限)</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.violationProbabilityLower > 20 ? 'danger' : row.violationProbabilityLower > 5 ? 'warning' : 'info'" size="small">
                {{ row.violationProbabilityLower }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="电压高于1.05倍基准电压的概率" placement="top"><span>P(V>上限)</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.violationProbabilityUpper > 20 ? 'danger' : row.violationProbabilityUpper > 5 ? 'warning' : 'info'" size="small">
                {{ row.violationProbabilityUpper }}%
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="result.nodes.filter((n: any) => n.violationProbabilityLower > 0 || n.violationProbabilityUpper > 0).length === 0" description="暂无电压越限风险节点" :image-size="50" />
      </div>

      <div class="chart-panel">
        <div class="panel-header">
          <el-icon color="#E6A23C"><WarningFilled /></el-icon>
          <span>线路过载风险</span>
        </div>
        <el-table :data="result.branchRes.filter((b: any) => b.overloadProbability > 1)" stripe size="small" max-height="300" style="width: 100%">
          <el-table-column prop="name" min-width="140">
            <template #header><el-tooltip content="输电线路或变压器支路" placement="top"><span>线路</span></el-tooltip></template>
          </el-table-column>
          <el-table-column width="100">
            <template #header><el-tooltip content="概率潮流采样的有功功率期望值" placement="top"><span>期望功率(MW)</span></el-tooltip></template>
            <template #default="{ row }">{{ row.expectedPowerMw }}</template>
          </el-table-column>
          <el-table-column prop="expectedLoadingPct" width="100">
            <template #header><el-tooltip content="概率潮流采样的负载率期望值" placement="top"><span>期望负载率</span></el-tooltip></template>
            <template #default="{ row }">{{ row.expectedLoadingPct }}%</template>
          </el-table-column>
          <el-table-column prop="overloadProbability" width="100">
            <template #header><el-tooltip content="负载率超过100%的概率" placement="top"><span>过载概率</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.overloadProbability > 10 ? 'danger' : 'warning'" size="small">
                {{ row.overloadProbability }}%
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="result.branchRes.filter((b: any) => b.overloadProbability > 1).length === 0" description="暂无线路过载风险" :image-size="50" />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { Histogram, WarningFilled } from '@element-plus/icons-vue'
export default { components: { Histogram, WarningFilled } }
</script>

<style scoped>
.online-page { padding: 0; }
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #606266; white-space: nowrap; }
.chart-panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.null-value { color: #c0c4cc; }
.dist-config {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  padding: 12px 16px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.dist-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
}
.dist-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  padding-bottom: 2px;
  border-bottom: 1px solid #e4e7ed;
}
.dist-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-unit {
  font-size: 12px;
  color: #909399;
  width: 20px;
}
</style>
