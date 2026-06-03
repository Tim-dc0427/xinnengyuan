<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/grid-diagnosis/power-generation'
const tabs = [
  { path: 'stats', label: '发电量统计分析' },
  { path: 'factors', label: '出力影响因素分析' },
  { path: 'extreme', label: '极端场景模拟分析' },
  { path: 'carbon', label: '碳排放量统计分析' },
  { path: 'joint', label: '光储联合出力分析' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
