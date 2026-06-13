<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchScenarios, fetchStrategies, fetchSimulations, startSimulation, stopSimulation, pauseSimulation, resumeSimulation, updateSimulationParams, deleteSimulation } from '@/api/scenario'
import RealtimeMonitor from './components/RealtimeMonitor.vue'
import { formatDateTime } from '@/utils/time'

const router = useRouter()
const scenarios = ref<any[]>([])
const strategies = ref<any[]>([])
const simulations = ref<any[]>([])
const loading = ref(false)

const form = ref({ scenario_id: '', strategy_id: '', time_range: { start: '', end: '' }, boundary_conditions: {} as any, step_interval_minutes: 1, speed_multiplier: 1, faults: [] as any[] })
const dialogVisible = ref(false)
const starting = ref(false)

// 实时监控
const monitorVisible = ref(false)
const monitorSimId = ref('')
const monitorScenarioConfig = ref<any>({})

async function loadData() {
  loading.value = true
  try {
    simulations.value = await fetchSimulations()
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
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  form.value = { scenario_id: '', strategy_id: '', time_range: { start: todayStr + 'T08:00', end: todayStr + 'T18:00' }, boundary_conditions: { maxLoad: 100, minLoad: 30, pvOutput: 80 } as any, step_interval_minutes: 1, speed_multiplier: 1, faults: [] }
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
      step_interval_minutes: form.value.step_interval_minutes,
      speed_multiplier: form.value.speed_multiplier,
    })
    dialogVisible.value = false
    await loadData()
    autoOpenMonitor(sim)
  } finally {
    starting.value = false
  }
}

// 迭代重新模拟：复用上次参数，启动后自动打开实时监控
async function reRun(row: any) {
  if (!row.scenario_id) return
  try {
    const sim = await startSimulation({
      scenario_id: row.scenario_id,
      strategy_id: row.strategy_id || undefined,
      time_range: row.time_range || undefined,
      boundary_conditions: row.boundary_conditions || undefined,
    })
    await loadData()
    autoOpenMonitor(sim)
  } catch { /* ignore */ }
}

async function stop(id: string) {
  await stopSimulation(id)
  await loadData()
}

async function handleDelete(row: any) {
  try { await ElMessageBox.confirm(`确定删除此模拟记录？`, '确认删除', { type: 'warning' }) } catch { return }
  try {
    await deleteSimulation(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || e.message || '删除失败') }
}

async function pauseSim(id: string) {
  await pauseSimulation(id)
  await loadData()
}

async function resumeSim(id: string) {
  await resumeSimulation(id)
  await loadData()
}

