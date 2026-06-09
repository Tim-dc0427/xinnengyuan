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
  aggregationType?: 'hour' | 'day' | 'month' | 'year'
  compareMode?: 'yoy' | 'mom' | 'none'
  groupBy?: 'station' | 'zone' | 'voltage_level'
}

// 聚合后的出力统计
export interface AggregatedOutputStats {
  groupKey: string
  groupType: 'station' | 'zone' | 'voltage_level'
  stationName?: string
  zone?: string
  voltageLevel?: string
  installedCapacityMw: number
  totalOutputKwh: number
  avgOutputKw: number
  maxOutputKw: number
  stationCount: number
  generationHours?: number
  prevTotalOutputKwh?: number
  changePct?: number | null
  prevGenerationHours?: number
  generationHoursChangePct?: number | null
}

// 电站选项（下拉列表）
export interface StationOption {
  id: string
  stationName: string
  installedCapacityMw: number
  gridConnectionVoltageKv: number
  longitude: number
  latitude: number
  zone: string
  voltageLevel: string
}

export interface BackfeedItem {
  time: string
  activePowerKw: number
  reactivePowerKvar: number
  apparentPowerKva: number
  direction: 'forward' | 'reverse'
  isBackfeed: boolean
}

export interface StationSnapshot {
  stationId: string
  stationName: string
  installedCapacityMw: number
  gridConnectionVoltageKv: number
  longitude: number
  latitude: number
  zone: string
  voltageLevel: string
  time: string
  activePowerKw: number
  reactivePowerKvar: number
  apparentPowerKva: number
  direction: 'forward' | 'reverse'
  isBackfeed: boolean
}

// 储能选项
export interface StorageOption {
  id: string
  name: string
  ratedPowerKw: number
  ratedCapacityKwh: number
  storageType: string
  zone: string
}

// ==================== Influencing Factors ====================
export interface ControlVariableDetail {
  factorKey: string
  factorLabel: string
  unit: string
  mean: number
  stdDev: number
  min: number
  max: number
}

export interface FactorAnalysisResult {
  stationId: string
  factorType: 'irradiance' | 'temperature' | 'humidity' | 'equipment_age' | 'inverter_efficiency'
  factorLabel: string
  correlationCoefficient: number
  partialCorrelationCoefficient: number
  controlledVariables: string
  controlDetails: ControlVariableDetail[]
  impactDescription: string
  chartData: Array<{ x: number; y: number }>
  normalizedChartData: Array<{ x: number; y: number }>
  baseIrradiance?: number
  ageYears?: number
}

// ==================== Extreme Scenario ====================
export type ExtremeScenarioType = 'high_temperature' | 'rainstorm'

// -------- 请求参数 --------

/** 高温场景参数 */
export interface HighTempParams {
  maxTemperatureC: number          // 最高温度 ℃ (30~55)
  minTemperatureC: number          // 最低温度 ℃ (18~32)
  peakTimeHour: number             // 峰值时刻 小时 (12~16)
  durationHalfHours: number        // 高温持续半宽 h (2~6)
}

/** 暴雨场景参数 */
export interface RainstormParams {
  rainfallIntensityMmh: number     // 降雨强度 mm/h (5~50)
  cloudCoverRatio: number          // 云层覆盖率 (0.5~1.0)
  durationHours: number            // 持续时长 h (2~12)
  peakTimeHour: number             // 暴雨中心时刻 h (10~18)
}

/** 极端场景模拟请求 */
export interface ExtremeScenarioRequest {
  stationId: string
  scenarioType: ExtremeScenarioType
  params: HighTempParams | RainstormParams
}

// -------- 时序数据 --------

/** 单时刻供需与备用分析 */
export interface TimePointAnalysis {
  time: string
  temperatureC: number             // 当前环境温度
  rainfallIntensityMmh?: number    // 逐时降雨强度 mm/h（暴雨场景）
  outputKw: number                 // 正常光伏出力（晴好天气预期）
  degradedOutputKw: number         // 极端场景光伏出力
  dropPct: number                  // 出力骤降比例（%）
  loadMw: number                   // 本地负荷
  supplyGapMw: number              // 供需缺口（负荷-极端出力，正值=缺电需备用填补）
  backupNeededMw: number           // 备用容量需求
  storageSupportHours: number      // 储能可支撑时长（当前SOC / 缺口功率）
}

