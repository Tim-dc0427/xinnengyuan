<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { fetchSimulationLive, pauseSimulation, resumeSimulation, stopSimulation, createIntervention } from '@/api/scenario'
import ChartContainer from '@/components/common/ChartContainer.vue'
import PreviewTopology from './PreviewTopology.vue'

const props = defineProps<{
  simulationId: string
  visible: boolean
  scenarioConfig: any
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
}>()

// 累积的时序数据
const voltageSeries = ref<[string, number][]>([])
const frequencySeries = ref<[string, number][]>([])
const loadRateSeries = ref<[string, number][]>([])
const consumptionRateSeries = ref<[string, number][]>([])
const pvOutputSeries = ref<[string, number][]>([])
const loadDemandSeries = ref<[string, number][]>([])
const storageSocSeries = ref<[string, number][]>([])
const operationCostSeries = ref<[string, number][]>([])

// 所有原始指标（用于构建拓扑着色数据）
const allMetrics = ref<any[]>([])

// 最新概要
const summary = ref<any>({})
// 策略事件
const events = ref<{ step: number; time: string; description: string; level: number }[]>([])
// 当前进度
const progress = ref(0)
const status = ref('')
const lastStep = ref(-1)

let pollTimer: ReturnType<typeof setInterval> | null = null

// 拓扑实时着色数据
const liveMetrics = computed(() => {
  const map: Record<string, { voltage: number; loadRate: number }> = {}
  const latestByKey: Record<string, any> = {}
  for (const m of allMetrics.value) {
    if (m.metric_type === 'strategy_event') continue
    if (m.metric_type.startsWith('voltage:')) {
      const key = m.metric_type.slice(8) // 去掉 'voltage:' 前缀
      latestByKey[key] = { ...latestByKey[key], voltage: m.value }
    } else if (m.metric_type.startsWith('load_rate:')) {
      const key = m.metric_type.slice(10)
      latestByKey[key] = { ...latestByKey[key], loadRate: m.value }
    }
  }
  for (const [k, v] of Object.entries(latestByKey)) {
    map[k] = { voltage: v.voltage || 1.0, loadRate: v.loadRate || 50 }
  }
  return map
})

function resetData() {
  voltageSeries.value = []; frequencySeries.value = []; loadRateSeries.value = []
  consumptionRateSeries.value = []; pvOutputSeries.value = []; loadDemandSeries.value = []
  storageSocSeries.value = []; operationCostSeries.value = []; allMetrics.value = []
  summary.value = {}; events.value = []; progress.value = 0; status.value = ''; lastStep.value = -1
  interveneInitialized = false
}

async function poll() {
  if (!props.simulationId) return
  try {
    const data = await fetchSimulationLive(props.simulationId, lastStep.value)
    if (!data) return
    progress.value = data.progress
    status.value = data.status
    summary.value = data.summary || {}

    // 仅首次从 paused_params 初始化滑块值，避免轮询覆盖用户手动调整
    if (!interveneInitialized && data.paused_params) {
      interveneInitialized = true
      const pp = data.paused_params
      if (pp.pvOutputLimit !== undefined) intervenePvLimit.value = pp.pvOutputLimit
      if (pp.chargePower !== undefined) interveneChargePower.value = pp.chargePower
      if (pp.loadShedRatio !== undefined) interveneLoadShed.value = pp.loadShedRatio
    }

    // 增量追加所有指标
    for (const m of data.newMetrics || []) {
      allMetrics.value.push(m)
    }
    for (const m of data.newMetrics || []) {
      const ts = m.timestamp?.slice(11, 19) || ''
      switch (m.metric_type) {
        case 'voltage': voltageSeries.value.push([ts, m.value]); break
        case 'frequency': frequencySeries.value.push([ts, m.value]); break
        case 'load_rate': loadRateSeries.value.push([ts, m.value]); break
        case 'consumption_rate': consumptionRateSeries.value.push([ts, m.value]); break
        case 'pv_output': pvOutputSeries.value.push([ts, m.value]); break
        case 'load_demand': loadDemandSeries.value.push([ts, m.value]); break
        case 'storage_soc': storageSocSeries.value.push([ts, m.value]); break
        case 'operation_cost': operationCostSeries.value.push([ts, m.value]); break
      }
    }
    // 追加事件
    for (const ev of data.events || []) {
      events.value.push(ev)
    }

    if (data.step !== undefined) lastStep.value = data.step
    if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed') {
      stopPolling()
    }
  } catch { /* 轮询失败忽略 */ }
}

