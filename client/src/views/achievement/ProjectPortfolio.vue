<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/achievement/projects'
const tabs = [
  { path: 'type-mgmt', label: '光伏项目类型兼容' },
  { path: 'access-conditions', label: '接入条件数字化管理' },
  { path: 'feasibility', label: '并网可行性综合分析' },
  { path: 'effectiveness', label: '项目成效验证评估' },
  { path: 'traceability', label: '项目留痕与追溯' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
