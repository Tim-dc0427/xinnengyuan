// API response envelope
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// Pagination query
export interface PaginationQuery {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// User roles
export type UserRole = 'admin' | 'planner' | 'operator' | 'viewer'

export interface UserInfo {
  id: string
  username: string
  displayName: string
  role: UserRole
  department: string
}

// Auth
export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

// ==================== 系统管理 ====================

// 部门/组织
export interface Department {
  id: string
  name: string
  parentId: string | null
  parentName?: string
  sortOrder: number
  createdAt: string
  children?: Department[]
}

export interface DepartmentForm {
  name: string
  parentId: string | null
  sortOrder: number
}

// 用户管理
export interface UserManageItem {
  id: string
  username: string
  displayName: string
  roleId: string
  roleName: string
  departmentId: string | null
  departmentName: string
  isActive: number
  lastLoginAt: string | null
  createdAt: string
}

export interface UserManageForm {
  username: string
  password?: string
  displayName: string
  roleId: string
  departmentId: string | null
  isActive: number
}

// 角色管理
export interface RolePermissions {
  menus: string[]
  actions: string[]
}

export interface RoleItem {
  id: string
  name: string
  permissions: RolePermissions
  userCount: number
  createdAt: string
}

export interface RoleForm {
  name: string
  permissions: RolePermissions
}

export interface MenuTreeNode {
  key: string
  path?: string
  title: string
  children?: MenuTreeNode[]
}

// 操作日志
export interface AuditLogItem {
  id: number
  userId: string
  username: string
  displayName?: string
  action: string
  resourceType: string
  resourceId: string | null
  detail?: string
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}
