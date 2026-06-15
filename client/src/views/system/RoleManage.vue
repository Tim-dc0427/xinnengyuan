<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRoles, createRole, updateRole, deleteRole } from '@/api/system'
import { MENU_TREE, ALL_ACTIONS } from '@new-energy/shared'
import type { RoleItem, MenuTreeNode } from '@new-energy/shared'
import { formatDateTime } from '@/utils/time'

const list = ref<RoleItem[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const editingId = ref<string | null>(null)
const form = ref({ name: '', permissions: { menus: [] as string[], actions: [] as string[] } })

// el-tree ref，用于获取半选节点
const treeRef = ref<any>(null)

// 默认展开所有节点
const defaultExpandedKeys = ref<string[]>([])
function initExpandedKeys() {
  const keys: string[] = []
  function walk(nodes: MenuTreeNode[]) {
    for (const n of nodes) {
      keys.push(n.key)
      if (n.children) walk(n.children)
    }
  }
  walk(MENU_TREE)
  defaultExpandedKeys.value = keys
}
initExpandedKeys()

// 当前选中的菜单权限 key（包括全选/半选的，el-tree v-model 在 check-strictly=false 时只返回叶子节点的 key）
// 我们需要保存时过滤：只保留以 / 开头的（真实路由 path）
const checkedMenuKeys = ref<string[]>([])

async function load() {
  const { data } = await getRoles()
  list.value = data.data
}

function openCreate() {
  dialogTitle.value = '新增角色'
  editingId.value = null
  form.value = { name: '', permissions: { menus: [], actions: [] } }
  checkedMenuKeys.value = []
  dialogVisible.value = true
  nextTick(() => {
    treeRef.value?.setCheckedKeys([])
  })
}

function openEdit(item: RoleItem) {
  dialogTitle.value = '编辑角色'
  editingId.value = item.id
  form.value = {
    name: item.name,
    permissions: {
      menus: [...item.permissions.menus],
      actions: item.permissions.actions.includes('*')
        ? ALL_ACTIONS.map(a => a.value)
        : [...item.permissions.actions],
    },
  }
  dialogVisible.value = true
  // el-tree 的 checked keys：如果是 * 则全选所有叶子，否则用存储的 menus
  const keys = item.permissions.menus.includes('*')
    ? collectAllLeafKeys()
    : [...item.permissions.menus]
  checkedMenuKeys.value = keys
  nextTick(() => {
    treeRef.value?.setCheckedKeys(keys)
  })
}

function collectAllLeafKeys(): string[] {
  const keys: string[] = []
  function walk(nodes: MenuTreeNode[]) {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        walk(n.children)
      } else {
        keys.push(n.key)
      }
    }
  }
  walk(MENU_TREE)
  return keys
}

async function submit() {
  if (!form.value.name.trim()) { ElMessage.warning('请输入角色名称'); return }

  // 从 checkedMenuKeys 中提取实际路由 path（排除 _group_ 前缀的 key）
  const selectedMenus = checkedMenuKeys.value.filter(k => k.startsWith('/'))

  // 判断是否全选了所有菜单
  const allLeafKeys = collectAllLeafKeys().filter(k => k.startsWith('/'))
  const menuValue = selectedMenus.length >= allLeafKeys.length ? ['*'] : selectedMenus

  // 判断是否全选了所有功能
  const actionValue = form.value.permissions.actions.length >= ALL_ACTIONS.length ? ['*'] : form.value.permissions.actions

  const payload = {
    name: form.value.name,
    permissions: {
      menus: menuValue,
      actions: actionValue,
    },
  }

  try {
    if (editingId.value) {
      await updateRole(editingId.value, payload)
    } else {
      await createRole(payload)
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

function formatPerms(item: RoleItem): string {
  const p = item.permissions
  const menuCount = p.menus.includes('*') ? '全部' : `${p.menus.length} 项`
  const actionCount = p.actions.includes('*') ? '全部' : `${p.actions.length} 项`
  return `菜单 ${menuCount}，功能 ${actionCount}`
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
      <el-table-column prop="name" label="角色名" width="120" />
      <el-table-column label="权限" min-width="240">
        <template #default="{ row }">
          <span style="color: #606266">{{ formatPerms(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="userCount" label="用户数" width="80" />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" text type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="角色名称">
          <el-input v-model="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="菜单权限">
          <div class="menu-tree-wrapper">
            <el-tree
              ref="treeRef"
              v-model="checkedMenuKeys"
              :data="MENU_TREE"
              show-checkbox
              node-key="key"
              :default-expanded-keys="defaultExpandedKeys"
              :expand-on-click-node="false"
              :check-strictly="false"
              style="max-height: 360px; overflow-y: auto"
            >
              <template #default="{ data }">
                <span class="tree-node-label">{{ data.title }}</span>
              </template>
            </el-tree>
          </div>
        </el-form-item>
        <el-form-item label="功能权限">
          <el-checkbox-group v-model="form.permissions.actions">
            <el-checkbox v-for="a in ALL_ACTIONS" :key="a.value" :label="a.value" :value="a.value" style="margin-right: 16px; margin-bottom: 4px">
              {{ a.label }}
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
.menu-tree-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px 4px;
  min-height: 120px;
}
.tree-node-label {
  font-size: 13px;
  color: #303133;
}
</style>
