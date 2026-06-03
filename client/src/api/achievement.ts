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
export async function fetchProjects(params?: { status?: string; projectType?: string; constructionProgress?: string; gridVoltage?: string; operationStatus?: string }) {
  const res = await apiClient.get('/api/v1/achievement/projects', { params })
  return res.data?.data as ProjectItem[]
}

// ==================== 项目字段库 ====================
export async function fetchProjectFieldLibrary(keyword?: string) {
  const res = await apiClient.get('/api/v1/achievement/project-field-library', { params: keyword ? { keyword } : {} })
  return res.data?.data as Array<{ id: string; field_code: string; field_name: string; field_type: string; field_options?: string; category?: string }>
}

export async function createProjectFieldLibraryItem(data: { fieldCode: string; fieldName: string; fieldType: string; fieldOptions?: string; category?: string }) {
  const res = await apiClient.post('/api/v1/achievement/project-field-library', data)
  return res.data?.data
}

export async function deleteProjectFieldLibraryItem(id: string) {
  await apiClient.delete(`/api/v1/achievement/project-field-library/${id}`)
}

// ==================== 项目文档管理 ====================
export interface ProjectDocument { id: string; project_id: string; doc_name: string; doc_type: string; file_path: string; file_size: number; uploaded_at: string }

export async function fetchProjectDocuments(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/documents`)
  return res.data?.data as ProjectDocument[]
}

export async function uploadProjectDocument(projectId: string, file: File, docType: string) {
  const form = new FormData(); form.append('file', file); form.append('docType', docType)
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data?.data as ProjectDocument
}

export function getDocumentDownloadUrl(docId: string, projectId: string) { return `/api/v1/achievement/projects/${projectId}/documents/${docId}/download` }

export async function deleteProjectDocument(projectId: string, docId: string) { await apiClient.delete(`/api/v1/achievement/projects/${projectId}/documents/${docId}`) }

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
export async function runFeasibility(projectId: string, data: {
  params: Record<string, any>
  weights?: Record<string, number>
  accessPointId?: string
}) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/feasibility`, data)
  return res.data?.data as FeasibilityResult
}

export async function fetchFeasibility(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/feasibility`)
  return res.data?.data as FeasibilityResult
}

// ==================== 成效验证（旧） ====================
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

// ==================== 投运项目管理（成效验证评估） ====================
export interface OperationProject {
  id: string
  project_code: string
  project_name: string
  station_id: string
  station_name?: string
  installed_capacity_mw?: number
  grid_connection_voltage_kv?: number
  panel_type?: string
  longitude?: number
  latitude?: number
  address?: string
  zone?: string
  voltage_level?: string
  operation_start_date: string | null
  planned_annual_output_mwh: number | null
  planned_equivalent_hours: number | null
  planned_absorption_rate_pct: number | null
  planned_voltage_compliance_pct: number | null
  status: string
  remarks: string | null
  created_at: string
  updated_at: string | null
}

export interface EffectivenessVerification {
  id: string
  project_id: string
  period_start: string
  period_end: string

  auto_output_kwh: number | null
  auto_equivalent_hours: number | null
  auto_voltage_compliance_pct: number | null
  auto_frequency_compliance_pct: number | null
  auto_power_factor_rate: number | null
  auto_completeness_pct: number | null

  final_output_kwh: number | null
  final_equivalent_hours: number | null
  final_voltage_compliance_pct: number | null
  final_frequency_compliance_pct: number | null
  final_power_factor_rate: number | null
  final_completeness_pct: number | null

  absorption_rate_pct: number | null

  planned_output_mwh: number | null
  planned_equivalent_hours: number | null
  planned_absorption_rate_pct: number | null
  planned_voltage_compliance_pct: number | null

  manual_override: number
  correction_note: string | null
  is_effective: number
  remarks: string | null
  verified_by: string | null
  created_at: string
}

export interface AvailableStation {
  id: string
  station_name: string
  installed_capacity_mw: number
  grid_connection_voltage_kv: number
  address: string
  installed_date: string | null
}

// 投运项目 CRUD
export async function fetchOperationProjects(params?: { status?: string; stationId?: string }) {
  const res = await apiClient.get('/api/v1/achievement/operation-projects', { params })
  return res.data?.data as OperationProject[]
}

export async function fetchOperationProject(id: string) {
  const res = await apiClient.get(`/api/v1/achievement/operation-projects/${id}`)
  return res.data?.data as OperationProject
}

export async function createOperationProject(data: {
  projectCode: string
  projectName: string
  stationId: string
  operationStartDate?: string
  plannedAnnualOutputMwh?: number
  plannedEquivalentHours?: number
  plannedAbsorptionRatePct?: number
  plannedVoltageCompliancePct?: number
  remarks?: string
}) {
  const res = await apiClient.post('/api/v1/achievement/operation-projects', data)
  return res.data?.data as OperationProject
}

export async function updateOperationProject(id: string, data: Record<string, any>) {
  const res = await apiClient.put(`/api/v1/achievement/operation-projects/${id}`, data)
  return res.data?.data as OperationProject
}

export async function deleteOperationProject(id: string) {
  await apiClient.delete(`/api/v1/achievement/operation-projects/${id}`)
}

// 可选电站
export async function fetchAvailableStations() {
  const res = await apiClient.get('/api/v1/achievement/available-stations')
  return res.data?.data as AvailableStation[]
}

// 成效验证评估
export async function fetchVerifications(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/operation-projects/${projectId}/verifications`)
  return res.data?.data as EffectivenessVerification[]
}

