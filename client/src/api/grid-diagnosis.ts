import { apiClient } from './client'
import type {
  AggregatedOutputStats,
  PvOutputStatsQuery,
  FactorAnalysisResult,
  ExtremeScenarioResult,
  ExtremeScenarioType,
  HighTempParams,
  RainstormParams,
  CarbonStats,
  JointOutputAnalysis,
  StationOption,
  StorageOption,
  EquipmentType,
  EquipmentCapacityResult,
  EquipmentLifecycle,
  ReplacementPlan,
  VoltageFluctuation,
  VoltageFluctuationQuery,
  PowerSupplyReliability,
  ReliabilityQuery,
  QualificationLedgerItem,
  QualificationTrendItem,
  VoltageAnomalyPoint,
  EquipmentImpactItem,
  ComplaintStatsItem,
  HotspotItem,
  ComplaintTicketItem,
  EventAnalysisResult,
  Alert,
} from '@new-energy/shared'

// ==================== 电站 / 储能列表 ====================
export async function fetchStations() {
  const res = await apiClient.get('/api/v1/grid-diagnosis/stations')
  return res.data?.data as StationOption[]
}

export async function fetchStationsSnapshot() {
  const res = await apiClient.get('/api/v1/grid-diagnosis/stations/snapshot')
  return res.data?.data as import('@new-energy/shared').StationSnapshot[]
}

export async function fetchStorageList() {
  const res = await apiClient.get('/api/v1/grid-diagnosis/storage-list')
  return res.data?.data as StorageOption[]
}

// ==================== 发电量统计 ====================
export async function fetchPvOutputStats(query: PvOutputStatsQuery) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/pv-output/stats', { params: query })
  return res.data?.data as AggregatedOutputStats[]
}

// ==================== 影响因素分析 ====================
export async function fetchFactorAnalysis(query: {
  stationId: string
  startDate?: string
  endDate?: string
}) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/pv-output/factors', { params: query })
  return res.data?.data as FactorAnalysisResult[]
}

// ==================== 极端场景模拟 ====================
export async function simulateExtremeScenario(params: {
  stationId: string
  scenarioType: ExtremeScenarioType
  params: HighTempParams | RainstormParams
}) {
  const res = await apiClient.post('/api/v1/grid-diagnosis/pv-output/simulate-extreme', params)
  return res.data?.data as ExtremeScenarioResult
}

export async function exportExtremeReport(params: {
  stationId: string
  scenarioType: ExtremeScenarioType
  params: HighTempParams | RainstormParams
}, format: 'word' | 'pdf' = 'word') {
  const res = await apiClient.post(
    `/api/v1/grid-diagnosis/pv-output/simulate-extreme/export?format=${format}`,
    params,
    { responseType: 'blob' },
  )
  return res.data as Blob
}

// ==================== 碳排放动态 ====================
export async function fetchCarbonDynamic(query: {
  stationId: string; startDate: string; endDate: string; granularity?: 'hour' | 'day'
}) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/carbon/dynamic', { params: query })
  return res.data?.data as {
    stationId: string; stationName: string; granularity: string
    totalOutputKwh: number; co2ReductionKg: number; coalSavingTon: number
    timeSeries: Array<{ time: string; outputKwh: number; co2ReductionKg: number; coalSavingKg: number; thermalCo2Kg: number }>
    thermalFactor: { co2PerKwh: number; coalPerKwh: number; equivalentTrees: number }
  }
}

// ==================== 碳排放统计 ====================
export async function fetchCarbonStats(query: {
  stationId?: string
  zone?: string
  startDate: string
  endDate: string
  groupBy?: 'station' | 'zone'
}) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/carbon/stats', { params: query })
  return res.data?.data as (CarbonStats & { stationName?: string; zone?: string; voltageLevel?: string; co2PerMwh?: number; stationCount?: number; groupKey?: string })[]
}

// ==================== 光储联合出力 ====================
export async function fetchJointOutputAnalysis(query: {
  stationId: string
  storageId: string
  startDate: string
  endDate: string
}) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/joint-output/analysis', { params: query })
  return res.data?.data as JointOutputAnalysis
}

// ==================== 光伏倒送判断 ====================
export async function detectBackfeed(params: { plantId: string; threshold?: number }) {
  const res = await apiClient.post('/api/v1/grid-diagnosis/backfeed/detect', params)
  return res.data?.data as import('@new-energy/shared').BackfeedItem[]
}

