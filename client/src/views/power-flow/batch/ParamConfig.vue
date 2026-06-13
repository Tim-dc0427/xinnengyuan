<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { fetchGridBuses, fetchGridBranches, submitBatchConfig } from '@/api/power-flow'
import MapSelector from '@/components/common/MapSelector.vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const groupName = ref('')
const calcType = ref('STANDARD')
const loadGrowthFactor = ref(1.0)
const pvOutputFactor = ref(1.0)
const convergenceTolerance = ref(1e-5)
const maxIterations = ref(50)
const timeWindowStart = ref(defaultTimeStart())
const timeWindowEnd = ref(defaultTimeEnd())

function defaultTimeStart() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`
}
function defaultTimeEnd() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59:59`
}
function pad(n: number) { return String(n).padStart(2, '0') }
const zoneFilter = ref('')
const voltageLevelFilter = ref('')
const selectedBusIds = ref<string[]>([])
const selectedBranchIds = ref<string[]>([])

const allBuses = ref<any[]>([])
const allBranches = ref<any[]>([])
const zones = ref<string[]>([])
const voltageLevels = ref<string[]>([])
const activeTab = ref('map')
const busTableRef = ref<any>(null)
const branchTableRef = ref<any>(null)
const busStatusFilter = ref<'all' | 'selected' | 'unselected'>('all')
const branchStatusFilter = ref<'all' | 'selected' | 'unselected'>('all')

// 基础筛选（区域 + 电压等级），不含选中状态筛选
const baseFilteredBuses = computed(() => {
  let list = allBuses.value
  if (zoneFilter.value) list = list.filter((b: any) => b.zone === zoneFilter.value)
  if (voltageLevelFilter.value) list = list.filter((b: any) => b.voltage_level === voltageLevelFilter.value)
  return list
})

const baseFilteredBranches = computed(() => {
  let list = allBranches.value
  if (zoneFilter.value) list = list.filter((b: any) => b.zone === zoneFilter.value)
  if (voltageLevelFilter.value) list = list.filter((b: any) => b.voltage_level === voltageLevelFilter.value)
  return list
})

// 表格显示数据 = 基础筛选 + 选中状态筛选
const filteredBuses = computed(() => {
  let list = baseFilteredBuses.value
  if (busStatusFilter.value === 'selected') list = list.filter((b: any) => selectedBusIds.value.includes(b.id))
  if (busStatusFilter.value === 'unselected') list = list.filter((b: any) => !selectedBusIds.value.includes(b.id))
  return list
})

const filteredBranches = computed(() => {
  let list = baseFilteredBranches.value
  if (branchStatusFilter.value === 'selected') list = list.filter((b: any) => selectedBranchIds.value.includes(b.id))
  if (branchStatusFilter.value === 'unselected') list = list.filter((b: any) => !selectedBranchIds.value.includes(b.id))
  return list
})

const busPoints = computed(() => {
  let list = allBuses.value.filter((b: any) => b.longitude != null && b.latitude != null)
  if (zoneFilter.value) list = list.filter((b: any) => b.zone === zoneFilter.value)
  return list.map((b: any) => ({
    id: b.id,
    name: b.name,
    zone: b.zone,
    voltageLevel: b.voltage_level,
    baseKv: b.base_kv,
    longitude: b.longitude,
    latitude: b.latitude,
    physicalRole: b.physical_role || '',
  }))
})

const selectedCount = computed(() => selectedBusIds.value.length + selectedBranchIds.value.length)

const busNameById = computed(() => {
  const map = new Map<string, string>()
  for (const b of allBuses.value) map.set(b.id, b.name || b.id)
  return map
})

let syncingTable = false
let syncingBranch = false
let filterChanging = false

// 筛选切换时锁定，防止表格 data 变化触发 selection-change 清空选中
watch([busStatusFilter, branchStatusFilter, zoneFilter, voltageLevelFilter], () => {
  filterChanging = true
  nextTick(() => { filterChanging = false })
})

function handleBusSelect(rows: any[]) {
  if (syncingTable || filterChanging) return
  selectedBusIds.value = rows.map((r: any) => r.id)
}

function handleBranchSelect(rows: any[]) {
  if (syncingBranch || filterChanging) return
  selectedBranchIds.value = rows.map((r: any) => r.id)
}

function selectAllBuses() {
  const ids = baseFilteredBuses.value.map((b: any) => b.id)
  selectedBusIds.value = [...new Set([...selectedBusIds.value, ...ids])]
}

function deselectAllBuses() {
  const removeIds = new Set(baseFilteredBuses.value.map((b: any) => b.id))
  selectedBusIds.value = selectedBusIds.value.filter(id => !removeIds.has(id))
}

