import { apiClient } from './client'

export interface ProjectItem {
  id: string
  project_code: string
  project_name: string
  project_type: string
  pv_type?: string
  plan_id?: string
  capacity_kw?: number
  budget?: string
  status: string
  actual_cost?: string
  actual_completion_date?: string
  custom_fields?: string
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface ProjectType {
  id: string
  name: string
  code: string
  description?: string
  sort_order?: number
  fields?: ProjectTypeField[]
  created_at?: string
}

export interface ProjectTypeField {
  id: string
  type_id: string
  field_code: string
  field_name: string
  field_type: string
  field_options?: string
  is_required: number
  sort_order: number
  created_at?: string
}

export interface AccessCondition {
  id?: string
  project_id: string
  condition_type: string
  requirement: string
  actual_value: string
  is_satisfied: boolean
}

export interface FeasibilityResult {
  id?: string
  project_id: string
  technical_score: number
  economic_score: number
  environmental_score: number
  social_score: number
  comprehensive_score: number
  created_at?: string
}

export interface EffectivenessRecord {
  id?: string
  project_id: string
  verification_date: string
  planned_output_kwh: number
  actual_output_kwh: number
  absorption_rate_pct: number
  voltage_compliance_pct: number
  is_effective: boolean
  remarks?: string
}

export interface AuditRecord {
  id: string
  project_id: string
  action: string
  description: string
  operator: string
  created_at: string
}

// ==================== 项目管理 ====================
export async function fetchProjects(params?: { status?: string; projectType?: string }) {
  const res = await apiClient.get('/api/v1/achievement/projects', { params })
  return res.data?.data as ProjectItem[]
}

export async function createProject(data: {
  projectCode: string
  projectName: string
  projectType: string
  pvType?: string
  planId?: string
  capacityKw?: number
  budget?: string
  customFields?: Record<string, any>
}) {
  const res = await apiClient.post('/api/v1/achievement/projects', data)
  return res.data?.data as ProjectItem
}

export async function updateProject(id: string, data: {
  projectName?: string
  status?: string
  actualCost?: string
  actualCompletionDate?: string
}) {
  const res = await apiClient.put(`/api/v1/achievement/projects/${id}`, data)
  return res.data?.data as ProjectItem
}

// ==================== 接入条件 ====================
export async function fetchAccessConditions(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/access-conditions`)
  return res.data?.data as AccessCondition[]
}

export async function saveAccessConditions(projectId: string, conditions: {
  conditionType: string
  requirement: string
  actualValue: string
  isSatisfied: boolean
}[]) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/access-conditions`, conditions)
  return res.data?.data as AccessCondition[]
}

// ==================== 可行性评估 ====================
export async function runFeasibility(projectId: string, weights?: {
  technical?: number
  economic?: number
  environmental?: number
  social?: number
}) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/feasibility`, weights)
  return res.data?.data as FeasibilityResult
}

export async function fetchFeasibility(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/feasibility`)
  return res.data?.data as FeasibilityResult
}

// ==================== 成效验证 ====================
export async function verifyEffectiveness(projectId: string, data: {
  plannedOutputKwh: number
  actualOutputKwh: number
  absorptionRatePct: number
  voltageCompliancePct: number
  isEffective: boolean
  remarks?: string
}) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/verify`, data)
  return res.data?.data as EffectivenessRecord
}

// ==================== 历史追溯 ====================
export async function traceHistory(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/trace`)
  return res.data?.data as AuditRecord[]
}

// ==================== 项目类型管理 ====================
export async function fetchProjectTypes() {
  const res = await apiClient.get('/api/v1/achievement/project-types')
  return res.data?.data as ProjectType[]
}

export async function fetchProjectTypesWithFields() {
  const res = await apiClient.get('/api/v1/achievement/project-types/with-fields')
  return res.data?.data as ProjectType[]
}

export async function fetchProjectTypeWithFields(id: string) {
  const res = await apiClient.get(`/api/v1/achievement/project-types/${id}/with-fields`)
  return res.data?.data as ProjectType & { fields: ProjectTypeField[] }
}

export async function createProjectType(data: { name: string; code: string; description?: string; sortOrder?: number }) {
  const res = await apiClient.post('/api/v1/achievement/project-types', data)
  return res.data?.data as ProjectType
}

export async function updateProjectType(id: string, data: { name?: string; description?: string; sortOrder?: number }) {
  const res = await apiClient.put(`/api/v1/achievement/project-types/${id}`, data)
  return res.data?.data as ProjectType
}

export async function deleteProjectType(id: string) {
  const res = await apiClient.delete(`/api/v1/achievement/project-types/${id}`)
  return res.data?.data
}

export async function fetchTypeFields(typeId: string) {
  const res = await apiClient.get(`/api/v1/achievement/project-types/${typeId}/fields`)
  return res.data?.data as ProjectTypeField[]
}

export async function saveTypeFields(typeId: string, fields: Array<{
  fieldCode: string; fieldName: string; fieldType: string
  fieldOptions?: string; isRequired: boolean; sortOrder: number
}>) {
  const res = await apiClient.post(`/api/v1/achievement/project-types/${typeId}/fields`, fields)
  return res.data?.data as ProjectTypeField[]
}
