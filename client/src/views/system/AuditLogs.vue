<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAuditLogs, getUserOptions } from '@/api/system'
import type { AuditLogItem } from '@new-energy/shared'
import { formatDateTime } from '@/utils/time'

const list = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const loading = ref(false)

const filters = ref({ userId: '', action: '', startDate: '', endDate: '' })
const users = ref<{ id: string; username: string; display_name: string }[]>([])

async function load() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (filters.value.userId) params.userId = filters.value.userId
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.startDate) params.startDate = filters.value.startDate
    if (filters.value.endDate) params.endDate = filters.value.endDate
    const { data } = await getAuditLogs(params as any)
    list.value = data.data.list
    total.value = data.data.total
  } finally { loading.value = false }
}

async function loadUsers() {
  const { data } = await getUserOptions()
  users.value = data.data
}

function search() { page.value = 1; load() }
function reset() { filters.value = { userId: '', action: '', startDate: '', endDate: '' }; page.value = 1; load() }
function handlePageChange(p: number) { page.value = p; load() }
function handleSizeChange(s: number) { pageSize.value = s; page.value = 1; load() }

onMounted(() => { loadUsers(); load() })
</script>

<template>
  <div class="chart-panel-title">操作日志</div>
  <div class="panel-body">
    <div class="filter-bar">
      <el-select v-model="filters.userId" placeholder="用户" clearable style="width: 160px">
        <el-option v-for="u in users" :key="u.id" :label="u.display_name" :value="u.id" />
      </el-select>
      <el-select v-model="filters.action" placeholder="操作类型" clearable style="width: 120px; margin-left: 8px">
        <el-option label="创建" value="CREATE" />
        <el-option label="修改" value="UPDATE" />
        <el-option label="删除" value="DELETE" />
        <el-option label="执行" value="EXECUTE" />
      </el-select>
      <el-date-picker v-model="filters.startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width: 160px; margin-left: 8px" />
      <el-date-picker v-model="filters.endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 160px; margin-left: 8px" />
      <el-button type="primary" @click="search" style="margin-left: 8px">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <el-table :data="list" border v-loading="loading" style="width: 100%; margin-top: 12px" size="small">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div style="padding:8px 16px;font-size:12px;color:#606266">
            <div v-if="row.detail" style="margin-bottom:4px"><strong>操作描述：</strong>{{ row.detail }}</div>
            <div v-if="row.oldValue" style="margin-bottom:4px"><strong>修改前：</strong><pre style="margin:2px 0;white-space:pre-wrap;max-height:120px;overflow:auto;background:#f5f7fa;padding:4px 8px;border-radius:2px">{{ row.oldValue }}</pre></div>
            <div v-if="row.newValue" style="margin-bottom:4px"><strong>修改后：</strong><pre style="margin:2px 0;white-space:pre-wrap;max-height:120px;overflow:auto;background:#f5f7fa;padding:4px 8px;border-radius:2px">{{ row.newValue }}</pre></div>
            <div>用户代理：{{ row.userAgent || '-' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="用户" width="100">
        <template #default="{ row }">{{ row.displayName || row.username || '-' }}</template>
      </el-table-column>
      <el-table-column prop="action" label="操作" width="80" />
      <el-table-column prop="resourceType" label="资源类型" width="130" />
      <el-table-column label="操作描述" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.detail || '-' }}</template>
      </el-table-column>
      <el-table-column prop="ipAddress" label="IP" width="130" />
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > pageSize"
      style="margin-top: 12px; justify-content: flex-end"
      layout="total, sizes, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      :page-sizes="[10, 15, 30]"
      @size-change="handleSizeChange"
      @current-change="handlePageChange"
    />
  </div>
</template>

<style scoped>
.panel-body { background: #fff; padding: 16px; border-radius: 4px; }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; }
</style>