function selectAllBranches() {
  const ids = baseFilteredBranches.value.map((b: any) => b.id)
  selectedBranchIds.value = [...new Set([...selectedBranchIds.value, ...ids])]
}

function deselectAllBranches() {
  const removeIds = new Set(baseFilteredBranches.value.map((b: any) => b.id))
  selectedBranchIds.value = selectedBranchIds.value.filter(id => !removeIds.has(id))
}

// 同步 selectedBusIds 到表格的 selection 状态
watch(selectedBusIds, async () => {
  await nextTick()
  if (!busTableRef.value) return
  syncingTable = true
  const table = busTableRef.value
  for (const row of filteredBuses.value) {
    const shouldBeSelected = selectedBusIds.value.includes(row.id)
    const isSelected = (table as any).getSelectionRows?.()?.some((r: any) => r.id === row.id)
    if (shouldBeSelected !== isSelected) {
      ;(table as any).toggleRowSelection(row, shouldBeSelected)
    }
  }
  syncingTable = false
})

// 同步 selectedBranchIds 到线路表格的 selection 状态
watch(selectedBranchIds, async () => {
  await nextTick()
  if (!branchTableRef.value) return
  syncingBranch = true
  const table = branchTableRef.value
  for (const row of filteredBranches.value) {
    const shouldBeSelected = selectedBranchIds.value.includes(row.id)
    const isSelected = (table as any).getSelectionRows?.()?.some((r: any) => r.id === row.id)
    if (shouldBeSelected !== isSelected) {
      ;(table as any).toggleRowSelection(row, shouldBeSelected)
    }
  }
  syncingBranch = false
})

// 自动关联支路：选中节点后，自动选中与该节点相连的所有支路
watch(selectedBusIds, (newIds) => {
  const busIdSet = new Set(newIds)
  if (busIdSet.size === 0) {
    selectedBranchIds.value = []
    return
  }
  const autoIds: string[] = []
  for (const br of allBranches.value) {
    if (busIdSet.has(br.from_bus_id) || busIdSet.has(br.to_bus_id)) {
      if (!autoIds.includes(br.id)) autoIds.push(br.id)
    }
  }
  selectedBranchIds.value = autoIds
})

