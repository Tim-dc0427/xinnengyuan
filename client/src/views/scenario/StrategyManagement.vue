<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchScenarios, fetchStrategies, fetchStrategy, createStrategy, updateStrategy, deleteStrategy, generateStrategy } from '@/api/scenario'
import { formatDateTime } from '@/utils/time'

const route = useRoute()
const strategies = ref<any[]>([])
const scenarios = ref<any[]>([])
const loading = ref(false)
const filterScenarioId = ref('')
const filterType = ref('')
interface RuleItem { name: string; condition: string; action: string; priority: number }
interface ScheduleItem { timeRange: string; action: string; deviceType: string; deviceName?: string; targetValue: number; unit: string; reason?: string }

const dialogVisible = ref(false)
const editingId = ref('')
const form = ref<any>({
  scenario_id: '', name: '', strategy_type: 'comprehensive', status: 'draft',
  control_rules: [] as RuleItem[],
  schedule: [] as ScheduleItem[],
  constraints: { voltageUpperLimit: 235, voltageLowerLimit: 205, frequencyUpperLimit: 50.5, frequencyLowerLimit: 49.5, lineLoadRateLimit: 0.9, devicePowerLimitPct: 100 },
  economic_targets: { optimizationMode: 'cost_first', targetConsumptionRate: 0.95, maxOperationCostPerKwh: 0.42 },
})
const generating = ref(false)
const detailVisible = ref(false)
const detail = ref<any>(null)

const deviceTypeLabel: Record<string, string> = {
  source: '电源侧',
  grid: '电网侧',
  load: '负荷侧',
  storage: '储能侧',
}

const scheduleGroups = computed(() => {
  if (!detail.value?.config?.schedule || !Array.isArray(detail.value.config.schedule)) return []
  const groups: Record<string, { key: string; label: string; items: any[] }> = {}
  const order = ['source', 'grid', 'storage', 'load']
  for (const item of detail.value.config.schedule) {
    const key = item.deviceType || 'unknown'
    if (!groups[key]) {
      groups[key] = { key, label: deviceTypeLabel[key] || key, items: [] }
    }
    groups[key].items.push(item)
  }
  return order.filter(k => groups[k]).map(k => groups[k])
})

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
  form.value = {
    scenario_id: '', name: '', strategy_type: 'comprehensive', status: 'draft',
    control_rules: [],
    schedule: [],
    constraints: { voltageUpperLimit: 235, voltageLowerLimit: 205, frequencyUpperLimit: 50.5, frequencyLowerLimit: 49.5, lineLoadRateLimit: 0.9, devicePowerLimitPct: 100 },
    economic_targets: { optimizationMode: 'cost_first', targetConsumptionRate: 0.95, maxOperationCostPerKwh: 0.42 },
  }
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  const c = row.config || {}
  form.value = {
    scenario_id: row.scenario_id,
    name: row.name,
    strategy_type: row.strategy_type,
    status: row.status,
    control_rules: c.control_rules || [],
    schedule: c.schedule || [],
    constraints: row.constraints || c.constraints || { voltageUpperLimit: 235, voltageLowerLimit: 205, frequencyUpperLimit: 50.5, frequencyLowerLimit: 49.5, lineLoadRateLimit: 0.9, devicePowerLimitPct: 100 },
    economic_targets: row.economic_targets || c.economic_targets || { optimizationMode: 'cost_first', targetConsumptionRate: 0.95, maxOperationCostPerKwh: 0.42 },
  }
  dialogVisible.value = true
}

function buildConfig() {
  return {
    control_rules: form.value.control_rules,
    schedule: form.value.schedule,
  }
}

async function save() {
  if (!form.value.name || !form.value.scenario_id) return
  const payload = {
    scenario_id: form.value.scenario_id,
    name: form.value.name,
    strategy_type: form.value.strategy_type,
    status: form.value.status,
    config: buildConfig(),
    constraints: form.value.constraints,
    economic_targets: form.value.economic_targets,
  }
  if (editingId.value) {
    await updateStrategy(editingId.value, payload)
  } else {
    await createStrategy(payload)
  }
  dialogVisible.value = false
  await loadData()
}

