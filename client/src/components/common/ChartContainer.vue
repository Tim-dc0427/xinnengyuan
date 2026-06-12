<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart, ScatterChart, RadarChart, GaugeChart, HeatmapChart, GraphChart, TreeChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent,
} from 'echarts/components'

use([
  CanvasRenderer, LineChart, BarChart, PieChart, ScatterChart, RadarChart, GaugeChart, HeatmapChart, GraphChart, TreeChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent,
])

const props = withDefaults(defineProps<{
  option: Record<string, unknown>
  height?: string
  loading?: boolean
}>(), {
  height: '400px',
  loading: false,
})

const emit = defineEmits<{
  chartClick: [params: any]
}>()

const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const echartsInst = ref<any>(null)  // ref 而非 shallowRef，确保 defineExpose 自动解包

let pollTimer: ReturnType<typeof setInterval> | null = null

function tryGetInstance() {
  const vchart = chartRef.value as any
  if (!vchart) return
  const inst = vchart.chart?.value ?? vchart.chart
  if (inst && typeof inst.setOption === 'function' && inst !== echartsInst.value) {
    echartsInst.value = inst
    return true
  }
  return false
}

watch(chartRef, () => {
  if (chartRef.value) {
    tryGetInstance()
    if (!echartsInst.value) {
      pollTimer = setInterval(() => { if (tryGetInstance()) clearInterval(pollTimer!) }, 100)
    }
  }
})

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

defineExpose({ chartRef, echartsInst })
</script>

<template>
  <div class="chart-container">
    <div v-if="loading" class="chart-loading">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>
    <VChart
      v-else
      ref="chartRef"
      :option="option"
      :style="{ height }"
      autoresize
      @click="(p: any) => emit('chartClick', p)"
    />
  </div>
</template>

<style scoped>
.chart-container { position: relative; width: 100%; }
.chart-loading { display: flex; align-items: center; justify-content: center; height: v-bind(height); }
</style>