/** 分时段备用电源配置建议 */
export interface BackupConfigSegment {
  timeRange: string
  loadMw: number
  pvOutputMw: number
  supplyGapMw: number
  backupRequiredMw: number
  recommendedType: 'storage' | 'gas_turbine' | 'demand_response' | 'grid_import'
  recommendedCapacityMw: number
  recommendedDurationH: number
}

// -------- 报告 --------

/** 电站基础信息 */
export interface ScenarioStationInfo {
  stationName: string
  installedCapacityMw: number
  gridConnectionVoltageKv: number
  zone: string
  busName: string
  storagePowerMw: number
  storageCapacityMwh: number
}

/** 策略分析 */
export interface ScenarioStrategyAnalysis {
  // 高温
  cooling?: {
    panelTempEstimate: string
    inverterRiskPeriods: string
    measures: string[]
    expectedEffect: string
  }
  scheduling?: {
    storageStrategy: string
    pvLimitAdvice: string
    loadShedAdvice: string
    maintenanceAdvice: string
  }
  // 暴雨
  protection?: {
    waterproofAssessment: string
    lineProtectionAdvice: string
    drainageAdvice: string
    emergencySupplies: string[]
  }
}

/** 总结报告 */
export interface ScenarioConclusion {
  keyFindings: string[]
  quantitativeMetrics: {
    totalEnergyShortfallMwh: number
    peakBackupRequiredMw: number
    avgSupplyGuaranteeRate: number
    maxSupplyGapMw: number
  }
  backupRecommendation: string
  riskLevel: string
  riskLevelLabel: string
}

/** 模拟数据分析 */
export interface ScenarioDataAnalysis {
  outputDrop: {
    overallDropPct: number
    peakDropHour: string
    peakDropPct: number
    worstPeriod: string
  }
  supplyGuarantee: {
    avgRate: number
    minRate: number
    minRateHour: string
  }
  supplyGap: {
    maxGapMw: number
    maxGapHour: string
    totalShortfallMwh: number
    gapPeriod: string
  }
  temperature?: {
    maxTempC: number
    maxTempHour: string
    peakPanelTempC: number
    highTempWindow: string
  }
  rainstorm?: {
    maxIntensityMmh: number
    cloudCoverPct: number
    affectedHours: number
    worstPeriod: string
  }
  backup: {
    peakRequiredMw: number
    peakRequiredHour: string
    recommendedType: string
    recommendedCapacityMw: number
  }
}

/** 场景报告 */
export interface ScenarioReport {
  stationInfo: ScenarioStationInfo
  scenarioParams: Record<string, string | number>
  dataAnalysis: ScenarioDataAnalysis
  strategyAnalysis: ScenarioStrategyAnalysis
  conclusion: ScenarioConclusion
}

// -------- 模拟结果 --------

export interface ExtremeScenarioResult {
  scenarioType: ExtremeScenarioType
  stationInfo: ScenarioStationInfo
  // 汇总指标
  outputDropPct: number
  avgSupplyGuaranteeRate: number
  peakSupplyGapMw: number
  peakBackupRequiredMw: number
  totalEnergyShortfallMwh: number
  backupCapacityRequired: number
  // 数据
  timeSeriesData: TimePointAnalysis[]
  backupConfig: BackupConfigSegment[]
  // 报告
  report: ScenarioReport
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
  socKwh?: number
}

export interface JointOutputAnalysis {
  stationId: string
  storageId: string
  storageName?: string
  ratedPowerKw?: number
  ratedCapacityKwh?: number
  timeSeries: JointOutputData[]
  pvFluctuationStdDev?: number
  jointFluctuationStdDev?: number
  fluctuationImprovementPct?: number
  pvPeakValleyDiff?: number
  jointPeakValleyDiff?: number
  peakValleyImprovementPct?: number
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
  equipmentName: string
  equipmentType: EquipmentType
  modelNumber: string
  manufacturer: string
  ratedCapacityKva: number
  ratedVoltageKv: number
  ratedCurrentA: number
  installationDate: string
  designLifeYears: number
  grade: string
  status: string
  stationId: string
  stationName: string
  stationCapacityMw: number
  shortCircuitCurrentA: number
  throughCurrentA: number
  loadRate: number
  isOverloaded: boolean
  riskLevel: string
  assessment: Record<string, any>
}

