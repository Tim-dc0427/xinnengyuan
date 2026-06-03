<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchFactorAnalysis, fetchStations } from '@/api/grid-diagnosis'
import type { StationOption } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const selectedStation = ref('')
const dateRange = ref<[string, string]>(['2026-04-01', '2026-06-01'])
const loading = ref(false)
const factors = ref<any[]>([])
const activeFactor = ref('')

async function loadData() {
  if (!selectedStation.value) return
  loading.value = true
  try {
    const data = await fetchFactorAnalysis({
      stationId: selectedStation.value,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
    })
    factors.value = data || []
    if (factors.value.length > 0 && !activeFactor.value) activeFactor.value = factors.value[0].factorType
  } finally {
    loading.value = false
  }
}

const factorUnitMap: Record<string, string> = {
  irradiance: '辐照度 (W/m²)',
  temperature: '温度 (°C)',
  humidity: '湿度 (%)',
  inverter_efficiency: '逆变器效率',
  equipment_age: '运行年限 (年)',
}

function scatterOption(factor: any) {
  const unit = factorUnitMap[factor.factorType] || ''
  const data = (factor.chartData || []).map((d: any) => [d.x, d.y])
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => `${unit}: ${p.value[0]}<br/>出力: ${p.value[1]} kW` },
    xAxis: { type: 'value', name: unit },
    yAxis: { type: 'value', name: '出力 (kW)' },
    series: [{ type: 'scatter', data, symbolSize: 5 }],
  }
}

onMounted(async () => {
  stations.value = (await fetchStations()) || []
  if (stations.value.length > 0) {
    selectedStation.value = stations.value[0].id
    await loadData()
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">出力影响因素分析</div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">电站</span>
        <el-select v-model="selectedStation" size="small" style="width:280px" @change="loadData" filterable>
          <el-option v-for="s in stations" :key="s.id" :label="s.stationName" :value="s.id" />
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">日期范围</span>
        <el-date-picker v-model="dateRange[0]" type="date" value-format="YYYY-MM-DD" placeholder="开始" size="small" @change="loadData" style="width:130px" />
        <span style="color:#909399;margin:0 4px">至</span>
        <el-date-picker v-model="dateRange[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" size="small" @change="loadData" style="width:130px" />
      </div>
    </div>

    <!-- Tab页：每个因子单独分析 -->
    <div class="chart-panel" v-if="factors.length > 0">
      <el-tabs v-model="activeFactor" type="border-card">
        <el-tab-pane v-for="f in factors" :key="f.factorType" :label="f.factorLabel || f.factorType" :name="f.factorType">
          <div style="display:flex;gap:16px;margin-bottom:12px">
            <span>相关系数: <b>{{ f.correlationCoefficient?.toFixed(4) }}</b></span>
            <span>数据点数: <b>{{ f.chartData?.length || 0 }}</b></span>
            <span v-if="f.ageYears != null">设备运行年限: <b>{{ f.ageYears }} 年</b></span>
          </div>
          <ChartContainer :option="scatterOption(f)" height="350px" :loading="loading" />
          <div style="margin-top:8px;font-size:13px;color:#606266">{{ f.impactDescription }}</div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; gap:20px; flex-wrap:wrap; background:#f5f7fa; padding:10px 16px; border-radius:4px; margin-bottom:16px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-label { font-size:13px; color:#606266; white-space:nowrap; }
</style>
