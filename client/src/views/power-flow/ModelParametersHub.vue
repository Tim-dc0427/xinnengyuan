<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/power-flow/model-params'
const tabs = [
  { path: 'management', label: '参数管理' },
  { path: 'versioning', label: '参数版本控制' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
