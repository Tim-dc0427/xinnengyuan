<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/grid-diagnosis/power-quality'
const tabs = [
  { path: 'fluctuation', label: '并网点电压波动监测' },
  { path: 'reliability', label: '供电可靠性计算' },
  { path: 'qualification', label: '电压合格率统计' },
  { path: 'alerts', label: '供电质量预警机制' },
  { path: 'event-trace', label: '历史事件追溯分析' },
  { path: 'impact', label: '电压波动影响分析' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
