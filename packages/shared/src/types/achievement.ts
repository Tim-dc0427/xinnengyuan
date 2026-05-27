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
  capacityKw: number
  budget: number
  actualCost: number
  status: ProjectStatus
  startDate: string
  expectedCompletionDate: string
  actualCompletionDate: string | null
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
  projectId: string
  verificationDate: string
  plannedOutputKwh: number
  actualOutputKwh: number
  absorptionRatePct: number
  voltageCompliancePct: number
  deviationPct: number
  isEffective: boolean
  remarks: string
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