function showResults(row: any) {
  // 直接跳转到场景执行效果评估页，按 simulation_id 筛选
  router.push({ path: '/resources/scenarios/evaluation', query: { simulation_id: row.id } })
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

function getStatusTag(status: string) {
  const map: Record<string, string> = { pending: 'info', running: 'primary', paused: 'warning', completed: 'success', stopped: 'warning', failed: 'danger' }
  return map[status] || 'info'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = { pending: '等待中', running: '运行中', paused: '已暂停', completed: '已完成', stopped: '已停止', failed: '失败' }
  return map[status] || status
}

// 场景策略调整
const strategyDialogVisible = ref(false)
const strategyDialogSimId = ref('')
const strategyDialogSceneName = ref('')
const editableRules = ref<any[]>([])
const strategyConstraints = ref({ voltageUpperLimit: 1.05, voltageLowerLimit: 0.93, frequencyUpperLimit: 50.5, frequencyLowerLimit: 49.5, lineLoadRateLimit: 80 })
const strategyEconomic = ref({ optimizationMode: 'cost_first', targetConsumptionRate: 95, maxOperationCostPerKwh: 0.42 })
const strategySaving = ref(false)

function openStrategyDialog(row: any) {
  strategyDialogSimId.value = row.id
  const scene = scenarios.value.find((s: any) => s.id === row.scenario_id)
  strategyDialogSceneName.value = scene?.name || row.id?.slice(0, 8)
  // 协同规则
  const rules = scene?.config?.controlRules || []
  editableRules.value = rules.length > 0 ? rules.map((r: any) => ({ ...r })) : [{ name: '', condition: '', action: '', priority: 1 }]
  // 约束与经济目标（从场景config加载，匹配策略管理字段名）
  const cfg = scene?.config || {}
  if (cfg.constraints) {
    strategyConstraints.value = {
      voltageUpperLimit: cfg.constraints.voltageUpperLimit ?? 1.05,
      voltageLowerLimit: cfg.constraints.voltageLowerLimit ?? 0.93,
      frequencyUpperLimit: cfg.constraints.frequencyUpperLimit ?? 50.5,
      frequencyLowerLimit: cfg.constraints.frequencyLowerLimit ?? 49.5,
      lineLoadRateLimit: cfg.constraints.lineLoadRateLimit ?? 80,
    }
  }
  if (cfg.economicTargets) {
    strategyEconomic.value = {
      optimizationMode: cfg.economicTargets.optimizationMode || 'cost_first',
      targetConsumptionRate: cfg.economicTargets.targetConsumptionRate ?? 95,
      maxOperationCostPerKwh: cfg.economicTargets.maxOperationCostPerKwh ?? 0.42,
    }
  }
  strategyDialogVisible.value = true
}

function addRule() {
  editableRules.value.push({ name: '', condition: '', action: '', priority: editableRules.value.length + 1 })
}

async function applyStrategyToRunning() {
  strategySaving.value = true
  try {
    const validRules = editableRules.value.filter((r: any) => r.condition || r.action)
    await updateSimulationParams(strategyDialogSimId.value, {
      constraints: { ...strategyConstraints.value },
      economic_targets: { ...strategyEconomic.value },
      control_rules: validRules,
    })
    ElMessage.success('策略已更新，正在运行的模拟将应用新规则')
    strategyDialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error('策略更新失败')
  } finally {
    strategySaving.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadOptions()
  loadData()
  pollTimer = setInterval(loadData, 2000)
})

onBeforeUnmount(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})
</script>

