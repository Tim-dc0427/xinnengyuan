// ==================== Plan ====================
export type PlanType = 'DISTRIBUTION' | 'PV_INTEGRATION' | 'GRID_UPGRADE'
export type PlanStatus = 'draft' | 'review' | 'approved' | 'executing' | 'completed'

export interface Plan {
  id: string
  planName: string
  planType: PlanType
  planYear: number
  description: string
  status: PlanStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ==================== PV Model Integration (2.1.1) ====================
export interface PvStation {
  id: string
  name: string
  capacityKw: number
  panelType: string
  panelTypeLabel: string
  ratedVoltageKv: number
  longitude: number
  latitude: number
  landType: string
  landAreaMu: number
  electricalParams: Record<string, number>
  equipmentList: PvEquipmentItem[]
  status: 'planning' | 'construction' | 'operating' | 'retired'
  planId?: string
  createdAt: string
  updatedAt: string
}

export interface PvEquipmentItem {
  equipmentType: string
  modelNumber: string
  quantity: number
  unitPrice: number
  technicalParams: Record<string, number>
}

export interface PvCostLibraryItem {
  id: string
  modelName: string
  modelType: string
  manufacturer: string
  unitCostPerKw: number
  ratedPowerKw: number
  efficiencyPct: number
  lifespanYears: number
  technicalParams: Record<string, number>
  remark: string
  modelTypeId?: string
  installedCapacityKw?: number
  comprehensiveCost?: number
  createdAt: string
}

// ==================== Site Recommendation (2.1.2) ====================
export interface ConstraintRule {
  id: string
  ruleName: string
  ruleType: 'irradiance' | 'grid' | 'land' | 'environment' | 'custom' | ConstraintCategoryType
  weight: number
  enabled: boolean
  params: Record<string, number | string | boolean | any>
  description: string
}

// ===== 布点约束条件详细配置 (2.1.2 扩展) =====
export type ConstraintCategoryType =
  | 'resource'      // 资源禀赋
  | 'grid'          // 电网接入
  | 'land'          // 土地利用
  | 'environment'   // 环境敏感
  | 'load'          // 负荷消纳
  | 'terrain'       // 地形交通
  | 'climate'       // 气象灾害

export interface ConstraintParamField {
  key: string
  label: string
  type: 'number' | 'select' | 'multiSelect' | 'range'
  defaultValue: number | string | string[]
  unit: string
  options?: { label: string; value: any }[]
  min?: number
  max?: number
  step?: number
  description?: string
}

export interface ConstraintCategoryMeta {
  type: ConstraintCategoryType
  name: string
  icon: string
  sortOrder: number
  params: ConstraintParamField[]
}

export interface ConstraintCategoryValue {
  categoryType: ConstraintCategoryType
  paramValues: Record<string, any>
}

export interface ConstraintDetailConfig {
  planId?: string
  categories: ConstraintCategoryValue[]
}

export interface SpatialAnalysisParams {
  regionPolygon: Array<[number, number]>
  constraints: {
    minIrradiance?: number
    maxDistanceToSubstationKm?: number
    landTypes?: string[]
    maxSlope?: number
    minAreaMu?: number
  }
  weights: {
    irradiance: number
    gridAccess: number
    landUse: number
    economic: number
  }
}

export interface CandidatePoint {
  id: string
  planId: string
  stationId?: string
  longitude: number
  latitude: number
  locationDesc: string
  recommendedCapacityKw: number
  comprehensiveScore: number
  scores: {
    absorption: number
    transmission: number
    economic: number
  }
  absorptionCapacityKw: number
  transmissionLineLengthKm: number
  transmissionCost: number
  landCost: number
  constraintDescription: string
  priority: number
  status: 'pending' | 'selected' | 'rejected'
}

// ===== 接入点基础数据（布点规划数据源） =====
export interface PotentialSite {
  id: string
  name: string
  longitude: number
  latitude: number
  areaMu: number
  landType: string
  terrainType: string
  landCostPerMu: number
  isForbidden: boolean
  // 资源禀赋
  annualIrradiance: number
  equivHours: number
  annualSunshineHours: number
  peakSunHours: number
  // 电网接入
  distanceToSubstationKm: number
  availableCapacityMw: number
  shortCircuitMva: number
  // 建设条件
  slopeDeg: number
  description: string
}

// ===== 综合指标评估结果 =====
export interface ComprehensiveEvaluation {
  siteId: string
  locationDesc: string
  evaluationTime: string        // 评估时间
  // 消纳能力
  localMaxLoadKw: number        // 本地最大负荷
  localMinLoadKw: number        // 本地最小负荷
  peakRegulationCapacityKw: number // 可调峰能力
  acceptableCapacityKw: number     // 可接纳容量
  // 送出通道
  lineLengthKm: number           // 线路长度（固定不变）
  constructionDifficulty: string // 施工难度（固定不变）
  constructionCostTenThousand: number // 建设成本
  // 经济性
  landAcquisitionCostTenThousand: number // 征地成本
  rentalCostTenThousandPerYear: number   // 租赁费用
  envAssessmentLevel: string     // 环评等级（固定不变）
}

// ==================== Absorption Scheme (2.1.3) ====================
export interface StorageConfig {
  requiredCapacityKwh: number
  requiredPowerKw: number
  storageType: 'lithium' | 'flow' | 'lead-carbon' | 'other'
  durationHours: number
  estimatedCost: number
  layoutPlan: string
}

export interface ReactiveCompConfig {
  compType: 'SVG' | 'SVC' | 'capacitor' | 'other'
  requiredCapacityKvar: number
  targetPowerFactor: number
  estimatedCost: number
}

export interface LineModificationPlan {
  modificationType: 'upgrade_conductor' | 'new_tie_line' | 'upgrade_transformer' | 'other'
  currentSpec: string
  targetSpec: string
  lineLengthKm: number
  estimatedCost: number
  description: string
  /** 变压器改造 — 当前容量(kVA) */
  currentCapacityKva?: number
  /** 变压器改造 — 目标容量(kVA) */
  targetCapacityKva?: number
  /** 变压器改造 — 电压等级 */
  voltageLevel?: string
}

export interface AbsorptionPlanDetail {
  id: string
  schemeId: string
  planName: string
  candidatePointId: string
  storageConfig: StorageConfig
  reactiveCompConfig: ReactiveCompConfig
  lineModification: LineModificationPlan
  pvOutputProfile: Array<{ time: string; outputKw: number }>
  loadProfile: Array<{ time: string; loadKw: number }>
  absorptionCapacityKw: number
  investmentCost: number
  annualBenefit: number
  parameters: Record<string, number>
  status: 'draft' | 'completed'
  createdAt: string
  updatedAt: string
}

// ===== 方案变体（多方案对比）=====
export interface ComputedIndicators {
  totalInvestmentTenThousand: number
  annualBenefitTenThousand: number
  absorptionCapacityKw: number
  absorptionImprovementPct: number
  paybackPeriodYears: number
  irrPct: number | null
  npv: number | null
  storageCostBreakdown: { equipmentCost: number; constructionCost: number; otherCost: number }
  annualCashflow: Array<{ year: number; netCashflow: number; cumulativeCashflow: number }>
}

export interface SchemeVariant {
  id: string
  name: string
  parentPlanId: string
  storageConfig: StorageConfig
  reactiveCompConfig: ReactiveCompConfig
  lineModification: LineModificationPlan
  computedIndicators: ComputedIndicators
  createdAt: string
}

// ==================== Cost Management (2.1.4) ====================
export interface UnitCostParam {
  id: string
  category: 'equipment' | 'construction' | 'land' | 'other'
  itemName: string
  unitCost: number
  unit: string
  costType: 'fixed' | 'per_kw' | 'per_kwh' | 'per_mu' | 'per_km'
  effectiveDate: string
  remark: string
}

export interface InvestmentResult {
  totalInvestment: number
  breakdown: {
    equipmentCost: number
    constructionCost: number
    landCost: number
    otherCost: number
  }
  unitCostPerKw: number
  details: Array<{
    itemName: string
    amount: number
    proportion: number
  }>
}

export interface CostComparison {
  pvTotalCost: number
  pvUnitCost: number
  traditionalTotalCost: number
  traditionalUnitCost: number
  costAdvantagePct: number
  pvBreakdown?: { equipmentCost: number; constructionCost: number; landCost: number; otherCost: number } | null
  traditionalBreakdown?: { equipmentCost: number; constructionCost: number; landCost: number; otherCost: number } | null
  comparisonChart: {
    labels: string[]
    pvValues: number[]
    traditionalValues: number[]
  }
}

export interface RoiAnalysis {
  upfrontCosts: {
    equipmentInvestment: number
    landCost: number
    constructionCost: number
    otherCost: number
    total: number
  }
  annualRevenue: {
    powerGenerationIncome: number
    greenSubsidy: number
    carbonTradingIncome: number
    total: number
  }
  annualExpenses: {
    operationCost: number
    maintenanceCost: number
    insuranceCost: number
    otherCost: number
    total: number
  }
  financialIndicators: {
    irrPct: number
    npv: number
    paybackPeriodYears: number
    roiPct: number
  }
  yearlyCashflow: Array<{ year: number; netCashflow: number; cumulativeCashflow: number }>
}

// ==================== Equipment Ledger (2.1.5) ====================
export type PvEquipmentType = 'pv_module' | 'inverter' | 'transformer' | 'cable' | 'switchgear' | 'other'
export type PvLifecycleEventType = 'design' | 'procurement' | 'commissioning' | 'operation' | 'maintenance' | 'retirement'

export interface EquipmentLedgerItem {
  id: string
  planId: string
  stationId: string
  equipmentType: PvEquipmentType
  equipmentTypeLabel: string
  equipmentCode: string
  modelNumber: string
  manufacturer: string
  ratedParams: Record<string, any>
  quantity: number
  installDate: string
  status: 'installed' | 'operating' | 'fault' | 'retired'
  locationDesc: string
  createdAt: string
  updatedAt: string
}

export interface EquipmentLifecycleRecord {
  id: string
  equipmentId: string
  eventType: PvLifecycleEventType
  eventTypeLabel: string
  eventTime: string
  operator: string
  description: string
  attachments: string[]
  eventData: Record<string, any>
}

// ==================== PV Model Types (规划工具) ====================
export interface PvModelType {
  id: string
  name: string
  code: string
  description?: string
  sort_order?: number
  fields?: PvModelTypeField[]
  created_at?: string
}

export interface PvModelTypeField {
  id: string
  type_id: string
  field_code: string
  field_name: string
  field_type: string
  field_options?: string
  is_required: number
  sort_order: number
  category?: string
  created_at?: string
}

// ==================== Legacy types ====================
export interface PvStationModel {
  id: string
  planId: string
  name: string
  capacityKw: number
  panelType: string
  ratedVoltageKv: number
  longitude: number
  latitude: number
  landType: string
  electricalParams: Record<string, number>
  equipmentLedger: Array<{
    equipmentType: string
    modelNumber: string
    quantity: number
    unitPrice: number
  }>
}

export interface SiteRecommendationQuery {
  regionPolygon: Array<[number, number]>
  constraints: {
    minIrradiance?: number
    maxDistanceToSubstationKm?: number
    landTypes?: string[]
    maxSlope?: number
    environmentalSensitivity?: string[]
  }
  weights?: {
    irradiance?: number
    gridAccess?: number
    landUse?: number
    economic?: number
  }
}

export interface SiteRecommendation {
  id: string
  planId: string
  longitude: number
  latitude: number
  recommendedCapacityKw: number
  comprehensiveScore: number
  solarIrradianceScore: number
  gridAccessScore: number
  landUseScore: number
  economicScore: number
  constraintDescription: string
  status: string
}

export type SchemeType = 'STORAGE' | 'REACTIVE_COMP' | 'LINE_MOD' | 'COMBINATION'

export interface AbsorptionScheme {
  id: string
  planId: string
  schemeName: string
  schemeType: SchemeType
  energyStorageCapacityKwh: number
  energyStoragePowerKw: number
  reactiveCompensationKvar: number
  lineModificationDescription: string
  estimatedCost: number
  expectedAbsorptionImprovementPct: number
}

export interface AbsorptionSchemeConfig {
  candidatePointId: string
  pvOutputProfile: Array<{ time: string; outputKw: number }>
  loadProfile: Array<{ time: string; loadKw: number }>
  voltageHistory: VoltageIssue[]
  backfeedRisk: 'low' | 'medium' | 'high'
}

interface VoltageIssue {
  time: string
  deviationPct: number
}

export interface UnitCostParams {
  equipmentCategory: string
  unitCostPerKw: number
  unitCostPerKwh: number
  constructionCostPerKw: number
  landCostPerMu: number
  otherCostPct: number
}

export interface EconomicAnalysis {
  totalInvestment: number
  unitCostPerKw: number
  annualOperatingCost: number
  annualRevenue: number
  paybackPeriodYears: number
  irrPct: number
  npv: number
  costBreakdown: {
    equipmentCost: number
    constructionCost: number
    landCost: number
    otherCost: number
  }
  comparisonWithTraditional: {
    traditionalUnitCost: number
    pvUnitCost: number
    costAdvantagePct: number
  }
}
