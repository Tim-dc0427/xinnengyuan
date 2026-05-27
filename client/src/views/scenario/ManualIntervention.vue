<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchScenarios, fetchRunningSimulations, fetchInterventions, createIntervention, stopSimulation } from '@/api/scenario'

const scenarios = ref<any[]>([])
const runningSims = ref<any[]>([])
const interventions = ref<any[]>([])
const loading = ref(false)

const filterType = ref('')
const filterScenarioId = ref('')

const dialogVisible = ref(false)
const form = ref({ scenario_id: '', simulation_id: '', operation_type: 'adjust', operation_params: {} as any, reason: '' })
const submitting = ref(false)

const operationTypes = [
  { value: 'pause', label: '暂停' },
  { value: 'resume', label: '恢复' },
  { value: 'adjust', label: '参数调整' },
  { value: 'override', label: '强制控制' },
]

async function loadData() {
  loading.value = true
  try {
    const [scenarioRes, sims, intv] = await Promise.all([
      fetchScenarios({ pageSize: 100 }),
      fetchRunningSimulations(),
      fetchInterventions({
        operation_type: filterType.value || undefined,
        scenario_id: filterScenarioId.value || undefined,
      }),
    ])
    scenarios.value = scenarioRes.list || []
    runningSims.value = sims || []
    interventions.value = intv || []
  } finally {
    loading.value = false
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
      await stopSimulation(form.value.simulation_id)
    }
    dialogVisible.value = false
    await loadData()
  } finally {
    submitting.value = false
  }
}

const operationTypeLabels: Record<string, string> = {
  pause: '暂停', resume: '恢复', adjust: '参数调整', override: '强制控制',
}

onMounted(loadData)
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterType" placeholder="操作类型" clearable style="width:130px" size="small" @change="loadData">
          <el-option v-for="t in operationTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="filterScenarioId" placeholder="关联场景" clearable style="width:180px" size="small" @change="loadData">
          <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <el-button type="primary" size="small" @click="openIntervention">新建干预</el-button>
    </div>

    <div v-if="runningSims.length" class="chart-panel" style="margin-bottom:16px">
      <div class="chart-panel-title" style="margin-bottom:12px">运行中的场景</div>
      <div v-for="sim in runningSims" :key="sim.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:8px;background:#fafafa;border-radius:4px">
        <div>
          <span style="font-weight:600">{{ sim.scenario_name }}</span>
          <span style="margin-left:12px;font-size:12px;color:#909399">进度: {{ sim.progress }}%</span>
        </div>
        <div style="display:flex;gap:8px">
          <el-button size="small" type="warning" @click="() => {
            form = { scenario_id: sim.scenario_id, simulation_id: sim.id, operation_type: 'pause', operation_params: {} as any, reason: '' }
            dialogVisible = true
          }">暂停</el-button>
          <el-button size="small" @click="() => {
            form = { scenario_id: sim.scenario_id, simulation_id: sim.id, operation_type: 'adjust', operation_params: { pvOutputLimit: 80 } as any, reason: '' }
            dialogVisible = true
          }">调整参数</el-button>
        </div>
      </div>
    </div>

    <el-table :data="interventions" stripe size="small" v-loading="loading">
      <el-table-column label="场景" min-width="140">
        <template #default="{ row }">
          {{ scenarios.find(s => s.id === row.scenario_id)?.name || row.scenario_id?.slice(0, 8) }}
        </template>
      </el-table-column>
      <el-table-column label="操作类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.operation_type === 'pause' ? 'danger' : row.operation_type === 'resume' ? 'success' : 'warning'" size="small">
            {{ operationTypeLabels[row.operation_type] || row.operation_type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作参数" min-width="200">
        <template #default="{ row }">
          {{ row.operation_params ? JSON.stringify(row.operation_params) : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="140" />
      <el-table-column prop="operator" label="操作人" width="100" />
      <el-table-column prop="operated_at" label="操作时间" width="155" />
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建干预操作" width="520px">
      <el-form :model="form" label-position="top" size="small">
        <el-form-item label="关联场景">
          <el-select v-model="form.scenario_id">
            <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联模拟(可选)">
          <el-select v-model="form.simulation_id" clearable>
            <el-option v-for="s in runningSims" :key="s.id" :label="s.id?.slice(0, 12)" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="form.operation_type">
            <el-option v-for="t in operationTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <template v-if="form.operation_type === 'adjust'">
          <el-form-item label="光伏出力上限(%)">
            <el-input-number v-model="form.operation_params.pvOutputLimit" :min="0" :max="100" size="small" style="width:100%" />
          </el-form-item>
          <el-form-item label="储能充电功率(kW)">
            <el-input-number v-model="form.operation_params.chargePower" :min="0" size="small" style="width:100%" />
          </el-form-item>
          <el-form-item label="储能放电功率(kW)">
            <el-input-number v-model="form.operation_params.dischargePower" :min="0" size="small" style="width:100%" />
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
  </div>
</template>
