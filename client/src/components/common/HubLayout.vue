<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface TabItem {
  path: string
  label: string
}

const props = defineProps<{
  basePath: string
  tabs: TabItem[]
}>()

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => {
  const segments = route.path.split('/')
  const last = segments[segments.length - 1]
  const match = props.tabs.find((t) => t.path === last)
  return match ? match.path : props.tabs[0]?.path ?? ''
})

function onTabChange(name: string) {
  router.push(`${props.basePath}/${name}`)
}

const showTabs = computed(() => props.tabs.length > 1)
</script>

<template>
  <div v-if="showTabs" class="hub-tabs-bar chart-panel">
    <el-tabs :model-value="activeTab" @tab-change="onTabChange">
      <el-tab-pane
        v-for="tab in tabs"
        :key="tab.path"
        :label="tab.label"
        :name="tab.path"
      />
    </el-tabs>
  </div>
  <router-view />
</template>

<style scoped>
.hub-tabs-bar {
  margin-bottom: 16px;
  border-radius: 8px;
  padding: 0 20px;
}

.hub-tabs-bar :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.hub-tabs-bar :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.hub-tabs-bar :deep(.el-tabs__item) {
  font-size: 14px;
  color: #606266;
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
}

.hub-tabs-bar :deep(.el-tabs__item.is-active) {
  color: #267F7B;
  font-weight: 600;
}

.hub-tabs-bar :deep(.el-tabs__active-bar) {
  background-color: #267F7B;
  height: 2px;
}
</style>
