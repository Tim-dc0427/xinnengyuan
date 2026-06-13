<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchScenarios, fetchRunningSimulations, fetchStrategy, updateStrategy, fetchInterventions, createIntervention, stopSimulation, pauseSimulation, resumeSimulation, updateSimulationParams } from '@/api/scenario'
const scenarios = ref<any[]>([])
const runningSims = ref<any[]>([])
const interventions = ref<any[]>([])
const loading = ref(false)

const filterType = ref('')
const filterScenarioId = ref('')
const filterOperator = ref('')
const filterDateRange = ref<[string, string] | null>(null)

const dialogVisible = ref(false)
const form = ref({ scenario_id: '', simulation_id: '', operation_type: 'adjust', operation_params: {} as any, reason: '' })
const submitting = ref(false)
const quickSubmitting = ref(false)

const operationTypes = [
  { value: 'pause', label: '暂停' },
  { value: 'resume', label: '恢复' },
  { value: 'adjust', label: '参数调整' },
  { value: 'force_control', label: '强制控制' },
  { value: 'emergency_stop', label: '紧急停止' },
]

const operationTypeLabels: Record<string, string> = {
  pause: '暂停', resume: '恢复', adjust: '参数调整',
  force_control: '强制控制', emergency_stop: '紧急停止',
}

// 快捷操作面板每行状态（仿真参数）
const quickActionState = reactive<Record<string, { pvOutputLimit: number; chargePower: number; loadShedRatio: number }>>({})

watch(runningSims, (sims) => {
  for (const sim of sims) {
    if (!quickActionState[sim.id]) {
      let pp: any = null
      try { pp = typeof sim.paused_params === 'string' ? JSON.parse(sim.paused_params) : sim.paused_params } catch {}
      quickActionState[sim.id] = {
        pvOutputLimit: pp?.pvOutputLimit ?? 80,
        chargePower: pp?.chargePower ?? 5000,
        loadShedRatio: pp?.loadShedRatio ?? 0,
      }
    }
  }
}, { immediate: true })

async function loadData() {
  loading.value = true
  try {
    const [scenarioRes, sims, intv] = await Promise.all([
      fetchScenarios({ pageSize: 100 }),
      fetchRunningSimulations(),
      fetchInterventions({
        operation_type: filterType.value || undefined,
        scenario_id: filterScenarioId.value || undefined,
        operator: filterOperator.value || undefined,
        start_date: filterDateRange.value?.[0] || undefined,
        end_date: filterDateRange.value?.[1] || undefined,
      }),
    ])
    scenarios.value = scenarioRes.list || []
    runningSims.value = sims || []
    interventions.value = intv || []
  } finally {
    loading.value = false
  }
}

const strategyDialogVisible = ref(false)
const strategySaving = ref(false)
const editingSim = ref<any>(null)
interface RuleItem { name: string; condition: string; action: string; priority: number }
const strategyForm = ref<any>({
  control_rules: [] as RuleItem[],
  constraints: { voltageUpperLimit: 235, voltageLowerLimit: 205, frequencyUpperLimit: 50.5, frequencyLowerLimit: 49.5, lineLoadRateLimit: 0.9, devicePowerLimitPct: 100 },
  economic_targets: { optimizationMode: 'cost_first', targetConsumptionRate: 0.95, maxOperationCostPerKwh: 0.42 },
})

async function openStrategyEdit(sim: any) {
  editingSim.value = sim
  if (sim.strategy_id) {
    try {
      const strategy = await fetchStrategy(sim.strategy_id)
      if (strategy) {
        strategyForm.value.name = strategy.name || ''
        const c = strategy.config || {}
        const ct = strategy.constraints || {}
        const et = strategy.economic_targets || {}
        strategyForm.value.control_rules = c.control_rules || []
        strategyForm.value.constraints = {
          voltageUpperLimit: ct.voltageUpperLimit ?? 235,
          voltageLowerLimit: ct.voltageLowerLimit ?? 205,
          frequencyUpperLimit: ct.frequencyUpperLimit ?? 50.5,
          frequencyLowerLimit: ct.frequencyLowerLimit ?? 49.5,
          lineLoadRateLimit: ct.lineLoadRateLimit ?? 0.9,
          devicePowerLimitPct: ct.devicePowerLimitPct ?? 100,
        }
        strategyForm.value.economic_targets = {
          optimizationMode: et.optimizationMode || 'cost_first',
          targetConsumptionRate: et.targetConsumptionRate ?? 0.95,
          maxOperationCostPerKwh: et.maxOperationCostPerKwh ?? 0.42,
        }
      }
    } catch {}
  }
  strategyDialogVisible.value = true
}

