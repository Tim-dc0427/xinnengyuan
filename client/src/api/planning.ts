import { apiClient } from './client'
import type {
  Plan, PvStation, PvCostLibraryItem, ConstraintRule,
  CandidatePoint, AbsorptionPlanDetail, UnitCostParam,
  InvestmentResult, CostComparison, RoiAnalysis,
  EquipmentLifecycleRecord, EquipmentLedgerItem, PotentialSite, ComprehensiveEvaluation, SchemeVariant,
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
export async function fetchCostLibrary(params?: { modelType?: string }) {
  const res = await apiClient.get('/api/v1/planning/pv-cost-library', { params })
  return res.data?.data as PvCostLibraryItem[]
}

export async function createCostLibraryItem(data: Partial<PvCostLibraryItem>) {
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

// ==================== Cost Management (2.1.4) ====================
export async function fetchUnitCostParams(params?: { category?: string }) {
  const res = await apiClient.get('/api/v1/planning/unit-cost-params', { params })
  return res.data?.data as UnitCostParam[]
}

export async function calculateInvestment(data: { capacityKw: number }) {
  const res = await apiClient.post('/api/v1/planning/calculate-investment', data)
  return res.data?.data as InvestmentResult
}

export async function compareCost(data: { pvCapacityKw: number }) {
  const res = await apiClient.post('/api/v1/planning/compare-cost', data)
  return res.data?.data as CostComparison
}

export async function roiAnalysis(data: {
  capacityKw: number; investment?: number
  storageConfig?: any; reactiveCompConfig?: any; lineModification?: any
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
