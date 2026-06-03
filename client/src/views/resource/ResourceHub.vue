<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/resources/hub'
const tabs = [
  { path: 'models', label: '资源模型构建' },
  { path: 'maintenance', label: '资源维护' },
  { path: 'topology', label: '资源关联关系' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
