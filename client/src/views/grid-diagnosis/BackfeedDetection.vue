<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import StationMap from '@/components/common/StationMap.vue'
import { fetchStations, fetchStationsSnapshot, detectBackfeed, fetchEquipmentCapacity, fetchEquipmentReliability, fetchEquipmentPower, fetchAvailableHours } from '@/api/grid-diagnosis'
import type { StationOption, StationSnapshot, EquipmentPowerItem } from '@new-energy/shared'

// ==================== 数据状态 ====================
const stations = ref<StationOption[]>([])
const snapshots = ref<StationSnapshot[]>([])
const activeStationId = ref<string | null>(null)
const backfeedEvents = ref<Array<{ time: string; activePowerKw: number; reactivePowerKvar: number; apparentPowerKva: number }>>([])
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ==================== 设备台账 ====================
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const typeLabelMap: Record<string, string> = { TRANSFORMER: '变压器', BREAKER: '断路器', CABLE: '电缆', SWITCH: '开关设备', INVERTER: '逆变器', BATTERY: '储能电池' }

const equipmentList = ref<Array<{
  id: string; name: string; type: string; capacityKva: number; voltageKv: number; currentA: number
  reliability?: number; grade?: string
  activePowerKw?: number | null; reactivePowerKvar?: number | null; apparentPowerKva?: number | null
}>>([])

// 接入点时段选择（主面板 + Drawer 共用）
const availableHours = ref<string[]>([])
const selectedStationHour = ref('')
const stationHourPower = ref<{ activePowerKw: number; reactivePowerKvar: number; apparentPowerKva: number } | null>(null)
const stationHourLoading = ref(false)

const powerBearingTypes = ['TRANSFORMER', 'INVERTER', 'BATTERY']
function hasPowerData(eq: { type: string; activePowerKw?: number | null }) {
  return powerBearingTypes.includes(eq.type) && eq.activePowerKw != null
}
// 非功率型设备的铭牌参数标签
const paramLabelMap: Record<string, { label: string; unit: string; value: (eq: { capacityKva: number; voltageKv: number; currentA?: number }) => string }> = {
  TRANSFORMER: { label: '额定容量', unit: 'kVA', value: (eq) => eq.capacityKva.toFixed(0) },
  INVERTER: { label: '额定容量', unit: 'kVA', value: (eq) => eq.capacityKva.toFixed(0) },
  BATTERY: { label: '额定容量', unit: 'kVA', value: (eq) => eq.capacityKva.toFixed(0) },
  BREAKER: { label: '额定电流', unit: 'A', value: (eq) => (eq.currentA || eq.capacityKva / eq.voltageKv / 1.732).toFixed(0) },
  CABLE: { label: '载流量', unit: 'A', value: (eq) => (eq.currentA || eq.capacityKva / eq.voltageKv / 1.732).toFixed(0) },
  SWITCH: { label: '额定电流', unit: 'A', value: (eq) => (eq.currentA || eq.capacityKva / eq.voltageKv / 1.732).toFixed(0) },
}

// ==================== 加载实时快照 ====================
async function loadSnapshot() {
  try {
    const data = await fetchStationsSnapshot()
    snapshots.value = data
  } catch { /* 静默 */ }
}

