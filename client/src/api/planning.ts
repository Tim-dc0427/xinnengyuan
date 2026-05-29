import { apiClient } from './client'
import type {
  Plan, PvStation, PvCostLibraryItem, ConstraintRule,
  CandidatePoint, AbsorptionPlanDetail, UnitCostParam,
  InvestmentResult, CostComparison, RoiAnalysis,
  EquipmentLifecycleRecord, EquipmentLedgerItem, PotentialSite, ComprehensiveEvaluation, SchemeVariant,
  PvModelType, PvModelTypeField,
} from '@new-energy/shared'

// ==================== Plan ====================
export async function fetchPlans(params?: { status?: string; planYear?: number }) {
  const res = await apiClient.get('/api/v1/planning', { params })
  return res.data?.data as Plan[]
}

export async function createPlan(data: Partial<Plan>) {
  const res = await apiClient.post('/api/v1/planning', data)
  return res.data?.data as Plan
}

export async function updatePlan(id: string, data: Partial<Plan>) {
  const res = await apiClient.put(`/api/v1/planning/${id}`, data)
  return res.data?.data as Plan
}

// ==================== PV Stations (2.1.1) ====================
export async function fetchPvStations(params?: { planId?: string; status?: string }) {
  const res = await apiClient.get('/api/v1/planning/pv-stations', { params })
  return res.data?.data as PvStation[]
}

export async function createPvStation(data: Partial<PvStation>) {
  const res = await apiClient.post('/api/v1/planning/pv-stations', data)
  return res.data?.data as PvStation
}

export async function updatePvStation(id: string, data: Partial<PvStation>) {
  const res = await apiClient.put(`/api/v1/planning/pv-stations/${id}`, data)
  return res.data?.data as PvStation
}

export async function deletePvStation(id: string) {
  const res = await apiClient.delete(`/api/v1/planning/pv-stations/${id}`)
  return res.data?.data
}

// ==================== PV Cost Library (2.1.1) ====================
export async function fetchCostLibrary(params?: { modelType?: string; modelTypeId?: string }) {
  const res = await apiClient.get('/api/v1/planning/pv-cost-library', { params })
  return res.data?.data as PvCostLibraryItem[]
}

export async function upsertCostLibraryItem(data: { modelTypeId: string; unitCostPerKw?: number; remark?: string }) {
  const res = await apiClient.post('/api/v1/planning/pv-cost-library', data)
  return res.data?.data as PvCostLibraryItem
}

// ==================== Constraint Rules (2.1.2) ====================
export async function fetchConstraintRules(params?: { planId?: string }) {
  const res = await apiClient.get('/api/v1/planning/constraint-rules', { params })
  return res.data?.data as ConstraintRule[]
}

export async function saveConstraintRules(data: Partial<ConstraintRule>[]) {
  const res = await apiClient.post('/api/v1/planning/constraint-rules', data)
  return res.data?.data as ConstraintRule[]
}

// ==================== Potential Sites & Evaluation ====================
export async function fetchPotentialSites() {
  const res = await apiClient.get('/api/v1/planning/potential-sites')
  return res.data?.data as PotentialSite[]
}

export async function fetchEvaluation() {
  const res = await apiClient.get('/api/v1/planning/evaluate')
  return res.data?.data as ComprehensiveEvaluation[]
}

// ==================== Candidate Points (2.1.2) ====================
export async function runSpatialAnalysis(data: any) {
  const res = await apiClient.post('/api/v1/planning/spatial-analysis', data)
  return res.data?.data as CandidatePoint[]
}

export async function fetchCandidatePoints(params?: { planId?: string; status?: string }) {
  const res = await apiClient.get('/api/v1/planning/candidate-points', { params })
  return res.data?.data as CandidatePoint[]
}

// ==================== Absorption Plans (2.1.3) ====================
/** 将 API 返回的 snake_case 消纳方案数据映射为前端 camelCase */
function mapAbsorptionPlan(item: any): AbsorptionPlanDetail {
  if (!item) return item

  const parseJSON = (val: any, fallback: any = null) => {
    if (!val) return fallback
    if (typeof val === 'string') { try { return JSON.parse(val) } catch { return fallback } }
    return val
  }

  return {
    id: item.id,
    schemeId: item.scheme_id ?? item.schemeId ?? item.schemeId,
    planName: item.plan_name ?? item.planName,
    candidatePointId: item.candidate_point_id ?? item.candidatePointId,
    storageConfig: parseJSON(item.storage_config ?? item.storageConfig, {}),
    reactiveCompConfig: parseJSON(item.reactive_comp_config ?? item.reactiveCompConfig, {}),
    lineModification: parseJSON(item.line_modification ?? item.lineModification, {}),
    pvOutputProfile: parseJSON(item.pv_output_profile ?? item.pvOutputProfile, []),
    loadProfile: parseJSON(item.load_profile ?? item.loadProfile, []),
    absorptionCapacityKw: item.absorption_capacity_kw ?? item.absorptionCapacityKw ?? 0,
    investmentCost: item.investment_cost ?? item.investmentCost ?? 0,
    annualBenefit: item.annual_benefit ?? item.annualBenefit ?? 0,
    parameters: parseJSON(item.parameters ?? item.parameters, {}),
    status: item.status ?? 'draft',
    createdAt: item.created_at ?? item.createdAt ?? '',
    updatedAt: item.updated_at ?? item.updatedAt ?? '',
  }
}

