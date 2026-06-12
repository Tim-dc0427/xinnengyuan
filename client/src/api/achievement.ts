import { apiClient } from './client'

export interface ProjectItem {
  id: string
  project_code: string
  project_name: string
  project_type: string
  pv_type?: string
  plan_id?: string
  station_id?: string | null
  capacity_kw?: number
  budget?: string
  status: string
  actual_cost?: string
  actual_completion_date?: string
  custom_fields?: string
  created_by?: string
  created_at: string
  updated_at?: string
  // JOIN 字段（forVerification 查询时返回）
  station_name?: string
  installed_capacity_mw?: number
  grid_connection_voltage_kv?: number
  panel_type?: string
  longitude?: number
  latitude?: number
  address?: string
  land_area_mu?: number
  zone?: string
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
export async function fetchProjects(params?: { status?: string; projectType?: string; constructionProgress?: string; gridVoltage?: string; operationStatus?: string; forVerification?: boolean }) {
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
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/documents`, form)
  return res.data?.data as ProjectDocument
}

export async function downloadProjectDocument(projectId: string, docId: string, docName: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/documents/${docId}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = docName; a.click()
  URL.revokeObjectURL(url)
}

export async function previewProjectDocument(projectId: string, docId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/documents/${docId}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  window.open(url, '_blank')
}

export function canPreview(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'txt', 'csv', 'json', 'xml'].includes(ext)
}

export async function deleteProjectDocument(projectId: string, docId: string) { await apiClient.delete(`/api/v1/achievement/projects/${projectId}/documents/${docId}`) }

export async function createProject(data: {
  projectCode: string
  projectName: string
  projectType: string
  pvType?: string
  planId?: string
  stationId?: string
  capacityKw?: number
  budget?: string
  actualCost?: string
  status?: string
  startDate?: string
  expectedCompletionDate?: string
  actualCompletionDate?: string
  customFields?: Record<string, any>
  plannedAnnualOutputMwh?: number
  plannedEquivalentHours?: number
  plannedAbsorptionRatePct?: number
  plannedVoltageCompliancePct?: number
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
  auto_voltage_violation_rate_pct: number | null
  auto_reactive_reverse_rate_pct: number | null
  auto_completeness_pct: number | null

  final_output_kwh: number | null
  final_equivalent_hours: number | null
  final_voltage_compliance_pct: number | null
  final_frequency_compliance_pct: number | null
  final_power_factor_rate: number | null
  final_voltage_violation_rate_pct: number | null
  final_reactive_reverse_rate_pct: number | null
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

// 运行数据实时聚合
export interface RunningStats {
  projectId: string
  stationId: string
  stationName: string | null
  periodStart: string
  periodEnd: string
  auto: {
    outputMwh: number | null
    equivalentHours: number | null
    voltageCompliancePct: number | null
    frequencyCompliancePct: number | null
    powerFactorRate: number | null
    voltageViolationRate: number | null
    reactiveReverseRate: number | null
    absorptionRatePct: number | null
    completenessPct: number | null
  }
  planned: {
    outputMwh: number | null
    equivalentHours: number | null
    absorptionRatePct: number | null
    voltageCompliancePct: number | null
  }
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
  projectType: string
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

// 运行数据实时聚合
export async function fetchRunningStats(projectId: string, periodStart: string, periodEnd: string) {
  const res = await apiClient.get(`/api/v1/achievement/operation-projects/${projectId}/running-stats`, {
    params: { periodStart, periodEnd },
  })
  return res.data?.data as RunningStats
}

// 竣工对标（功能二）
export interface CompletionComparison {
  projectId: string; periodStart: string; periodEnd: string
  planned: Record<string, number | null>
  auto: Record<string, number | null>
  dimensions: Array<{
    dimension: string
    indicators: Array<{ label: string; unit: string; planned: string; actual: string; deviation: string; status: string }>
  }>
  overallVerdict: string
}

export async function fetchCompletionComparison(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/operation-projects/${projectId}/completion-comparison`)
  return res.data?.data as CompletionComparison
}

