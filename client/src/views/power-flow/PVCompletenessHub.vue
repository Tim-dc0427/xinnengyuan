<script setup lang="ts">
import { reactive, provide } from 'vue'
import HubLayout from '@/components/common/HubLayout.vue'
import { checkPVCompleteness } from '@/api/data-validation'
import { COMPLETENESS_KEY } from './pv-completeness-key'

const basePath = '/power-flow/data-validation/pv-completeness'
const tabs = [
  { path: 'check', label: '数据完整性校验维度' },
  { path: 'report', label: '数据质量报告生成' },
]

const state = reactive<{ result: any; loading: boolean }>({ result: null, loading: false })

async function runCheck() {
  if (state.loading) return
  state.loading = true
  try {
    state.result = await checkPVCompleteness()
  } finally {
    state.loading = false
  }
}

provide(COMPLETENESS_KEY, { state, runCheck })
</script>

<template>
  <HubLayout :base-path="basePath" :tabs="tabs" />
</template>