function addStrategyRule() {
  strategyForm.value.control_rules.push({ name: '', condition: '', action: '', priority: strategyForm.value.control_rules.length + 1 })
}
function removeStrategyRule(idx: number) {
  strategyForm.value.control_rules.splice(idx, 1)
}
async function saveStrategyEdit() {
  const sim = editingSim.value
  if (!sim?.strategy_id) return
  strategySaving.value = true
  try {
    await updateStrategy(sim.strategy_id, {
      name: strategyForm.value.name || undefined,
      config: {
        control_rules: strategyForm.value.control_rules,
      },
      constraints: strategyForm.value.constraints,
      economic_targets: strategyForm.value.economic_targets,
    })
    // 实时推送到正在运行的模拟（仅running/paused状态可推送）
    try {
      await updateSimulationParams(sim.id, {
        constraints: strategyForm.value.constraints,
        economic_targets: strategyForm.value.economic_targets,
        control_rules: strategyForm.value.control_rules,
      })
      ElMessage.success('策略已保存，已实时推送到运行中的模拟')
    } catch {
      ElMessage.success('策略已保存（模拟未运行，下次启动时生效）')
    }
    strategyDialogVisible.value = false
  } catch (e) {
    console.error('保存策略失败', e)
  } finally {
    strategySaving.value = false
  }
}

function openIntervention() {
  form.value = { scenario_id: '', simulation_id: '', operation_type: 'adjust', operation_params: { pvOutputLimit: 80, chargePower: 50 } as any, reason: '' }
  dialogVisible.value = true
}

async function submitIntervention() {
  if (!form.value.scenario_id) return
  submitting.value = true
  try {
    await createIntervention({
      scenario_id: form.value.scenario_id,
      simulation_id: form.value.simulation_id || undefined,
      operation_type: form.value.operation_type,
      operation_params: form.value.operation_params,
      reason: form.value.reason,
    })
    if (form.value.operation_type === 'pause' && form.value.simulation_id) {
      await pauseSimulation(form.value.simulation_id)
    }
    if (form.value.operation_type === 'emergency_stop' && form.value.simulation_id) {
      await stopSimulation(form.value.simulation_id)
    }
    ElMessage.success('干预操作已提交')
    dialogVisible.value = false
    await loadData()
  } finally {
    submitting.value = false
  }
}

async function quickExecute(sim: any) {
  const qs = quickActionState[sim.id]
  if (!qs) return
  quickSubmitting.value = true
  try {
    const params = {
      pvOutputLimit: qs.pvOutputLimit,
      chargePower: qs.chargePower,
      loadShedRatio: qs.loadShedRatio,
    }
    // createIntervention 的 force_control 分支已合并更新 paused_params
    await createIntervention({
      scenario_id: sim.scenario_id,
      simulation_id: sim.id,
      operation_type: 'force_control',
      operation_params: params,
      reason: '快捷操作面板 - 强制控制',
    })
    ElMessage.success('快捷控制已生效，模拟参数已实时更新')
    await loadData()
  } catch (e) {
    console.error('快捷操作执行失败', e)
  } finally {
    quickSubmitting.value = false
  }
}

async function quickPause(sim: any) {
  quickSubmitting.value = true
  try {
    await createIntervention({
      scenario_id: sim.scenario_id,
      simulation_id: sim.id,
      operation_type: 'pause',
      operation_params: {},
      reason: `快捷暂停: ${sim.scenario_name || sim.id}`,
    })
    await pauseSimulation(sim.id)
    ElMessage.success('已暂停')
    await loadData()
  } catch (e) {
    console.error('暂停失败', e)
  } finally {
    quickSubmitting.value = false
  }
}

async function quickResume(sim: any) {
  quickSubmitting.value = true
  try {
    await createIntervention({
      scenario_id: sim.scenario_id,
      simulation_id: sim.id,
      operation_type: 'resume',
      operation_params: {},
      reason: `快捷恢复: ${sim.scenario_name || sim.id}`,
    })
    await resumeSimulation(sim.id)
    ElMessage.success('已恢复')
    await loadData()
  } catch (e) {
    console.error('恢复失败', e)
  } finally {
    quickSubmitting.value = false
  }
}