export interface EquipmentPowerItem {
  equipmentId: string
  equipmentName: string
  equipmentType: string
  ratedCapacityKva: number
  activePowerKw: number | null
  reactivePowerKvar: number | null
  apparentPowerKva: number | null
}

export interface EquipmentPowerResponse {
  time: string
  stationActivePowerKw: number
  stationReactivePowerKvar: number
  totalRatedCapacityKva: number
  items: EquipmentPowerItem[]
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
  equipmentType?: string
  plantName?: string
  importance?: string
  remainingLifePct?: number
  designLifeYears?: number
  currentAgeYears?: number
  currentSoh?: number
  cumulativeCycles?: number
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
  stationId: string
  stationName: string
  nominalVoltageKv: number
  windowMinutes: number
  timeSeries: Array<VoltageFluctuationPoint>
  alerts: Array<VoltageFluctuationAlert>
  maxFluctuationPct: number
  avgFluctuationPct: number
  thresholdViolations: number
  dataRange: { firstTime: string; lastTime: string }
}

export interface FaultTreeNode {
  id: string
  name: string
  parent: string | null
  failureRate?: number
  mttr?: number
}

export interface ReliabilityContribution {
  group: string
  saifi: number
  saidiPct: number
}

export interface MonthlyReliabilityComparison {
  month: string
  theoretical: number
  actual: number | null
  actualSAIDI: number | null
}

export interface PowerSupplyReliability {
  stationId: string
  stationName: string
  voltageKv: number
  topologyConfig: { connectionType: string; lineType: string }
  faultTree: FaultTreeNode[]
  saifi: number
  saidi: number
  theoreticalReliability: number
  contributions: ReliabilityContribution[]
  actualSAIFI: number
  actualSAIDI: number
  actualOutageCount: number
  deviationPct: number | null
  monthlyComparison: MonthlyReliabilityComparison[]
}

export interface ReliabilityQuery { stationId: string; startDate: string; endDate: string; connectionType?: string; lineType?: string }

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

// ==================== Power Quality Extensions ====================

export interface VoltageFluctuationQuery {
  pointId: string
  startDate: string
  endDate: string
  windowMinutes?: number
}

export interface VoltageFluctuationPoint {
  time: string
  voltageKv: number
  activePowerKw: number
  loadKw: number
  fluctuationPct: number
}

export interface VoltageFluctuationAlert {
  time: string
  level: string
  title: string
  fluctuationPct: number
  activePowerKw: number
  loadKw: number
}

export interface QualificationQuery { startDate: string; endDate: string; voltageLevel?: string }

export interface QualificationLedgerItem {
  zone: string
  voltageLevel: string
  period: string
  totalHours: number
  qualifiedHours: number
  rate: number
  violations: number
}

export interface QualificationTrendItem {
  month: string
  [zone: string]: number | string
}

export interface VoltageAnomalyPoint {
  time: string
  zone: string
  rate: number
  weather: string
  pvStatus: string
  loadStatus: string
  rootCause: string
  causeType: string
}

export interface EquipmentImpactItem {
  id: string
  device: string
  type: string
  ratedVoltage: string
  surgeCount: number
  sagCount: number
  noramlTemp: number
  surgeTemp: number
  sagTemp: number
  runYears: string
  risk: string
}

export interface ComplaintStatsItem {
  industry: string
  complaints: number
  lossEstimate: number
  mainIssue: string
}

export interface HotspotItem {
  zone: string
  complaints: number
  avgFluctuation: number
  risk: string
}

export interface EventAnalysisResult {
  event: any
  primaryCause: string
  probability: number
  secondaryCauses: string[]
  relatedEvents: any[]
  preventiveMeasures: string[]
}

export interface AlertThreshold {
  level: string
  voltagePct: number
  color: string
}
