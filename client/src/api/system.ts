import { apiClient } from './client'
import type { Department, DepartmentForm, RoleItem, RoleForm, UserManageItem, UserManageForm, AuditLogItem } from '@new-energy/shared'

// ==================== 部门 ====================
export function getDepartments() {
  return apiClient.get<{ code: number; data: Department[] }>('/api/v1/system/departments')
}

export function createDepartment(body: DepartmentForm) {
  return apiClient.post('/api/v1/system/departments', body)
}

export function updateDepartment(id: string, body: DepartmentForm) {
  return apiClient.put(`/api/v1/system/departments/${id}`, body)
}

export function deleteDepartment(id: string) {
  return apiClient.delete(`/api/v1/system/departments/${id}`)
}

// ==================== 角色 ====================
export function getRoles() {
  return apiClient.get<{ code: number; data: RoleItem[] }>('/api/v1/system/roles')
}

export function createRole(body: RoleForm) {
  return apiClient.post('/api/v1/system/roles', body)
}

export function updateRole(id: string, body: RoleForm) {
  return apiClient.put(`/api/v1/system/roles/${id}`, body)
}

export function deleteRole(id: string) {
  return apiClient.delete(`/api/v1/system/roles/${id}`)
}

// ==================== 用户 ====================
export function getUsers(params?: { page?: number; pageSize?: number }) {
  return apiClient.get<{ code: number; data: { list: UserManageItem[]; total: number; page: number; pageSize: number } }>('/api/v1/system/users', { params })
}

export function createUser(body: UserManageForm) {
  return apiClient.post('/api/v1/system/users', body)
}

export function updateUser(id: string, body: Partial<UserManageForm>) {
  return apiClient.put(`/api/v1/system/users/${id}`, body)
}

export function deleteUser(id: string) {
  return apiClient.delete(`/api/v1/system/users/${id}`)
}

// ==================== 操作日志 ====================
export function getAuditLogs(params?: { page?: number; pageSize?: number; userId?: string; action?: string; startDate?: string; endDate?: string }) {
  return apiClient.get<{ code: number; data: { list: AuditLogItem[]; total: number; page: number; pageSize: number } }>('/api/v1/system/audit-logs', { params })
}

// ==================== 用户选项（用于筛选下拉） ====================
export function getUserOptions() {
  return apiClient.get<{ code: number; data: { id: string; username: string; display_name: string }[] }>('/api/v1/system/user-options')
}

// ==================== 数据范围 ====================
export async function fetchDataRanges() {
  const res = await apiClient.get('/api/v1/system/data-ranges')
  return res.data?.data as Record<string, { minTime: string | null; maxTime: string | null; count: number }>
}