function addRule() {
  form.value.control_rules.push({ name: '', condition: '', action: '', priority: form.value.control_rules.length + 1 })
}
function removeRule(idx: number) {
  form.value.control_rules.splice(idx, 1)
}
function addSchedule() {
  form.value.schedule.push({ timeRange: '', action: '', deviceType: '', targetValue: 0, unit: 'kW' })
}
function removeSchedule(idx: number) {
  form.value.schedule.splice(idx, 1)
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
    const result = await generateStrategy(sid)
    await loadData()
    const schedule: any[] = result?.config?.schedule || []
    const counts = { source: 0, grid: 0, load: 0, storage: 0 }
    schedule.forEach((s: any) => { const t = s.deviceType as keyof typeof counts; if (t in counts) counts[t]++ })
    ElMessage.success(`策略已自动生成 — 源${counts.source} 网${counts.grid} 荷${counts.load} 储${counts.storage}`)
  } finally {
    generating.value = false
  }
}

function showDetail(row: any) {
  detail.value = row
  detailVisible.value = true
}

onMounted(async () => {
  if (route.query.scenario_id) {
    filterScenarioId.value = route.query.scenario_id as string
  }
  await loadScenarios()
  await loadData()
  // 从干预页跳转过来 → 直接打开对应策略的编辑弹窗
  const sid = route.query.strategy_id as string
  if (sid) {
    try {
      const strategy = await fetchStrategy(sid)
      if (strategy) openEdit(strategy)
    } catch {}
  }
})
</script>

