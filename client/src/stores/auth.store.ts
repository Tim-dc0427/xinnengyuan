import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, LoginRequest, LoginResponse } from '@new-energy/shared'
import { apiClient } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))

  const isLoggedIn = computed(() => !!accessToken.value)
  const token = computed(() => accessToken.value)

  async function login(credentials: LoginRequest) {
    const { data } = await apiClient.post<{ code: number; data: LoginResponse }>('/api/v1/auth/login', credentials)
    const result = data.data
    accessToken.value = result.accessToken
    refreshToken.value = result.refreshToken
    user.value = result.user
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  async function fetchUser() {
    const { data } = await apiClient.get<{ code: number; data: UserInfo }>('/api/v1/auth/me')
    user.value = data.data
  }

  return { user, accessToken, refreshToken, isLoggedIn, token, login, logout, fetchUser }
})
