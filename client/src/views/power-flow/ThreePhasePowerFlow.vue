<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { submitThreePhasePF, getTaskResult, fetchPhaseDataDetail, reuseHistoryParams } from '@/api/power-flow'
import type { PhaseDataDetail } from '@/api/power-flow'
import { ElMessage } from 'element-plus'
import CalcProgress from '@/components/calculation/CalcProgress.vue'
import FeederSelector from '@/components/calculation/FeederSelector.vue'
import { useFeederSelection } from '@/composables/useFeederSelection'

const route = useRoute()

const taskId = ref<string | null>(null)
const loading = ref(false)
const result: any = ref(null)
const phaseDataDetail = ref<PhaseDataDetail | null>(null)
const showPhaseDetailExpanded = ref(false)

const weatherScenario = ref<'actual' | 'sunny' | 'cloudy' | 'rainy'>('actual')

const feeder = useFeederSelection()

watch(() => feeder.selectedFeederIds.value, async (newIds) => {
  if (newIds.length > 0) {
    try {
      phaseDataDetail.value = await fetchPhaseDataDetail(newIds)
    } catch (_) { phaseDataDetail.value = null }
  } else {
    phaseDataDetail.value = null
  }
}, { deep: false })

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
      useDBPhaseData: true,
      weatherScenario: weatherScenario.value,
      feederIds: feeder.selectedFeederIds.value,
      pvBusIds: feeder.feederPVBusIds.value,
    }
    if (phaseDataDetail.value) {
      params.customLoadPhases = phaseDataDetail.value.loads
      params.customGenPhases = phaseDataDetail.value.generators
      params.customBranchZeroSeq = phaseDataDetail.value.branches
    }
    const res = await submitThreePhasePF(params)
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

const overloadedBranches = computed(() => {
  if (!result.value?.branchRes) return []
  return result.value.branchRes.filter((b: any) => b.isOverloaded)
})

function overloadedPhases(branch: any): string[] {
  const phases: string[] = []
  if (branch.phaseAIsOverloaded) phases.push('A')
  if (branch.phaseBIsOverloaded) phases.push('B')
  if (branch.phaseCIsOverloaded) phases.push('C')
  return phases
}
</script>

