<script setup lang="ts">
import { ref } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart, ScatterChart, RadarChart, GaugeChart, HeatmapChart, GraphChart, TreeChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent, VisualMapComponent,
} from 'echarts/components'

use([
  CanvasRenderer, LineChart, BarChart, PieChart, ScatterChart, RadarChart, GaugeChart, HeatmapChart, GraphChart, TreeChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent, VisualMapComponent,
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
defineExpose({ chartRef })
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
.chart-container {
  position: relative;
  width: 100%;
}
.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: v-bind(height);
}
</style>
