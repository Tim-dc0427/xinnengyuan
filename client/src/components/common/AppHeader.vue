<script setup lang="ts">
import { ref } from 'vue'
import { Bell, ArrowDown } from '@element-plus/icons-vue'

const alertCount = ref(3)
</script>

<template>
  <header class="app-header">
    <div class="header-right" style="margin-left:auto">
      <el-badge :value="alertCount" class="notification-badge">
        <el-button :icon="Bell" circle />
      </el-badge>
      <el-dropdown>
        <span class="user-info">
          管理员
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>个人设置</el-dropdown-item>
            <el-dropdown-item divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 10;
}
.header-left {
  display: flex;
  align-items: center;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.notification-badge {
  margin-right: 8px;
}
.user-info {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
