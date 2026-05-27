// ==================== Power Plant ====================
export type PlantType = 'PV' | 'WIND' | 'STORAGE' | 'PV_STORAGE'
export type PlantStatus = 'active' | 'maintenance' | 'decommissioned'

export interface PowerPlant {
  id: string
  name: string
  plantType: PlantType
  capacityKw: number
  installedDate: string
  longitude: number
  latitude: number
  address: string
  status: PlantStatus
  metadata: Record<string, unknown>
  createdAt: string
}

// ==================== PV Output ====================
export interface PvOutputRecord {
  time: string
  plantId: string
  activePowerKw: number
  reactivePowerKvar: number
  voltageV: number
  currentA: number
  frequencyHz: number
  powerFactor: number
  temperatureC: number
  irradianceWm2: number
  humidityPct: number
  inverterEfficiency: number
}

export interface PvOutputStats {
  plantId: string
  plantName: string
  totalOutputKwh: number
  avgOutputKw: number
  maxOutputKw: number
  capacityFactor: number
  yoyChangePct: number
  momChangePct: number
}

export interface PvOutputStatsQuery {
  startDate: string
  endDate: string
  regionId?: string
  voltageLevel?: string
  aggregationType: 'hour' | 'day' | 'month' | 'year'
  compareMode?: 'yoy' | 'mom' | 'none'
}

// ==================== Influencing Factors ====================
export interface FactorAnalysisResult {
  plantId: string
  plantName: string
  correlationCoefficient: number
  factorType: 'irradiance' | 'temperature' | 'humidity' | 'equipment_age' | 'inverter_efficiency'
  impactDescription: string
  chartData: Array<{ x: number; y: number }>
}

// ==================== Extreme Scenario ====================
export type ExtremeScenarioType = 'high_temperature' | 'rainstorm'

export interface ExtremeScenarioResult {
  scenarioType: ExtremeScenarioType
  outputDropPct: number
  absorptionCapacityChange: number
  backupCapacityRequired: number
  recommendations: string[]
  timeSeriesData: Array<{ time: string; outputKw: number; absorptionKw: number }>
}

// ==================== Carbon Emission ====================
export interface CarbonStats {
  plantId: string
  periodStart: string
  totalOutputKwh: number
  co2ReductionKg: number
  coalSavingTon: number
  so2ReductionKg: number
  noxReductionKg: number
}

// ==================== Joint Output ====================
export interface JointOutputData {
  time: string
  pvOutputKw: number
  storageChargeKw: number
  storageDischargeKw: number
  jointOutputKw: number
}

export interface JointOutputAnalysis {
  plantId: string
  storageId: string
  timeSeries: JointOutputData[]
  fluctuationStdDev: number
  peakValleyDiff: number
  peakShavingCapacityKw: number
}

// ==================== Equipment ====================
export type EquipmentType = 'TRANSFORMER' | 'BREAKER' | 'CABLE' | 'SWITCH' | 'INVERTER'
export type ReliabilityGrade = 'A' | 'B' | 'C'

export interface Equipment {
  id: string
  plantId: string
  equipmentType: EquipmentType
  modelNumber: string
  manufacturer: string
  ratedCapacityKva: number
  ratedVoltageKv: number
  ratedCurrentA: number
  installationDate: string
  designLifeYears: number
  longitude: number
  latitude: number
  parentEquipmentId: string | null
  grade: ReliabilityGrade
  status: string
  metadata: Record<string, unknown>
}

export interface EquipmentCapacityResult {
  equipmentId: string
  equipmentType: EquipmentType
  shortCircuitCurrent: number
  throughCurrent: number
  isOverloaded: boolean
  loadRate: number
  riskLevel: string
}

export interface EquipmentLifecycle {
  id: string
  equipmentId: string
  eventType: string
  eventDate: string
  description: string
  cost: number
  performedBy: string
  remainingLifeYears: number
  nextMaintenanceDate: string
}

export interface ReplacementPlan {
  equipmentId: string
  equipmentName: string
  priority: number
  reason: string
  suggestedDate: string
  estimatedCost: number
}

// ==================== Voltage ====================
export interface VoltageMeasurement {
  time: string
  equipmentId: string
  phaseAV: number
  phaseBV: number
  phaseCV: number
  voltageDeviationPct: number
}

export interface VoltageFluctuation {
  pointId: string
  timeSeries: Array<{ time: string; voltageV: number; fluctuationPct: number }>
  maxFluctuationPct: number
  avgFluctuationPct: number
  thresholdViolations: number
}

export interface PowerSupplyReliability {
  saifi: number    // System Average Interruption Frequency Index
  saidi: number    // System Average Interruption Duration Index
  theoreticalReliability: number
  actualReliability: number
  deviationPct: number
  faultTreeNodes: FaultTreeNode[]
}

export interface FaultTreeNode {
  id: string
  label: string
  type: 'root' | 'intermediate' | 'leaf'
  failureRate: number
  children?: FaultTreeNode[]
}

export interface VoltageQualification {
  regionId: string
  voltageLevel: string
  qualificationRate: number
  totalHours: number
  qualifiedHours: number
}

// ==================== Alert ====================
export type AlertLevel = 'INFO' | 'WARN' | 'CRITICAL' | 'EMERGENCY'
export type AlertSourceType = 'VOLTAGE' | 'EQUIPMENT' | 'POWER_FLOW' | 'PV_OUTPUT'

export interface Alert {
  id: string
  alertLevel: AlertLevel
  sourceType: AlertSourceType
  sourceId: string
  title: string
  message: string
  triggeredAt: string
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
}
