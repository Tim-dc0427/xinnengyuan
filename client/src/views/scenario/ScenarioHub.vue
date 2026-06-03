<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/resources/scenarios'
const tabs = [
  { path: 'management', label: '互动场景管理' },
  { path: 'strategy', label: '互动场景策略管理' },
  { path: 'simulation', label: '场景模拟与验证' },
  { path: 'evaluation', label: '场景执行效果评估' },
  { path: 'intervention', label: '场景策略人工干预' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
