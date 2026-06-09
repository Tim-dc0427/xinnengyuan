<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRoles, createRole, updateRole, deleteRole } from '@/api/system'
import type { RoleItem } from '@new-energy/shared'

const list = ref<RoleItem[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const editingId = ref<string | null>(null)
const form = ref({ name: '', permissions: [] as string[] })

const permOptions = [
  { label: '全部 (*)', value: '*' },
  { label: '读取 (read)', value: 'read' },
  { label: '写入 (write)', value: 'write' },
  { label: '计算 (calculate)', value: 'calculate' },
]

async function load() {
  const { data } = await getRoles()
  list.value = data.data
}

function openCreate() {
  dialogTitle.value = '新增角色'
  editingId.value = null
  form.value = { name: '', permissions: [] }
  dialogVisible.value = true
}

function openEdit(item: RoleItem) {
  dialogTitle.value = '编辑角色'
  editingId.value = item.id
  form.value = { name: item.name, permissions: [...item.permissions] }
  dialogVisible.value = true
}

async function submit() {
  if (!form.value.name.trim()) { ElMessage.warning('请输入角色名称'); return }
  try {
    if (editingId.value) {
      await updateRole(editingId.value, form.value)
    } else {
      await createRole(form.value)
    }
    ElMessage.success(editingId.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function remove(item: RoleItem) {
  if (item.userCount > 0) { ElMessage.warning('该角色下存在用户，无法删除'); return }
  try {
    await ElMessageBox.confirm(`确定删除角色「${item.name}」？`, '提示', { type: 'warning' })
    await deleteRole(item.id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="chart-panel-title">角色管理</div>
  <div class="panel-body">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增角色</el-button>
    </div>
    <el-table :data="list" border style="width: 100%">
      <el-table-column prop="name" label="角色名" width="140" />
      <el-table-column prop="permissions" label="权限" min-width="200">
        <template #default="{ row }">
          <el-tag v-for="p in row.permissions" :key="p" size="small" style="margin-right: 4px">{{ p === '*' ? '全部' : p }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="userCount" label="用户数" width="80" />
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" text type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="角色名称">
          <el-input v-model="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="form.permissions">
            <el-checkbox v-for="p in permOptions" :key="p.value" :label="p.value" :value="p.value">
              {{ p.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel-body { background: #fff; padding: 16px; border-radius: 4px; }
.toolbar { margin-bottom: 12px; }
</style>
