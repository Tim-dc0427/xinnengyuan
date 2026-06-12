// ==================== Indicators ====================
export interface PowerFlowIndicator {
  nodeId: string
  nodeName: string
  voltagePu: number
  voltageAngleDeg: number
  activePowerMw: number
  reactivePowerMvar: number
  powerFlowDirection: 'forward' | 'reverse'
  networkLossKw: number
}

export interface ThreePhaseImbalance {
  nodeId: string
  nodeName: string
  phaseAVoltage: number
  phaseBVoltage: number
  phaseCVoltage: number
  voltageImbalancePct: number
  phaseACurrent: number
  phaseBCurrent: number
  phaseCCurrent: number
  currentImbalancePct: number
  isRelatedToPv: boolean
  relatedPvPlantId: string | null
}

export interface NodeStabilityResult {
  nodeId: string
  busId: string
  name: string
  zone: string
  voltageLevel: string
  voltagePu: number
  angleDeg: number
  stabilityMargin: number
  isWeakNode: boolean
  weakNodeReason: string | null
  /** 关联发电机有功出力 (MW) */
  pgMw: number
  /** 关联发电机无功出力 (Mvar) */
  qgMvar: number
  /** 关联负荷有功 (MW) */
  pdMw: number
  /** 关联负荷无功 (Mvar) */
  qdMvar: number
  /** 母线类型 (slack/pv/pq) */
  busType: string
  /** 关联设备描述（发电机/负荷/光伏电站名称等） */
  connectedDevices: string[]
}

// ==================== Data Validation ====================
export type ValidationType = 'COMPLETENESS' | 'BOUNDARY' | 'CONSISTENCY'

export interface CompletenessCheckResult {
  checkType: 'COMPLETENESS'
  totalRecords: number
  passedRecords: number
  continuityIssues: Array<{ startTime: string; endTime: string; gapMinutes: number }>
  confidenceIssues: Array<{ recordTime: string; confidencePct: number }>
  weatherMismatches: Array<{ recordTime: string; expected: string; actual: string }>
}

export interface BoundaryCheckResult {
  checkType: 'BOUNDARY'
  totalParams: number
  passedParams: number
  anomalyItems: Array<{
    paramName: string
    currentValue: number
    historicalAvg: number
    deviationPct: number
    isAnomaly: boolean
  }>
}

export interface ConsistencyCheckResult {
  checkType: 'CONSISTENCY'
  totalPairs: number
  syncedPairs: number
  offsetIssues: Array<{
    startTime: string
    endTime: string
    offsetRate: number
  }>
}

export type ValidationResult = CompletenessCheckResult | BoundaryCheckResult | ConsistencyCheckResult

// ==================== Calculation ====================
export type CalcTaskType = 'ONLINE' | 'BATCH' | 'PROBABILISTIC' | 'THREE_PHASE' | 'REVERSE' | 'STANDARD'
export type CalcTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused'

export interface CalcTaskParams {
  taskType: CalcTaskType
  nodeIds: string[]
  pvPlantIds: string[]
  timeWindow: { start: string; end: string }
  convergenceTolerance?: number
  maxIterations?: number
}