// ==================== 设备承载力 ====================
export async function fetchEquipmentCapacity(query: { equipmentType?: string; stationId?: string }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/equipment/capacity', { params: query })
  return res.data?.data as EquipmentCapacityResult[]
}

// ==================== 设备可靠性 ====================
export async function fetchEquipmentReliability(equipmentId: string) {
  const res = await apiClient.get(`/api/v1/grid-diagnosis/equipment/reliability/${equipmentId}`)
  return res.data?.data as { equipmentId: string; reliability: number; failureRate: number; grade: string }
}

// ==================== 设备级功率（按时段） ====================
export async function fetchEquipmentPower(stationId: string, time: string) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/equipment/power', { params: { stationId, time } })
  return res.data?.data as import('@new-energy/shared').EquipmentPowerResponse
}

export async function fetchAvailableHours(stationId: string) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/equipment/power-hours', { params: { stationId } })
  return res.data?.data as string[]
}

// ==================== 设备生命周期 ====================
export async function fetchEquipmentLifecycle(equipmentId: string) {
  const res = await apiClient.get(`/api/v1/grid-diagnosis/equipment/lifecycle/${equipmentId}`)
  return res.data?.data as EquipmentLifecycle[]
}

export async function predictLife(params: { equipmentId: string }) {
  const res = await apiClient.post('/api/v1/grid-diagnosis/equipment/lifecycle/predict', params)
  return res.data?.data as {
    equipmentId: string
    currentAgeYears: number
    designLifeYears: number
    remainingLifeYears: number
    degradationRate: number
    isBattery: boolean
    sohPct?: number
    failureThresholdPct?: number
    cumulativeCycles?: number
    estimatedRemainingMonths?: number
    replacementDate?: string
    monthlyHistory?: Array<{ month: string; sohPct: number; cycleCount: number; cumulativeCycles: number }>
  }
}

export async function generateReplacementPlan(params: { plantId?: string }) {
  const res = await apiClient.post('/api/v1/grid-diagnosis/equipment/lifecycle/replacement-plan', params)
  return res.data?.data as ReplacementPlan[]
}

// ==================== 供电质量 ====================
export async function fetchVoltageFluctuation(query: VoltageFluctuationQuery) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/voltage-fluctuation', { params: query })
  return res.data?.data as VoltageFluctuation
}

export async function fetchPowerReliability(query: ReliabilityQuery) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/reliability', { params: query })
  return res.data?.data as PowerSupplyReliability
}

export async function fetchQualificationRate(query: { startDate: string; endDate: string; voltageLevel?: string }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/qualification-rate', { params: query })
  return res.data?.data as { hourlyLedger: QualificationLedgerItem[]; trendData: QualificationTrendItem[]; trendKeys: string[]; anomalyPoints: VoltageAnomalyPoint[] }
}

export async function fetchEquipmentImpact(query: { startDate: string; endDate: string }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/equipment-impact', { params: query })
  return res.data?.data as EquipmentImpactItem[]
}

export async function fetchComplaintStats(query: { startDate: string; endDate: string }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/complaint-stats', { params: query })
  return res.data?.data as ComplaintStatsItem[]
}

export async function fetchHotspotDistribution(query: { startDate: string; endDate: string }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/hotspot-distribution', { params: query })
  return res.data?.data as HotspotItem[]
}

export async function fetchComplaintTickets(query?: { isVoltageRelated?: string; industry?: string; zone?: string }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/power-quality/complaint-tickets', { params: query })
  return res.data?.data as ComplaintTicketItem[]
}

export async function fetchAlerts(query?: { level?: string; limit?: number }) {
  const res = await apiClient.get('/api/v1/grid-diagnosis/alerts', { params: query })
  return res.data?.data as Alert[]
}

export async function acknowledgeAlert(alertId: string) {
  const res = await apiClient.post(`/api/v1/grid-diagnosis/alerts/${alertId}/acknowledge`)
  return res.data?.data
}

export async function fetchEventTrace(eventId: string) {
  const res = await apiClient.get(`/api/v1/grid-diagnosis/events/${eventId}/trace`)
  return res.data?.data as EventAnalysisResult
}
