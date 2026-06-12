<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import StationMap from '@/components/common/StationMap.vue'
import { fetchStations, fetchEquipmentCapacity, fetchEquipmentReliability } from '@/api/grid-diagnosis'
import type { StationOption, EquipmentCapacityResult } from '@new-energy/shared'

interface ReliabilityRow extends EquipmentCapacityResult {
  reliability?: number
  failureRate?: number
  reliabilityGrade?: string
  assessing?: boolean
}

const stations = ref<StationOption[]>([])
const selectedStationId = ref<string | null>(null)
const loading = ref(false)
const allEquipment = ref<ReliabilityRow[]>([])        // 全局全部设备
const filteredList = ref<ReliabilityRow[]>([])         // 按电站筛选

const typeLabelMap: Record<string, string> = { TRANSFORMER: '变压器', BREAKER: '断路器', CABLE: '电缆', SWITCH: '开关设备', INVERTER: '逆变器', BATTERY: '储能电池' }

// 页面加载：获取全部设备并评估可靠性
async function initAllReliability() {
  loading.value = true
  try {
    const data = await fetchEquipmentCapacity({})
    allEquipment.value = data.map((e) => ({ ...e, reliabilityGrade: e.grade || '?' }))
    for (const eq of allEquipment.value) assessOne(eq)
  } catch {
    ElMessage.error('加载设备数据失败')
  } finally {
    loading.value = false
  }
}

fetchStations().then((data) => { stations.value = data }).then(() => initAllReliability())

const selectedStation = computed(() => stations.value.find((s) => s.id === selectedStationId.value))

// 地图选站 → 筛选明细
function onMapSelect(id: string | null) {
  selectedStationId.value = id
  if (id) {
    filteredList.value = allEquipment.value.filter((e) => e.stationId === id)
  } else {
    filteredList.value = []
  }
}

async function assessOne(row: ReliabilityRow) {
  row.assessing = true
  try {
    const result = await fetchEquipmentReliability(row.equipmentId)
    row.reliability = result.reliability
    row.failureRate = result.failureRate
    row.reliabilityGrade = result.grade
  } catch {
    row.reliabilityGrade = row.grade || '?'
  } finally {
    row.assessing = false
  }
}

function gradeTagType(grade: string) {
  return grade === 'A' ? 'success' : grade === 'B' ? 'warning' : 'danger'
}

const gradeStats = computed(() => {
  const list = selectedStationId.value ? filteredList.value : allEquipment.value
  const a = list.filter((e) => e.reliabilityGrade === 'A').length
  const b = list.filter((e) => e.reliabilityGrade === 'B').length
  const c = list.filter((e) => e.reliabilityGrade === 'C').length
  return { a, b, c, total: list.length }
})

const activeTab = ref('detail')

const warningList = computed(() => allEquipment.value.filter((e) => e.reliabilityGrade === 'C'))
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">设备可靠性评估</div>

    <!-- 地图选电站 -->
    <div class="chart-panel" style="padding:0;overflow:hidden">
      <StationMap
        :stations="stations"
        :snapshots="[]"
        :active-id="selectedStationId"
        @select="onMapSelect"
      />
    </div>

    <!-- 选中电站信息 -->
    <div class="chart-panel">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <template v-if="selectedStation">
          <span style="font-weight:600">{{ selectedStation.stationName }}</span>
          <span style="color:#606266">区域：{{ selectedStation.zone }}</span>
          <span style="color:#606266">并网电压：{{ selectedStation.gridConnectionVoltageKv }}kV</span>
          <span style="color:#606266">装机容量：{{ selectedStation.installedCapacityMw }}MW</span>
        </template>
        <span v-else style="color:#909399">点击地图上的电站标记，查看设备可靠性评估</span>
      </div>

      <div v-if="allEquipment.length" style="display:flex;gap:16px;margin-top:12px">
        <el-tag type="success">A级：{{ gradeStats.a }} 台</el-tag>
        <el-tag type="warning">B级：{{ gradeStats.b }} 台</el-tag>
        <el-tag type="danger">C级：{{ gradeStats.c }} 台</el-tag>
        <el-tag>总计：{{ gradeStats.total }} 台</el-tag>
      </div>
    </div>

    <!-- Tabs: 可靠性明细 / 低可靠性预警 -->
    <div class="chart-panel">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="可靠性明细" name="detail">
          <template v-if="filteredList.length">
            <el-table :data="filteredList" stripe size="small" max-height="500">
              <el-table-column prop="equipmentName" label="设备名称" width="150" />
              <el-table-column label="类型" width="100">
                <template #default="{ row }">{{ typeLabelMap[row.equipmentType] || row.equipmentType }}</template>
              </el-table-column>
              <el-table-column prop="stationName" label="所属电站" width="140" />
              <el-table-column prop="ratedVoltageKv" label="电压等级(kV)" width="110" />
              <el-table-column label="可靠度" width="110">
                <template #default="{ row }">
                  <span v-if="row.reliability !== undefined">{{ (row.reliability * 100).toFixed(6) }}%</span>
                  <span v-else style="color:#c0c4cc">评估中...</span>
                </template>
              </el-table-column>
              <el-table-column label="故障率(/年)" width="110">
                <template #default="{ row }">{{ row.failureRate?.toFixed(5) || '-' }}</template>
              </el-table-column>
              <el-table-column label="可靠性等级" width="110">
                <template #default="{ row }">
                  <el-tag :type="gradeTagType(row.reliabilityGrade || '')" size="small">{{ row.reliabilityGrade || '?' }}级</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="设计寿命(年)" width="110">
                <template #default="{ row }">{{ row.designLifeYears }}</template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button size="small" :loading="row.assessing" @click="assessOne(row)">重新评估</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <el-empty v-else description="请点击地图选择电站查看设备明细" />
        </el-tab-pane>
        <el-tab-pane label="低可靠性预警" name="warning">
          <template v-if="warningList.length">
            <el-table :data="warningList" stripe size="small" max-height="400">
              <el-table-column prop="equipmentName" label="设备名称" width="150" />
              <el-table-column label="类型" width="80">
                <template #default="{ row }">{{ typeLabelMap[row.equipmentType] || row.equipmentType }}</template>
              </el-table-column>
              <el-table-column label="可靠度" width="100">
                <template #default="{ row }">{{ row.reliability ? (row.reliability * 100).toFixed(6) + '%' : '-' }}</template>
              </el-table-column>
              <el-table-column label="故障率(/年)" width="120">
                <template #default="{ row }">{{ row.failureRate ? row.failureRate.toFixed(5) : '-' }}</template>
              </el-table-column>
              <el-table-column label="等级" width="80">
                <template #default="{ row }"><el-tag :type="gradeTagType(row.reliabilityGrade || '')" size="small">{{ row.reliabilityGrade }}级</el-tag></template>
              </el-table-column>
              <el-table-column prop="stationName" label="所属电站" />
            </el-table>
          </template>
          <el-empty v-else description="暂无低可靠性设备" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>