<template>
  <div>
    <div class="chart-panel-title">场景模拟验证</div>
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:16px">
      <el-button type="primary" size="small" @click="openStart">启动模拟</el-button>
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
      <el-table-column label="开始时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.started_at) }}</template>
      </el-table-column>
      <el-table-column label="结束时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.completed_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'running'">
            <el-button size="small" link type="primary" @click="openMonitor(row)">实时监控</el-button>
            <el-button size="small" link @click="openStrategyDialog(row)">迭代调整</el-button>
            <el-button size="small" link @click="pauseSim(row.id)">暂停</el-button>
            <el-button size="small" link @click="stop(row.id)">停止</el-button>
          </template>
          <template v-else-if="row.status === 'paused'">
            <el-button size="small" link type="primary" @click="openMonitor(row)">实时监控</el-button>
            <el-button size="small" link @click="openStrategyDialog(row)">迭代调整</el-button>
            <el-button size="small" link @click="resumeSim(row.id)">恢复</el-button>
            <el-button size="small" link @click="stop(row.id)">停止</el-button>
          </template>
          <template v-else>
            <el-button size="small" link type="primary" :disabled="row.status !== 'completed'" @click="showResults(row)">查看结果</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
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
          <el-select v-model="form.strategy_id" clearable placeholder="暂无可选策略">
            <el-option v-for="s in strategies" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <div v-if="!strategies.length && form.scenario_id" style="font-size:11px;color:#909399;margin-top:4px">该场景暂无关联策略，可在策略管理页面创建</div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-date-picker v-model="form.time_range.start" type="datetime" placeholder="选择开始时间" size="small" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-date-picker v-model="form.time_range.end" type="datetime" placeholder="选择结束时间" size="small" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">预设边界条件</el-divider>
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
        <el-form-item label="故障注入(可选)">
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

    <RealtimeMonitor
      v-model:visible="monitorVisible"
      :simulation-id="monitorSimId"
      :scenario-config="monitorScenarioConfig"
    />

    <!-- 策略调整弹窗 -->
    <el-dialog v-model="strategyDialogVisible" :title="`迭代调整 — ${strategyDialogSceneName}`" width="720px">
      <!-- 安全约束 -->
      <div style="margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">约束条件</div>
        <el-row :gutter="10">
          <el-col :span="4">
            <span style="font-size:11px;color:#909399">电压上限(pu)</span>
            <el-input-number v-model="strategyConstraints.voltageUpperLimit" :min="1.0" :max="1.15" :step="0.01" :precision="2" size="small" style="width:100%" />
          </el-col>
          <el-col :span="4">
            <span style="font-size:11px;color:#909399">电压下限(pu)</span>
            <el-input-number v-model="strategyConstraints.voltageLowerLimit" :min="0.85" :max="1.0" :step="0.01" :precision="2" size="small" style="width:100%" />
          </el-col>
          <el-col :span="4">
            <span style="font-size:11px;color:#909399">频率上限(Hz)</span>
            <el-input-number v-model="strategyConstraints.frequencyUpperLimit" :min="50" :max="51" :step="0.1" size="small" style="width:100%" />
          </el-col>
          <el-col :span="4">
            <span style="font-size:11px;color:#909399">频率下限(Hz)</span>
            <el-input-number v-model="strategyConstraints.frequencyLowerLimit" :min="49" :max="50" :step="0.1" size="small" style="width:100%" />
          </el-col>
          <el-col :span="4">
            <span style="font-size:11px;color:#909399">线路负载率(%)</span>
            <el-input-number v-model="strategyConstraints.lineLoadRateLimit" :min="50" :max="120" size="small" style="width:100%" />
          </el-col>
        </el-row>
      </div>

      <!-- 经济目标 -->
      <div style="margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">经济目标</div>
        <el-row :gutter="10">
          <el-col :span="6">
            <span style="font-size:11px;color:#909399">优化模式</span>
            <el-select v-model="strategyEconomic.optimizationMode" size="small" style="width:100%">
              <el-option label="成本优先" value="cost_first" />
              <el-option label="消纳优先" value="consumption_first" />
              <el-option label="平衡模式" value="balanced" />
            </el-select>
          </el-col>
          <el-col :span="6">
            <span style="font-size:11px;color:#909399">目标消纳率(%)</span>
            <el-input-number v-model="strategyEconomic.targetConsumptionRate" :min="50" :max="100" size="small" style="width:100%" />
          </el-col>
          <el-col :span="6">
            <span style="font-size:11px;color:#909399">运营成本上限(¥/kWh)</span>
            <el-input-number v-model="strategyEconomic.maxOperationCostPerKwh" :min="0.1" :max="2" :step="0.01" :precision="2" size="small" style="width:100%" />
          </el-col>
        </el-row>
      </div>

      <el-divider style="margin:12px 0" />

      <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600">协同规则 ({{ editableRules.length }})</span>
        <el-button size="small" @click="addRule">添加规则</el-button>
      </div>
      <div v-for="(rule, idx) in editableRules" :key="idx" style="padding:10px;margin-bottom:8px;background:#fafafa;border:1px solid #ebeef5;border-radius:4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:600;color:#606266">规则 {{ idx + 1 }}</span>
          <el-button size="small" link type="danger" @click="editableRules.splice(idx, 1)">删除</el-button>
        </div>
        <el-row :gutter="8">
          <el-col :span="6">
            <span style="font-size:11px;color:#909399">名称</span>
            <el-input v-model="rule.name" size="small" placeholder="规则名称" />
          </el-col>
          <el-col :span="7">
            <span style="font-size:11px;color:#909399">触发条件</span>
            <el-input v-model="rule.condition" size="small" placeholder="如：光伏出力>80%" />
          </el-col>
          <el-col :span="7">
            <span style="font-size:11px;color:#909399">执行动作</span>
            <el-input v-model="rule.action" size="small" placeholder="如：启动储能充电" />
          </el-col>
          <el-col :span="4">
            <span style="font-size:11px;color:#909399">优先级</span>
            <el-input-number v-model="rule.priority" :min="1" :max="99" size="small" style="width:100%" />
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <el-button size="small" @click="strategyDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="strategySaving" @click="applyStrategyToRunning">应用策略</el-button>
      </template>
    </el-dialog>
  </div>
</template>
