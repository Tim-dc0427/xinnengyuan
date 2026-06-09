<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchFactorAnalysis, fetchStations } from '@/api/grid-diagnosis'
import type { StationOption } from '@new-energy/shared'

const stations = ref<StationOption[]>([])
const selectedStation = ref('')
const loading = ref(false)
const factors = ref<any[]>([])
const activeFactor = ref('')

async function loadData() {
  if (!selectedStation.value) return
  loading.value = true
  try {
    const data = await fetchFactorAnalysis({
      stationId: selectedStation.value,
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

function hasChartData(factor: any) {
  const isPrimary = factor.factorType === 'irradiance'
  return isPrimary
    ? (factor.chartData?.length || 0) > 0
    : (factor.normalizedChartData?.length || factor.chartData?.length || 0) > 0
}

function scatterOption(factor: any) {
  const unit = factorUnitMap[factor.factorType] || ''
  const label = factor.factorLabel || factor.factorType
  // 非光照因子用归一化数据（Y=出力/光照），消除光照主效应后偏相关关系肉眼可见
  const isPrimary = factor.factorType === 'irradiance'
  const source = isPrimary ? factor.chartData : (factor.normalizedChartData || factor.chartData)
  const data = (source || []).map((d: any) => [d.x, d.y])
  const yName = isPrimary ? '出力 (kW)' : '等效出力 (kW)'
  const tooltipFormatter = isPrimary
    ? (p: any) => `${unit}: ${p.value[0]}<br/>出力: ${p.value[1]} kW`
    : (p: any) => `${unit}: ${p.value[0]}<br/>等效出力: ${p.value[1]} kW`
  const rangeMap: Record<string, [number, number]> = {
    inverter_efficiency: [0.85, 1.0],
    humidity: [0, 100],
    irradiance: [0, 1200],
  }
  const xRange = rangeMap[factor.factorType]
  return {
    title: { text: `${label}与出力关系散点图`, left: 'center', textStyle: { fontSize: 14, fontWeight: 'normal', color: '#303133' } },
    tooltip: { trigger: 'item', formatter: tooltipFormatter },
    xAxis: { type: 'value', name: unit, ...(xRange ? { min: xRange[0], max: xRange[1] } : {}) },
    yAxis: { type: 'value', name: yName },
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
    </div>

    <!-- Tab页：每个因子单独分析 -->
    <div class="chart-panel" v-if="factors.length > 0">
      <el-tabs v-model="activeFactor" type="border-card">
        <el-tab-pane v-for="f in factors" :key="f.factorType" :label="f.factorLabel || f.factorType" :name="f.factorType">
          <template v-if="hasChartData(f)">
            <ChartContainer :option="scatterOption(f)" height="350px" :loading="loading" />
          </template>
          <template v-else>
            <div style="height:100px;display:flex;align-items:center;justify-content:center;color:#909399;font-size:14px;background:#fafafa;border-radius:4px">数据不足，无法生成图表</div>
          </template>
          <div style="margin-top:8px;font-size:13px;color:#606266">
            <div style="margin-bottom:6px">
              <span>{{ f.impactDescription }}</span>
              <span style="margin-left:16px">简单相关系数: <b>{{ f.correlationCoefficient?.toFixed(4) }}</b></span>
              <span style="margin-left:16px">偏相关系数: <b>{{ f.partialCorrelationCoefficient?.toFixed(4) }}</b></span>
            </div>
            <table style="border-collapse:collapse;margin-bottom:6px" v-if="f.controlDetails?.length">
              <thead>
                <tr style="background:#f5f7fa">
                  <th style="padding:4px 12px;text-align:left;font-weight:500;border:1px solid #e4e7ed">控制变量</th>
                  <th style="padding:4px 12px;text-align:right;font-weight:500;border:1px solid #e4e7ed">均值</th>
                  <th style="padding:4px 12px;text-align:right;font-weight:500;border:1px solid #e4e7ed">标准差</th>
                  <th style="padding:4px 12px;text-align:right;font-weight:500;border:1px solid #e4e7ed">最小值</th>
                  <th style="padding:4px 12px;text-align:right;font-weight:500;border:1px solid #e4e7ed">最大值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in f.controlDetails" :key="c.factorKey">
                  <td style="padding:4px 12px;border:1px solid #e4e7ed">{{ c.factorLabel }}{{ c.unit ? ' (' + c.unit + ')' : '' }}</td>
                  <td style="padding:4px 12px;text-align:right;border:1px solid #e4e7ed">{{ c.mean }}</td>
                  <td style="padding:4px 12px;text-align:right;border:1px solid #e4e7ed">{{ c.stdDev }}</td>
                  <td style="padding:4px 12px;text-align:right;border:1px solid #e4e7ed">{{ c.min }}</td>
                  <td style="padding:4px 12px;text-align:right;border:1px solid #e4e7ed">{{ c.max }}</td>
                </tr>
              </tbody>
            </table>
            <div style="display:flex;gap:20px">
              <span>数据点数: <b>{{ f.chartData?.length || 0 }}</b></span>
              <span v-if="f.ageYears != null">设备运行年限: <b>{{ f.ageYears }} 年</b></span>
            </div>
          </div>
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