export interface CalcTask {
  id: string
  taskType: CalcTaskType
  status: CalcTaskStatus
  progressPct: number
  progressMessage: string | null
  etaMs: number | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface CalcResult {
  id: string
  taskId: string
  version: number
  nodeResults: NodeResult[]
  branchResults: BranchResult[]
  summary: CalcSummary
  reversePowerDetected: boolean
  threePhaseImbalancePct: number
  totalLossKw: number
}

export interface NodeResult {
  nodeId: string
  name?: string
  voltageLevel?: string
  zone?: string
  voltagePu: number
  angleDeg: number
  activePowerMw: number
  reactivePowerMvar: number
  loadRate: number
}

export interface BranchResult {
  branchId: string
  fromNodeId: string
  toNodeId: string
  fromBusName?: string
  toBusName?: string
  branchType?: string
  voltageLevel?: string
  activePowerMw: number
  reactivePowerMvar: number
  currentA: number
  loadRate: number
  powerDirection: 'forward' | 'reverse'
  lossMw?: number
}

export interface CalcSummary {
  totalLossKw: number
  maxVoltageDeviation: number
  maxLoadRate: number
  reversePowerBranches: number
  violatedConstraintCount: number
  totalGenMw?: number
  totalLoadMw?: number
  iterations?: number
  converged?: boolean
}

// ==================== Online Calculation Types ====================

export interface TaskProgress {
  status: CalcTaskStatus
  progressPct: number
  progressMessage: string | null
  etaMs: number | null
  elapsedSec: number
  checkpointAvailable: boolean
}

export interface StandardPFParams {
  scenario?: {
    type: 'normal' | 'fault' | 'solar'
    faultBranchId?: string
    solarMultiplier?: number
  }
  voltageLevel?: string
  region?: string
}

export interface ReversePFParams {
  pvBusIds: string[]
  pvOutputMw: number[]
  loadReductionFactor?: number
  jointInjection?: boolean
  voltageLevel?: string
  region?: string
}

export interface ReversePFTimePoint {
  time: string
  reversePowerMw: number
  lossMw: number
  avgVoltagePu: number
  minVoltagePu: number
}

export interface ReversePFResult {
  timePoints: ReversePFTimePoint[]
  nodeResults: NodeResult[]
  branchResults: BranchResult[]
  maxReversePowerMw: number
  maxReverseTime: string
  reverseBranchCount: number
  totalReverseEnergyMwh: number
}

export interface DistributionSpec {
  type: 'normal' | 'beta'
  params: Record<string, number>
}

export interface ProbabilisticPFParams {
  sampleCount: number
  loadUncertaintyPct: number
  pvUncertaintyPct: number
  voltageLevel?: string
  region?: string
}

export interface NodeProbabilisticResult {
  nodeId: string
  name: string
  expectedV: number
  stdDevV: number
  p95V: number
  p5V: number
  violationProbability: number
  histogram: Array<{ voltagePu: number; count: number }>
}

export interface BranchOverloadResult {
  branchId: string
  name: string
  expectedLoadingPct: number
  overloadProbability: number
}

export interface ProbabilisticPFResult {
  nodeResults: NodeProbabilisticResult[]
  branchResults: BranchOverloadResult[]
  voltageViolationNodes: Array<{ nodeId: string; name: string; probability: number }>
  overloadBranches: Array<{ branchId: string; name: string; probability: number }>
  expectedLossMw: number
  p95LossMw: number
}

export interface ThreePhasePFParams {
  phaseALoadRatio?: number
  phaseBLoadRatio?: number
  phaseCLoadRatio?: number
  phaseAGenRatio?: number
  phaseBGenRatio?: number
  phaseCGenRatio?: number
  impedanceAsymmetryPct?: number
  pvBusIds?: string[]
  weatherScenario?: string
  voltageLevel?: string
  region?: string
}

export interface PhaseNodeResult {
  busId: string
  name: string
  zone: string
  voltageLevel: string
  baseKv: number
  phaseA: number
  phaseB: number
  phaseC: number
  angleA: number
  angleB: number
  angleC: number
  vuf: number
  isViolation: boolean
  pvRelated: boolean
  loadType: string
}

export interface PhaseBranchResult {
  branchId: string
  fromBus: string
  toBus: string
  fromBusName: string
  toBusName: string
  branchType: string
  voltageLevel: string
  phaseAPFromMw: number;  phaseAQFromMvar: number
  phaseALoadingPct: number; phaseAIsOverloaded: boolean
  phaseBPFromMw: number;  phaseBQFromMvar: number
  phaseBLoadingPct: number; phaseBIsOverloaded: boolean
  phaseCPFromMw: number;  phaseCQFromMvar: number
  phaseCLoadingPct: number; phaseCIsOverloaded: boolean
  phaseALossMw: number; phaseBLossMw: number; phaseCLossMw: number
  ampacityMva: number
  isOverloaded: boolean
}

export interface ThreePhasePFResult {
  nodeResults: PhaseNodeResult[]
  phaseBranchResults?: PhaseBranchResult[]
  totalLossMw: number
  maxVuf: number
  avgVuf: number
  violationCount: number
  violationRate: number
  phaseALossMw: number
  phaseBLossMw: number
  phaseCLossMw: number
}

// ==================== Probabilistic PF (legacy) ====================
export interface ProbabilisticResult {
  nodeId: string
  voltageDistribution: Array<{ voltagePu: number; probability: number }>
  overloadProbability: number
  voltageViolationProbability: number
  expectedLossKw: number
}

// ==================== Batch Calculation ====================
export interface BatchConfigParams {
  groupName: string
  calcType: CalcTaskType
  busIds: string[]
  branchIds: string[]
  parameters: {
    loadGrowthFactor?: number
    pvOutputFactor?: number
    timeWindow?: { start: string; end: string }
    convergenceTolerance?: number
    maxIterations?: number
  }
}

export interface BatchGroup {
  id: string
  groupName: string
  calcType?: CalcTaskType
  parameterTemplate: Record<string, unknown>
  selectedBusIds?: string[]
  selectedBranchIds?: string[]
  status: 'pending' | 'running' | 'completed' | 'partial_failed' | 'failed' | 'cancelled'
  totalTasks: number
  completedTasks: number
  failedTasks?: number
  resultSummary?: BatchResultAggregation | null
  createdAt: string
  completedAt?: string | null
}

export interface BatchItem {
  id: string
  taskId: string
  itemLabel: string
  itemType: 'node' | 'branch' | 'feeder'
  busId?: string
  branchId?: string
  feederId?: string
  idx: number
}

export interface BatchStatusResponse {
  group: BatchGroup
  items: Array<{
    id: string
    taskId: string
    itemLabel: string
    itemType: string
    status: string
    progressPct: number
    progressMessage: string | null
    etaMs: number | null
    errorMessage: string | null
  }>
  overallEtaMs: number | null
}

export interface BatchResultAggregation {
  totalDevices: number
  anomalyCount: number
  maxLoadRate: number
  maxVoltageDeviation: number
  ranking: Array<{ equipmentId: string; equipmentName: string; loadRate: number; rank: number }>
}

export interface BatchAnomalyItem {
  id: string
  groupId: string
  taskId?: string
  busId?: string
  equipmentName: string
  anomalyType: 'voltage_violation' | 'overload' | 'stability_insufficient' | 'reverse_power'
  severity: 'warning' | 'critical'
  currentValue: string
  thresholdValue: string
  description: string
}

export interface BatchResultSummary {
  group: BatchGroup
  regionStats: Array<{
    busId: string
    name: string
    zone: string
    voltageLevel: string
    loadRate: number
    voltageDeviationPct: number
    isAnomaly: boolean
    anomalyTypes: string[]
  }>
  anomalyItems: BatchAnomalyItem[]
  capacityRanking: Array<{ equipmentId: string; equipmentName: string; loadRate: number; rank: number }>
  charts?: {
    voltageDistribution?: Record<string, unknown>
    capacityRanking?: Record<string, unknown>
  }
}

// ==================== History ====================
export interface CalcHistoryRecord {
  id: string
  taskId: string
  taskType: CalcTaskType
  status: CalcTaskStatus
  createdBy: string
  operatorName: string
  createdAt: string
  completedAt: string | null
}

export interface VersionDiff {
  versionA: number
  versionB: number
  nodeDiff: Array<{
    nodeId: string
    voltageDiff: number
    powerDiff: number
    loadRateDiff: number
  }>
  branchDiff: Array<{
    branchId: string
    powerDiff: number
    loadRateDiff: number
  }>
}

// ==================== Model Parameters ====================
export interface OutputCurveTemplate {
  id: string
  templateName: string
  curveType: 'sunny' | 'cloudy' | 'rainy' | 'mixed' | 'custom'
  timeSeries: Array<{ time: string; normalizedOutput: number }>
}

export interface ConfidenceConfig {
  confidenceLevel: number
  distributionType: 'normal' | 'beta' | 'weibull'
  distributionParams: Record<string, number>
}

// 集中式光伏电站模型参数
export interface StationModelParams {
  id: string
  rootId: string
  modelName: string
  version: number
  isActive: boolean

  // 电气参数
  ratedCapacityMw: number
  ratedVoltageKv: number
  powerFactor: number
  efficiencyPct: number
  shortCircuitRatio: number

  // 控制参数
  mpptAlgorithm: string
  powerLimitMode: string
  rampRateLimit: number
  lvrtEnabled: boolean
  hvrtEnabled: boolean
  islandProtection: boolean

  // 环境参数
  designTempC: number
  designIrradiance: number
  designHumidityPct: number
  altitudeM: number
  soilingFactor: number

  modifiedBy: string | null
  changeSummary: string | null
  createdAt: string
  updatedAt: string | null
}

// ==================== Thresholds ====================
export interface IndicatorThreshold {
  indicatorName: string
  warningThreshold: number
  criticalThreshold: number
  unit: string
  isCustom: boolean
  applicableVoltageLevel: string | null
  applicableRegion: string | null
}
