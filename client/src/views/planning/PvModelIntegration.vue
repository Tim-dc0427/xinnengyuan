<script setup lang="ts">
import { ref, onMounted } from 'vue'
import StatCard from '@/components/common/StatCard.vue'
import { fetchPvStations, createPvStation, updatePvStation, deletePvStation, fetchCostLibrary, createCostLibraryItem } from '@/api/planning'
import type { PvStation, PvCostLibraryItem } from '@new-energy/shared'

const loading = ref(false)
const stations = ref<PvStation[]>([])
const costLibrary = ref<PvCostLibraryItem[]>([])
const dialogVisible = ref(false)
const costDialogVisible = ref(false)
const editingStation = ref<Partial<PvStation> | null>(null)
const stationForm = ref<Partial<PvStation>>({})
const costForm = ref<Partial<PvCostLibraryItem>>({})
const activeTab = ref<'stations' | 'cost'>('stations')

async function loadStations() {
  loading.value = true
  try {
    stations.value = await fetchPvStations()
  } finally {
    loading.value = false
  }
}

async function loadCostLibrary() {
  try {
    costLibrary.value = await fetchCostLibrary()
  } catch { /* ignore */ }
}

function openNewStation() {
  editingStation.value = null
  stationForm.value = {
    name: '', capacityKw: 50000, panelType: 'mono-si',
    ratedVoltageKv: 110, longitude: 116.4, latitude: 39.9,
    landType: 'desert', landAreaMu: 1000, status: 'planning',
    electricalParams: { efficiency: 20.5, temperatureCoefficient: -0.35 },
    equipmentList: [],
  }
  dialogVisible.value = true
}

function openEditStation(row: PvStation) {
  editingStation.value = row
  stationForm.value = { ...row }
  dialogVisible.value = true
}

async function saveStation() {
  if (editingStation.value?.id) {
    await updatePvStation(editingStation.value.id, stationForm.value)
  } else {
    await createPvStation(stationForm.value)
  }
  dialogVisible.value = false
  await loadStations()
}

async function removeStation(id: string) {
  await deletePvStation(id)
  await loadStations()
}

function openNewCost() {
  costForm.value = { modelName: '', modelType: 'pv_module', manufacturer: '', unitCostPerKw: 0, ratedPowerKw: 0, efficiencyPct: 0, lifespanYears: 25 }
  costDialogVisible.value = true
}

async function saveCostItem() {
  await createCostLibraryItem(costForm.value)
  costDialogVisible.value = false
  await loadCostLibrary()
}

const panelTypeOptions = [
  { value: 'mono-si', label: '单晶硅' },
  { value: 'poly-si', label: '多晶硅' },
  { value: 'thin-film', label: '薄膜' },
  { value: 'hjt', label: 'HJT异质结' },
  { value: 'bifacial', label: '双面双玻' },
]

const landTypeOptions = [
  { value: 'desert', label: '荒漠' },
  { value: 'gobi', label: '戈壁' },
  { value: 'agricultural', label: '农用地' },
  { value: 'industrial', label: '工业用地' },
  { value: 'mountain', label: '山地' },
]

const stationStatusOptions = [
  { value: 'planning', label: '规划中' },
  { value: 'construction', label: '建设中' },
  { value: 'operating', label: '运营中' },
  { value: 'retired', label: '已退役' },
]

const modelTypeOptions = [
  { value: 'pv_module', label: '光伏组件' },
  { value: 'inverter', label: '逆变器' },
  { value: 'transformer', label: '变压器' },
  { value: 'cable', label: '电缆' },
  { value: 'switchgear', label: '开关柜' },
]

onMounted(() => {
  loadStations()
  loadCostLibrary()
})
</script>

