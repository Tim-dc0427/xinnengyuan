<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchScenarios, fetchStrategies, fetchSimulations, startSimulation, stopSimulation, pauseSimulation, resumeSimulation, updateSimulationParams, fetchSimulationResults, fetchRunningSimulations } from '@/api/scenario'
import RealtimeMonitor from './components/RealtimeMonitor.vue'

const router = useRouter()

const scenarios = ref<any[]>([])
const strategies = ref<any[]>([])
const simulations = ref<any[]>([])
const runningSims = ref<any[]>([])
const loading = ref(false)
const filterScenarioId = ref('')

const form = ref({ scenario_id: '', strategy_id: '', time_range: { start: '', end: '' }, boundary_conditions: {} as any, step_interval_minutes: 1, speed_multiplier: 1, faults: [] as any[] })
const dialogVisible = ref(false)
const starting = ref(false)

const resultsVisible = ref(false)
const results = ref<any>(null)
const resultsLabel = ref('')
const resultsSimRow = ref<any>(null) // 当前查看结果的模拟行

// 实时监控
const monitorVisible = ref(false)
const monitorSimId = ref('')
const monitorScenarioConfig = ref<any>({})

// 迭代调整：记录上一次结果用于对比
const prevResults = ref<any>(null)
const iterating = ref(false)

const metricTypeMap: Record<string, string> = {
  voltage: '电压 (kV)',
  frequency: '频率 (Hz)',
  load_rate: '负载率 (%)',
  consumption_rate: '消纳率 (%)',
  pv_output: '光伏出力 (kW)',
  load_demand: '负荷 (kW)',
  storage_soc: '储能SOC (%)',
  operation_cost: '运营成本 (¥/kWh)',
  strategy_event: '策略事件',
}

