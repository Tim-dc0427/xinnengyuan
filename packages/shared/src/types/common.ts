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
