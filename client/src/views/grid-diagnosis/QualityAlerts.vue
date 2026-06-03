<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAlerts, acknowledgeAlert } from '@/api/grid-diagnosis'

const loading = ref(false)
const alerts = ref<any[]>([])
const thresholds = reactive([
  { indicator: '电压波动率', key: 'voltage', level1: 3, level2: 5, level3: 7, unit: '%' },
  { indicator: '频率偏差', key: 'frequency', level1: 0.2, level2: 0.5, level3: 1.0, unit: 'Hz' },
  { indicator: '功率因数', key: 'powerFactor', level1: 0.9, level2: 0.85, level3: 0.8, unit: '' },
])

onMounted(async () => {
  const saved = localStorage.getItem('alert_thresholds_v2')
  if (saved) {
    try { const vals = JSON.parse(saved); thresholds.forEach((t, i) => { if (vals[i]) Object.assign(t, vals[i]) }) } catch {}
  }
  await loadData()
})

async function loadData() {
  loading.value = true
  const data = await fetchAlerts({ limit: 200 })
  alerts.value = (data || []).filter((a: any) =>
    ['VOLTAGE_FLUCTUATION', 'FREQUENCY_DEVIATION', 'POWER_FACTOR'].includes(a.source_type)
  ).map((a: any, i: number) => {
    const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata || '{}') : (a.metadata || {})
    return {
      ...a,
      _no: `ALT-${(a.triggered_at || '').slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      _levelLabel: a.alert_level === 'CRITICAL' ? '三级' : a.alert_level === 'WARN' ? '二级' : '一级',
      _sourceLabel: (({ VOLTAGE_FLUCTUATION: '电压波动', FREQUENCY_DEVIATION: '频率偏差', POWER_FACTOR: '功率因数' }) as Record<string, string>)[a.source_type] || a.source_type,
      _pvOutput: meta.activePowerKw != null ? `${meta.activePowerKw}kW` : '-',
      _load: meta.loadKw != null ? `${meta.loadKw}kW` : '-',
      _fluctuation: meta.fluctuationPct != null ? `${meta.fluctuationPct}%` : meta.freqDeviationHz != null ? `${meta.freqDeviationHz}Hz` : meta.powerFactor != null ? `${meta.powerFactor}` : '-',
    }
  })
  loading.value = false
}

function saveThresholds() {
  localStorage.setItem('alert_thresholds_v2', JSON.stringify(thresholds.map(t => ({
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
        <el-table-column label="一级(注意)" width="130">
          <template #default="{ $index }">
            <el-input-number v-model="thresholds[$index].level1" :min="0.1" :max="100" :step="0.5" size="small" style="width:90px" /> {{ thresholds[$index].unit }}
          </template>
        </el-table-column>
        <el-table-column label="二级(警告)" width="130">
          <template #default="{ $index }">
            <el-input-number v-model="thresholds[$index].level2" :min="0.1" :max="100" :step="0.5" size="small" style="width:90px" /> {{ thresholds[$index].unit }}
          </template>
        </el-table-column>
        <el-table-column label="三级(严重)" width="130">
          <template #default="{ $index }">
            <el-input-number v-model="thresholds[$index].level3" :min="0.1" :max="100" :step="0.5" size="small" style="width:90px" /> {{ thresholds[$index].unit }}
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
        <el-table-column prop="title" label="告警内容" min-width="150" />
        <el-table-column prop="_fluctuation" label="偏差值" width="90" />
        <el-table-column prop="_pvOutput" label="光伏出力" width="100" />
        <el-table-column prop="_load" label="负荷" width="90" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.acknowledged_at ? 'success' : 'danger'" size="small">{{ row.acknowledged_at ? '已确认' : '待处理' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.acknowledged_at" type="primary" link size="small" @click="handleAck(row)">确认</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
