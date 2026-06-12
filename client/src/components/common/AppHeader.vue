<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth.store'
import { fetchAlerts } from '@/api/grid-diagnosis'
import { POWER_QUALITY_ALERT_TYPES } from '@new-energy/shared'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()
const alertCount = ref(0)
const alertList = ref<any[]>([])
const alertPopVisible = ref(false)

const displayName = computed(() => authStore.user?.displayName || '管理员')

async function loadAlerts() {
  try {
    const data = await fetchAlerts({ limit: 20 })
    if (data) {
      alertList.value = data.map((a: any) => {
        const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata || '{}') : (a.metadata || {})
        return {
          ...a,
          _levelType: a.alert_level === 'CRITICAL' ? 'danger' : a.alert_level === 'WARN' ? 'warning' : 'info',
          _levelLabel: a.alert_level === 'CRITICAL' ? '严重' : a.alert_level === 'WARN' ? '警告' : '提示',
          _sourceLabel: (({ VOLTAGE_FLUCTUATION: '电压波动率', POWER_SUPPLY_RELIABILITY: '实际可靠性率' }) as Record<string, string>)[a.source_type] || a.source_type,
          _summary: a.message ? a.message.slice(0, 40) + (a.message.length > 40 ? '...' : '') : a.title,
        }
      })
      alertCount.value = alertList.value.filter((a: any) => !a.acknowledged_at && (POWER_QUALITY_ALERT_TYPES as readonly string[]).includes(a.source_type)).length
    }
  } catch { /* 静默失败，不影响页面 */ }
}

function handleAlertClick(row: any) {
  alertPopVisible.value = false
  router.push('/grid-diagnosis/power-quality/alerts')
}

function handleViewAll() {
  alertPopVisible.value = false
  router.push('/grid-diagnosis/power-quality/alerts')
}

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    authStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}

onMounted(() => {
  loadAlerts()
  // 每60秒刷新一次预警数量
  setInterval(loadAlerts, 60000)
})
</script>

<template>
  <header class="app-header">
    <div class="header-right" style="margin-left:auto">
      <el-popover
        v-model:visible="alertPopVisible"
        trigger="click"
        placement="bottom-end"
        :width="360"
        :offset="8"
      >
        <template #reference>
          <el-badge :value="alertCount" :hidden="alertCount === 0" class="notification-badge">
            <el-button :icon="Bell" circle />
          </el-badge>
        </template>
        <div style="max-height:360px;overflow-y:auto">
          <div style="font-size:13px;font-weight:600;color:#303133;padding:4px 0 8px 0;border-bottom:1px solid #ebeef5;margin-bottom:8px">
            预警通知
            <span v-if="alertCount" style="color:#F56C6C;font-size:12px;font-weight:400;margin-left:8px">{{ alertCount }} 条待处理</span>
          </div>
          <div v-if="!alertList.length" style="text-align:center;color:#909399;padding:24px 0;font-size:13px">暂无预警通知</div>
          <div
            v-for="a in alertList"
            :key="a.id"
            style="padding:8px 0;border-bottom:1px solid #f2f3f5;cursor:pointer"
            @click="handleAlertClick(a)"
          >
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:13px;font-weight:500;color:#303133;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ a.title }}</span>
              <el-tag :type="a._levelType" size="small" style="margin-left:8px;flex-shrink:0">{{ a._levelLabel }}</el-tag>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
              <span style="font-size:12px;color:#909399">{{ a._summary }}</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-top:2px">
              <span style="font-size:11px;color:#c0c4cc">{{ a._sourceLabel }}</span>
              <span style="font-size:11px;color:#c0c4cc">{{ (a.triggered_at || '').slice(0, 16).replace('T', ' ') }}</span>
              <span v-if="!a.acknowledged_at" style="font-size:11px;color:#F56C6C">待处理</span>
            </div>
          </div>
        </div>
        <div v-if="alertList.length" style="text-align:center;padding-top:8px;border-top:1px solid #ebeef5;margin-top:4px">
          <el-button type="primary" link size="small" @click="handleViewAll">查看全部预警</el-button>
        </div>
      </el-popover>
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
