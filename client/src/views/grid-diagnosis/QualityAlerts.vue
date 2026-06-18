<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchAlerts, acknowledgeAlert, fetchStations } from '@/api/grid-diagnosis'
import { POWER_QUALITY_ALERT_TYPES } from '@new-energy/shared'

const router = useRouter()
const loading = ref(false)
const alerts = ref<any[]>([])
const stationMap = ref<Record<string, string>>({})
const thresholds = reactive([
  { indicator: '电压波动率', key: 'voltage', level1: 3, level2: 5, level3: 7, unit: '%' },
  { indicator: '实际可靠性率', key: 'reliability', level1: 99.999, level2: 99.990, level3: 99.950, unit: '%' },
])

onMounted(async () => {
  const saved = localStorage.getItem('alert_thresholds_v3')
  if (saved) {
    try { const vals = JSON.parse(saved); thresholds.forEach((t, i) => { if (vals[i]) Object.assign(t, vals[i]) }) } catch {}
  }
  // 加载电站映射表
  try {
    const list = await fetchStations()
    if (list) list.forEach((s: any) => { stationMap.value[s.id] = s.stationName || s.station_name })
  } catch {}
  await loadData()
})

async function loadData() {
  loading.value = true
  const data = await fetchAlerts({ limit: 200 })
  alerts.value = (data || []).filter((a: any) =>
    (POWER_QUALITY_ALERT_TYPES as readonly string[]).includes(a.source_type)
  ).map((a: any, i: number) => {
    const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata || '{}') : (a.metadata || {})
    // 关联设备：优先取metadata中的名称，否则从source_id查电站表
    const stationName = meta.stationName || stationMap.value[a.source_id] || ''
    return {
      ...a,
      _no: `ALT-${(a.triggered_at || '').slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      _levelLabel: a.alert_level === 'CRITICAL' ? '三级' : a.alert_level === 'WARN' ? '二级' : '一级',
      _sourceLabel: (({ VOLTAGE_FLUCTUATION: '电压波动率', POWER_SUPPLY_RELIABILITY: '实际可靠性率' }) as Record<string, string>)[a.source_type] || a.source_type,
      _stationName: stationName,
      _pvOutput: meta.activePowerKw != null ? `${meta.activePowerKw} kW` : '-',
      _load: meta.loadKw != null ? `${meta.loadKw} kW` : '-',
      _fluctuation: meta.fluctuationPct != null ? `${meta.fluctuationPct}%` : meta.reliabilityPct != null ? `${meta.reliabilityPct}%` : '-',
      _hasCurve: a.source_type === 'VOLTAGE_FLUCTUATION' && meta.stationId,
      _curveParams: {
        pointId: meta.stationId || a.source_id,
        date: (a.triggered_at || '').slice(0, 10),
      },
    }
  })
  loading.value = false
}

function goVoltageCurve(row: any) {
  const p = row._curveParams
  if (p?.pointId) {
    router.push({
      path: '/grid-diagnosis/power-quality/fluctuation',
      query: { pointId: p.pointId, date: p.date },
    })
  }
}

function saveThresholds() {
  localStorage.setItem('alert_thresholds_v3', JSON.stringify(thresholds.map(t => ({
    level1: t.level1, level2: t.level2, level3: t.level3,
  }))))
  ElMessage.success('阈值已保存')
}

async function handleAck(row: any) {
  await acknowledgeAlert(row.id)
  row.acknowledged_at = new Date().toISOString()
  ElMessage.success('已确认')
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">供电质量预警机制</div>

    <div class="chart-panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px 4px 16px">
        <span style="font-size:14px;font-weight:600;color:#303133">多级预警阈值设置</span>
        <el-button type="primary" size="small" @click="saveThresholds">保存阈值</el-button>
      </div>
      <el-table :data="thresholds" size="small" stripe>
        <el-table-column prop="indicator" label="指标" width="120" />
        <el-table-column label="一级(注意)" width="140">
          <template #default="{ $index }">
            <template v-if="$index === 0">
              <el-input-number v-model="thresholds[$index].level1" :min="0.1" :max="100" :step="0.5" size="small" style="width:100px" /> {{ thresholds[$index].unit }}
            </template>
            <template v-else>
              <el-input-number v-model="thresholds[$index].level1" :min="90" :max="100" :step="0.001" :precision="3" size="small" style="width:100px" /> {{ thresholds[$index].unit }}
            </template>
          </template>
        </el-table-column>
        <el-table-column label="二级(警告)" width="140">
          <template #default="{ $index }">
            <template v-if="$index === 0">
              <el-input-number v-model="thresholds[$index].level2" :min="0.1" :max="100" :step="0.5" size="small" style="width:100px" /> {{ thresholds[$index].unit }}
            </template>
            <template v-else>
              <el-input-number v-model="thresholds[$index].level2" :min="90" :max="100" :step="0.001" :precision="3" size="small" style="width:100px" /> {{ thresholds[$index].unit }}
            </template>
          </template>
        </el-table-column>
        <el-table-column label="三级(严重)" width="140">
          <template #default="{ $index }">
            <template v-if="$index === 0">
              <el-input-number v-model="thresholds[$index].level3" :min="0.1" :max="100" :step="0.5" size="small" style="width:100px" /> {{ thresholds[$index].unit }}
            </template>
            <template v-else>
              <el-input-number v-model="thresholds[$index].level3" :min="90" :max="100" :step="0.001" :precision="3" size="small" style="width:100px" /> {{ thresholds[$index].unit }}
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="chart-panel">
      <div style="font-size:14px;font-weight:600;padding:8px 16px 4px 16px;color:#303133">预警通知与信息展示</div>
      <el-table :data="alerts" size="small" stripe height="380">
        <el-table-column prop="_no" label="编号" width="160" />
        <el-table-column prop="triggered_at" label="发生时间" width="170" />
        <el-table-column label="等级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.alert_level === 'CRITICAL' ? 'danger' : row.alert_level === 'WARN' ? 'warning' : 'info'" size="small">{{ row._levelLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="_sourceLabel" label="指标" width="90" />
        <el-table-column prop="_stationName" label="关联电站" width="150" show-overflow-tooltip />
        <el-table-column prop="title" label="告警内容" min-width="180" show-overflow-tooltip />
        <el-table-column prop="_fluctuation" label="偏差值" width="90" />
        <el-table-column prop="_pvOutput" label="光伏出力" width="110" />
        <el-table-column prop="_load" label="负荷" width="100" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.acknowledged_at ? 'success' : 'danger'" size="small">{{ row.acknowledged_at ? '已确认' : '待处理' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row._hasCurve" type="primary" link size="small" @click="goVoltageCurve(row)">电压曲线</el-button>
            <el-button v-if="!row.acknowledged_at" type="primary" link size="small" @click="handleAck(row)">确认</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
