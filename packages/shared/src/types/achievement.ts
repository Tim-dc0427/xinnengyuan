// ==================== Project ====================
export type ProjectType = 'PV_GRID_CONNECTION' | 'PV_STORAGE' | 'GRID_UPGRADE'
export type ProjectStatus = 'initiated' | 'feasibility' | 'approved' | 'construction' | 'completed' | 'closed'

export interface Project {
  id: string
  projectCode: string
  projectName: string
  projectType: ProjectType
  pvType: string | null
  planId: string | null
  stationId: string | null
  capacityKw: number
  budget: number
  actualCost: number | null
  status: ProjectStatus
  startDate: string
  expectedCompletionDate: string
  actualCompletionDate: string | null
  customFields?: Record<string, any>
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ==================== Access Condition ====================
export type ConditionType = 'VOLTAGE_LEVEL' | 'CAPACITY' | 'DISTANCE' | 'PROTECTION' | 'METERING'

export interface AccessCondition {
  id: string
  projectId: string
  conditionType: ConditionType
  requirement: string
  actualValue: string
  isSatisfied: boolean
  verifiedBy: string | null
  verifiedAt: string | null
}

// ==================== Feasibility Assessment ====================
export interface FeasibilityAssessment {
  projectId: string
  technicalScore: number
  economicScore: number
  environmentalScore: number
  socialScore: number
  comprehensiveScore: number
  assessedBy: string
  assessedAt: string
}

export interface FeasibilityWeights {
  technical: number
  economic: number
  environmental: number
  social: number
}

export interface ConstraintItem {
  dimension: string
  issue: string
  severity: 'high' | 'medium' | 'low'
  improvementDirection: string
}

export interface FeasibilityReport {
  projectInfo: Project
  scores: FeasibilityAssessment
  constraints: ConstraintItem[]
  recommendations: string[]
}

// ==================== Effectiveness ====================
export interface EffectivenessVerification {
  id: string
  project_id: string
  period_start: string
  period_end: string
  // 自动聚合值
  auto_output_kwh: number | null
  auto_equivalent_hours: number | null
  auto_voltage_compliance_pct: number | null
  auto_frequency_compliance_pct: number | null
  auto_power_factor_rate: number | null
  auto_completeness_pct: number | null
  // 手动修正值
  final_output_kwh: number | null
  final_equivalent_hours: number | null
  final_voltage_compliance_pct: number | null
  final_frequency_compliance_pct: number | null
  final_power_factor_rate: number | null
  final_voltage_violation_rate: number | null
  final_reactive_reverse_rate: number | null
  final_completeness_pct: number | null
  // 消纳率
  absorption_rate_pct: number | null
  // 规划目标快照
  planned_output_mwh: number | null
  planned_equivalent_hours: number | null
  planned_absorption_rate_pct: number | null
  planned_voltage_compliance_pct: number | null
  // 修正标记
  manual_override: number
  correction_note: string | null
  // 判定
  is_effective: number
  remarks: string | null
  verified_by: string | null
  created_at: string
}

export interface EffectivenessReport {
  projectOverview: string
  targetCompletion: {
    plannedOutput: number
    actualOutput: number
    deviationPct: number
  }
  causeAnalysis: string
  lessonsLearned: string[]
}

// ==================== Assessment Model ====================
export type AssessmentDimension = 'resource' | 'grid' | 'investment' | 'environment'
export type FieldType = 'numeric' | 'text'
export type ScoreRule =
  | 'direct_ratio'
  | 'inverse_ratio'
  | 'threshold_full'
  | 'map_direct'
  | 'map_inverse'
  | 'map_fixed'
  | 'match_full'

export interface AssessmentModelField {
  id: string
  field_code: string
  field_name: string
  field_desc?: string | null
  field_type: FieldType
  dimension: AssessmentDimension
  base_value?: number | null
  score_rule: ScoreRule
  text_map?: string | null
  match_value?: string | null
  max_score: number
  fail_score: number
  sort_order: number
  is_active: number
  created_at?: string
  updated_at?: string | null
}

// ==================== Project Audit ====================
export interface ProjectAuditEntry {
  id: string
  projectId: string
  action: string
  oldStatus: string
  newStatus: string
  comment: string
  performedBy: string
  createdAt: string
}

export interface ProjectHistory {
  version: number
  timestamp: string
  operator: string
  changeType: string
  snapshot: Project
}