<template>
  <div>
    <!-- Stat Cards -->
    <div class="stat-card-row">
      <StatCard title="光伏电站" :value="stations.length" unit="座" icon="Connection" color="#267F7B" />
      <StatCard title="总装机容量" :value="stations.reduce((s: number, i: any) => s + i.capacityKw, 0) / 10000" unit="万kW" icon="TrendCharts" color="#67C23A" />
      <StatCard title="造价库型号" :value="costLibrary.length" unit="种" icon="Collection" color="#E6A23C" />
      <StatCard title="平均单位造价" value="1,800" unit="元/kW" icon="Money" color="#F56C6C" />
    </div>

    <!-- Tabs -->
    <div class="chart-panel">
      <div class="panel-header">
        <div class="sub-tabs">
          <span :class="['sub-tab', { active: activeTab === 'stations' }]" @click="activeTab = 'stations'">光伏电站管理</span>
          <span :class="['sub-tab', { active: activeTab === 'cost' }]" @click="activeTab = 'cost'">设备综合造价库</span>
        </div>
        <el-button v-if="activeTab === 'stations'" type="primary" size="small" @click="openNewStation">新建电站</el-button>
        <el-button v-else type="primary" size="small" @click="openNewCost">新增造价条目</el-button>
      </div>

      <!-- Station Table -->
      <el-table v-if="activeTab === 'stations'" :data="stations" v-loading="loading" stripe size="small">
        <el-table-column prop="name" label="电站名称" min-width="160" />
        <el-table-column label="容量" width="110">
          <template #default="{ row }">{{ (row.capacityKw / 1000).toFixed(1) }} MW</template>
        </el-table-column>
        <el-table-column label="组件类型" width="110">
          <template #default="{ row }">{{ panelTypeOptions.find(o => o.value === row.panelType)?.label || row.panelType }}</template>
        </el-table-column>
        <el-table-column prop="ratedVoltageKv" label="电压等级" width="100">
          <template #default="{ row }">{{ row.ratedVoltageKv }} kV</template>
        </el-table-column>
        <el-table-column label="坐标" width="150">
          <template #default="{ row }">{{ row.longitude?.toFixed(2) }}, {{ row.latitude?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="土地属性" width="100">
          <template #default="{ row }">{{ landTypeOptions.find(o => o.value === row.landType)?.label || row.landType }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'operating' ? 'success' : row.status === 'construction' ? 'warning' : 'info'" size="small">
              {{ stationStatusOptions.find(o => o.value === row.status)?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="openEditStation(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="removeStation(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Cost Library Table -->
      <el-table v-else :data="costLibrary" stripe size="small">
        <el-table-column prop="modelName" label="型号名称" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ modelTypeOptions.find(o => o.value === row.modelType)?.label || row.modelType }}</template>
        </el-table-column>
        <el-table-column prop="manufacturer" label="厂商" width="120" />
        <el-table-column prop="unitCostPerKw" label="单位造价" width="110">
          <template #default="{ row }">{{ row.unitCostPerKw?.toLocaleString() }} 元/kW</template>
        </el-table-column>
        <el-table-column prop="ratedPowerKw" label="额定功率" width="100">
          <template #default="{ row }">{{ row.ratedPowerKw }} kW</template>
        </el-table-column>
        <el-table-column prop="efficiencyPct" label="效率" width="80">
          <template #default="{ row }">{{ row.efficiencyPct }}%</template>
        </el-table-column>
        <el-table-column prop="lifespanYears" label="寿命" width="70">
          <template #default="{ row }">{{ row.lifespanYears }}年</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" />
      </el-table>
    </div>

    <!-- Station Dialog -->
    <el-dialog v-model="dialogVisible" :title="editingStation ? '编辑光伏电站' : '新建光伏电站'" width="700px" destroy-on-close>
      <el-form :model="stationForm" label-width="110px" size="small">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="电站名称" required><el-input v-model="stationForm.name" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="装机容量" required><el-input v-model="stationForm.capacityKw" type="number"><template #append>kW</template></el-input></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="组件类型"><el-select v-model="stationForm.panelType" style="width:100%">
              <el-option v-for="o in panelTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电压等级"><el-input v-model="stationForm.ratedVoltageKv" type="number"><template #append>kV</template></el-input></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经度"><el-input v-model="stationForm.longitude" type="number" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度"><el-input v-model="stationForm.latitude" type="number" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="土地属性"><el-select v-model="stationForm.landType" style="width:100%">
              <el-option v-for="o in landTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="占地面积"><el-input v-model="stationForm.landAreaMu" type="number"><template #append>亩</template></el-input></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-radio-group v-model="stationForm.status">
            <el-radio v-for="o in stationStatusOptions" :key="o.value" :value="o.value">{{ o.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStation">保存</el-button>
      </template>
    </el-dialog>

    <!-- Cost Library Dialog -->
    <el-dialog v-model="costDialogVisible" title="新增造价条目" width="600px" destroy-on-close>
      <el-form :model="costForm" label-width="110px" size="small">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="型号名称" required><el-input v-model="costForm.modelName" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备类型"><el-select v-model="costForm.modelType" style="width:100%">
              <el-option v-for="o in modelTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="制造商"><el-input v-model="costForm.manufacturer" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位造价" required><el-input v-model="costForm.unitCostPerKw" type="number"><template #append>元/kW</template></el-input></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="额定功率"><el-input v-model="costForm.ratedPowerKw" type="number"><template #append>kW</template></el-input></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="效率"><el-input v-model="costForm.efficiencyPct" type="number"><template #append>%</template></el-input></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="寿命"><el-input v-model="costForm.lifespanYears" type="number"><template #append>年</template></el-input></el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="costDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCostItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.sub-tabs {
  display: flex;
  gap: 0;
}
.sub-tab {
  padding: 6px 18px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-right: none;
  transition: all 0.2s;
}
.sub-tab:first-child { border-radius: 4px 0 0 4px; }
.sub-tab:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #dcdfe6; }
.sub-tab.active {
  background: #267F7B;
  color: #fff;
  border-color: #267F7B;
}
.sub-tab.active + .sub-tab { border-left-color: #267F7B; }
</style>
