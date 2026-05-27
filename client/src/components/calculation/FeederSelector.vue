<script setup lang="ts">
defineProps<{
  feederZoneOptions: string[]
  feederOptions: Array<{ value: string; label: string }>
  selectedFeederIds: string[]
  feederZoneFilter: string
}>()

const emit = defineEmits<{
  'update:selectedFeederIds': [value: string[]]
  'update:feederZoneFilter': [value: string]
  selectAll: []
  deselectAll: []
}>()
</script>

<template>
  <div class="filter-group">
    <el-tooltip content="按区域筛选馈线" placement="top">
      <span class="filter-label">区域：</span>
    </el-tooltip>
    <el-select
      :model-value="feederZoneFilter"
      size="small"
      clearable
      placeholder="全部区域"
      style="width: 110px"
      @update:model-value="$emit('update:feederZoneFilter', $event || '')"
      @change="$emit('deselectAll')"
    >
      <el-option v-for="z in feederZoneOptions" :key="z" :label="z" :value="z" />
    </el-select>
    <el-tooltip content="选择馈线后自动确定接入光伏电站并裁剪拓扑，留空则使用全部电网" placement="top">
      <span class="filter-label">馈线：</span>
    </el-tooltip>
    <el-select
      :model-value="selectedFeederIds"
      multiple
      collapse-tags
      collapse-tags-tooltip
      size="small"
      style="width: 340px"
      placeholder="选择馈线（可选）"
      @update:model-value="$emit('update:selectedFeederIds', $event)"
    >
      <el-option v-for="opt in feederOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>
    <el-button size="small" @click="$emit('selectAll')">全选</el-button>
    <el-button size="small" @click="$emit('deselectAll')">清空</el-button>
  </div>
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #606266; white-space: nowrap; }
</style>
