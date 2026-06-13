<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/power-flow/batch'
const tabs = [
  { path: 'config', label: '参数配置' },
  { path: 'monitor', label: '任务监控' },
  { path: 'results', label: '批量结果汇总分析' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