export async function updateCompletionTargets(projectId: string, targets: Record<string, number>) {
  const res = await apiClient.put(`/api/v1/achievement/operation-projects/${projectId}/completion-targets`, targets)
  return res.data?.data
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
  finalVoltageViolationRate?: number | null
  finalReactiveReverseRate?: number | null
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

// 评估报告
export interface EvaluationReport {
  projectInfo: {
    projectCode: string; projectName: string; stationName: string
    capacityMw: number | string; gridVoltageKv: number | string; operationDate: string
  }
  evaluationPeriod: { start: string; end: string }
  dimensions: Array<{
    dimension: string
    indicators: Array<{ label: string; planned: string; actual: string; deviation: string; status: string }>
  }>
  deviations: Array<{ dimension: string; indicator: string; planned: string; actual: string; deviation: string; autoCause?: string }>
  highlights: Array<{ text: string; dimension: string; indicator: string }>
  improvements: Array<{ text: string; dimension: string; indicator: string }>
  dataCompleteness: string
  hasManualCorrection: boolean
  correctionNote: string | null
  overallVerdict: string
  verifiedAt: string
}

export async function fetchEvaluationReport(verificationId: string) {
  const res = await apiClient.get(`/api/v1/achievement/verifications/${verificationId}/report`)
  return res.data?.data as EvaluationReport
}

// 经验教训案例库
export interface LessonItem {
  id: string
  project_id: string
  verification_id: string | null
  title: string
  type: 'success' | 'lesson'
  dimension: string
  indicator: string | null
  content: string
  cause: string | null
  suggestion: string | null
  created_by: string | null
  created_at: string
}

export async function fetchLessons(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/operation-projects/${projectId}/lessons`)
  return res.data?.data as LessonItem[]
}

export async function createLesson(data: {
  projectId: string; verificationId?: string; title: string; type: string
  dimension: string; indicator?: string; content: string; cause?: string; suggestion?: string
}) {
  const res = await apiClient.post(`/api/v1/achievement/operation-projects/${data.projectId}/lessons`, data)
  return res.data?.data as LessonItem
}

export async function deleteLesson(projectId: string, lessonId: string) {
  await apiClient.delete(`/api/v1/achievement/projects/${projectId}/lessons/${lessonId}`)
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

// ==================== 四维评估模型字段 ====================

export interface AssessmentModelField {
  id: string
  field_code: string
  field_name: string
  field_desc?: string | null
  field_type: 'numeric' | 'text'
  dimension: 'resource' | 'grid' | 'investment' | 'environment'
  base_value?: number | null
  score_rule: string
  text_map?: string | null
  match_value?: string | null
  max_score: number
  fail_score: number
  sort_order: number
  is_active: number
  created_at?: string
  updated_at?: string | null
}

export async function fetchAssessmentModelFields() {
  const res = await apiClient.get('/api/v1/achievement/assessment-model/fields')
  return res.data?.data as AssessmentModelField[]
}

export async function createAssessmentModelField(data: {
  fieldCode: string
  fieldName: string
  fieldDesc?: string
  fieldType: 'numeric' | 'text'
  dimension: 'resource' | 'grid' | 'investment' | 'environment'
  baseValue?: number | null
  scoreRule: string
  textMap?: Record<string, number> | null
  matchValue?: string | null
  maxScore?: number
  failScore?: number
  sortOrder?: number
}) {
  const res = await apiClient.post('/api/v1/achievement/assessment-model/fields', data)
  return res.data?.data as AssessmentModelField
}

export async function updateAssessmentModelField(id: string, data: Record<string, any>) {
  const res = await apiClient.put(`/api/v1/achievement/assessment-model/fields/${id}`, data)
  return res.data?.data as AssessmentModelField
}

export async function deleteAssessmentModelField(id: string) {
  await apiClient.delete(`/api/v1/achievement/assessment-model/fields/${id}`)
}

export async function resetAssessmentModelDefaults() {
  const res = await apiClient.post('/api/v1/achievement/assessment-model/reset')
  return res.data?.data as AssessmentModelField[]
}

// ==================== 项目版本管理 ====================

export interface ProjectVersion {
  id: string
  project_id: string
  version_number: number
  stage: string
  snapshot?: string
  changed_fields?: string
  changelog?: string
  created_by?: string
  created_at: string
}

export interface VersionDiff {
  v1: ProjectVersion
  v2: ProjectVersion
  diffs: Array<{ field: string; v1Value: any; v2Value: any }>
}

export async function fetchProjectVersions(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/versions`)
  return res.data?.data as ProjectVersion[]
}

export async function fetchVersionDetail(versionId: string) {
  const res = await apiClient.get(`/api/v1/achievement/project-versions/${versionId}`)
  return res.data?.data as ProjectVersion & { snapshot?: any; changedFields?: any }
}