async function loadData() {
  loading.value = true
  try {
    simulations.value = await fetchSimulations({ scenario_id: filterScenarioId.value || undefined })
    runningSims.value = await fetchRunningSimulations()
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  const res = await fetchScenarios({ pageSize: 100 })
  scenarios.value = res.list || []
}

async function onScenarioChange() {
  if (form.value.scenario_id) {
    strategies.value = await fetchStrategies({ scenario_id: form.value.scenario_id })
  } else {
    strategies.value = []
  }
}

function openStart() {
  form.value = { scenario_id: '', strategy_id: '', time_range: { start: '', end: '' }, boundary_conditions: { maxLoad: 100, minLoad: 30, pvOutput: 80 } as any, step_interval_minutes: 1, speed_multiplier: 1, faults: [] }
  strategies.value = []
  dialogVisible.value = true
}

async function start() {
  if (!form.value.scenario_id) return
  starting.value = true
  try {
    const bc = { ...form.value.boundary_conditions, faults: form.value.faults }
    const sim = await startSimulation({
      scenario_id: form.value.scenario_id,
      strategy_id: form.value.strategy_id || undefined,
      time_range: form.value.time_range,
      boundary_conditions: bc,
    })
    dialogVisible.value = false
    await loadData()
    // 启动后自动打开实时监控
    autoOpenMonitor(sim)
  } finally {
    starting.value = false
  }
}

// 迭代重新模拟：复用上次参数
async function reRun(row: any) {
  if (!row.scenario_id) return
  iterating.value = true
  try {
    // 保存当前结果作为"上一次"
    if (row.status === 'completed') {
      try {
        prevResults.value = await fetchSimulationResults(row.id)
      } catch { prevResults.value = null }
    }
    const sim = await startSimulation({
      scenario_id: row.scenario_id,
      strategy_id: row.strategy_id || undefined,
      time_range: row.time_range || undefined,
      boundary_conditions: row.boundary_conditions || undefined,
    })
    await loadData()
    // 自动打开实时监控
    autoOpenMonitor(sim)
  } finally {
    iterating.value = false
  }
}

async function stop(id: string) {
  await stopSimulation(id)
  await loadData()
}

async function pauseSim(id: string) {
  await pauseSimulation(id)
  await loadData()
}

async function resumeSim(id: string) {
  await resumeSimulation(id)
  await loadData()
}

async function updateParams(id: string, params: any) {
  await updateSimulationParams(id, params)
}

async function showResults(row: any) {
  resultsSimRow.value = row
  resultsLabel.value = `模拟结果 - ${row.id?.slice(0, 8)}...`
  results.value = await fetchSimulationResults(row.id)
  resultsVisible.value = true
}

function autoOpenMonitor(sim: any) {
  monitorSimId.value = sim.id || sim
  const scene = scenarios.value.find((s: any) => s.id === sim.scenario_id)
  monitorScenarioConfig.value = scene?.config || {}
  monitorVisible.value = true
}

function openMonitor(row: any) {
  monitorSimId.value = row.id
  const scene = scenarios.value.find((s: any) => s.id === row.scenario_id)
  monitorScenarioConfig.value = scene?.config || {}
  monitorVisible.value = true
}

// 跳转策略管理页调整参数
function goAdjustStrategy(row: any) {
  resultsVisible.value = false
  router.push({ path: '/resources/scenarios/strategy', query: { scenario_id: row.scenario_id } })
}

// 迭代：从结果页直接重跑
async function iterateFromResult() {
  if (!resultsSimRow.value) return
  resultsVisible.value = false
  await reRun(resultsSimRow.value)
}

function getStatusTag(status: string) {
  const map: Record<string, string> = { pending: 'info', running: 'primary', paused: 'warning', completed: 'success', stopped: 'warning', failed: 'danger' }
  return map[status] || 'info'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = { pending: '等待中', running: '运行中', paused: '已暂停', completed: '已完成', stopped: '已停止', failed: '失败' }
  return map[status] || status
}

// 计算通过率和经济性
function calcPassRate(m: any[]) {
  if (!m?.length) return 100
  const violations = m.filter((x: any) => x.is_violation && x.metric_type !== 'strategy_event').length
  const total = m.filter((x: any) => x.metric_type !== 'strategy_event').length
  return total > 0 ? Math.round(((total - violations) / total) * 100) : 100
}

function getLatestMetric(m: any[], type: string) {
  const found = [...m].reverse().find((x: any) => x.metric_type === type)
  return found?.value
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    try {
      const [sims, running] = await Promise.all([
        fetchSimulations({ scenario_id: filterScenarioId.value || undefined }),
        fetchRunningSimulations(),
      ])
      simulations.value = sims
      runningSims.value = running
      if (running.length === 0) stopPolling()
    } catch { /* 轮询失败忽略 */ }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

watch(() => runningSims.value.length, (n) => {
  if (n > 0) startPolling()
  else stopPolling()
})

onMounted(() => {
  loadOptions()
  loadData()
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <div>
    <div class="chart-panel-title">场景模拟与验证</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterScenarioId" placeholder="关联场景" clearable style="width:180px" size="small" @change="loadData">
          <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <el-button type="primary" size="small" @click="openStart">启动模拟</el-button>
    </div>

    <div v-if="runningSims.length" style="margin-bottom:16px;border:1px solid #e0e0e0;border-radius:4px">
      <div style="font-size:13px;font-weight:600;padding:8px 12px;background:#f5f7fa;border-bottom:1px solid #e0e0e0">运行中的模拟</div>
      <div v-for="sim in runningSims" :key="sim.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0">
        <div style="flex:1">
          <span style="font-weight:600">{{ sim.scenario_name || sim.scenario_id?.slice(0, 8) }}</span>
          <span style="margin-left:12px;font-size:12px;color:#606266">进度: {{ sim.progress }}%</span>
        </div>
        <div style="display:flex;gap:4px">
          <el-button size="small" type="primary" link @click="openMonitor(sim)">实时监控</el-button>
          <el-button size="small" link @click="pauseSim(sim.id)">暂停</el-button>
          <el-button size="small" link @click="stop(sim.id)">停止</el-button>
        </div>
      </div>
    </div>

    <el-table :data="simulations" stripe size="small" v-loading="loading">
      <el-table-column label="关联场景" min-width="120">
        <template #default="{ row }">
          {{ scenarios.find((s: any) => s.id === row.scenario_id)?.name || row.scenario_id?.slice(0, 8) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="getStatusTag(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="110">
        <template #default="{ row }">
          <el-progress :percentage="row.progress" :status="row.status === 'completed' ? 'success' : ''" :stroke-width="10" />
        </template>
      </el-table-column>
      <el-table-column prop="started_at" label="开始时间" width="150" />
      <el-table-column prop="completed_at" label="结束时间" width="150" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'running'">
            <el-button size="small" link type="primary" @click="openMonitor(row)">实时监控</el-button>
            <el-button size="small" link @click="pauseSim(row.id)">暂停</el-button>
            <el-button size="small" link @click="stop(row.id)">停止</el-button>
          </template>
          <template v-else-if="row.status === 'paused'">
            <el-button size="small" link type="primary" @click="openMonitor(row)">实时监控</el-button>
            <el-button size="small" link @click="resumeSim(row.id)">恢复</el-button>
            <el-button size="small" link @click="stop(row.id)">停止</el-button>
          </template>
          <template v-else>
            <el-button size="small" link type="primary" :disabled="row.status !== 'completed'" @click="showResults(row)">查看结果</el-button>
            <el-button size="small" link :disabled="row.status === 'running'" :loading="iterating" @click="reRun(row)">重新模拟</el-button>
            <el-button v-if="row.strategy_id" size="small" link @click="goAdjustStrategy(row)">调整策略</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="启动模拟" width="500px">
      <el-form :model="form" label-position="top" size="small">
        <el-form-item label="选择场景">
          <el-select v-model="form.scenario_id" @change="onScenarioChange">
            <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择策略(可选)">
          <el-select v-model="form.strategy_id" clearable>
            <el-option v-for="s in strategies" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-input v-model="form.time_range.start" placeholder="2026-05-22T08:00" size="small" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-input v-model="form.time_range.end" placeholder="2026-05-22T18:00" size="small" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="最大负荷(MW)">
              <el-input-number v-model="form.boundary_conditions.maxLoad" :min="0" size="small" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最小负荷(MW)">
              <el-input-number v-model="form.boundary_conditions.minLoad" :min="0" size="small" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="光伏出力(%)">
              <el-input-number v-model="form.boundary_conditions.pvOutput" :min="0" :max="100" size="small" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="时间步长">
              <el-select v-model="form.step_interval_minutes" size="small" style="width:100%">
                <el-option :value="1" label="1分钟" />
                <el-option :value="5" label="5分钟" />
                <el-option :value="15" label="15分钟" />
                <el-option :value="30" label="30分钟" />
                <el-option :value="60" label="60分钟" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模拟速度">
              <el-select v-model="form.speed_multiplier" size="small" style="width:100%">
                <el-option :value="1" label="1x" />
                <el-option :value="10" label="10x" />
                <el-option :value="100" label="100x" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <!-- 故障注入面板 -->
        <el-form-item label="故障注入">
          <div style="width:100%">
            <div v-for="(f, i) in form.faults" :key="i" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <el-select v-model="f.type" size="small" style="width:130px">
                <el-option value="线路跳闸" label="线路跳闸" />
                <el-option value="负荷突增" label="负荷突增" />
                <el-option value="光伏骤降" label="光伏骤降" />
              </el-select>
              <el-input-number v-model="f.trigger_step" :min="1" placeholder="触发步" size="small" style="width:100px" controls-position="right" />
              <template v-if="f.type === '负荷突增'">
                <el-input-number v-model="f.load_multiplier" :min="1" :step="0.1" :precision="1" placeholder="负荷倍数" size="small" style="width:120px" controls-position="right" />
              </template>
              <template v-else-if="f.type === '光伏骤降'">
                <el-input-number v-model="f.drop_ratio" :min="0" :max="100" placeholder="骤降比例%" size="small" style="width:120px" controls-position="right" />
              </template>
              <el-button size="small" text @click="form.faults.splice(i, 1)">删除</el-button>
            </div>
            <el-button size="small" @click="form.faults.push({ type: '线路跳闸', trigger_step: 1 })">+ 添加故障</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="starting" @click="start">启动</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resultsVisible" :title="resultsLabel" width="800px">
      <template v-if="results">
        <!-- 评估摘要 -->
        <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:120px;padding:10px;background:#f5f7fa;border-radius:4px;text-align:center">
            <div style="font-size:11px;color:#909399">安全通过率</div>
            <div style="font-size:22px;font-weight:600" :style="{ color: calcPassRate(results.metrics) >= 90 ? '#67C23A' : calcPassRate(results.metrics) >= 70 ? '#E6A23C' : '#F56C6C' }">{{ calcPassRate(results.metrics) }}%</div>
          </div>
          <div style="flex:1;min-width:120px;padding:10px;background:#f5f7fa;border-radius:4px;text-align:center">
            <div style="font-size:11px;color:#909399">越限项数</div>
            <div style="font-size:22px;font-weight:600" :style="{ color: results.violations?.length ? '#F56C6C' : '#67C23A' }">{{ results.violations?.length || 0 }}</div>
          </div>
          <div style="flex:1;min-width:120px;padding:10px;background:#f5f7fa;border-radius:4px;text-align:center">
            <div style="font-size:11px;color:#909399">运营成本</div>
            <div style="font-size:22px;font-weight:600" :style="{ color: (getLatestMetric(results.metrics, 'operation_cost') || 0) > 0.42 ? '#F56C6C' : '#67C23A' }">{{ getLatestMetric(results.metrics, 'operation_cost')?.toFixed(3) || '-' }}</div>
            <div style="font-size:10px;color:#909399">¥/kWh</div>
          </div>
          <div style="flex:1;min-width:120px;padding:10px;background:#f5f7fa;border-radius:4px;text-align:center">
            <div style="font-size:11px;color:#909399">消纳率</div>
            <div style="font-size:22px;font-weight:600" :style="{ color: (getLatestMetric(results.metrics, 'consumption_rate') || 0) < 95 ? '#F56C6C' : '#67C23A' }">{{ getLatestMetric(results.metrics, 'consumption_rate')?.toFixed(1) || '-' }}%</div>
          </div>
        </div>

        <!-- 与上一次模拟对比 -->
        <div v-if="prevResults" style="margin-bottom:12px;padding:8px;background:#fef0f0;border:1px solid #fde2e2;border-radius:4px;font-size:12px">
          <span style="font-weight:600;color:#F56C6C">迭代对比: </span>
          上次通过率 {{ calcPassRate(prevResults.metrics) }}% → 本次 {{ calcPassRate(results.metrics) }}%
          <span v-if="calcPassRate(results.metrics) > calcPassRate(prevResults.metrics)" style="color:#67C23A"> ↑ 改善</span>
          <span v-else-if="calcPassRate(results.metrics) < calcPassRate(prevResults.metrics)" style="color:#F56C6C"> ↓ 恶化</span>
          <span v-else style="color:#909399"> → 持平</span>
        </div>

        <div style="margin-bottom:12px">
          <span style="font-size:13px;font-weight:600">越限明细</span>
          <el-tag v-if="results.violations?.length" type="danger" size="small" style="margin-left:8px">{{ results.violations.length }} 项</el-tag>
          <el-tag v-else type="success" size="small" style="margin-left:8px">无越限</el-tag>
        </div>
        <el-table :data="results.metrics" stripe size="small" max-height="300">
          <el-table-column prop="timestamp" label="时间戳" width="155" />
          <el-table-column label="指标类型" width="140">
            <template #default="{ row }">{{ metricTypeMap[row.metric_type] || row.metric_type }}</template>
          </el-table-column>
          <el-table-column prop="value" label="值" width="100" />
          <el-table-column prop="threshold" label="阈值" width="100" />
          <el-table-column label="越限" width="60" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.is_violation" type="danger" size="small">是</el-tag>
              <span v-else style="color:#909399">否</span>
            </template>
          </el-table-column>
        </el-table>

        <!-- 迭代操作 -->
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <el-button v-if="resultsSimRow?.strategy_id" size="small" @click="goAdjustStrategy(resultsSimRow)">调整策略参数</el-button>
          <el-button size="small" type="primary" :loading="iterating" @click="iterateFromResult">迭代重新模拟</el-button>
        </div>
      </template>
    </el-dialog>

    <RealtimeMonitor
      v-model:visible="monitorVisible"
      :simulation-id="monitorSimId"
      :scenario-config="monitorScenarioConfig"
    />
  </div>
</template>
