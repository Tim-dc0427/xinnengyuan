<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRoles, createRole, updateRole, deleteRole } from '@/api/system'
import { MENU_TREE, collectLeafPaths } from '@new-energy/shared'
import type { RoleItem, MenuTreeNode } from '@new-energy/shared'
import { formatDateTime } from '@/utils/time'

const ALL_LEAF_PATHS = collectLeafPaths(MENU_TREE)

const list = ref<RoleItem[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const editingId = ref<string | null>(null)
const form = ref({ name: '', permissions: { menus: [] as string[], actions: [] as string[] } })

// 每次弹窗重建 tree
const treeKey = ref(0)
// tree 的 ref
const treeRef = ref<any>(null)

// 手动维护的选中 key 列表（只含以 / 开头的叶子 key）
const checkedMenuKeys = ref<string[]>([])
// 弹窗打开时要设的初始 keys
const initialCheckedKeys = ref<string[]>([])

// 默认展开所有节点
const defaultExpandedKeys = ref<string[]>([])
;(function initExpandedKeys() {
  const keys: string[] = []
  function walk(nodes: MenuTreeNode[]) {
    for (const n of nodes) {
      keys.push(n.key)
      if (n.children) walk(n.children)
    }
  }
  walk(MENU_TREE)
  defaultExpandedKeys.value = keys
})()

async function load() {
  const { data } = await getRoles()
  list.value = data.data
}

function openCreate() {
  dialogTitle.value = '新增角色'
  editingId.value = null
  form.value = { name: '', permissions: { menus: [], actions: [] } }
  initialCheckedKeys.value = []
  checkedMenuKeys.value = []
  treeKey.value++
  dialogVisible.value = true
}

function openEdit(item: RoleItem) {
  dialogTitle.value = '编辑角色'
  editingId.value = item.id

  const rawMenus = item.permissions.menus
  const leafKeys = rawMenus.includes('*')
    ? [...ALL_LEAF_PATHS]
    : rawMenus.filter(k => ALL_LEAF_PATHS.includes(k))

  form.value = { name: item.name, permissions: { menus: [...rawMenus], actions: [] } }
  initialCheckedKeys.value = leafKeys
  checkedMenuKeys.value = leafKeys
  treeKey.value++
  dialogVisible.value = true
}

// el-tree check 事件 — 手动维护 checkedMenuKeys
function handleCheck(_node: any, info: { checkedKeys: string[] }) {
  // 只保留叶子 key（以 / 开头），排除 _group_ 等内部 key
  checkedMenuKeys.value = info.checkedKeys.filter(k => k.startsWith('/'))
}

async function submit() {
  if (!form.value.name.trim()) { ElMessage.warning('请输入角色名称'); return }

  const selected = checkedMenuKeys.value
  const menuValue = selected.length >= ALL_LEAF_PATHS.length ? ['*'] : selected

  const payload = {
    name: form.value.name,
    permissions: { menus: menuValue, actions: [] },
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
  const m = item.permissions.menus
  return m.includes('*') ? '全部菜单' : `${m.length} 个菜单`
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
              :key="treeKey"
              :data="MENU_TREE"
              show-checkbox
              node-key="key"
              :default-expanded-keys="defaultExpandedKeys"
              :default-checked-keys="initialCheckedKeys"
              :expand-on-click-node="false"
              @check="handleCheck"
              style="max-height: 360px; overflow-y: auto"
            >
              <template #default="{ data }">
                <span class="tree-node-label">{{ data.title }}</span>
              </template>
            </el-tree>
          </div>
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