async function handlePause() {
  try { await pauseSimulation(props.simulationId) } catch { /* ignore */ }
}

async function handleResume() {
  try { await resumeSimulation(props.simulationId) } catch { /* ignore */ }
}

async function handleStop() {
  try { await ElMessageBox.confirm('确定停止当前模拟？', '确认', { type: 'warning' }) } catch { return }
  try { await stopSimulation(props.simulationId) } catch { /* ignore */ }
}

// 紧急干预快捷操作
const intervenePvLimit = ref(80)
const interveneChargePower = ref(5000)
const interveneLoadShed = ref(0)
const interveneSubmitting = ref(false)
let interveneInitialized = false

async function quickIntervene() {
  interveneSubmitting.value = true
  try {
    const params = {
      pvOutputLimit: intervenePvLimit.value,
      chargePower: interveneChargePower.value,
      loadShedRatio: interveneLoadShed.value,
    }
    await createIntervention({
      scenario_id: '',
      simulation_id: props.simulationId,
      operation_type: 'force_control',
      operation_params: params,
      reason: '实时监控快捷干预',
    })
    // createIntervention 已写入 paused_params，模拟继续运行并在下一步自动生效
  } catch (e) {
    console.error('快捷干预失败', e)
  } finally {
    interveneSubmitting.value = false
  }
}

async function emergencyStopCurrent() {
  try { await ElMessageBox.confirm('紧急停止将终止当前模拟，无法恢复。确定执行？', '紧急停止确认', { type: 'error', confirmButtonText: '确定停止' }) } catch { return }
  interveneSubmitting.value = true
  try {
    await createIntervention({
      scenario_id: '',
      simulation_id: props.simulationId,
      operation_type: 'emergency_stop',
      operation_params: {},
      reason: '实时监控紧急停止',
    })
    await stopSimulation(props.simulationId)
  } catch (e) {
    console.error('紧急停止失败', e)
  } finally {
    interveneSubmitting.value = false
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(poll, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

watch(() => props.visible, (v) => {
  if (v) {
    resetData()
    poll() // 立即拉一次
    startPolling()
  } else {
    stopPolling()
  }
})

onBeforeUnmount(stopPolling)

// 电压曲线 option
const voltageOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { top: 8, right: 16, bottom: 20, left: 48 },
  xAxis: { type: 'category' as const, data: voltageSeries.value.map(d => d[0]), axisLabel: { fontSize: 10 } },
  yAxis: { type: 'value' as const, name: 'kV', axisLabel: { fontSize: 10 } },
  series: [{ type: 'line' as const, data: voltageSeries.value.map(d => d[1]), smooth: true, symbol: 'none', lineStyle: { color: '#5470C6', width: 2 } }],
}))

const frequencyOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { top: 8, right: 16, bottom: 20, left: 48 },
  xAxis: { type: 'category' as const, data: frequencySeries.value.map(d => d[0]), axisLabel: { fontSize: 10 } },
  yAxis: { type: 'value' as const, name: 'Hz', axisLabel: { fontSize: 10 }, min: 49.5, max: 50.5 },
  series: [{ type: 'line' as const, data: frequencySeries.value.map(d => d[1]), smooth: true, symbol: 'none', lineStyle: { color: '#91CC75', width: 2 } }],
}))

const loadRateOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { top: 8, right: 16, bottom: 20, left: 48 },
  xAxis: { type: 'category' as const, data: loadRateSeries.value.map(d => d[0]), axisLabel: { fontSize: 10 } },
  yAxis: { type: 'value' as const, name: '%', axisLabel: { fontSize: 10 }, min: 0, max: 100 },
  series: [{ type: 'line' as const, data: loadRateSeries.value.map(d => d[1]), smooth: true, symbol: 'none', lineStyle: { color: '#FAC858', width: 2 } }],
}))

const consumptionOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { top: 8, right: 16, bottom: 20, left: 48 },
  xAxis: { type: 'category' as const, data: consumptionRateSeries.value.map(d => d[0]), axisLabel: { fontSize: 10 } },
  yAxis: { type: 'value' as const, name: '%', axisLabel: { fontSize: 10 }, min: 0, max: 100 },
  series: [{ type: 'line' as const, data: consumptionRateSeries.value.map(d => d[1]), smooth: true, symbol: 'none', lineStyle: { color: '#FC8452', width: 2 } }],
}))