onMounted(async () => {
  stations.value = await fetchStations()
  await loadSnapshot()
  // 每 30 秒刷新实时快照
  refreshTimer = setInterval(() => loadSnapshot(), 30000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const activeStation = computed(() => stations.value.find((s) => s.id === activeStationId.value))
const activeSnapshot = computed(() => snapshots.value.find((s) => s.stationId === activeStationId.value))

// ==================== 倒送事件（点击电站后加载极端数据） ====================
async function loadBackfeedEvents(stationId: string) {
  try {
    const data = await detectBackfeed({ plantId: stationId, threshold: 0 })
    // 只保留倒送事件（极端情况）
    backfeedEvents.value = data
      .filter((d) => d.isBackfeed)
      .slice(0, 50)
  } catch { /* 静默 */ }
}

function onMapSelect(id: string | null) {
  activeStationId.value = id
  if (id) {
    loadBackfeedEvents(id)
    loadStationHours(id)
  } else {
    backfeedEvents.value = []
    availableHours.value = []
    stationHourPower.value = null
  }
}

async function loadStationHours(stationId: string) {
  stationHourLoading.value = true
  try {
    const hours = await fetchAvailableHours(stationId).catch(() => [] as string[])
    availableHours.value = hours
    if (hours.length > 0) {
      selectedStationHour.value = hours[0]
      await loadStationHourPower(stationId, hours[0])
    }
  } finally { stationHourLoading.value = false }
}

async function loadStationHourPower(stationId: string, time: string) {
  try {
    const data = await fetchEquipmentPower(stationId, time)
    stationHourPower.value = {
      activePowerKw: data.stationActivePowerKw,
      reactivePowerKvar: data.stationReactivePowerKvar,
      apparentPowerKva: Math.sqrt(data.stationActivePowerKw ** 2 + data.stationReactivePowerKvar ** 2),
    }
  } catch { stationHourPower.value = null }
}

async function onStationHourChange() {
  if (!activeStationId.value || !selectedStationHour.value) return
  await loadStationHourPower(activeStationId.value, selectedStationHour.value)
}

// ==================== 全局统计 ====================
const snapshotStats = computed(() => {
  const list = snapshots.value
  if (!list.length) return { forward: 0, reverse: 0, backfeedCount: 0, maxP: 0 }
  return {
    forward: list.filter((s) => s.direction === 'forward').length,
    reverse: list.filter((s) => s.direction === 'reverse').length,
    backfeedCount: list.filter((s) => s.isBackfeed).length,
    maxP: Math.max(...list.map((s) => Math.abs(s.activePowerKw))),
  }
})

// ==================== 设备台账 ====================
async function openEquipmentDrawer() {
  if (!activeStationId.value) return
  drawerVisible.value = true
  drawerLoading.value = true
  const stationId = activeStationId.value
  try {
    // 并行加载设备台帐、可用时段
    const [equipData, hours] = await Promise.all([
      fetchEquipmentCapacity({ stationId }),
      fetchAvailableHours(stationId).catch(() => [] as string[]),
    ])
    availableHours.value = hours
    if (!selectedStationHour.value && hours.length > 0) selectedStationHour.value = hours[0]
    equipmentList.value = equipData.map((e) => ({
      id: e.equipmentId, name: e.equipmentName, type: e.equipmentType,
      capacityKva: e.ratedCapacityKva, voltageKv: e.ratedVoltageKv, currentA: e.ratedCurrentA || 0,
    }))
    // 并行加载可靠性 + 设备功率
    const [, powerData] = await Promise.all([
      Promise.allSettled(equipmentList.value.map(async (item) => {
        try {
          const rel = await fetchEquipmentReliability(item.id)
          item.reliability = rel.reliability; item.grade = rel.grade
        } catch { /* 忽略 */ }
      })),
      selectedStationHour.value ? loadEquipmentPower(stationId, selectedStationHour.value) : Promise.resolve(),
    ])
    await powerData
  } catch { ElMessage.error('设备台账加载失败') } finally { drawerLoading.value = false }
}

async function loadEquipmentPower(stationId: string, time: string) {
  try {
    const data = await fetchEquipmentPower(stationId, time)
    const map = new Map(data.items.map((i: EquipmentPowerItem) => [i.equipmentId, i]))
    for (const eq of equipmentList.value) {
      const p = map.get(eq.id)
      if (p) {
        eq.activePowerKw = p.activePowerKw
        eq.reactivePowerKvar = p.reactivePowerKvar
        eq.apparentPowerKva = p.apparentPowerKva
      }
    }
  } catch { /* 忽略 */ }
}

async function onDrawerHourChange() {
  if (!activeStationId.value || !selectedStationHour.value) return
  drawerLoading.value = true
  try {
    await loadEquipmentPower(activeStationId.value, selectedStationHour.value)
  } finally { drawerLoading.value = false }
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">光伏倒送场景判断</div>

    <!-- 全局实时概览 -->
    <div v-if="snapshots.length" class="chart-panel">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px">
        <span style="font-weight:600">实时功率方向（{{ snapshots[0]?.time?.slice(0, 16) || '-' }}）</span>
        <el-tag type="success">正向：{{ snapshotStats.forward }} 站</el-tag>
        <el-tag type="danger">反向：{{ snapshotStats.reverse }} 站</el-tag>
        <el-tag type="warning">倒送越限：{{ snapshotStats.backfeedCount }} 站</el-tag>
        <span style="color:#909399">最大出力：{{ snapshotStats.maxP.toFixed(0) }} kW</span>
      </div>
    </div>

    <!-- 地图 -->
    <div class="chart-panel" style="padding:0;overflow:hidden">
      <StationMap
        :stations="stations"
        :snapshots="snapshots"
        :active-id="activeStationId"
        @select="onMapSelect"
      />
    </div>

    <!-- 选中电站实时快照 -->
    <div v-if="activeStation" class="chart-panel">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:13px">
        <span style="font-weight:600">{{ activeStation.stationName }}</span>
        <span>区域：{{ activeStation.zone }}</span>
        <span>并网电压：{{ activeStation.gridConnectionVoltageKv }}kV</span>
        <span>装机容量：{{ activeStation.installedCapacityMw }}MW</span>
        <el-divider direction="vertical" />
        <!-- 实时快照（最新） -->
        <template v-if="activeSnapshot">
          <span>实时 P：<b :style="{ color: activeSnapshot.activePowerKw >= 0 ? '#67c23a' : '#f56c6c', fontSize: '16px' }">{{ activeSnapshot.activePowerKw.toFixed(1) }} kW</b></span>
          <span>Q：<b>{{ activeSnapshot.reactivePowerKvar.toFixed(1) }} kvar</b></span>
          <span>S：<b>{{ activeSnapshot.apparentPowerKva.toFixed(1) }} kVA</b></span>
          <el-tag :type="activeSnapshot.direction === 'forward' ? 'success' : 'danger'" size="small">{{ activeSnapshot.direction === 'forward' ? '正向供电' : '反向倒送' }}</el-tag>
        </template>
        <el-button size="small" type="primary" @click="openEquipmentDrawer" :loading="drawerLoading">设备台账</el-button>
      </div>
    </div>

    <!-- 倒送事件明细（极端数据） -->
    <div v-if="backfeedEvents.length" class="chart-panel">
      <div class="chart-panel-title">倒送事件明细（{{ backfeedEvents.length }} 条）</div>
      <el-table :data="backfeedEvents" stripe size="small" max-height="400">
        <el-table-column prop="time" label="时间" width="170" />
        <el-table-column prop="activePowerKw" label="有功(kW)" width="120">
          <template #default="{ row }"><span style="color:#f56c6c">{{ row.activePowerKw.toFixed(1) }}</span></template>
        </el-table-column>
        <el-table-column prop="reactivePowerKvar" label="无功(kvar)" width="120" />
        <el-table-column prop="apparentPowerKva" label="视在(kVA)" width="120" />
        <el-table-column label="方向" width="80">
          <template #default="{ row }">
            <el-tag type="danger" size="small">反向倒送</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 设备台账 + 实时运行状态 Drawer -->
    <el-drawer v-model="drawerVisible" title="设备台账与实时运行状态" direction="rtl" size="600px">
      <template v-if="activeStation">
        <div style="margin-bottom:12px;color:#606266;font-size:13px">
          <div style="font-weight:600;font-size:15px">{{ activeStation.stationName }}</div>
          <div>装机容量：{{ activeStation.installedCapacityMw }}MW | 并网电压：{{ activeStation.gridConnectionVoltageKv }}kV</div>
        </div>
        <!-- 实时运行状态 -->
        <div v-if="activeSnapshot" style="margin-bottom:16px;background:#f5f7fa;padding:10px 12px;border-radius:4px;font-size:13px">
          <div style="font-weight:600;margin-bottom:6px">实时运行状态</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <span>有功 P：<b :style="{ color: activeSnapshot.activePowerKw >= 0 ? '#67c23a' : '#f56c6c' }">{{ activeSnapshot.activePowerKw.toFixed(1) }} kW</b></span>
            <span>无功 Q：{{ activeSnapshot.reactivePowerKvar.toFixed(1) }} kvar</span>
            <span>视在 S：{{ activeSnapshot.apparentPowerKva.toFixed(1) }} kVA</span>
            <span>方向：<el-tag :type="activeSnapshot.direction === 'forward' ? 'success' : 'danger'" size="small">{{ activeSnapshot.direction === 'forward' ? '正向供电' : '反向倒送' }}</el-tag></span>
          </div>
          <div style="color:#909399;font-size:11px;margin-top:4px">数据时间：{{ activeSnapshot.time }}</div>
        </div>
      </template>

      <div v-for="eq in equipmentList" :key="eq.id" style="margin-bottom:12px;border:1px solid #e4e7ed;border-radius:4px;padding:10px 12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-weight:600;font-size:13px">{{ eq.name }}</span>
          <el-tag size="small">{{ typeLabelMap[eq.type] || eq.type }}</el-tag>
        </div>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item :label="(paramLabelMap[eq.type] || paramLabelMap.TRANSFORMER).label">
            {{ (paramLabelMap[eq.type] || paramLabelMap.TRANSFORMER).value(eq) }} {{ (paramLabelMap[eq.type] || paramLabelMap.TRANSFORMER).unit }}
          </el-descriptions-item>
          <el-descriptions-item label="额定电压">{{ eq.voltageKv }} kV</el-descriptions-item>
        </el-descriptions>
        <div v-if="hasPowerData(eq)" style="margin-top:6px;font-size:12px;color:#606266">
          <span style="font-weight:600;color:#303133">实时功率：</span>
          <span>P <b :style="{ color: (eq.activePowerKw ?? 0) >= 0 ? '#67c23a' : '#f56c6c' }">{{ (eq.activePowerKw ?? 0).toFixed(1) }} kW</b></span>
          <span style="margin-left:8px">Q {{ (eq.reactivePowerKvar ?? 0).toFixed(1) }} kvar</span>
          <span style="margin-left:8px">S {{ (eq.apparentPowerKva ?? 0).toFixed(1) }} kVA</span>
        </div>
        <div v-if="eq.reliability != null" style="margin-top:6px;font-size:12px">
          <span style="color:#909399">可靠性：</span>
          <span :style="{ color: eq.reliability >= 0.9 ? '#67c23a' : eq.reliability >= 0.8 ? '#e6a23c' : '#f56c6c' }">{{ (eq.reliability * 100).toFixed(1) }}%</span>
          <span v-if="eq.grade" style="margin-left:6px;color:#909399">| 评级：{{ eq.grade }}</span>
        </div>
      </div>

      <div v-if="!equipmentList.length && !drawerLoading" style="text-align:center;color:#909399;padding:40px">暂无设备数据</div>
    </el-drawer>
  </div>
</template>