export async function compareVersions(projectId: string, v1: number, v2: number) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/versions/compare`, { params: { v1, v2 } })
  return res.data?.data as VersionDiff
}

export async function restoreProjectVersion(projectId: string, versionId: string) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/versions/${versionId}/restore`)
  return res.data?.data as ProjectItem
}

// ==================== 项目档案核心内容 ====================

export interface ArchiveCompleteness {
  totalFields: number
  filledFields: number
  rate: number
  missingFields: string[]
}

export interface OutputCurvePoint {
  time: string
  activePower: number
  voltage: number
  powerFactor: number
}

export interface DeviceParam {
  id: string
  rootId: string
  modelName: string
  version: number
  ratedCapacityMw: number
  ratedVoltageKv: number
  powerFactor: number
  efficiencyPct: number
  shortCircuitRatio: number
  mpptAlgorithm: string
  powerLimitMode: string
  rampRateLimit: number
  lvrtEnabled: number
  hvrtEnabled: number
  islandProtection: number
  designTempC: number
  designIrradiance: number
  designHumidityPct: number
  altitudeM: number
  soilingFactor: number
  changeSummary?: string
  createdAt?: string
}

export interface ProjectArchive {
  project: ProjectItem
  deviceParams: DeviceParam[]
  documents: ProjectDocument[]
  adjustments: PlanAdjustment[]
  completeness: ArchiveCompleteness
}

export async function fetchProjectArchive(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/archive`)
  return res.data?.data as ProjectArchive
}

export async function fetchCompleteness(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/completeness`)
  return res.data?.data as ArchiveCompleteness
}

export async function fetchOutputCurve(projectId: string, period: 'day' | 'week' | 'month' = 'day', date?: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/output-curve`, { params: { period, date } })
  return res.data?.data as OutputCurvePoint[]
}

export async function fetchProjectDeviceParams(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/device-params`)
  return res.data?.data as DeviceParam[]
}

// ==================== 合规性检查 ====================

export interface ComplianceCheckItem {
  id: string
  code: string
  name: string
  category: string
  description?: string
  check_rule: string
  rule_config: string
  is_enabled: number
  sort_order: number
}

export interface ComplianceCheckResult {
  id: string
  project_id: string
  checklist_item_id: string
  checkItemName?: string
  checkItemCode?: string
  category?: string
  check_status: 'pass' | 'fail' | 'pending' | 'na'
  actual_value?: string
  detail?: any
  checked_by?: string
  checked_at?: string
}

export interface ComplianceReport {
  projectInfo: {
    projectCode: string
    projectName: string
    stationName: string
    capacityMw: number | string
    gridVoltageKv: number | string
    status: string
  }
  checkedAt: string
  results: ComplianceCheckResult[]
  summary: { passCount: number; failCount: number; pendingCount: number; total: number }
  overallVerdict: string
}

export async function fetchComplianceChecklist() {
  const res = await apiClient.get('/api/v1/achievement/compliance-checklist')
  return res.data?.data as ComplianceCheckItem[]
}

export async function runComplianceCheck(projectId: string) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/compliance-check`)
  return res.data?.data as ComplianceCheckResult[]
}

export async function fetchComplianceResults(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/compliance-results`)
  return res.data?.data as ComplianceCheckResult[]
}

export async function fetchComplianceReport(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/compliance-report`)
  return res.data?.data as ComplianceReport
}

// ==================== 规划调整记录 ====================

export interface PlanAdjustment {
  id: string
  project_id: string
  adjustment_type: string
  field_path?: string
  old_value?: string
  new_value?: string
  reason: string
  approval_status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  created_by?: string
  created_at: string
}

export async function fetchPlanAdjustments(projectId: string) {
  const res = await apiClient.get(`/api/v1/achievement/projects/${projectId}/plan-adjustments`)
  return res.data?.data as PlanAdjustment[]
}

export async function createPlanAdjustment(projectId: string, data: {
  adjustmentType: string
  fieldPath?: string
  oldValue?: string
  newValue?: string
  reason: string
}) {
  const res = await apiClient.post(`/api/v1/achievement/projects/${projectId}/plan-adjustments`, data)
  return res.data?.data as PlanAdjustment
}

export async function approvePlanAdjustment(id: string, status: 'approved' | 'rejected') {
  const res = await apiClient.put(`/api/v1/achievement/plan-adjustments/${id}/approve`, { status })
  return res.data?.data as PlanAdjustment
}