async function loadData() {
  loading.value = true
  try {
    const [buses, branches] = await Promise.all([
      fetchGridBuses(),
      fetchGridBranches(),
    ])
    allBuses.value = (buses || []).map((b: any) => ({
      ...b,
      voltage_level: b.voltage_level || b.voltageLevel,
      base_kv: b.base_kv ?? b.baseKv,
      bus_type: b.bus_type || b.busType,
    }))
    allBranches.value = branches || []
    zones.value = [...new Set(allBuses.value.map((b: any) => b.zone).filter(Boolean))] as string[]
    voltageLevels.value = [...new Set(allBuses.value.map((b: any) => b.voltage_level).filter(Boolean))] as string[]
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (selectedCount.value === 0) {
    ElMessage.warning('请选择至少一条母线或线路')
    return
  }
  submitting.value = true
  try {
    const res = await submitBatchConfig({
      groupName: groupName.value || `批量计算 ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
      calcType: calcType.value,
      busIds: selectedBusIds.value,
      branchIds: selectedBranchIds.value,
      parameters: {
        loadGrowthFactor: loadGrowthFactor.value,
        pvOutputFactor: pvOutputFactor.value,
        convergenceTolerance: convergenceTolerance.value,
        maxIterations: maxIterations.value,
        ...(timeWindowStart.value || timeWindowEnd.value ? {
          timeWindow: {
            start: timeWindowStart.value || undefined,
            end: timeWindowEnd.value || undefined,
          },
        } : {}),
      },
    })
    router.push({ name: 'BatchTaskMonitor', query: { groupId: res.groupId } })
  } catch {
    ElMessage.error('提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="batch-config">
    <div class="chart-panel-title">参数配置</div>
    <div class="config-grid">
      <div class="config-left">
        <div class="filter-row">
          <span class="selected-hint">已选 {{ selectedBusIds.length }} 母线 / {{ selectedBranchIds.length }} 线路</span>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="地图框选" name="map">
            <div class="table-toolbar">
              <el-select v-model="zoneFilter" placeholder="区域" clearable size="small" style="width:120px">
                <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
              </el-select>
            </div>
            <MapSelector
              v-if="busPoints.length > 0"
              :buses="busPoints"
              :selected-ids="selectedBusIds"
              @update:selected-ids="selectedBusIds = $event"
            />
            <el-empty v-else description="加载中" />
          </el-tab-pane>
          <el-tab-pane label="母线列表" name="buses">
            <div class="table-toolbar">
              <el-radio-group v-model="busStatusFilter" size="small">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="selected">已选</el-radio-button>
                <el-radio-button value="unselected">未选</el-radio-button>
              </el-radio-group>
              <el-select v-model="zoneFilter" placeholder="区域" clearable size="small" style="width:100px">
                <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
              </el-select>
              <el-select v-model="voltageLevelFilter" placeholder="电压等级" clearable size="small" style="width:100px">
                <el-option v-for="v in voltageLevels" :key="v" :label="v" :value="v" />
              </el-select>
              <el-button size="small" @click="selectAllBuses">全选当前</el-button>
              <el-button size="small" @click="deselectAllBuses">清空当前</el-button>
            </div>
            <el-table
              ref="busTableRef"
              :data="filteredBuses"
              v-loading="loading"
              size="small"
              max-height="390"
              stripe
              @selection-change="handleBusSelect"
            >
              <el-table-column type="selection" width="40" />
              <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
              <el-table-column prop="zone" label="区域" width="90" />
              <el-table-column prop="voltage_level" label="电压等级" width="90" />
              <el-table-column prop="bus_type" label="类型" width="70" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="线路列表" name="branches">
            <div class="table-toolbar">
              <el-radio-group v-model="branchStatusFilter" size="small">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="selected">已选</el-radio-button>
                <el-radio-button value="unselected">未选</el-radio-button>
              </el-radio-group>
              <el-select v-model="zoneFilter" placeholder="区域" clearable size="small" style="width:100px">
                <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
              </el-select>
              <el-select v-model="voltageLevelFilter" placeholder="电压等级" clearable size="small" style="width:100px">
                <el-option v-for="v in voltageLevels" :key="v" :label="v" :value="v" />
              </el-select>
              <el-button size="small" @click="selectAllBranches">全选当前</el-button>
              <el-button size="small" @click="deselectAllBranches">清空当前</el-button>
            </div>
            <el-table
              ref="branchTableRef"
              :data="filteredBranches"
              size="small"
              max-height="390"
              stripe
              @selection-change="handleBranchSelect"
            >
              <el-table-column type="selection" width="40" />
              <el-table-column label="送端母线" min-width="110" show-overflow-tooltip>
                <template #default="{ row }">{{ busNameById.get(row.from_bus_id) || row.from_bus_id }}</template>
              </el-table-column>
              <el-table-column label="受端母线" min-width="110" show-overflow-tooltip>
                <template #default="{ row }">{{ busNameById.get(row.to_bus_id) || row.to_bus_id }}</template>
              </el-table-column>
              <el-table-column prop="branch_type" label="类型" width="80" />
              <el-table-column prop="voltage_level" label="电压等级" width="80" />
              <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>

      <div class="config-right">
        <div class="section-title">计算参数</div>
        <el-form label-width="110px" size="small">
          <el-form-item label="任务名称">
            <el-input v-model="groupName" placeholder="自动生成" />
          </el-form-item>
          <el-form-item label="计算类型">
            <el-select v-model="calcType" style="width:100%">
              <el-option label="标准潮流" value="STANDARD" />
              <el-option label="反向潮流" value="REVERSE" />
              <el-option label="概率潮流" value="PROBABILISTIC" />
              <el-option label="三相潮流" value="THREE_PHASE" />
            </el-select>
          </el-form-item>
          <el-form-item label="负荷增长系数">
            <el-input-number v-model="loadGrowthFactor" :step="0.05" :precision="2" :min="0.5" :max="2.0" style="width:100%" />
          </el-form-item>
          <el-form-item label="光伏出力系数">
            <el-input-number v-model="pvOutputFactor" :step="0.05" :precision="2" :min="0" :max="1.5" style="width:100%" />
          </el-form-item>
          <el-form-item label="时间窗口起">
            <el-date-picker
              v-model="timeWindowStart"
              type="datetime"
              placeholder="开始时间"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DDTHH:mm:ss"
              size="small"
              style="width:100%"
            />
          </el-form-item>
          <el-form-item label="时间窗口止">
            <el-date-picker
              v-model="timeWindowEnd"
              type="datetime"
              placeholder="结束时间"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DDTHH:mm:ss"
              size="small"
              style="width:100%"
            />
          </el-form-item>
          <el-form-item label="收敛精度">
            <el-select v-model="convergenceTolerance" style="width:100%">
              <el-option label="1e-4" :value="1e-4" />
              <el-option label="1e-5" :value="1e-5" />
              <el-option label="1e-6" :value="1e-6" />
            </el-select>
          </el-form-item>
          <el-form-item label="最大迭代次数">
            <el-input-number v-model="maxIterations" :step="10" :min="10" :max="200" style="width:100%" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" :disabled="selectedCount === 0" @click="handleSubmit">
              提交批量计算 ({{ selectedCount }})
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.batch-config { padding: 0; }
.config-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
.config-left, .config-right { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
.filter-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.selected-hint { font-size: 12px; color: #909399; margin-left: auto; }
.table-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
</style>
