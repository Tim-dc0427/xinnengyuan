<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/power-flow/online'
const tabs = [
  { path: 'standard', label: '潮流计算支持' },
  { path: 'reverse', label: '反向潮流计算支持' },
  { path: 'probabilistic', label: '概率潮流计算支持' },
  { path: 'three-phase', label: '三相潮流计算支持' },
  { path: 'tasks', label: '异步计算及进度跟踪' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
