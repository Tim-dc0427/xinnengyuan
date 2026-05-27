<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchScenarios, fetchStrategies, createStrategy, updateStrategy, deleteStrategy, generateStrategy } from '@/api/scenario'

const strategies = ref<any[]>([])
const scenarios = ref<any[]>([])
const loading = ref(false)
const filterScenarioId = ref('')
const filterType = ref('')
const dialogVisible = ref(false)
const editingId = ref('')
const form = ref<any>({
  scenario_id: '', name: '', strategy_type: 'comprehensive',
  constraints: { voltageUpperLimit: 1.07, voltageLowerLimit: 0.93, lineLoadRateLimit: 0.9 },
  economic_targets: { targetConsumptionRate: 0.95, maxOperationCostPerKwh: 0.42 },
  status: 'draft',
})
const generating = ref(false)
const detailVisible = ref(false)
const detail = ref<any>(null)

const strategyTypes = [
  { value: 'comprehensive', label: '综合策略' },
  { value: 'source', label: '电源侧' },
  { value: 'grid', label: '电网侧' },
  { value: 'load', label: '负荷侧' },
  { value: 'storage', label: '储能侧' },
]

async function loadData() {
  loading.value = true
  try {
    strategies.value = await fetchStrategies({
      scenario_id: filterScenarioId.value || undefined,
      strategy_type: filterType.value || undefined,
    })
  } finally {
    loading.value = false
  }
}

async function loadScenarios() {
  const res = await fetchScenarios({ pageSize: 100 })
  scenarios.value = res.list || []
}

function openCreate() {
  editingId.value = ''
  form.value = { scenario_id: '', name: '', strategy_type: 'comprehensive', constraints: {}, economic_targets: {}, status: 'draft' }
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  form.value = {
    scenario_id: row.scenario_id,
    name: row.name,
    strategy_type: row.strategy_type,
    constraints: row.constraints || {},
    economic_targets: row.economic_targets || {},
    status: row.status,
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.name || !form.value.scenario_id) return
  if (editingId.value) {
    await updateStrategy(editingId.value, form.value)
  } else {
    await createStrategy(form.value)
  }
  dialogVisible.value = false
  await loadData()
}

async function remove(id: string) {
  await deleteStrategy(id)
  await loadData()
}

async function autoGenerate() {
  const sid = filterScenarioId.value || form.value.scenario_id
  if (!sid) return
  generating.value = true
  try {
    await generateStrategy(sid)
    await loadData()
  } finally {
    generating.value = false
  }
}

function showDetail(row: any) {
  detail.value = row
  detailVisible.value = true
}

onMounted(() => {
  loadScenarios()
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
        <el-select v-model="filterType" placeholder="策略类型" clearable style="width:130px" size="small" @change="loadData">
          <el-option v-for="t in strategyTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </div>
      <div style="display:flex;gap:8px">
        <el-button size="small" :loading="generating" @click="autoGenerate">自动生成策略</el-button>
        <el-button type="primary" size="small" @click="openCreate">新增策略</el-button>
      </div>
    </div>
    <el-table :data="strategies" stripe size="small" v-loading="loading">
      <el-table-column label="场景" min-width="140">
        <template #default="{ row }">
          {{ scenarios.find(s => s.id === row.scenario_id)?.name || row.scenario_id?.slice(0, 8) }}
        </template>
      </el-table-column>
      <el-table-column prop="name" label="策略名称" min-width="140" />
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          {{ strategyTypes.find(t => t.value === row.strategy_type)?.label || row.strategy_type }}
        </template>
      </el-table-column>
      <el-table-column label="算法生成" width="80" align="center">
        <template #default="{ row }">
          {{ row.generated_by_algorithm === '1' ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'warning'" size="small">
            {{ row.status === 'active' ? '启用' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="150" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="showDetail(row)">详情</el-button>
          <el-button size="small" link @click="openEdit(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑策略' : '新增策略'" width="560px">
      <el-form :model="form" label-position="top" size="small">
        <el-form-item label="关联场景">
          <el-select v-model="form.scenario_id" :disabled="!!editingId">
            <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="策略名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="策略类型">
              <el-select v-model="form.strategy_type">
                <el-option v-for="t in strategyTypes" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status">
                <el-option label="草稿" value="draft" />
                <el-option label="启用" value="active" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="安全约束(电压上限 p.u.)">
          <el-input-number v-model="form.constraints.voltageUpperLimit" :min="0.9" :max="1.2" :step="0.01" size="small" style="width:100%" />
        </el-form-item>
        <el-form-item label="安全约束(电压下限 p.u.)">
          <el-input-number v-model="form.constraints.voltageLowerLimit" :min="0.8" :max="1.1" :step="0.01" size="small" style="width:100%" />
        </el-form-item>
        <el-form-item label="经济性目标(消纳率 %)">
          <el-input-number v-model="form.economic_targets.targetConsumptionRate" :min="0" :max="1" :step="0.01" size="small" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="save">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="策略详情" width="600px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="策略名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="策略类型">{{ strategyTypes.find(t => t.value === detail.strategy_type)?.label }}</el-descriptions-item>
          <el-descriptions-item label="算法生成">{{ detail.generated_by_algorithm === '1' ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status === 'active' ? '启用' : '草稿' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px;font-weight:600;font-size:13px">安全约束</div>
        <el-descriptions :column="1" border size="small" style="margin-top:8px">
          <el-descriptions-item label="电压上限">{{ detail.constraints?.voltageUpperLimit }} p.u.</el-descriptions-item>
          <el-descriptions-item label="电压下限">{{ detail.constraints?.voltageLowerLimit }} p.u.</el-descriptions-item>
          <el-descriptions-item label="负载率上限">{{ detail.constraints?.lineLoadRateLimit ? (detail.constraints.lineLoadRateLimit * 100) + '%' : '-' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px;font-weight:600;font-size:13px">经济性目标</div>
        <el-descriptions :column="1" border size="small" style="margin-top:8px">
          <el-descriptions-item label="目标消纳率">{{ detail.economic_targets?.targetConsumptionRate ? (detail.economic_targets.targetConsumptionRate * 100) + '%' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="最大运营成本">{{ detail.economic_targets?.maxOperationCostPerKwh ? '¥' + detail.economic_targets.maxOperationCostPerKwh + '/kWh' : '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </div>
</template>
