import { apiClient } from './client'
import type { LoginResponse } from '@new-energy/shared'

/** 获取 RSA 公钥（PEM 格式），用于加密密码 */
export async function getPublicKey(): Promise<string> {
  const { data } = await apiClient.get<{ code: number; data: { publicKey: string } }>('/api/v1/auth/public-key')
  return data.data.publicKey
}

/** 登录（密码已用 RSA 公钥加密） */
export async function login(username: string, encryptedPassword: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<{ code: number; data: LoginResponse }>('/api/v1/auth/login', {
    username,
    encryptedPassword,
  })
  return data.data
}
