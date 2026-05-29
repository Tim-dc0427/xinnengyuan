<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { fetchGridBuses, fetchGridBranches, submitBatchConfig } from '@/api/power-flow'
import MapSelector from '@/components/common/MapSelector.vue'
import { ElMessage } from 'element-plus'

const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const groupName = ref('')
const calcType = ref('STANDARD')
const loadGrowthFactor = ref(1.0)
const pvOutputFactor = ref(1.0)
const convergenceTolerance = ref(1e-5)
const maxIterations = ref(50)
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

const filteredBuses = computed(() => {
  let list = allBuses.value
  if (zoneFilter.value) list = list.filter((b: any) => b.zone === zoneFilter.value)
  if (voltageLevelFilter.value) list = list.filter((b: any) => b.voltage_level === voltageLevelFilter.value)
  return list
})

const filteredBranches = computed(() => {
  let list = allBranches.value
  if (zoneFilter.value) list = list.filter((b: any) => b.zone === zoneFilter.value)
  if (voltageLevelFilter.value) list = list.filter((b: any) => b.voltage_level === voltageLevelFilter.value)
  return list
})

const busPoints = computed(() => {
  return allBuses.value
    .filter((b: any) => b.longitude != null && b.latitude != null)
    .map((b: any) => ({
      id: b.id,
      name: b.name,
      zone: b.zone,
      voltageLevel: b.voltage_level,
      baseKv: b.base_kv,
      longitude: b.longitude,
      latitude: b.latitude,
    }))
})

const selectedCount = computed(() => selectedBusIds.value.length + selectedBranchIds.value.length)

function handleBusSelect(rows: any[]) {
  selectedBusIds.value = rows.map((r: any) => r.id)
}

function handleBranchSelect(rows: any[]) {
  selectedBranchIds.value = rows.map((r: any) => r.id)
}

// 同步 selectedBusIds 到表格的 selection 状态
watch(selectedBusIds, async () => {
  await nextTick()
  if (!busTableRef.value) return
  const table = busTableRef.value
  for (const row of filteredBuses.value) {
    const shouldBeSelected = selectedBusIds.value.includes(row.id)
    const isSelected = (table as any).getSelectionRows?.()?.some((r: any) => r.id === row.id)
    if (shouldBeSelected !== isSelected) {
      ;(table as any).toggleRowSelection(row, shouldBeSelected)
    }
  }
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
    ElMessage.warning('请选择至少一个设备')
    return
  }
  submitting.value = true
  try {
    const res = await submitBatchConfig({
      groupName: groupName.value || `批量计算 ${new Date().toLocaleString('zh-CN')}`,
      calcType: calcType.value,
      busIds: selectedBusIds.value,
      branchIds: selectedBranchIds.value,
      parameters: {
        loadGrowthFactor: loadGrowthFactor.value,
        pvOutputFactor: pvOutputFactor.value,
        convergenceTolerance: convergenceTolerance.value,
        maxIterations: maxIterations.value,
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
          <el-select v-model="zoneFilter" placeholder="区域" clearable size="small" style="width:140px">
            <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
          </el-select>
          <el-select v-model="voltageLevelFilter" placeholder="电压等级" clearable size="small" style="width:140px">
            <el-option v-for="v in voltageLevels" :key="v" :label="v" :value="v" />
          </el-select>
          <span class="selected-hint">已选 {{ selectedBusIds.length }} 节点 / {{ selectedBranchIds.length }} 支路</span>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="地图框选" name="map">
            <MapSelector
              v-if="busPoints.length > 0"
              :buses="busPoints"
              :selected-ids="selectedBusIds"
              @update:selected-ids="selectedBusIds = $event"
            />
            <el-empty v-else description="加载中" />
          </el-tab-pane>
          <el-tab-pane label="节点列表" name="buses">
            <el-table
              ref="busTableRef"
              :data="filteredBuses"
              v-loading="loading"
              size="small"
              max-height="420"
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
          <el-tab-pane label="支路列表" name="branches">
            <el-table
              :data="filteredBranches"
              size="small"
              max-height="420"
              stripe
              @selection-change="handleBranchSelect"
            >
              <el-table-column type="selection" width="40" />
              <el-table-column prop="from_bus_id" label="起始节点" width="140" show-overflow-tooltip />
              <el-table-column prop="to_bus_id" label="终止节点" width="140" show-overflow-tooltip />
              <el-table-column prop="branch_type" label="类型" width="80" />
              <el-table-column prop="voltage_level" label="电压等级" width="90" />
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
</style>
