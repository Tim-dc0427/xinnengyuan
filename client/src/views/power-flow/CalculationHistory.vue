<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/power-flow/history'
const tabs = [
  { path: 'management', label: '历史记录管理' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