<template>
  <div>
    <div class="chart-panel-title">互动场景策略管理</div>
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
      <el-table-column label="优化模式" width="90">
        <template #default="{ row }">
          {{ row.economic_targets?.optimizationMode === 'cost_first' ? '成本优先' : row.economic_targets?.optimizationMode === 'consumption_first' ? '消纳优先' : row.economic_targets?.optimizationMode === 'balanced' ? '平衡模式' : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'warning'" size="small">
            {{ row.status === 'active' ? '启用' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="showDetail(row)">详情</el-button>
          <el-button size="small" link @click="openEdit(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑策略' : '新增策略'" width="720px">
      <el-form :model="form" label-position="top" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="关联场景">
              <el-select v-model="form.scenario_id" :disabled="!!editingId">
                <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="策略名称">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
        </el-row>
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

        <el-divider style="margin:4px 0 12px" />

        <!-- 一、协同策略（控制规则） -->
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#267F7B">协同策略（控制规则）</div>
        <div style="margin-bottom:8px">
          <el-button size="small" @click="addRule">添加规则</el-button>
        </div>
        <div v-for="(rule, idx) in form.control_rules" :key="idx" style="padding:10px;margin-bottom:6px;background:#fafafa;border:1px solid #f0f0f0;border-radius:4px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;font-weight:600">规则 {{ idx + 1 }}</span>
            <el-button size="small" link type="danger" @click="removeRule(idx)">删除</el-button>
          </div>
          <el-row :gutter="8">
            <el-col :span="6"><span style="font-size:11px;color:#909399">名称</span><el-input v-model="rule.name" size="small" placeholder="如：光伏超发消纳" /></el-col>
            <el-col :span="7"><span style="font-size:11px;color:#909399">触发条件</span><el-input v-model="rule.condition" size="small" placeholder="如：光伏出力 > 80%" /></el-col>
            <el-col :span="8"><span style="font-size:11px;color:#909399">执行动作</span><el-input v-model="rule.action" size="small" placeholder="如：储能充电→限制光伏" /></el-col>
            <el-col :span="3"><span style="font-size:11px;color:#909399">优先级</span><el-input-number v-model="rule.priority" :min="1" :max="99" size="small" style="width:100%" /></el-col>
          </el-row>
        </div>

        <el-divider style="margin:12px 0" />

        <!-- 二、调度方案（执行计划） -->
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#267F7B">调度方案（执行计划）</div>
        <div style="margin-bottom:8px">
          <el-button size="small" @click="addSchedule">添加时段</el-button>
        </div>
        <div v-for="(s, idx) in form.schedule" :key="idx" style="padding:10px;margin-bottom:6px;background:#fafafa;border:1px solid #f0f0f0;border-radius:4px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;font-weight:600">时段 {{ idx + 1 }}</span>
            <el-button size="small" link type="danger" @click="removeSchedule(idx)">删除</el-button>
          </div>
          <el-row :gutter="8">
            <el-col :span="5"><span style="font-size:11px;color:#909399">时间范围</span><el-input v-model="s.timeRange" size="small" placeholder="如：10:00-12:00" /></el-col>
            <el-col :span="5"><span style="font-size:11px;color:#909399">设备类型</span>
              <el-select v-model="s.deviceType" size="small" style="width:100%">
                <el-option label="储能" value="storage" />
                <el-option label="光伏" value="source" />
                <el-option label="负荷" value="load" />
                <el-option label="电网" value="grid" />
              </el-select>
            </el-col>
            <el-col :span="7"><span style="font-size:11px;color:#909399">动作</span><el-input v-model="s.action" size="small" placeholder="如：放电补电" /></el-col>
            <el-col :span="4"><span style="font-size:11px;color:#909399">目标值</span><el-input-number v-model="s.targetValue" :min="0" size="small" style="width:100%" /></el-col>
            <el-col :span="3"><span style="font-size:11px;color:#909399">单位</span>
              <el-select v-model="s.unit" size="small" style="width:100%">
                <el-option label="kW" value="kW" />
                <el-option label="kWh" value="kWh" />
                <el-option label="%" value="%" />
              </el-select>
            </el-col>
          </el-row>
        </div>

        <el-divider style="margin:12px 0" />

        <!-- 三、安全约束 -->
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#E6A23C">安全约束（硬限值）</div>
        <el-row :gutter="12">
          <el-col :span="6"><span style="font-size:11px;color:#909399">电压上限(kV)</span><el-input-number v-model="form.constraints.voltageUpperLimit" :min="200" :max="264" :step="1" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:11px;color:#909399">电压下限(kV)</span><el-input-number v-model="form.constraints.voltageLowerLimit" :min="176" :max="242" :step="1" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:11px;color:#909399">频率上限(Hz)</span><el-input-number v-model="form.constraints.frequencyUpperLimit" :min="50" :max="51" :step="0.1" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:11px;color:#909399">频率下限(Hz)</span><el-input-number v-model="form.constraints.frequencyLowerLimit" :min="49" :max="50" :step="0.1" size="small" style="width:100%" /></el-col>
        </el-row>
        <el-row :gutter="12" style="margin-top:8px">
          <el-col :span="6"><span style="font-size:11px;color:#909399">线路负载率上限</span><el-input-number v-model="form.constraints.lineLoadRateLimit" :min="0" :max="1" :step="0.05" size="small" style="width:100%" /></el-col>
          <el-col :span="6"><span style="font-size:11px;color:#909399">设备功率上限(%)</span><el-input-number v-model="form.constraints.devicePowerLimitPct" :min="0" :max="100" size="small" style="width:100%" /></el-col>
        </el-row>

        <el-divider style="margin:12px 0" />

        <!-- 四、经济目标 -->
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#409EFF">经济性目标</div>
        <el-row :gutter="12">
          <el-col :span="8"><span style="font-size:11px;color:#909399">优化模式</span>
            <el-select v-model="form.economic_targets.optimizationMode" size="small" style="width:100%">
              <el-option label="成本优先" value="cost_first" />
              <el-option label="消纳优先" value="consumption_first" />
              <el-option label="平衡模式" value="balanced" />
            </el-select>
          </el-col>
          <el-col :span="8"><span style="font-size:11px;color:#909399">目标消纳率(%)</span><el-input-number v-model="form.economic_targets.targetConsumptionRate" :min="0" :max="1" :step="0.01" size="small" style="width:100%" /></el-col>
          <el-col :span="8"><span style="font-size:11px;color:#909399">最大运营成本(¥/kWh)</span><el-input-number v-model="form.economic_targets.maxOperationCostPerKwh" :min="0" :step="0.01" size="small" style="width:100%" /></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="save">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="策略详情" width="720px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="策略名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="策略类型">{{ strategyTypes.find(t => t.value === detail.strategy_type)?.label }}</el-descriptions-item>
          <el-descriptions-item label="算法生成">{{ detail.generated_by_algorithm === '1' ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status === 'active' ? '启用' : '草稿' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px;font-weight:600;font-size:13px">安全约束</div>
        <el-descriptions :column="2" border size="small" style="margin-top:8px">
          <el-descriptions-item label="电压上限">{{ detail.constraints?.voltageUpperLimit ?? '-' }} kV</el-descriptions-item>
          <el-descriptions-item label="电压下限">{{ detail.constraints?.voltageLowerLimit ?? '-' }} kV</el-descriptions-item>
          <el-descriptions-item label="频率上限">{{ detail.constraints?.frequencyUpperLimit ?? '-' }} Hz</el-descriptions-item>
          <el-descriptions-item label="频率下限">{{ detail.constraints?.frequencyLowerLimit ?? '-' }} Hz</el-descriptions-item>
          <el-descriptions-item label="线路负载率上限">{{ detail.constraints?.lineLoadRateLimit ? (detail.constraints.lineLoadRateLimit * 100).toFixed(0) + '%' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="设备功率上限">{{ detail.constraints?.devicePowerLimitPct ? detail.constraints.devicePowerLimitPct + '%' : '-' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px;font-weight:600;font-size:13px">经济性目标</div>
        <el-descriptions :column="2" border size="small" style="margin-top:8px">
          <el-descriptions-item label="优化模式">{{ detail.economic_targets?.optimizationMode === 'cost_first' ? '成本优先' : detail.economic_targets?.optimizationMode === 'consumption_first' ? '消纳优先' : detail.economic_targets?.optimizationMode === 'balanced' ? '平衡模式' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="目标消纳率">{{ detail.economic_targets?.targetConsumptionRate ? (detail.economic_targets.targetConsumptionRate * 100).toFixed(0) + '%' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="最大运营成本">{{ detail.economic_targets?.maxOperationCostPerKwh ? '¥' + detail.economic_targets.maxOperationCostPerKwh + '/kWh' : '-' }}</el-descriptions-item>
        </el-descriptions>
        <template v-if="scheduleGroups.length">
          <div style="margin-top:16px;font-weight:600;font-size:13px">调度方案（共 {{ detail.config.schedule.length }} 条）</div>
          <div style="max-height:360px;overflow-y:auto;margin-top:8px">
            <template v-for="group in scheduleGroups" :key="group.key">
              <div style="font-size:12px;font-weight:600;color:#267F7B;margin:8px 0 4px;padding-left:4px;border-left:3px solid #267F7B">{{ group.label }}</div>
              <el-timeline>
                <el-timeline-item
                  v-for="(item, idx) in group.items"
                  :key="idx"
                  :timestamp="item.timeRange"
                  placement="top"
                  size="small"
                >
                  <div style="font-size:12px;line-height:1.6">
                    <span style="font-weight:600">{{ item.deviceName || item.deviceType }}</span>
                    <el-tag size="small" style="margin-left:8px">{{ item.action }}</el-tag>
                    <span style="margin-left:8px">{{ item.targetValue }} {{ item.unit }}</span>
                    <div v-if="item.reason" style="color:#909399;margin-top:2px">{{ item.reason }}</div>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </template>
          </div>
        </template>
      </template>
    </el-dialog>
  </div>
</template>
