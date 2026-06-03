<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import ChartContainer from '@/components/common/ChartContainer.vue'
import StationMap from '@/components/common/StationMap.vue'
import { fetchStations, fetchStationsSnapshot, fetchEquipmentCapacity, fetchEquipmentLifecycle, predictLife, generateReplacementPlan } from '@/api/grid-diagnosis'
import type { StationOption, StationSnapshot, EquipmentCapacityResult, EquipmentLifecycle, ReplacementPlan } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const snapshots = ref<StationSnapshot[]>([])
const equipmentList = ref<EquipmentCapacityResult[]>([])
const selectedStationId = ref<string | null>(null)
const selectedEquipmentId = ref('')
const loading = ref(false)

const lifecycleEvents = ref<EquipmentLifecycle[]>([])
const prediction = ref<any>(null)
const replacementPlans = ref<ReplacementPlan[]>([])
const predicting = ref(false)
const planning = ref(false)

const typeLabelMap: Record<string, string> = { TRANSFORMER: '变压器', BREAKER: '断路器', CABLE: '电缆', SWITCH: '开关设备', INVERTER: '逆变器', BATTERY: '储能电池' }

fetchStations().then((data) => { stations.value = data })
fetchStationsSnapshot().then((data) => { snapshots.value = data })

const selectedStation = computed(() => stations.value.find((s) => s.id === selectedStationId.value))
const activeSnapshot = computed(() => snapshots.value.find((s) => s.stationId === selectedStationId.value))

async function loadEquipment() {
  if (!selectedStationId.value) { equipmentList.value = []; return }
  loading.value = true
  try {
    const data = await fetchEquipmentCapacity({ stationId: selectedStationId.value })
    equipmentList.value = data
  } catch {
    ElMessage.error('加载设备数据失败')
  } finally {
    loading.value = false
  }
}

function onMapSelect(id: string | null) {
  selectedStationId.value = id
  selectedEquipmentId.value = ''
  lifecycleEvents.value = []
  prediction.value = null
  if (id) loadEquipment()
  else equipmentList.value = []
}

async function selectEquipment(id: string) {
  selectedEquipmentId.value = id
  lifecycleEvents.value = []
  prediction.value = null
  if (!id) return
  try {
    lifecycleEvents.value = await fetchEquipmentLifecycle(id)
  } catch { /* ignore */ }
}

const selectedEquipment = computed(() => equipmentList.value.find((e) => e.equipmentId === selectedEquipmentId.value))

async function runPredict() {
  if (!selectedEquipmentId.value) return
  predicting.value = true
  try {
    prediction.value = await predictLife({ equipmentId: selectedEquipmentId.value })
  } catch {
    ElMessage.error('寿命预测失败')
  } finally { predicting.value = false }
}

async function runReplacementPlan() {
  planning.value = true
  try {
    const plans = await generateReplacementPlan({
      plantId: selectedStationId.value || undefined,
    })
    replacementPlans.value = plans
    if (plans.length === 0) {
      ElMessage.info('当前无需要更换的设备（SOH 均高于 85%）')
    } else {
      ElMessage.success(`生成 ${plans.length} 条更换计划`)
    }
  } catch {
    ElMessage.error('更换计划生成失败')
  } finally { planning.value = false }
}