async function emergencyStopSim(sim: any) {
  try { await ElMessageBox.confirm(`确定紧急停止 "${sim.scenario_name || sim.id}"？此操作不可恢复。`, '紧急停止确认', { type: 'error', confirmButtonText: '确定停止' }) } catch { return }
  quickSubmitting.value = true
  try {
    await createIntervention({
      scenario_id: sim.scenario_id,
      simulation_id: sim.id,
      operation_type: 'emergency_stop',
      operation_params: {},
      reason: `紧急停止: ${sim.scenario_name || sim.id}`,
    })
    await stopSimulation(sim.id)
    await loadData()
  } catch (e) {
    console.error('紧急停止失败', e)
  } finally {
    quickSubmitting.value = false
  }
}

const paramKeyLabels: Record<string, string> = {
  pvOutputLimit: '光伏出力上限',
  chargePower: '储能功率',
  loadShedRatio: '负荷切除比例',
}

function formatOperationParams(row: any) {
  const params = row.operation_params
  if (!params || typeof params !== 'object' || Object.keys(params).length === 0) return '-'
  return Object.entries(params)
    .filter(([k]) => k !== '_applied')
    .map(([k, v]) => {
      const label = paramKeyLabels[k] || k
      const unit = k === 'pvOutputLimit' || k === 'loadShedRatio' ? '%' : k.includes('Power') ? 'kW' : ''
      return `${label}: ${v}${unit}`
    })
    .join('，')
}

function formatParamsChange(row: any) {
  const type = row.operation_type
  if (type === 'pause') return '运行中 → 已暂停'
  if (type === 'resume') return '已暂停 → 运行中'
  if (type === 'emergency_stop') return '运行中 → 已停止'

  const opParams = row.operation_params
  if (!opParams || typeof opParams !== 'object') return '-'

  // 从 params_before.paused_params 提取干预前的参数值
  let beforePaused: any = {}
  try {
    let pb = row.params_before
    if (typeof pb === 'string') pb = JSON.parse(pb)
    let pp = pb?.paused_params
    if (typeof pp === 'string') pp = JSON.parse(pp)
    if (pp && typeof pp === 'object') beforePaused = pp
  } catch {}

  const keys = ['pvOutputLimit', 'chargePower', 'loadShedRatio']
  const changes: string[] = []
  for (const k of keys) {
    if (opParams[k] === undefined) continue
    const bVal = beforePaused[k]
    const aVal = opParams[k]
    const unit = k === 'pvOutputLimit' || k === 'loadShedRatio' ? '%' : 'kW'
    if (bVal !== undefined && bVal !== aVal) {
      changes.push(`${bVal}${unit}→${aVal}${unit}`)
    } else if (bVal === undefined) {
      changes.push(`→${aVal}${unit}`)
    }
  }
  return changes.length ? changes.join('，') : '-'
}

onMounted(loadData)
</script>

