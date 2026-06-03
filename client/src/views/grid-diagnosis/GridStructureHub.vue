<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/grid-diagnosis/grid-structure'
const tabs = [
  { path: 'backfeed', label: '光伏倒送场景判断' },
  { path: 'capacity', label: '设备承载力量化计算' },
  { path: 'reliability', label: '设备可靠性评估' },
  { path: 'lifecycle', label: '设备寿命周期管理' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