const degradChartOption = computed(() => {
  const history = prediction.value?.monthlyHistory
  if (!history?.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: history.map((h: any) => h.month), axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: 'SOH(%)', min: 75, max: 100 },
    series: [{
      type: 'line', data: history.map((h: any) => h.sohPct), smooth: true,
      markLine: { silent: true, data: [{ yAxis: 80, label: { formatter: '失效阈值' }, lineStyle: { color: '#f56c6c', type: 'dashed' } }] },
    }],
    grid: { top: 20, right: 20, bottom: 60, left: 50 },
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">设备寿命周期管理</div>

    <!-- 地图选电站 -->
    <div class="chart-panel" style="padding:0;overflow:hidden">
      <StationMap
        :stations="stations"
        :snapshots="[]"
        :active-id="selectedStationId"
        @select="onMapSelect"
      />
    </div>

    <!-- 选中电站 + 设备选择 -->
    <div class="chart-panel">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <template v-if="selectedStation">
          <span style="font-weight:600">{{ selectedStation.stationName }}</span>
          <span style="color:#606266">区域：{{ selectedStation.zone }}</span>
          <span style="color:#606266">装机：{{ selectedStation.installedCapacityMw }}MW</span>
        </template>
        <span v-else style="color:#909399">点击地图上的电站标记，查看该站设备</span>
        <template v-if="equipmentList.length">
          <el-divider direction="vertical" />
          <span>选择设备：</span>
          <el-select v-model="selectedEquipmentId" placeholder="选择设备" clearable style="width:240px" size="small" @change="selectEquipment">
            <el-option v-for="e in equipmentList" :key="e.equipmentId" :label="e.equipmentName" :value="e.equipmentId" />
          </el-select>
        </template>
      </div>
    </div>

    <!-- 实时运行数据 -->
    <div v-if="activeSnapshot && selectedStation" class="chart-panel">
      <div class="chart-panel-title">实时运行数据</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px">
        <span>有功 P：<b :style="{ color: activeSnapshot.activePowerKw >= 0 ? '#67c23a' : '#f56c6c' }">{{ activeSnapshot.activePowerKw.toFixed(1) }} kW</b></span>
        <span>无功 Q：<b>{{ activeSnapshot.reactivePowerKvar.toFixed(1) }} kvar</b></span>
        <span>视在 S：<b>{{ activeSnapshot.apparentPowerKva.toFixed(1) }} kVA</b></span>
        <span>方向：<el-tag :type="activeSnapshot.direction === 'forward' ? 'success' : 'danger'" size="small">{{ activeSnapshot.direction === 'forward' ? '正向供电' : '反向倒送' }}</el-tag></span>
        <span style="color:#909399">数据时间：{{ activeSnapshot.time }}</span>
      </div>
      <div style="color:#909399;font-size:11px;margin-top:4px">
        负载率约 {{ (activeSnapshot.apparentPowerKva / (selectedStation.installedCapacityMw * 1000 / 0.9) * 100).toFixed(1) }}%（视在功率 / 光伏接入容量），该负载水平直接影响设备老化和寿命
      </div>
    </div>

    <!-- 设备全生命周期数据 -->
    <div v-if="selectedEquipment" class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">设备铭牌参数</div>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="设备名称">{{ selectedEquipment.equipmentName }}</el-descriptions-item>
          <el-descriptions-item label="设备类型">{{ typeLabelMap[selectedEquipment.equipmentType] || selectedEquipment.equipmentType }}</el-descriptions-item>
          <el-descriptions-item label="型号">{{ selectedEquipment.modelNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="厂家">{{ selectedEquipment.manufacturer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="额定容量(kVA)">{{ selectedEquipment.ratedCapacityKva }}</el-descriptions-item>
          <el-descriptions-item label="额定电压(kV)">{{ selectedEquipment.ratedVoltageKv }}</el-descriptions-item>
          <el-descriptions-item label="额定电流(A)">{{ selectedEquipment.ratedCurrentA }}</el-descriptions-item>
          <el-descriptions-item label="投运日期">{{ selectedEquipment.installationDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="设计寿命(年)">{{ selectedEquipment.designLifeYears }}</el-descriptions-item>
          <el-descriptions-item label="可靠性等级">{{ selectedEquipment.grade }}级</el-descriptions-item>
          <el-descriptions-item label="所属电站">{{ selectedEquipment.stationName }}</el-descriptions-item>
          <el-descriptions-item label="装机容量(MW)">{{ selectedEquipment.stationCapacityMw }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="chart-panel">
        <div class="chart-panel-title">历史事件记录</div>
        <el-table v-if="lifecycleEvents.length" :data="lifecycleEvents" stripe size="small" max-height="280">
          <el-table-column prop="event_date" label="日期" width="120" />
          <el-table-column prop="event_type" label="事件类型" width="100" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="cost" label="费用(元)" width="100" />
          <el-table-column prop="performed_by" label="操作人" width="100" />
        </el-table>
        <div v-else style="color:#c0c4cc;text-align:center;padding:40px">暂无历史事件记录</div>
      </div>
    </div>

    <!-- 剩余寿命预测 -->
    <div v-if="selectedEquipment" class="chart-panel">
      <div class="chart-panel-title">设备剩余寿命预测</div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
        <el-button type="primary" size="small" :loading="predicting" @click="runPredict">执行预测</el-button>
      </div>
      <div v-if="prediction" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
        <el-tag>已运行：{{ prediction.currentAgeYears }} 年</el-tag>
        <el-tag>设计寿命：{{ prediction.designLifeYears }} 年</el-tag>
        <el-tag type="warning">剩余寿命：{{ prediction.remainingLifeYears }} 年</el-tag>
        <el-tag v-if="prediction.isBattery" type="warning">当前SOH：{{ prediction.sohPct }}%</el-tag>
        <el-tag v-if="prediction.replacementDate">建议更换：{{ prediction.replacementDate }}</el-tag>
      </div>
      <!-- 老化速率与运行环境影响 -->
      <div v-if="prediction" style="background:#fafafa;border:1px solid #e4e7ed;border-radius:4px;padding:10px 14px;font-size:12px;margin-bottom:12px">
        <div style="font-weight:600;margin-bottom:4px">老化速率与环境参数</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;line-height:1.8">
          <span>月均老化率：<b>{{ prediction.degradationRate }}</b> SOH%/月</span>
          <span v-if="activeSnapshot">当前负载率：<b>{{ (activeSnapshot.apparentPowerKva / (selectedStation!.installedCapacityMw * 1000 / 0.9) * 100).toFixed(1) }}%</b></span>
          <span>剩余预估循环：<b>{{ prediction.cumulativeCycles || '-' }}</b> 次</span>
          <span v-if="prediction.estimatedRemainingMonths">预计失效：<b style="color:#e6a23c">{{ prediction.estimatedRemainingMonths }} 个月后</b></span>
        </div>
        <div style="color:#909399;margin-top:4px">老化模型：Arrhenius 温度加速 + 循环次数线性衰减。月均退化 = 基础退化率 × (1 + 0.02 × (T-25)) × (1 + 0.01 × 负载率%)</div>
      </div>
      <div v-if="prediction?.monthlyHistory?.length" style="display:flex;gap:16px">
        <div style="flex:1">
          <ChartContainer :option="degradChartOption" height="300px" />
        </div>
        <div style="width:280px">
          <el-table :data="prediction.monthlyHistory.slice(-6)" stripe size="small">
            <el-table-column prop="month" label="月份" width="100" />
            <el-table-column prop="sohPct" label="SOH(%)" width="80" />
            <el-table-column prop="cycleCount" label="循环次数" />
          </el-table>
        </div>
      </div>
    </div>

    <!-- 设备更换计划 -->
    <div class="chart-panel">
      <div class="chart-panel-title">设备更换计划</div>
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <el-button type="primary" size="small" :loading="planning" :disabled="!selectedStationId" @click="runReplacementPlan">生成更换计划</el-button>
        <span v-if="!selectedStationId" style="color:#909399;font-size:12px">请先在地图上选择电站</span>
        <span v-else-if="replacementPlans.length" style="font-size:12px;color:#606266">共 {{ replacementPlans.length }} 条，按优先级排序</span>
      </div>
      <el-table v-if="replacementPlans.length" :data="replacementPlans" stripe size="small" max-height="400">
        <el-table-column prop="equipmentName" label="设备名称" width="150" />
        <el-table-column label="设备类型" width="90">
          <template #default="{ row }">{{ typeLabelMap[row.equipmentType] || row.equipmentType || '-' }}</template>
        </el-table-column>
        <el-table-column prop="plantName" label="所属电站" width="140" />
        <el-table-column label="重要性" width="80">
          <template #default="{ row }">
            <el-tag :type="row.importance === '主干' ? 'danger' : 'info'" size="small">{{ row.importance || '分支' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="剩余寿命" width="100">
          <template #default="{ row }">
            <span v-if="row.currentSoh != null">{{ row.currentSoh.toFixed(1) }}%</span>
            <span v-else-if="row.remainingLifePct != null" :style="{ color: row.remainingLifePct < 20 ? '#f56c6c' : row.remainingLifePct < 40 ? '#e6a23c' : '#606266' }">{{ row.remainingLifePct }}%</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.priority === 1 ? 'danger' : row.priority === 2 ? 'warning' : row.priority === 3 ? '' : 'info'" size="small">P{{ row.priority }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="更换原因" min-width="220" />
        <el-table-column prop="suggestedDate" label="建议更换日期" width="120" />
        <el-table-column label="预估费用" width="120">
          <template #default="{ row }">{{ row.estimatedCost?.toLocaleString() }} 元</template>
        </el-table-column>
      </el-table>
      <div v-else-if="!planning" style="color:#c0c4cc;text-align:center;padding:20px">点击"生成更换计划"按钮查看结果</div>
    </div>
  </div>
</template>
