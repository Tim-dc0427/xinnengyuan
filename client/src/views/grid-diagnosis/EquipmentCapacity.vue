<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import StationMap from '@/components/common/StationMap.vue'
import EquipmentReport from '@/components/common/EquipmentReport.vue'
import { fetchStations, fetchEquipmentCapacity } from '@/api/grid-diagnosis'
import type { StationOption, EquipmentCapacityResult } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const selectedStationId = ref<string | null>(null)
const activeType = ref('TRANSFORMER')
const loading = ref(false)
const equipmentList = ref<EquipmentCapacityResult[]>([])

// 变压器报告弹窗
const reportVisible = ref(false)
const reportEquipment = ref<EquipmentCapacityResult | null>(null)

const typeOptions: Array<{ label: string; value: string }> = [
  { label: '变压器', value: 'TRANSFORMER' },
  { label: '断路器', value: 'BREAKER' },
  { label: '电缆', value: 'CABLE' },
  { label: '开关设备', value: 'SWITCH' },
]

const typeLabelMap: Record<string, string> = { TRANSFORMER: '变压器', BREAKER: '断路器', CABLE: '电缆', SWITCH: '开关设备', INVERTER: '逆变器' }

fetchStations().then((data) => { stations.value = data })

const selectedStation = computed(() => stations.value.find((s) => s.id === selectedStationId.value))

async function loadData() {
  if (!selectedStationId.value) {
    equipmentList.value = []
    return
  }
  loading.value = true
  try {
    const data = await fetchEquipmentCapacity({
      equipmentType: activeType.value,
      stationId: selectedStationId.value,
    })
    equipmentList.value = data
  } catch {
    ElMessage.error('加载设备数据失败')
  } finally {
    loading.value = false
  }
}

watch(selectedStationId, () => { loadData() }, { immediate: true })
watch(activeType, () => { loadData() })

function riskTagType(level: string) {
  return level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'success'
}
function riskLabel(level: string) {
  return level === 'critical' ? '严重' : level === 'warning' ? '关注' : '正常'
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">设备承载力量化计算</div>

    <!-- 地图选电站 -->
    <div class="chart-panel" style="padding:0;overflow:hidden">
      <StationMap
        :stations="stations"
        :snapshots="[]"
        :active-id="selectedStationId"
        @select="(id) => selectedStationId = id"
      />
    </div>

    <!-- 选中电站 + 筛选 -->
    <div class="chart-panel">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <template v-if="selectedStation">
          <span style="font-weight:600">{{ selectedStation.stationName }}</span>
          <span style="color:#606266">区域：{{ selectedStation.zone }}</span>
          <span style="color:#606266">并网电压：{{ selectedStation.gridConnectionVoltageKv }}kV</span>
          <span style="color:#606266">装机容量：{{ selectedStation.installedCapacityMw }}MW</span>
        </template>
        <span v-else style="color:#909399">点击地图上的电站标记选择电站，或留空查看全部</span>
        <span style="margin-left:16px">设备类型：</span>
        <el-radio-group v-model="activeType" size="small">
          <el-radio-button v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 设备承载表格 -->
    <div class="chart-panel">
      <el-table :data="equipmentList" stripe size="small" v-loading="loading" max-height="500">
        <el-table-column prop="equipmentName" label="设备名称" width="150" />
        <el-table-column label="设备类型" width="100">
          <template #default="{ row }">{{ typeLabelMap[row.equipmentType] || row.equipmentType }}</template>
        </el-table-column>
        <el-table-column prop="stationName" label="所属电站" width="140" />
        <el-table-column prop="ratedVoltageKv" label="电压等级(kV)" width="120" />
        <el-table-column prop="ratedCapacityKva" label="额定容量(kVA)" width="130" />
        <el-table-column label="短路电流(A)" width="120">
          <template #default="{ row }">{{ row.shortCircuitCurrentA?.toFixed(0) }}</template>
        </el-table-column>
        <el-table-column label="穿越电流(A)" width="120">
          <template #default="{ row }">{{ row.throughCurrentA?.toFixed(0) }}</template>
        </el-table-column>
        <el-table-column label="负载率" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.isOverloaded ? '#f56c6c' : '#67c23a', fontWeight:600 }">{{ (row.loadRate * 100).toFixed(1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="过载状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isOverloaded ? 'danger' : 'success'" size="small">{{ row.isOverloaded ? '过载' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" size="small">{{ riskLabel(row.riskLevel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="专项评估" min-width="200">
          <template #default="{ row }">
            <template v-if="row.equipmentType === 'TRANSFORMER'">
              短路{{ row.assessment?.shortCircuitCurrentKa }}kA / 穿越{{ row.assessment?.throughCurrentKa }}kA
              <br/>
              <span>热稳定：</span>
              <span :style="{ color: row.assessment?.thermalStability?.passed ? '#67c23a' : '#f56c6c', fontWeight:600 }">{{ row.assessment?.thermalStability?.passed ? '通过' : '不通过' }}</span>
              <span style="margin-left:8px">动稳定：</span>
              <span :style="{ color: row.assessment?.dynamicStability?.passed ? '#67c23a' : '#f56c6c', fontWeight:600 }">{{ row.assessment?.dynamicStability?.passed ? '通过' : '不通过' }}</span>
            </template>
            <template v-else-if="row.equipmentType === 'BREAKER'">
              额定分断{{ row.assessment?.ratedBreakingKa }}kA / 实际短路{{ row.assessment?.actualShortCircuitKa }}kA
              <el-tag v-if="row.assessment?.isInsufficient" type="danger" size="small">分断能力不足</el-tag>
            </template>
            <template v-else-if="row.equipmentType === 'CABLE'">
              额定载流{{ row.assessment?.ratedAmpacityA }}A / 实际负载{{ row.assessment?.actualLoadA }}A / 温升裕度{{ row.assessment?.temperatureMarginC }}℃
              <el-tag v-if="row.assessment?.isOverload" type="danger" size="small">载流量超标</el-tag>
            </template>
            <template v-else-if="row.equipmentType === 'SWITCH'">
              短路{{ row.assessment?.shortCircuitCurrentKa }}kA
              <br/>
              <span>载流：</span><span :style="{ color: row.assessment?.longTermCurrent?.passed ? '#67c23a' : '#f56c6c', fontWeight:600 }">{{ row.assessment?.longTermCurrent?.passed ? '通过' : '不通过' }}</span>
              <span style="margin-left:4px">热稳定：</span><span :style="{ color: row.assessment?.thermalStability?.passed ? '#67c23a' : '#f56c6c', fontWeight:600 }">{{ row.assessment?.thermalStability?.passed ? '通过' : '不通过' }}</span>
              <span style="margin-left:4px">动稳定：</span><span :style="{ color: row.assessment?.dynamicStability?.passed ? '#67c23a' : '#f56c6c', fontWeight:600 }">{{ row.assessment?.dynamicStability?.passed ? '通过' : '不通过' }}</span>
              <span style="margin-left:4px">开断：</span><span :style="{ color: row.assessment?.breakingCapacity?.passed ? '#67c23a' : '#f56c6c', fontWeight:600 }">{{ row.assessment?.breakingCapacity?.passed ? '通过' : '不通过' }}</span>
              <br/>
              <span style="font-size:12px;color:#409eff;font-weight:600">{{ row.assessment?.overallVerdict }}</span>
            </template>
            <template v-else>-</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="reportEquipment = row; reportVisible = true">报告</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 设备评估报告弹窗 -->
    <EquipmentReport
      v-model:visible="reportVisible"
      :equipment="reportEquipment"
      :station="selectedStation || null"
    />
  </div>
</template>
