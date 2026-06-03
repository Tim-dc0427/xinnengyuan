<script setup lang="ts">
import HubLayout from '@/components/common/HubLayout.vue'

const basePath = '/planning/distribution'
const tabs = [
  { path: 'pv-model', label: '集中式光伏模型集成' },
  { path: 'site-planning', label: '布点规划智能推荐' },
  { path: 'absorption-scheme', label: '消纳方案智能编制' },
  { path: 'cost-analysis', label: '造价管理与经济性分析' },
  { path: 'equipment-ledger', label: '设备台账动态管理' },
]
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
