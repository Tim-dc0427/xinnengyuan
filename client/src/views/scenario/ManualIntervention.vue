<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { fetchScenarios, fetchRunningSimulations, fetchInterventions, createIntervention, stopSimulation, exportInterventions } from '@/api/scenario'

const scenarios = ref<any[]>([])
const runningSims = ref<any[]>([])
const interventions = ref<any[]>([])
const loading = ref(false)

const filterType = ref('')
const filterScenarioId = ref('')

const dialogVisible = ref(false)
const form = ref({ scenario_id: '', simulation_id: '', operation_type: 'adjust', operation_params: {} as any, reason: '' })
const submitting = ref(false)
const quickSubmitting = ref(false)

const operationTypes = [
  { value: 'pause', label: '暂停' },
  { value: 'resume', label: '恢复' },
  { value: 'adjust', label: '参数调整' },
  { value: 'override', label: '强制控制' },
  { value: 'force_control', label: '强制控制' },
  { value: 'emergency_stop', label: '紧急停止' },
]

const operationTypeLabels: Record<string, string> = {
  pause: '暂停', resume: '恢复', adjust: '参数调整', override: '强制控制',
  force_control: '强制控制', emergency_stop: '紧急停止',
}

// 快捷操作面板每行状态
const quickActionState = reactive<Record<string, { pvOutputLimit: number; chargePower: number; loadShedRatio: number }>>({})

watch(runningSims, (sims) => {
  for (const sim of sims) {
    if (!quickActionState[sim.id]) {
      // 从 paused_params 恢复已有的干预值
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

async function quickExecute(sim: any) {
  const qs = quickActionState[sim.id]
  if (!qs) return
  quickSubmitting.value = true
  try {
    await createIntervention({
      scenario_id: sim.scenario_id,
      simulation_id: sim.id,
      operation_type: 'force_control',
      operation_params: {
        pvOutputLimit: qs.pvOutputLimit,
        chargePower: qs.chargePower,
        loadShedRatio: qs.loadShedRatio,
      },
      reason: '快捷操作面板 - 强制控制',
    })
    // createIntervention 已写入 paused_params，模拟继续运行并在下一步自动生效
    await loadData()
  } catch (e) {
    console.error('快捷操作执行失败', e)
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

function formatParamsChange(row: any) {
  const before = row.params_before
  const after = row.params_after
  if (!before && !after) return '-'
  const changes: string[] = []
  const keys = new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])])
  for (const key of keys) {
    const bVal = before?.[key]
    const aVal = after?.[key]
    if (bVal !== aVal) {
      changes.push(`${key}: ${bVal ?? '-'} → ${aVal ?? '-'}`)
    }
  }
  return changes.length ? changes.join('; ') : '无变化'
}

async function exportAuditReport() {
  try {
    const data = await exportInterventions({
      operation_type: filterType.value || undefined,
      scenario_id: filterScenarioId.value || undefined,
    })
    const list = Array.isArray(data) ? data : []
    if (list.length === 0) {
      console.warn('无数据可导出')
      return
    }
    // 后端返回中文键的对象数组，直接用对象键作为CSV表头
    const headers = Object.keys(list[0])
    const rows = list.map((row: any) => headers.map(h => String(row[h] ?? '')))
    const csvContent = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `干预审计报告_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('导出失败', e)
  }
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
            {{ sim.status }}
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
            <span style="font-size:12px;white-space:nowrap;color:#606266">储能充电功率</span>
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
          <el-button size="small" type="danger" :loading="quickSubmitting" @click="emergencyStopSim(sim)">
            紧急停止
          </el-button>
        </div>
      </div>
    </div>

    <!-- 筛选与操作栏 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterType" placeholder="操作类型" clearable style="width:130px" size="small" @change="loadData">
          <el-option v-for="t in operationTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="filterScenarioId" placeholder="关联场景" clearable style="width:180px" size="small" @change="loadData">
          <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <div style="display:flex;gap:8px">
        <el-button size="small" @click="exportAuditReport">导出审计报告</el-button>
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
          {{ row.operation_params ? JSON.stringify(row.operation_params) : '-' }}
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
            <el-option v-for="s in runningSims" :key="s.id" :label="s.id?.slice(0, 12)" :value="s.id" />
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
