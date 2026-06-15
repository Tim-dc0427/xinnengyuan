import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, LoginRequest, LoginResponse, RolePermissions } from '@new-energy/shared'
import { apiClient } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const permissions = ref<RolePermissions>({ menus: [], actions: [] })

  const isLoggedIn = computed(() => !!accessToken.value)
  const token = computed(() => accessToken.value)

  // 根据当前用户角色从角色列表获取权限
  async function loadPermissions() {
    if (!user.value) return
    try {
      const { data } = await apiClient.get<{ code: number; data: { name: string; permissions: RolePermissions }[] }>('/api/v1/system/roles')
      const roles = data.data
      const role = roles.find((r: { name: string }) => r.name === user.value!.role)
      if (role) {
        permissions.value = role.permissions
      }
    } catch {
      // 获取权限失败时保持默认空权限
    }
  }

  async function login(credentials: LoginRequest) {
    const { data } = await apiClient.post<{ code: number; data: LoginResponse }>('/api/v1/auth/login', credentials)
    const result = data.data
    accessToken.value = result.accessToken
    refreshToken.value = result.refreshToken
    user.value = result.user
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    await loadPermissions()
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    permissions.value = { menus: [], actions: [] }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  async function fetchUser() {
    const { data } = await apiClient.get<{ code: number; data: UserInfo }>('/api/v1/auth/me')
    user.value = data.data
    await loadPermissions()
  }

  function hasMenu(path: string): boolean {
    const menus = permissions.value.menus
    if (menus.includes('*')) return true
    return menus.includes(path)
  }

  function getFirstAccessibleChild(hubPath: string, childPaths: string[]): string | null {
    const menus = permissions.value.menus
    if (menus.includes('*')) return childPaths[0] || null
    return childPaths.find(p => menus.includes(p)) || null
  }

  return { user, accessToken, refreshToken, permissions, isLoggedIn, token, login, logout, fetchUser, loadPermissions, hasMenu, getFirstAccessibleChild }
})