function getLevelTag(level: number) {
  return level === 2 ? 'danger' : level === 1 ? 'warning' : 'info'
}

function getLevelLabel(level: number) {
  return level === 2 ? '严重' : level === 1 ? '警告' : '信息'
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="实时监控面板"
    direction="rtl"
    size="900px"
    :with-header="true"
  >
    <!-- 进度 -->
    <div style="margin-bottom:12px;display:flex;align-items:center;gap:12px">
      <el-progress :percentage="progress" :status="status === 'completed' ? 'success' : status === 'failed' ? 'exception' : ''" :stroke-width="16" style="flex:1" />
      <el-tag v-if="status === 'running'" type="primary" size="small">运行中</el-tag>
      <el-tag v-else-if="status === 'completed'" type="success" size="small">已完成</el-tag>
      <el-tag v-else-if="status === 'failed'" type="danger" size="small">失败</el-tag>
      <el-tag v-else-if="status === 'paused'" type="warning" size="small">已暂停</el-tag>
    </div>

    <!-- 快捷操作 -->
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <el-button size="small" @click="handlePause" :disabled="status !== 'running'">暂停</el-button>
      <el-button size="small" @click="handleResume" :disabled="status !== 'paused'">恢复</el-button>
      <el-button size="small" type="danger" @click="handleStop" :disabled="status !== 'running' && status !== 'paused'">停止</el-button>
    </div>

    <!-- 紧急干预面板 -->
    <div v-if="status === 'running' || status === 'paused'" style="margin-bottom:12px;padding:10px;background:#fef0f0;border:1px solid #fab6b6;border-radius:4px">
      <div style="font-size:12px;font-weight:600;color:#F56C6C;margin-bottom:8px">紧急干预</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:4px;min-width:160px">
          <span style="font-size:11px;white-space:nowrap;color:#606266">光伏出力上限</span>
          <el-slider v-model="intervenePvLimit" :min="0" :max="100" style="flex:1;min-width:80px" size="small" />
          <span style="font-size:11px;width:32px;text-align:right;color:#909399">{{ intervenePvLimit }}%</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;min-width:180px">
          <span style="font-size:11px;white-space:nowrap;color:#606266">储能充电功率</span>
          <el-slider v-model="interveneChargePower" :min="0" :max="10000" :step="100" style="flex:1;min-width:80px" size="small" />
          <span style="font-size:11px;width:44px;text-align:right;color:#909399">{{ interveneChargePower }}kW</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:11px;white-space:nowrap;color:#606266">负荷切除比例</span>
          <el-input-number v-model="interveneLoadShed" :min="0" :max="30" :step="1" size="small" style="width:100px" />
          <span style="font-size:11px;color:#909399">%</span>
        </div>
        <el-button size="small" type="primary" :loading="interveneSubmitting" @click="quickIntervene">立即执行</el-button>
        <el-button size="small" type="danger" plain :loading="interveneSubmitting" @click="emergencyStopCurrent">紧急停止</el-button>
      </div>
    </div>

    <!-- 数据面板 -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">电压</div>
        <div style="font-size:18px;font-weight:600;color:#303133">{{ summary.voltage?.toFixed(1) || '-' }}</div>
        <div style="font-size:10px;color:#909399">kV</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">频率</div>
        <div style="font-size:18px;font-weight:600;color:#303133">{{ summary.frequency?.toFixed(2) || '-' }}</div>
        <div style="font-size:10px;color:#909399">Hz</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">负载率</div>
        <div style="font-size:18px;font-weight:600" :style="{ color: summary.loadRate > 90 ? '#F56C6C' : summary.loadRate > 80 ? '#E6A23C' : '#303133' }">{{ summary.loadRate?.toFixed(1) || '-' }}</div>
        <div style="font-size:10px;color:#909399">%</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">消纳率</div>
        <div style="font-size:18px;font-weight:600" :style="{ color: summary.consumptionRate < 90 ? '#F56C6C' : '#67C23A' }">{{ summary.consumptionRate?.toFixed(1) || '-' }}</div>
        <div style="font-size:10px;color:#909399">%</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">光伏出力</div>
        <div style="font-size:18px;font-weight:600;color:#303133">{{ summary.pvOutput ? Math.round(summary.pvOutput) + '' : '-' }}</div>
        <div style="font-size:10px;color:#909399">kW</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">负荷</div>
        <div style="font-size:18px;font-weight:600;color:#303133">{{ summary.loadDemand ? Math.round(summary.loadDemand) + '' : '-' }}</div>
        <div style="font-size:10px;color:#909399">kW</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">储能SOC</div>
        <div style="font-size:18px;font-weight:600;color:#303133">{{ summary.storageSoc?.toFixed(1) || '-' }}</div>
        <div style="font-size:10px;color:#909399">%</div>
      </div>
      <div style="flex:1;min-width:90px;padding:8px;background:#f5f7fa;border-radius:4px;text-align:center">
        <div style="font-size:11px;color:#909399">运营成本</div>
        <div style="font-size:18px;font-weight:600" :style="{ color: summary.operationCost > 0.42 ? '#F56C6C' : '#67C23A' }">{{ summary.operationCost?.toFixed(3) || '-' }}</div>
        <div style="font-size:10px;color:#909399">¥/kWh</div>
      </div>
    </div>

    <!-- 通过率 -->
    <div v-if="summary.passRate !== undefined" style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
      <span style="font-size:12px;color:#606266">安全通过率</span>
      <el-progress :percentage="summary.passRate" :status="summary.passRate >= 90 ? 'success' : summary.passRate >= 70 ? 'warning' : 'exception'" :stroke-width="10" style="flex:1" />
      <span style="font-size:12px;color:#606266">{{ summary.passRate }}%</span>
    </div>

    <!-- 实时曲线 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="border:1px solid #e0e0e0;border-radius:4px;padding:4px">
        <div style="font-size:11px;font-weight:600;margin-bottom:2px;color:#5470C6">电压 (kV)</div>
        <ChartContainer :option="voltageOption" :height="'150px'" />
      </div>
      <div style="border:1px solid #e0e0e0;border-radius:4px;padding:4px">
        <div style="font-size:11px;font-weight:600;margin-bottom:2px;color:#91CC75">频率 (Hz)</div>
        <ChartContainer :option="frequencyOption" :height="'150px'" />
      </div>
      <div style="border:1px solid #e0e0e0;border-radius:4px;padding:4px">
        <div style="font-size:11px;font-weight:600;margin-bottom:2px;color:#FAC858">负载率 (%)</div>
        <ChartContainer :option="loadRateOption" :height="'150px'" />
      </div>
      <div style="border:1px solid #e0e0e0;border-radius:4px;padding:4px">
        <div style="font-size:11px;font-weight:600;margin-bottom:2px;color:#FC8452">消纳率 (%)</div>
        <ChartContainer :option="consumptionOption" :height="'150px'" />
      </div>
    </div>

    <!-- 策略事件日志 -->
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#606266">策略执行日志</div>
    <div style="max-height:200px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:4px;padding:8px">
      <div v-if="events.length === 0" style="font-size:12px;color:#909399;text-align:center;padding:16px">暂无策略事件</div>
      <div v-for="(ev, i) in events" :key="i" style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #f5f5f5;font-size:12px">
        <span style="color:#909399;white-space:nowrap;min-width:70px">{{ ev.time?.slice(11, 19) }}</span>
        <el-tag :type="getLevelTag(ev.level)" size="small" style="flex-shrink:0">{{ getLevelLabel(ev.level) }}</el-tag>
        <span :style="{ color: ev.level === 2 ? '#F56C6C' : '#303133' }">{{ ev.description }}</span>
      </div>
    </div>

    <!-- 网架图实时着色 -->
    <div v-if="scenarioConfig?.topology?.nodes?.length" style="margin-top:12px">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;color:#606266">网架图实时状态</div>
      <div style="display:flex;gap:8px;margin-bottom:4px;font-size:11px;color:#909399">
        <span><span style="display:inline-block;width:10px;height:10px;background:#F56C6C;border-radius:2px;margin-right:2px"></span>越限</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#E6A23C;border-radius:2px;margin-right:2px"></span>警告</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#67C23A;border-radius:2px;margin-right:2px"></span>正常</span>
      </div>
      <PreviewTopology :topology="scenarioConfig.topology" :live-metrics="liveMetrics" />
    </div>
  </el-drawer>
</template>
