<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  unit?: string
  trend?: number
  icon?: any
  color?: string
}>()
</script>

<template>
  <el-card class="stat-card" shadow="hover">
    <div class="stat-content">
      <div class="stat-info">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">
          <span class="value-num">{{ value }}</span>
          <span v-if="unit" class="value-unit">{{ unit }}</span>
        </div>
        <div v-if="trend !== undefined" class="stat-trend" :class="{ up: trend > 0, down: trend < 0 }">
          <el-icon><component :is="trend > 0 ? 'CaretTop' : 'CaretBottom'" /></el-icon>
          {{ Math.abs(trend) }}%
        </div>
      </div>
      <div v-if="icon" class="stat-icon" :style="{ color: color || '#267F7B' }">
        <el-icon :size="40"><component :is="icon" /></el-icon>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.stat-card {
  border-radius: 8px;
}
.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}
.value-unit {
  font-size: 14px;
  font-weight: 400;
  color: #909399;
  margin-left: 4px;
}
.stat-trend {
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
}
.stat-trend.up { color: var(--danger-color); }
.stat-trend.down { color: var(--success-color); }
</style>
