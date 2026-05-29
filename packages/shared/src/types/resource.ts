// ==================== Resource Model ====================
export type ResourceModelType = 'PV_ABSORPTION' | 'PV_OUTPUT' | 'CAPACITY' | 'STORAGE' | 'LOAD'

export interface ResourceModel {
  id: string
  modelName: string
  modelType: ResourceModelType
  parameterSchema: Record<string, unknown>
  plantId: string | null
  description: string
  version: number
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ==================== 模型参数三维度定义 ====================

export interface PvAbsorptionModelParams {
  physicalCharacteristics: {
    /** 装机容量 (MW) */
    installedCapacityMw: number
    /** 并网电压等级 (kV) */
    gridVoltageKv: number
    /** 逆变器额定功率 (kW) */
    inverterPowerKw: number
  }
  controlStrategy: {
    /** 有功出力上限(MW) — 调度限电指令 */
    activePowerLimitMw: number
    /** 限电优先级 */
    curtailmentPriority: 'guaranteed' | 'market' | 'competitive'
    /** N-1安全校核 */
    nMinus1Enabled: boolean
  }
  interfaceParameters: {
    /** 系统时序负荷曲线 — CSV导入，24点序列 */
    loadProfile: Array<{ time: string; loadMw: number }>
    /** 火电最小技术出力 (MW) */
    minThermalOutputMw: number
    /** 断面输送限额 (MW) */
    transmissionLimitMw: number
  }
}

export interface PvOutputModelParams {
  physicalCharacteristics: {
    /** 额定功率 (kW) */
    ratedPowerKw: number
    /** 组件类型 */
    panelType: 'monocrystalline' | 'polycrystalline' | 'thinFilm'
    /** 温度系数 (%/°C) */
    tempCoefficientPct: number
  }
  controlStrategy: {
    /** MPPT 算法 */
    mpptAlgorithm: 'pno' | 'incCond' | 'constantVoltage'
    /** 功率限制策略 */
    powerLimitEnabled: boolean
    /** 爬坡率限制 (kW/min) */
    rampRateLimitKwMin: number
  }
  interfaceParameters: {
    /** 气象数据接口 */
    weatherApiEnabled: boolean
    /** 逆变器通信协议 */
    inverterProtocol: 'modbus' | 'iec61850' | 'rs485'
    /** 出力预测数据格式 */
    forecastFormat: 'json' | 'csv' | 'xml'
  }
}

export interface CapacityModelParams {
  physicalCharacteristics: {
    /** 变压器容量 (kVA) */
    transformerCapacityKva: number
    /** 线路载流量 (A) */
    lineAmpacityA: number
    /** N-1 安全准则 */
    nMinus1Enabled: boolean
  }
  controlStrategy: {
    /** 过载保护定值 (%) */
    overloadThresholdPct: number
    /** 负载均衡策略 */
    loadBalancingMode: 'active' | 'passive' | 'off'
    /** 需求响应策略 */
    demandResponseEnabled: boolean
  }
  interfaceParameters: {
    /** SCADA 接口 */
    scadaEnabled: boolean
    /** 负荷预测输入 */
    loadForecastEnabled: boolean
    /** 拓扑数据格式 */
    topologyFormat: 'cim' | 'json' | 'custom'
  }
}

export interface StorageModelParams {
  physicalCharacteristics: {
    /** 额定容量 (kWh) */
    ratedCapacityKwh: number
    /** 额定功率 (kW) */
    ratedPowerKw: number
    /** 充放电效率 (%) */
    efficiencyPct: number
  }
  controlStrategy: {
    /** 充放电策略 */
    chargeMode: 'peakShaving' | 'freqRegulation' | 'backup'
    /** SOC 保护定值 (%) */
    socLimitPct: number
    /** 电网支撑模式 */
    gridSupportMode: 'inertia' | 'primaryFreq' | 'none'
  }
  interfaceParameters: {
    /** BMS 通信协议 */
    bmsProtocol: 'can' | 'rs485' | 'modbus'
    /** PCS 接口规范 */
    pcsInterface: 'analog' | 'digital' | 'mixed'
    /** SOC/SOH 上报格式 */
    sohReportFormat: 'json' | 'csv' | 'modbus_register'
  }
}

// ==================== Resource Relationship ====================
export type RelationshipType = 'FEEDS' | 'ABSORBS' | 'BALANCES' | 'BACKUP'

export interface ResourceRelationship {
  id: string
  sourceModelId: string
  targetModelId: string
  relationshipType: RelationshipType
  topologyEdgeData: {
    impedance: number
    distanceKm: number
    maxCapacityMw: number
    voltageLevelKv: number
  }
  coordinates: Array<[number, number]>
}

export interface ResourceHealthStatus {
  modelId: string
  healthScore: number
  status: 'healthy' | 'warning' | 'critical'
  anomalyList: Array<{ metric: string; value: number; threshold: number }>
  lastUpdated: string
}

export interface StorageLifetimePrediction {
  modelId: string
  currentSoh: number
  remainingCycleLife: number
  remainingCalendarLifeYears: number
  degradationRatePerCycle: number
  recommendedReplacementDate: string
}

// ==================== Topology ====================
export type TopoNodeType = 'SOURCE' | 'GRID' | 'LOAD' | 'STORAGE'
export type TopoEdgeType = 'PHYSICAL' | 'LOGICAL' | 'CONTROL'
export type FlowDirection = 'FORWARD' | 'REVERSE' | 'BIDIRECTIONAL'

export interface TopoNode {
  id: string
  name: string
  nodeType: TopoNodeType
  plantId?: string
  equipmentId?: string
  busId?: string
  voltageLevel?: string
  posX?: number
  posY?: number
  zone?: string
  capacityKw?: number
}

export interface TopoEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  edgeType: TopoEdgeType
  flowDirection: FlowDirection
  maxCapacityKw?: number
  controlLogic?: string
  sourceName?: string
  targetName?: string
}

