<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchScenarios, fetchStrategies, fetchSimulations, startSimulation, stopSimulation, fetchSimulationResults, fetchRunningSimulations } from '@/api/scenario'

const scenarios = ref<any[]>([])
const strategies = ref<any[]>([])
const simulations = ref<any[]>([])
const runningSims = ref<any[]>([])
const loading = ref(false)
const filterScenarioId = ref('')

const form = ref({ scenario_id: '', strategy_id: '', time_range: { start: '', end: '' }, boundary_conditions: {} as any })
const dialogVisible = ref(false)
const starting = ref(false)

const resultsVisible = ref(false)
const results = ref<any>(null)
const resultsLabel = ref('')

const metricTypeMap: Record<string, string> = {
  voltage: '电压 (p.u.)',
  frequency: '频率 (Hz)',
  load_rate: '负载率 (%)',
  consumption_rate: '消纳率 (%)',
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
  form.value = { scenario_id: '', strategy_id: '', time_range: { start: '', end: '' }, boundary_conditions: { maxLoad: 100, minLoad: 30, pvOutput: 80 } as any }
  strategies.value = []
  dialogVisible.value = true
}

async function start() {
  if (!form.value.scenario_id) return
  starting.value = true
  try {
    await startSimulation({
      scenario_id: form.value.scenario_id,
      strategy_id: form.value.strategy_id || undefined,
      time_range: form.value.time_range,
      boundary_conditions: form.value.boundary_conditions,
    })
    dialogVisible.value = false
    await loadData()
  } finally {
    starting.value = false
  }
}

async function stop(id: string) {
  await stopSimulation(id)
  await loadData()
}

async function showResults(row: any) {
  resultsLabel.value = `模拟结果 - ${row.id?.slice(0, 8)}...`
  results.value = await fetchSimulationResults(row.id)
  resultsVisible.value = true
}

function getStatusTag(status: string) {
  const map: Record<string, string> = { pending: 'info', running: 'primary', completed: 'success', stopped: 'warning', failed: 'danger' }
  return map[status] || 'info'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = { pending: '等待中', running: '运行中', completed: '已完成', stopped: '已停止', failed: '失败' }
  return map[status] || status
}

onMounted(() => {
  loadOptions()
  loadData()
})
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterScenarioId" placeholder="关联场景" clearable style="width:180px" size="small" @change="loadData">
          <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <el-button type="primary" size="small" @click="openStart">启动模拟</el-button>
    </div>

    <div v-if="runningSims.length" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title">运行中的模拟</div>
      <div v-for="sim in runningSims" :key="sim.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0">
        <div>
          <span style="font-weight:600">{{ sim.scenario_name }}</span>
          <span style="margin-left:12px;font-size:12px">进度: {{ sim.progress }}%</span>
        </div>
        <el-button size="small" @click="stop(sim.id)">停止</el-button>
      </div>
    </div>

    <el-table :data="simulations" stripe size="small" v-loading="loading">
      <el-table-column label="关联场景" min-width="140">
        <template #default="{ row }">
          {{ scenarios.find(s => s.id === row.scenario_id)?.name || row.scenario_id?.slice(0, 8) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="getStatusTag(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="120">
        <template #default="{ row }">
          <el-progress :percentage="row.progress" :status="row.status === 'completed' ? 'success' : ''" :stroke-width="12" />
        </template>
      </el-table-column>
      <el-table-column prop="started_at" label="开始时间" width="155" />
      <el-table-column prop="completed_at" label="结束时间" width="155" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" :disabled="row.status !== 'completed'" @click="showResults(row)">查看结果</el-button>
          <el-button v-if="row.status === 'running'" size="small" link @click="stop(row.id)">停止</el-button>
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
        <el-form-item label="最大负荷(MW)">
          <el-input-number v-model="form.boundary_conditions.maxLoad" :min="0" size="small" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="starting" @click="start">启动</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resultsVisible" :title="resultsLabel" width="800px">
      <template v-if="results">
        <div style="margin-bottom:12px">
          <span style="font-size:13px;font-weight:600">越限告警: </span>
          <el-tag v-if="results.violations?.length" type="danger" size="small">{{ results.violations.length }} 项越限</el-tag>
          <el-tag v-else type="success" size="small">无越限</el-tag>
        </div>
        <el-table :data="results.metrics" stripe size="small" max-height="400">
          <el-table-column prop="timestamp" label="时间戳" width="160" />
          <el-table-column label="指标类型" width="120">
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
      </template>
    </el-dialog>
  </div>
</template>