<template>
  <div>
    <div class="chart-panel-title">场景策略人工干预</div>

    <!-- 快捷操作面板 -->
    <div v-if="runningSims.length" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title" style="margin-bottom:12px">快捷操作面板</div>
      <div
        v-for="sim in runningSims"
        :key="sim.id"
        style="padding:12px;margin-bottom:8px;background:#fafafa;border:1px solid #ebeef5;border-radius:4px"
      >
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span style="font-weight:600;font-size:14px">{{ sim.scenario_name }}</span>
          <span style="font-size:12px;color:#909399">进度: {{ sim.progress }}%</span>
          <el-tag v-if="sim.status" size="small" :type="sim.status === 'running' ? 'success' : sim.status === 'paused' ? 'warning' : 'info'">
            {{ sim.status === 'running' ? '运行中' : sim.status === 'paused' ? '已暂停' : sim.status }}
          </el-tag>
        </div>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px;min-width:180px">
            <span style="font-size:12px;white-space:nowrap;color:#606266">光伏出力上限</span>
            <el-slider
              v-model="quickActionState[sim.id].pvOutputLimit"
              :min="0"
              :max="100"
              style="flex:1;min-width:100px"
            />
            <span style="font-size:12px;width:36px;text-align:right;color:#909399">{{ quickActionState[sim.id].pvOutputLimit }}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;min-width:200px">
            <span style="font-size:12px;white-space:nowrap;color:#606266">储能功率</span>
            <el-slider
              v-model="quickActionState[sim.id].chargePower"
              :min="0"
              :max="10000"
              :step="100"
              style="flex:1;min-width:100px"
            />
            <span style="font-size:12px;width:52px;text-align:right;color:#909399">{{ quickActionState[sim.id].chargePower }}kW</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;white-space:nowrap;color:#606266">负荷切除比例</span>
            <el-input-number
              v-model="quickActionState[sim.id].loadShedRatio"
              :min="0"
              :max="30"
              :step="1"
              size="small"
              style="width:120px"
            />
            <span style="font-size:12px;color:#909399">%</span>
          </div>
          <el-button size="small" type="primary" :loading="quickSubmitting" @click="quickExecute(sim)">
            立即执行
          </el-button>
          <el-button v-if="sim.status === 'running'" size="small" type="warning" :loading="quickSubmitting" @click="quickPause(sim)">
            暂停
          </el-button>
          <el-button v-if="sim.status === 'paused'" size="small" type="success" :loading="quickSubmitting" @click="quickResume(sim)">
            恢复
          </el-button>
          <el-button size="small" type="danger" :loading="quickSubmitting" @click="emergencyStopSim(sim)">
            紧急停止
          </el-button>
          <el-button size="small" @click="openStrategyEdit(sim)">编辑策略</el-button>
        </div>
      </div>
    </div>

    <!-- 筛选与操作栏 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterType" placeholder="操作类型" clearable style="width:120px" size="small" @change="loadData">
          <el-option v-for="t in operationTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="filterScenarioId" placeholder="关联场景" clearable style="width:160px" size="small" @change="loadData">
          <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-input v-model="filterOperator" placeholder="操作人" clearable style="width:120px" size="small" @change="loadData" />
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="~"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          size="small"
          style="width:240px"
          @change="loadData"
        />
      </div>
      <div style="display:flex;gap:8px">
        <el-button type="primary" size="small" @click="openIntervention">新建干预</el-button>
      </div>
    </div>

    <!-- 干预记录列表 -->
    <el-table :data="interventions" stripe size="small" v-loading="loading">
      <el-table-column label="场景" min-width="140">
        <template #default="{ row }">
          {{ scenarios.find(s => s.id === row.scenario_id)?.name || row.scenario_id?.slice(0, 8) }}
        </template>
      </el-table-column>
      <el-table-column label="操作类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.operation_type === 'pause' || row.operation_type === 'emergency_stop' ? 'danger' : row.operation_type === 'resume' ? 'success' : 'warning'" size="small">
            {{ operationTypeLabels[row.operation_type] || row.operation_type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作参数" min-width="180">
        <template #default="{ row }">
          {{ formatOperationParams(row) }}
        </template>
      </el-table-column>
      <el-table-column label="操作前/操作后" min-width="220">
        <template #default="{ row }">
          {{ formatParamsChange(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="140" />
      <el-table-column prop="operator" label="操作人" width="100" />
      <el-table-column prop="operated_at" label="操作时间" width="155" />
    </el-table>

    <!-- 新建干预弹窗（现有功能保持不变） -->
    <el-dialog v-model="dialogVisible" title="新建干预操作" width="520px">
      <el-form :model="form" label-position="top" size="small">
        <el-form-item label="关联场景">
          <el-select v-model="form.scenario_id">
            <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联模拟(可选)">
          <el-select v-model="form.simulation_id" clearable>
            <el-option v-for="s in runningSims" :key="s.id" :label="s.scenario_name || s.id?.slice(0,12)" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="form.operation_type">
            <el-option v-for="t in operationTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <template v-if="form.operation_type === 'adjust' || form.operation_type === 'force_control'">
          <el-form-item label="光伏出力上限(%)">
            <el-input-number v-model="form.operation_params.pvOutputLimit" :min="0" :max="100" size="small" style="width:100%" />
          </el-form-item>
          <el-form-item label="储能功率(kW)">
            <el-input-number v-model="form.operation_params.chargePower" :min="0" size="small" style="width:100%" />
          </el-form-item>
        </template>
        <el-form-item label="原因说明">
          <el-input v-model="form.reason" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="submitting" @click="submitIntervention">确定</el-button>
      </template>
    </el-dialog>

    <!-- 策略编辑弹窗 -->
    <el-dialog v-model="strategyDialogVisible" title="编辑互动场景策略" width="720px">
      <el-form :model="strategyForm" label-position="top" size="small">
        <!-- 一、协同策略 -->
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#267F7B">协同策略（控制规则）</div>
        <div style="margin-bottom:6px">
          <el-button size="small" @click="addStrategyRule">添加规则</el-button>
        </div>
        <div v-for="(r, idx) in strategyForm.control_rules" :key="idx" style="padding:8px;margin-bottom:4px;background:#fafafa;border:1px solid #f0f0f0;border-radius:3px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:11px;font-weight:600">规则 {{ idx + 1 }}</span>
            <el-button size="small" link type="danger" @click="removeStrategyRule(idx)">删除</el-button>
          </div>
          <el-row :gutter="6">
            <el-col :span="6"><span style="font-size:10px;color:#909399">名称</span><el-input v-model="r.name" size="small" /></el-col>
            <el-col :span="8"><span style="font-size:10px;color:#909399">触发条件</span><el-input v-model="r.condition" size="small" /></el-col>
            <el-col :span="7"><span style="font-size:10px;color:#909399">执行动作</span><el-input v-model="r.action" size="small" /></el-col>
            <el-col :span="3"><span style="font-size:10px;color:#909399">优先级</span><el-input-number v-model="r.priority" :min="1" :max="99" size="small" style="width:100%" /></el-col>
          </el-row>
        </div>

        <el-divider style="margin:10px 0" />

        <!-- 安全约束 -->
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#E6A23C">安全约束</div>
        <el-row :gutter="10">
          <el-col :span="6"><span style="font-size:10px;color:#909399">电压上限(kV)</span><el-input-number v-model="strategyForm.constraints.voltageUpperLimit" :min="200" :max="264" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:10px;color:#909399">电压下限(kV)</span><el-input-number v-model="strategyForm.constraints.voltageLowerLimit" :min="176" :max="242" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:10px;color:#909399">频率上限(Hz)</span><el-input-number v-model="strategyForm.constraints.frequencyUpperLimit" :min="50" :max="51" :step="0.1" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:10px;color:#909399">频率下限(Hz)</span><el-input-number v-model="strategyForm.constraints.frequencyLowerLimit" :min="49" :max="50" :step="0.1" size="small" style="width:100%" /></el-col>
        </el-row>
        <el-row :gutter="10" style="margin-top:6px">
          <el-col :span="6"><span style="font-size:10px;color:#909399">负载率上限</span><el-input-number v-model="strategyForm.constraints.lineLoadRateLimit" :min="0.5" :max="1" :step="0.05" :precision="2" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:10px;color:#909399">设备功率上限(%)</span><el-input-number v-model="strategyForm.constraints.devicePowerLimitPct" :min="0" :max="100" size="small" style="width:100%" /></el-col>
        </el-row>

        <el-divider style="margin:10px 0" />

        <!-- 四、经济性目标 -->
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#409EFF">经济性目标</div>
        <el-row :gutter="10">
          <el-col :span="8"><span style="font-size:10px;color:#909399">优化模式</span>
            <el-select v-model="strategyForm.economic_targets.optimizationMode" size="small" style="width:100%">
              <el-option label="成本优先" value="cost_first" />
              <el-option label="消纳优先" value="consumption_first" />
              <el-option label="平衡模式" value="balanced" />
            </el-select>
          </el-col>
          <el-col :span="8"><span style="font-size:10px;color:#909399">目标消纳率</span><el-input-number v-model="strategyForm.economic_targets.targetConsumptionRate" :min="0" :max="1" :step="0.01" :precision="2" size="small" style="width:100%" /></el-col>
          <el-col :span="8"><span style="font-size:10px;color:#909399">最大运营成本(¥/kWh)</span><el-input-number v-model="strategyForm.economic_targets.maxOperationCostPerKwh" :min="0" :step="0.01" :precision="2" size="small" style="width:100%" /></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button size="small" @click="strategyDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="strategySaving" @click="saveStrategyEdit">保存策略</el-button>
      </template>
    </el-dialog>
  </div>
</template>
