<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/power-flow/indicators'
const tabs = [
  { path: 'overview', label: '综合概览' },
  { path: 'voltage-stability', label: '节点电压稳定性' },
  { path: 'imbalance', label: '三相不平衡度' },
  { path: 'thresholds', label: '阈值配置' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
