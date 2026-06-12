export const RELIABILITY_GRADES = {
  A: '高可靠性',
  B: '中可靠性',
  C: '低可靠性',
} as const

export const RELIABILITY_GRADE_THRESHOLDS = {
  A: { minReliability: 0.99, maxFailureRate: 0.01 },
  B: { minReliability: 0.97, maxFailureRate: 0.03 },
  C: { minReliability: 0, maxFailureRate: Infinity },
} as const

export const EQUIPMENT_STATUS = {
  OPERATIONAL: 'operational',
  MAINTENANCE: 'maintenance',
  FAULT: 'fault',
  DECOMMISSIONED: 'decommissioned',
} as const