export async function generateAbsorptionPlan(data: any) {
  const res = await apiClient.post('/api/v1/planning/absorption-plans', data)
  return mapAbsorptionPlan(res.data?.data)
}

export async function fetchAbsorptionPlan(id: string) {
  const res = await apiClient.get(`/api/v1/planning/absorption-plans/${id}`)
  return mapAbsorptionPlan(res.data?.data)
}

export async function updateAbsorptionPlan(id: string, data: Partial<AbsorptionPlanDetail>) {
  const res = await apiClient.put(`/api/v1/planning/absorption-plans/${id}`, data)
  return mapAbsorptionPlan(res.data?.data)
}

// ==================== Scheme Variants (多方案对比) ====================
export async function fetchPlanVariants(planId: string) {
  const res = await apiClient.get(`/api/v1/planning/absorption-plans/${planId}/variants`)
  return res.data?.data as SchemeVariant[]
}

export async function createPlanVariant(planId: string, data: {
  variantName: string
  storageConfig: any
  reactiveCompConfig: any
  lineModification: any
  computedIndicators: any
}) {
  const res = await apiClient.post(`/api/v1/planning/absorption-plans/${planId}/variants`, {
    parentPlanId: planId,
    ...data,
  })
  return res.data?.data as SchemeVariant
}

export async function deletePlanVariant(variantId: string) {
  const res = await apiClient.delete(`/api/v1/planning/absorption-plans/variants/${variantId}`)
  return res.data?.data
}

// ==================== Cost Items (造价参数管理) ====================
export interface CostItem {
  id: string
  item_code: string
  category: string
  sub_category?: string
  equipment_type?: string
  model_spec?: string
  item_name: string
  unit_price: number
  cost_unit: string
  created_at?: string
  updated_at?: string
}

export async function fetchCostItems(params?: {
  category?: string; subCategory?: string; equipmentType?: string; itemCode?: string
}) {
  const res = await apiClient.get('/api/v1/planning/cost-items', { params })
  return res.data?.data as CostItem[]
}

export async function createCostItem(data: {
  itemCode: string; category: string; subCategory?: string
  equipmentType?: string; modelSpec?: string; itemName: string
  unitPrice: number; costUnit: string
}) {
  const res = await apiClient.post('/api/v1/planning/cost-items', data)
  return res.data?.data as CostItem
}

export async function updateCostItem(id: string, data: {
  itemCode?: string; category?: string; subCategory?: string
  equipmentType?: string; modelSpec?: string; itemName?: string
  unitPrice?: number; costUnit?: string
}) {
  const res = await apiClient.put(`/api/v1/planning/cost-items/${id}`, data)
  return res.data?.data as CostItem
}

export async function deleteCostItem(id: string) {
  const res = await apiClient.delete(`/api/v1/planning/cost-items/${id}`)
  return res.data?.data
}

// ==================== Investment Config (投资配置方案) ====================
export interface InvestmentConfigItem {
  id: string
  plan_id: string
  cost_item_id: string
  quantity: number
  unit_price: number
  item_code?: string
  equipment_type?: string
  model_spec?: string
  cost_item_name?: string
  cost_unit?: string
  created_at?: string
  updated_at?: string
}

export async function fetchInvestmentConfig(params?: { planId?: string }) {
  const res = await apiClient.get('/api/v1/planning/investment-config', { params })
  return res.data?.data as InvestmentConfigItem[]
}

export async function saveInvestmentConfig(planId: string, items: Array<{
  costItemId: string; quantity: number
}>) {
  const res = await apiClient.post(`/api/v1/planning/investment-config/${planId}`, items)
  return res.data?.data as InvestmentConfigItem[]
}

// ==================== Cost Management (2.1.4) ====================
export async function fetchUnitCostParams(params?: { category?: string }) {
  const res = await apiClient.get('/api/v1/planning/unit-cost-params', { params })
  return res.data?.data as UnitCostParam[]
}

export async function calculateInvestment(data: { capacityKw: number; planId?: string }) {
  const res = await apiClient.post('/api/v1/planning/calculate-investment', data)
  return res.data?.data as InvestmentResult
}

export async function compareCost(data: { planIdA?: string; planIdB?: string }) {
  const res = await apiClient.post('/api/v1/planning/compare-cost', data)
  return res.data?.data as CostComparison
}

export async function roiAnalysis(data: {
  planId?: string; capacityKw?: number; investment?: number
  annualHours?: number; gridPrice?: number
  subsidyPrice?: number; carbonPrice?: number; omRate?: number; projectLife?: number
}) {
  const res = await apiClient.post('/api/v1/planning/roi-analysis', data)
  return res.data?.data as RoiAnalysis
}

