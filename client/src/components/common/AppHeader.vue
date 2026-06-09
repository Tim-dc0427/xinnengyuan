<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth.store'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()
const alertCount = ref(3)

const displayName = computed(() => authStore.user?.displayName || '管理员')

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    authStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-right" style="margin-left:auto">
      <el-badge :value="alertCount" class="notification-badge">
        <el-button :icon="Bell" circle />
      </el-badge>
      <el-dropdown @command="handleCommand">
        <span class="user-info">
          {{ displayName }}
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="settings">个人设置</el-dropdown-item>
            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
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