export interface PvGridTopology {
  nodes: TopoNode[]
  edges: TopoEdge[]
}

// ==================== Topology Entities ====================
export type LoadEntityType = 'INDUSTRIAL' | 'COMMERCIAL' | 'RESIDENTIAL' | 'AGRICULTURAL' | 'MUNICIPAL'
export type StorageEntityType = 'BATTERY' | 'PUMPED_HYDRO' | 'FLYWHEEL'
export type ChargeMode = 'PEAK_SHAVING' | 'FREQ_REGULATION' | 'BACKUP' | 'ARBITRAGE'

export interface LoadEntity {
  id: string
  name: string
  loadType: LoadEntityType
  busId?: string | null
  voltageLevel?: string
  peakLoadKw?: number
  annualConsumptionMwh?: number
  zone?: string
  address?: string
  longitude?: number
  latitude?: number
  status: string
  description?: string
  createdAt: string
}

export interface StorageEntity {
  id: string
  name: string
  storageType: StorageEntityType
  busId?: string | null
  ratedPowerKw?: number
  ratedCapacityKwh?: number
  efficiencyPct?: number
  chargeMode?: ChargeMode
  voltageLevel?: string
  zone?: string
  longitude?: number
  latitude?: number
  status: string
  description?: string
  createdAt: string
}

export interface TopologyConnection {
  id: string
  sourceNodeType: TopoNodeType
  sourceNodeId: string
  sourceName?: string
  targetNodeType: TopoNodeType
  targetNodeId: string
  targetName?: string
  flowDirection: FlowDirection
  maxCapacityKw?: number
  controlLogic?: string
  status: string
  createdAt: string
}

// ==================== Scenario ====================
export type ScenarioType = 'NORMAL' | 'PEAK_LOAD' | 'EMERGENCY' | 'MAINTENANCE' | 'EXTREME_WEATHER'
export type ScenarioStatus = 'draft' | 'validated' | 'published' | 'archived'

export interface Scenario {
  id: string
  scenarioName: string
  description: string
  scenarioType: ScenarioType
  status: ScenarioStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ScenarioResourceAssignment {
  resourceModelId: string
  overrideParameters: Record<string, unknown> | null
}

// ==================== Strategy ====================
export type StrategyType = 'AUTO' | 'MANUAL' | 'HYBRID'
export type StrategyAlgorithm = 'OPTIMIZATION' | 'RULE_BASED' | 'RL' | 'MPC'

export interface Strategy {
  id: string
  scenarioId: string
  strategyName: string
  strategyType: StrategyType
  generationAlgorithm: StrategyAlgorithm | null
  strategyData: {
    rules: Array<{
      deviceId: string
      condition: string
      action: string
      priority: number
    }>
    constraints: Array<{
      type: string
      value: number
      isHardConstraint: boolean
    }>
    optimizationTarget: string
  }
  createdBy: string
  createdAt: string
}

// ==================== Simulation ====================
export type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SimulationRun {
  id: string
  scenarioId: string
  strategyId: string | null
  status: SimulationStatus
  inputSummary: Record<string, unknown>
  resultData: {
    absorptionRate: number
    voltageStability: number
    networkEfficiency: number
    economicScore: number
    timeSeriesData: Array<{
      time: string
      pvOutput: number
      load: number
      storageCharge: number
      storageDischarge: number
      gridImport: number
      gridExport: number
    }>
  } | null
  executionScore: number
  startedAt: string | null
  completedAt: string | null
  createdBy: string
}

// ==================== Execution Evaluation ====================
export interface ExecutionEvaluation {
  simulationId: string
  absorptionRatePct: number
  voltageStabilityScore: number
  economicScore: number
  reliabilityScore: number
  comprehensiveScore: number
  recommendation: string
}

export interface ManualInterventionRecord {
  id: string
  simulationId: string
  operatorId: string
  actionType: 'PAUSE' | 'RESUME' | 'MODIFY_PARAM' | 'OVERRIDE_STRATEGY'
  parameterChanges: Record<string, unknown>
  timestamp: string
  reason: string
}

// ==================== Scenario Topology (网架图编辑器) ====================

export interface TopoNodeState {
  id: string
  nodeType: TopoNodeType
  nodeId?: string
  nodeName: string
  voltageLevel?: string
  connectedCapacity?: number
  x: number
  y: number
  params: Record<string, any>
}

export interface TopoEdgeState {
  id: string
  sourceId: string
  targetId: string
  edgeType: TopoEdgeType
  flowDirection: FlowDirection
  maxCapacityKw?: number
}

export interface ScenarioTopology {
  nodes: TopoNodeState[]
  edges: TopoEdgeState[]
  topologyVersion?: number
}