<template>
  <div class="online-page">
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
        {{ result ? '重新计算' : '开始三相潮流计算' }}
      </el-button>
    </div>

    <div v-if="phaseDataDetail" class="phase-detail-panel">
      <div class="phase-detail-toggle" @click="showPhaseDetailExpanded = !showPhaseDetailExpanded">
        <span>分相数据明细</span>
        <span class="toggle-icon">{{ showPhaseDetailExpanded ? '收起 ▲' : '展开 ▼' }}</span>
      </div>
      <template v-if="showPhaseDetailExpanded">
        <div class="detail-section">
          <div class="detail-title">负荷分相 ({{ phaseDataDetail.loads.length }}条)</div>
          <el-table :data="phaseDataDetail.loads" stripe size="small" max-height="260" style="width:100%">
            <el-table-column prop="busName" width="100" label="母线" />
            <el-table-column prop="voltageLevel" width="70" label="电压" />
            <el-table-column width="80" label="A相P(MW)">
              <template #default="{ row }"><el-input-number v-model="row.pdAMw" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="B相P(MW)">
              <template #default="{ row }"><el-input-number v-model="row.pdBMw" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="C相P(MW)">
              <template #default="{ row }"><el-input-number v-model="row.pdCMw" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="A相Q(Mvar)">
              <template #default="{ row }"><el-input-number v-model="row.qdAMvar" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="B相Q(Mvar)">
              <template #default="{ row }"><el-input-number v-model="row.qdBMvar" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="C相Q(Mvar)">
              <template #default="{ row }"><el-input-number v-model="row.qdCMvar" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
          </el-table>
        </div>
        <div class="detail-section">
          <div class="detail-title">发电分相 ({{ phaseDataDetail.generators.length }}台)</div>
          <el-table :data="phaseDataDetail.generators" stripe size="small" max-height="220" style="width:100%">
            <el-table-column prop="busName" width="100" label="母线" />
            <el-table-column prop="voltageLevel" width="70" label="电压" />
            <el-table-column width="80" label="A相P(MW)">
              <template #default="{ row }"><el-input-number v-model="row.pgAMw" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="B相P(MW)">
              <template #default="{ row }"><el-input-number v-model="row.pgBMw" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="80" label="C相P(MW)">
              <template #default="{ row }"><el-input-number v-model="row.pgCMw" :min="0" :step="0.1" size="small" controls-position="right" /></template>
            </el-table-column>
          </el-table>
        </div>
        <div class="detail-section">
          <div class="detail-title">支路零序 ({{ phaseDataDetail.branches.length }}条)</div>
          <el-table :data="phaseDataDetail.branches" stripe size="small" max-height="220" style="width:100%">
            <el-table-column label="支路" width="180">
              <template #default="{ row }">{{ row.fromBusName }} → {{ row.toBusName }}</template>
            </el-table-column>
            <el-table-column prop="voltageLevel" width="70" label="电压" />
            <el-table-column prop="branchType" width="60" label="类型" />
            <el-table-column width="75" label="R(Ω)">
              <template #default="{ row }">{{ row.rOhm.toFixed(4) }}</template>
            </el-table-column>
            <el-table-column width="75" label="X(Ω)">
              <template #default="{ row }">{{ row.xOhm.toFixed(4) }}</template>
            </el-table-column>
            <el-table-column width="85" label="R0(Ω)">
              <template #default="{ row }"><el-input-number v-model="row.r0Ohm" :min="0" :step="0.001" size="small" controls-position="right" /></template>
            </el-table-column>
            <el-table-column width="85" label="X0(Ω)">
              <template #default="{ row }"><el-input-number v-model="row.x0Ohm" :min="0" :step="0.001" size="small" controls-position="right" /></template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </div>

    <CalcProgress
      :task-id="taskId"
      :show-pause-resume="true"
      @completed="onCompleted"
      @failed="onFailed"
    />

    <template v-if="result">
      <!-- 面板1：三相不平衡度台账 -->
      <div class="chart-panel">
        <div class="panel-header">
          <span>三相不平衡度台账</span>
        </div>
        <el-table :data="result.nodes" stripe size="small" max-height="500" style="width: 100%">
          <el-table-column prop="name" min-width="100">
            <template #header><el-tooltip content="母线节点名称" placement="top"><span>节点</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="voltageLevel" width="80">
            <template #header><el-tooltip content="节点电压等级" placement="top"><span>电压等级</span></el-tooltip></template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="A相实际电压" placement="top"><span>A相(kV)</span></el-tooltip></template>
            <template #default="{ row }">{{ (row.phaseA * row.baseKv).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="B相实际电压" placement="top"><span>B相(kV)</span></el-tooltip></template>
            <template #default="{ row }">{{ (row.phaseB * row.baseKv).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="C相实际电压" placement="top"><span>C相(kV)</span></el-tooltip></template>
            <template #default="{ row }">{{ (row.phaseC * row.baseKv).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="angleA" width="75">
            <template #header><el-tooltip content="A相电压相角" placement="top"><span>A相角(°)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="angleB" width="75">
            <template #header><el-tooltip content="B相电压相角" placement="top"><span>B相角(°)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="angleC" width="75">
            <template #header><el-tooltip content="C相电压相角" placement="top"><span>C相角(°)</span></el-tooltip></template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="A相净注入有功" placement="top"><span>A相P(MW)</span></el-tooltip></template>
            <template #default="{ row }">
              <span :style="{ color: row.phaseAPMw > 0 ? '#67C23A' : row.phaseAPMw < 0 ? '#F56C6C' : '#909399', fontWeight: 'bold' }">{{ row.phaseAPMw.toFixed(1) }}</span>
            </template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="A相净注入无功" placement="top"><span>A相Q(Mvar)</span></el-tooltip></template>
            <template #default="{ row }">{{ row.phaseAQMvar.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="B相净注入有功" placement="top"><span>B相P(MW)</span></el-tooltip></template>
            <template #default="{ row }">
              <span :style="{ color: row.phaseBPMw > 0 ? '#67C23A' : row.phaseBPMw < 0 ? '#F56C6C' : '#909399', fontWeight: 'bold' }">{{ row.phaseBPMw.toFixed(1) }}</span>
            </template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="B相净注入无功" placement="top"><span>B相Q(Mvar)</span></el-tooltip></template>
            <template #default="{ row }">{{ row.phaseBQMvar.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="C相净注入有功" placement="top"><span>C相P(MW)</span></el-tooltip></template>
            <template #default="{ row }">
              <span :style="{ color: row.phaseCPMw > 0 ? '#67C23A' : row.phaseCPMw < 0 ? '#F56C6C' : '#909399', fontWeight: 'bold' }">{{ row.phaseCPMw.toFixed(1) }}</span>
            </template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="C相净注入无功" placement="top"><span>C相Q(Mvar)</span></el-tooltip></template>
            <template #default="{ row }">{{ row.phaseCQMvar.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column prop="vuf" width="80">
            <template #header><el-tooltip content="电压不平衡度 VUF = |V负序|/|V正序|×100%" placement="top"><span>VUF(%)</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.vuf > 4 ? 'danger' : row.vuf > 2 ? 'warning' : 'success'" size="small">
                {{ row.vuf }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="pvRelated" width="80">
            <template #header><el-tooltip content="该节点是否接入光伏发电" placement="top"><span>光伏关联</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.pvRelated ? 'primary' : 'info'" size="small">{{ row.pvRelated ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="loadType" width="70">
            <template #header><el-tooltip content="该节点主要负荷类型" placement="top"><span>负荷类型</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="zone" width="70">
            <template #header><el-tooltip content="所属行政区划" placement="top"><span>区域</span></el-tooltip></template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 面板3：分相支路功率分布 -->
      <div class="chart-panel">
        <div class="panel-header">
          <span>分相支路功率分布</span>
        </div>
        <el-table v-if="result.branchRes && result.branchRes.length > 0" :data="result.branchRes" stripe size="small" max-height="400" style="width: 100%">
          <el-table-column prop="fromBusName" width="100">
            <template #header><el-tooltip content="支路起始母线" placement="top"><span>起始节点</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="toBusName" width="100">
            <template #header><el-tooltip content="支路终止母线" placement="top"><span>终止节点</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="voltageLevel" width="90">
            <template #header><el-tooltip content="支路电压等级" placement="top"><span>电压等级</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="branchType" width="80">
            <template #header><el-tooltip content="线路或变压器" placement="top"><span>类型</span></el-tooltip></template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="A相有功功率" placement="top"><span>A相有功(MW)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.phaseAPFromMw).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="A相无功功率" placement="top"><span>A相无功(Mvar)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.phaseAQFromMvar).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="A相负载率" placement="top"><span>A相负载率</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.phaseALoadingPct > 100 ? 'danger' : row.phaseALoadingPct > 80 ? 'warning' : 'info'" size="small">
                {{ Number(row.phaseALoadingPct).toFixed(1) }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="B相有功功率" placement="top"><span>B相有功(MW)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.phaseBPFromMw).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="B相无功功率" placement="top"><span>B相无功(Mvar)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.phaseBQFromMvar).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="B相负载率" placement="top"><span>B相负载率</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.phaseBLoadingPct > 100 ? 'danger' : row.phaseBLoadingPct > 80 ? 'warning' : 'info'" size="small">
                {{ Number(row.phaseBLoadingPct).toFixed(1) }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="C相有功功率" placement="top"><span>C相有功(MW)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.phaseCPFromMw).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="95">
            <template #header><el-tooltip content="C相无功功率" placement="top"><span>C相无功(Mvar)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.phaseCQFromMvar).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="90">
            <template #header><el-tooltip content="支路额定容量" placement="top"><span>额定(MVA)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.ampacityMva).toFixed(0) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无支路数据" :image-size="50" />
      </div>

      <!-- 面板4：单相过载检测 -->
      <div class="chart-panel">
        <div class="panel-header">
          <span>单相过载检测</span>
        </div>
        <el-table v-if="overloadedBranches.length > 0" :data="overloadedBranches" stripe size="small" max-height="300" style="width: 100%">
          <el-table-column min-width="140">
            <template #header><el-tooltip content="输电线路或变压器支路" placement="top"><span>线路</span></el-tooltip></template>
            <template #default="{ row }">{{ row.fromBusName }}→{{ row.toBusName }}</template>
          </el-table-column>
          <el-table-column prop="voltageLevel" width="90">
            <template #header><el-tooltip content="支路电压等级" placement="top"><span>电压等级</span></el-tooltip></template>
          </el-table-column>
          <el-table-column width="100">
            <template #header><el-tooltip content="出现过载的具体相别" placement="top"><span>过载相</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag v-for="p in overloadedPhases(row)" :key="p" type="danger" size="small" style="margin-right:2px">{{ p }}相</el-tag>
            </template>
          </el-table-column>
          <el-table-column width="100">
            <template #header><el-tooltip content="过载最严重相的负载率" placement="top"><span>负载率</span></el-tooltip></template>
            <template #default="{ row }">
              {{ Math.max(row.phaseALoadingPct, row.phaseBLoadingPct, row.phaseCLoadingPct).toFixed(1) }}%
            </template>
          </el-table-column>
          <el-table-column width="100">
            <template #header><el-tooltip content="支路额定传输容量" placement="top"><span>额定(MVA)</span></el-tooltip></template>
            <template #default="{ row }">{{ Number(row.ampacityMva).toFixed(0) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无单相过载线路" :image-size="50" />
      </div>

      <!-- 面板5：不平衡越限节点清单 -->
      <div class="chart-panel">
        <div class="panel-header">
          <span>不平衡越限节点清单（VUF > 2%）</span>
        </div>
        <el-table v-if="result.nodes.filter((n: any) => n.isViolation).length > 0" :data="result.nodes.filter((n: any) => n.isViolation)" stripe size="small" max-height="300" style="width: 100%">
          <el-table-column prop="name" min-width="110">
            <template #header><el-tooltip content="越限节点名称" placement="top"><span>节点</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="voltageLevel" width="80">
            <template #header><el-tooltip content="节点电压等级" placement="top"><span>电压等级</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="vuf" width="85">
            <template #header><el-tooltip content="电压不平衡度" placement="top"><span>VUF(%)</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag type="danger" size="small">{{ row.vuf }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="pvRelated" width="80">
            <template #header><el-tooltip content="是否与光伏接入相关" placement="top"><span>光伏关联</span></el-tooltip></template>
            <template #default="{ row }">
              <el-tag :type="row.pvRelated ? 'primary' : 'info'" size="small">{{ row.pvRelated ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="loadType" width="70">
            <template #header><el-tooltip content="节点主要负荷类型" placement="top"><span>负荷类型</span></el-tooltip></template>
          </el-table-column>
          <el-table-column prop="zone" width="70">
            <template #header><el-tooltip content="所属行政区划" placement="top"><span>区域</span></el-tooltip></template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无 VUF 越限节点" :image-size="50" />
      </div>

      <!-- 面板6：分相损耗汇总 -->
      <div class="chart-panel">
        <div class="panel-header">
          <span>分相损耗汇总</span>
        </div>
        <div class="loss-cards">
          <div class="loss-card">
            <span class="loss-label">A相损耗</span>
            <span class="loss-value">{{ result.summary.phaseALossMw?.toFixed(2) || '0.00' }} MW</span>
          </div>
          <div class="loss-card">
            <span class="loss-label">B相损耗</span>
            <span class="loss-value">{{ result.summary.phaseBLossMw?.toFixed(2) || '0.00' }} MW</span>
          </div>
          <div class="loss-card">
            <span class="loss-label">C相损耗</span>
            <span class="loss-value">{{ result.summary.phaseCLossMw?.toFixed(2) || '0.00' }} MW</span>
          </div>
          <div class="loss-card">
            <span class="loss-label">总损耗</span>
            <span class="loss-value">{{ ((result.summary.totalLossKw || 0) / 1000).toFixed(2) }} MW</span>
          </div>
          <div class="loss-card">
            <span class="loss-label">过载相数</span>
            <span class="loss-value" :class="{ 'loss-danger': (result.summary.overloadedPhasesCount || 0) > 0 }">{{ result.summary.overloadedPhasesCount || 0 }} 个</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.online-page { padding: 0; }
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #606266; white-space: nowrap; }
.detail-section {
  margin-top: 10px;
  padding: 8px 10px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.detail-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
}
.phase-detail-panel {
  background: #fff;
  border-radius: 8px;
  padding: 0 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.phase-detail-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  user-select: none;
}
.toggle-icon {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
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
.loss-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.loss-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 20px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  min-width: 120px;
}
.loss-label {
  font-size: 12px;
  color: #909399;
}
.loss-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.loss-danger {
  color: #F56C6C;
}
</style>
