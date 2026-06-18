<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUsers, createUser, updateUser, deleteUser } from '@/api/system'
import { getRoles, getDepartments } from '@/api/system'
import { validatePassword } from '@new-energy/shared'
import type { UserManageItem, RoleItem, Department, PasswordCheckResult } from '@new-energy/shared'
import { formatDateTime } from '@/utils/time'
import { getPublicKey } from '@/api/auth'
import JSEncrypt from 'jsencrypt'

const list = ref<UserManageItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const dialogVisible = ref(false)
const dialogTitle = ref('新增用户')
const editingId = ref<string | null>(null)
const form = ref({ username: '', password: '', displayName: '', roleId: '', departmentId: null as string | null, isActive: 1 })
const roles = ref<RoleItem[]>([])

// 密码校验状态
const pwdCheck = ref<PasswordCheckResult>({ valid: false, errors: [], checks: [] })
const pwdTouched = ref(false)

watch(() => form.value.password, (val) => {
  if (pwdTouched.value && val) {
    pwdCheck.value = validatePassword(val)
  } else if (!val) {
    pwdCheck.value = { valid: false, errors: [], checks: [] }
  }
})

function onPwdBlur() {
  pwdTouched.value = true
  if (form.value.password) {
    pwdCheck.value = validatePassword(form.value.password)
  }
}

function flattenDepts(items: Department[]): { id: string; name: string }[] {
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
const deptOptions = ref<{ id: string; name: string }[]>([])

async function load() {
  const { data } = await getUsers({ page: page.value, pageSize: pageSize.value })
  list.value = data.data.list
  total.value = data.data.total
}

async function loadOptions() {
  const [rRes, dRes] = await Promise.all([getRoles(), getDepartments()])
  roles.value = rRes.data.data
  deptOptions.value = flattenDepts(dRes.data.data)
}

function openCreate() {
  dialogTitle.value = '新增用户'
  editingId.value = null
  form.value = { username: '', password: '', displayName: '', roleId: '', departmentId: null, isActive: 1 }
  pwdCheck.value = { valid: false, errors: [], checks: [] }
  pwdTouched.value = false
  dialogVisible.value = true
}

function openEdit(item: UserManageItem) {
  dialogTitle.value = '编辑用户'
  editingId.value = item.id
  form.value = { username: item.username, password: '', displayName: item.displayName, roleId: item.roleId, departmentId: item.departmentId, isActive: item.isActive }
  pwdCheck.value = { valid: false, errors: [], checks: [] }
  pwdTouched.value = false
  dialogVisible.value = true
}

async function submit() {
  if (!form.value.username.trim()) { ElMessage.warning('请输入用户名'); return }
  if (!editingId.value && !form.value.password) { ElMessage.warning('请输入密码'); return }

  // 密码校验：新增时必验，编辑时仅当密码非空时校验
  if (form.value.password) {
    const result = validatePassword(form.value.password)
    if (!result.valid) {
      ElMessage.warning('密码不符合要求：' + result.errors.join('，'))
      return
    }
  } else if (!editingId.value) {
    ElMessage.warning('请输入密码')
    return
  }

  try {
    // 加密密码
    let encryptedPwd = ''
    if (form.value.password) {
      const publicKey = await getPublicKey()
      const encrypt = new JSEncrypt()
      encrypt.setPublicKey(publicKey)
      encryptedPwd = encrypt.encrypt(form.value.password) || ''
      if (!encryptedPwd) { ElMessage.error('密码加密失败'); return }
    }

    if (editingId.value) {
      const payload = { ...form.value }
      if (!payload.password) {
        delete (payload as any).password
      } else {
        payload.password = encryptedPwd
      }
      await updateUser(editingId.value, payload)
    } else {
      await createUser({ ...form.value, password: encryptedPwd } as any)
    }
    ElMessage.success(editingId.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function remove(item: UserManageItem) {
  try {
    await ElMessageBox.confirm(`确定删除用户「${item.displayName}」？`, '提示', { type: 'warning' })
    await deleteUser(item.id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

function handlePageChange(p: number) { page.value = p; load() }
function handleSizeChange(s: number) { pageSize.value = s; page.value = 1; load() }

onMounted(() => { loadOptions(); load() })
</script>

<template>
  <div class="chart-panel-title">用户管理</div>
  <div class="panel-body">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增用户</el-button>
    </div>
    <el-table :data="list" border style="width: 100%">
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="displayName" label="显示名" width="140" />
      <el-table-column prop="roleName" label="角色" width="100" />
      <el-table-column prop="departmentName" label="部门" width="100" />
      <el-table-column prop="isActive" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录" width="180" />
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

    <el-pagination
      v-if="total > pageSize"
      style="margin-top: 12px; justify-content: flex-end"
      layout="total, sizes, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      :page-sizes="[10, 20, 50]"
      @size-change="handleSizeChange"
      @current-change="handlePageChange"
    />

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="editingId ? '留空则不修改' : '请输入密码'"
            show-password
            @blur="onPwdBlur"
          />
          <!-- 密码规则实时校验 -->
          <div v-if="pwdTouched && form.password" class="pwd-rules">
            <div
              v-for="c in pwdCheck.checks"
              :key="c.label"
              :class="['pwd-rule-item', c.passed ? 'passed' : 'failed']"
            >
              <span class="pwd-rule-icon">{{ c.passed ? '✓' : '✗' }}</span>
              <span>{{ c.label }}</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="form.displayName" placeholder="请输入显示名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleId" placeholder="请选择角色" style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.departmentId" placeholder="请选择部门" clearable style="width: 100%">
            <el-option v-for="d in deptOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.isActive">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
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

.pwd-rules {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
}
.pwd-rule-item {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
}
.pwd-rule-icon {
  font-weight: bold;
  width: 14px;
  text-align: center;
}
.pwd-rule-item.passed { color: #67c23a; }
.pwd-rule-item.failed { color: #f56c6c; }
</style>