export async function createVerification(projectId: string, data: {
  periodStart: string
  periodEnd: string
  finalOutputKwh?: number | null
  finalEquivalentHours?: number | null
  finalVoltageCompliancePct?: number | null
  finalFrequencyCompliancePct?: number | null
  finalPowerFactorRate?: number | null
  finalCompletenessPct?: number | null
  absorptionRatePct?: number | null
  correctionNote?: string
  remarks?: string
}) {
  const res = await apiClient.post(`/api/v1/achievement/operation-projects/${projectId}/verifications`, data)
  return res.data?.data as EffectivenessVerification
}

export async function updateVerification(verificationId: string, data: Record<string, any>) {
  const res = await apiClient.put(`/api/v1/achievement/verifications/${verificationId}`, data)
  return res.data?.data as EffectivenessVerification
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

// ==================== 条件计划 ====================
export interface ConditionPlan {
  id: string; name: string; plan_type: string
  conditions: string  // JSON string of ConditionItem[]
  created_at?: string; updated_at?: string
}

export async function fetchConditionPlans(planType?: string) {
  const res = await apiClient.get('/api/v1/achievement/condition-plans', { params: { planType } })
  return res.data?.data as ConditionPlan[]
}
export async function createConditionPlan(data: { name: string; planType: string; conditions: any[] }) {
  const res = await apiClient.post('/api/v1/achievement/condition-plans', data)
  return res.data?.data as ConditionPlan
}
export async function updateConditionPlan(id: string, data: { name?: string; conditions?: any[] }) {
  const res = await apiClient.put(`/api/v1/achievement/condition-plans/${id}`, data)
  return res.data?.data as ConditionPlan
}
export async function deleteConditionPlan(id: string) {
  await apiClient.delete(`/api/v1/achievement/condition-plans/${id}`)
}

// ==================== 接入点资源 ====================
export interface AccessPointResource {
  id: string; source_type: string; source_id: string
  name: string; zone: string | null
  annual_irradiance: number | null
  sunshine_hours: number | null
  solar_grade: string | null
  voltage_kv: number | null
  short_circuit_capacity_mva: number | null
  corridor_available: string | null
  transmission_line_length_km: number | null
  unit_cost: number | null
  payback_years: number | null
  irr_pct: number | null
  land_type: string | null
  env_sensitivity: string | null
  geohazard_risk: string | null
  created_at?: string; updated_at?: string
}

export async function fetchAccessPoints() {
  const res = await apiClient.get('/api/v1/achievement/access-points')
  return res.data?.data as AccessPointResource[]
}

export async function updateAccessPoint(id: string, data: Record<string, any>) {
  const res = await apiClient.put(`/api/v1/achievement/access-points/${id}`, data)
  return res.data?.data as AccessPointResource
}

export async function createAccessPoint(data: Record<string, any>) {
  const res = await apiClient.post('/api/v1/achievement/access-points', data)
  return res.data?.data as AccessPointResource
}

export async function importAccessPoints(list: any[]) {
  const res = await apiClient.post('/api/v1/achievement/access-points/import', list)
  return res.data?.data as { inserted: number }
}