// ==================== Equipment Ledger (2.1.5) ====================

/** 将 API 返回的 snake_case 设备数据映射为前端 camelCase */
function mapEquipmentItem(item: any): EquipmentLedgerItem {
  if (!item) return item
  return {
    id: item.id,
    planId: item.plan_id ?? item.planId,
    stationId: item.station_id ?? item.stationId,
    equipmentType: item.equipment_type ?? item.equipmentType,
    equipmentTypeLabel: item.equipment_type_label ?? item.equipmentTypeLabel,
    equipmentCode: item.equipment_code ?? item.equipmentCode,
    modelNumber: item.model_number ?? item.modelNumber,
    manufacturer: item.manufacturer,
    ratedParams: typeof item.rated_params === 'string'
      ? JSON.parse(item.rated_params)
      : (item.rated_params ?? item.ratedParams ?? {}),
    quantity: item.quantity,
    installDate: item.install_date ?? item.installDate,
    status: item.status,
    locationDesc: item.location_desc ?? item.locationDesc,
    createdAt: item.created_at ?? item.createdAt,
    updatedAt: item.updated_at ?? item.updatedAt,
  }
}

function mapEquipmentItemList(items: any[]): EquipmentLedgerItem[] {
  return (items || []).map(mapEquipmentItem)
}

export async function fetchEquipmentLedger(planId: string) {
  const res = await apiClient.get(`/api/v1/planning/equipment-ledger/${planId}`)
  return mapEquipmentItemList(res.data?.data)
}

export async function fetchEquipmentByStation(stationId: string) {
  const res = await apiClient.get(`/api/v1/planning/equipment-by-station/${stationId}`)
  return mapEquipmentItemList(res.data?.data)
}

export async function createEquipmentItem(data: Partial<EquipmentLedgerItem>) {
  const res = await apiClient.post('/api/v1/planning/equipment-items', data)
  return mapEquipmentItem(res.data?.data)
}

export async function updateEquipmentItem(id: string, data: Partial<EquipmentLedgerItem>) {
  const res = await apiClient.put(`/api/v1/planning/equipment-items/${id}`, data)
  return mapEquipmentItem(res.data?.data)
}

export async function deleteEquipmentItem(id: string) {
  const res = await apiClient.delete(`/api/v1/planning/equipment-items/${id}`)
  return res.data?.data
}

export async function createLifecycleRecord(data: Partial<EquipmentLifecycleRecord>) {
  const res = await apiClient.post('/api/v1/planning/equipment-lifecycle', data)
  return res.data?.data as EquipmentLifecycleRecord
}

export async function fetchLifecycleRecords(equipmentId: string) {
  const res = await apiClient.get(`/api/v1/planning/equipment-lifecycle/${equipmentId}`)
  return res.data?.data as EquipmentLifecycleRecord[]
}

// ==================== PV Model Types (规划工具) ====================
export async function fetchPvModelTypes() {
  const res = await apiClient.get('/api/v1/planning/pv-model-types')
  return res.data?.data as PvModelType[]
}

export async function fetchPvModelTypeWithFields(id: string) {
  const res = await apiClient.get(`/api/v1/planning/pv-model-types/${id}/with-fields`)
  return res.data?.data as PvModelType
}

export async function createPvModelType(data: { name: string; code: string; description?: string; sortOrder?: number }) {
  const res = await apiClient.post('/api/v1/planning/pv-model-types', data)
  return res.data?.data as PvModelType
}

export async function updatePvModelType(id: string, data: { name?: string; description?: string; sortOrder?: number }) {
  const res = await apiClient.put(`/api/v1/planning/pv-model-types/${id}`, data)
  return res.data?.data as PvModelType
}

export async function deletePvModelType(id: string) {
  const res = await apiClient.delete(`/api/v1/planning/pv-model-types/${id}`)
  return res.data?.data
}

export async function fetchModelTypeFields(typeId: string) {
  const res = await apiClient.get(`/api/v1/planning/pv-model-types/${typeId}/fields`)
  return res.data?.data as PvModelTypeField[]
}

export async function saveModelTypeFields(typeId: string, fields: Array<{
  fieldCode: string; fieldName: string; fieldType: string
  fieldOptions?: string; isRequired: boolean; sortOrder: number
}>) {
  const res = await apiClient.post(`/api/v1/planning/pv-model-types/${typeId}/fields`, fields)
  return res.data?.data as PvModelTypeField[]
}

// ==================== Field Library (字段库) ====================
export async function fetchFieldLibrary(keyword?: string) {
  const res = await apiClient.get('/api/v1/planning/field-library', { params: keyword ? { keyword } : {} })
  return res.data?.data as Array<{ id: string; field_code: string; field_name: string; field_type: string; field_options?: string; category?: string }>
}

export async function createFieldLibraryItem(data: { fieldCode: string; fieldName: string; fieldType: string; fieldOptions?: string; category?: string }) {
  const res = await apiClient.post('/api/v1/planning/field-library', data)
  return res.data?.data
}
