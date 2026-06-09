<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/api/system'
import type { Department } from '@new-energy/shared'

const list = ref<Department[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增部门')
const editingId = ref<string | null>(null)
const form = ref({ name: '', parentId: null as string | null, sortOrder: 0 })
const parentOptions = ref<{ id: string; name: string }[]>([])

function flattenParents(items: Department[]): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = []
  function walk(nodes: Department[], depth: number) {
    for (const n of nodes) {
      result.push({ id: n.id, name: '  '.repeat(depth) + n.name })
      if (n.children) walk(n.children, depth + 1)
    }
  }
  walk(items, 0)
  return result
}

async function load() {
  const { data } = await getDepartments()
  list.value = data.data
  parentOptions.value = flattenParents(data.data)
}

function openCreate(parentId: string | null = null) {
  dialogTitle.value = '新增部门'
  editingId.value = null
  form.value = { name: '', parentId, sortOrder: 0 }
  dialogVisible.value = true
}

function openEdit(item: Department) {
  dialogTitle.value = '编辑部门'
  editingId.value = item.id
  form.value = { name: item.name, parentId: item.parentId, sortOrder: item.sortOrder }
  dialogVisible.value = true
}

async function submit() {
  if (!form.value.name.trim()) { ElMessage.warning('请输入部门名称'); return }
  try {
    if (editingId.value) {
      await updateDepartment(editingId.value, form.value)
    } else {
      await createDepartment(form.value)
    }
    ElMessage.success(editingId.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function remove(item: Department) {
  try {
    await ElMessageBox.confirm(`确定删除部门「${item.name}」？`, '提示', { type: 'warning' })
    await deleteDepartment(item.id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="chart-panel-title">组织管理</div>
  <div class="panel-body">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate(null)">新增部门</el-button>
    </div>
    <el-table :data="list" row-key="id" default-expand-all border style="width: 100%">
      <el-table-column prop="name" label="部门名称" />
      <el-table-column prop="sortOrder" label="排序" width="80" />
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openCreate(row.id)">新增子部门</el-button>
          <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" text type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="部门名称">
          <el-input v-model="form.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="form.parentId" placeholder="无（顶级部门）" clearable style="width: 100%">
            <el-option v-for="p in parentOptions" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
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
