<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/power-flow/data-validation'
const tabs = [
  { path: 'pv-completeness', label: '光伏数据完整性校验' },
  { path: 'boundary', label: '边界条件合理性校验' },
  { path: 'time-sync', label: '时序数据一致性校验' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
