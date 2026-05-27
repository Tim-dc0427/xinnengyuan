<script setup lang="ts">
defineProps<{
  items: Array<{
    label: string
    value: string | number
    unit?: string
    type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  }>
}>()
</script>

<template>
  <div class="result-summary">
    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="summary-card"
      :class="item.type ? `card-${item.type}` : ''"
    >
      <div class="card-label">{{ item.label }}</div>
      <div class="card-value">
        {{ item.value }}
        <span v-if="item.unit" class="card-unit">{{ item.unit }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}
.summary-card {
  flex: 1;
  min-width: 140px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px 20px;
  text-align: center;
  border-left: 3px solid #267F7B;
}
.summary-card.card-success { border-left-color: #67C23A; }
.summary-card.card-warning { border-left-color: #E6A23C; }
.summary-card.card-danger { border-left-color: #F56C6C; }
.summary-card.card-info { border-left-color: #909399; }
.card-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.card-value {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}
.card-unit {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
  margin-left: 4px;
}
</style>
