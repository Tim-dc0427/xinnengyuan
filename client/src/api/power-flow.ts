import { apiClient } from './client'

export interface NodeStabilityItem {
  nodeId: string
  busId?: string
  name?: string
  zone?: string
  voltageLevel?: string
  voltagePu: number
  angleDeg: number
  stabilityMargin: number
  isWeakNode: boolean
  connectedDevices?: string[]
}

export interface ThreePhaseItem {
  id: string
  nodeId?: string
  name?: string
  zone?: string
  voltageLevel?: string
  baseKv?: number
  physicalRole?: string
  imbalancePct: number
  phaseA?: number
  phaseB?: number
  phaseC?: number
  angleA?: number
  angleB?: number
  angleC?: number
  vuf?: number
  cuf?: number
  phaseACurrent?: number
  phaseBCurrent?: number
  phaseCCurrent?: number
  pvRelated?: boolean
  plantName?: string
  installedCapacity?: number | null
  transformerArea?: string
  loadType?: string
}

export interface ThresholdItem {
  id?: string
  indicatorName: string
  indicatorLabel: string
  warningThreshold: number
  criticalThreshold: number
  unit: string
  voltageLevel: string | null
  region: string | null
  enabled: boolean
  isCustom: boolean
  createdAt?: string
  updatedAt?: string
}

// ==================== 指标数据 ====================
export async function fetchIndicators(params?: { voltageLevel?: string; region?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/indicators', { params })
  return res.data?.data as {
    total_loss_kw?: number
    three_phase_imbalance_pct?: number
    reverse_power_detected?: number
    node_results?: any[]
    branch_results?: any[]
    summary?: any
  } | null
}

export async function fetchNodeStability(params?: { voltageLevel?: string; region?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/indicators/node-stability', { params })
  return res.data?.data as NodeStabilityItem[]
}

export async function fetchThreePhase(params?: { voltageLevel?: string; region?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/indicators/three-phase', { params })
  return res.data?.data as ThreePhaseItem[]
}

export interface ThreePhaseTrendNode {
  info: {
    busId: string
    name: string
    zone: string
    voltageLevel: string
    physicalRole: string
    pvRelated: boolean
    plantName: string
  }
  series: {
    time: string
    imbalancePct: number
    vuf: number
    cuf: number
    phaseA: number
    phaseB: number
    phaseC: number
    phaseACurrent: number
    phaseBCurrent: number
    phaseCCurrent: number
  }[]
}

export interface ThreePhaseTrendResult {
  dates: string[]
  nodes: ThreePhaseTrendNode[]
}

export async function fetchThreePhaseTrend(params: { startDate: string; endDate: string; busIds?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/indicators/three-phase/trend', { params })
  return res.data?.data as ThreePhaseTrendResult
}

// ==================== 阈值配置 ====================
export async function fetchThresholds(params?: { voltageLevel?: string; region?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/thresholds', { params })
  return res.data?.data as ThresholdItem[]
}

export async function updateThresholds(data: ThresholdItem[]) {
  const res = await apiClient.put('/api/v1/power-flow/thresholds', data)
  return res.data?.data as ThresholdItem[]
}

export async function deleteThreshold(id: string) {
  const res = await apiClient.delete(`/api/v1/power-flow/thresholds/${id}`)
  return res.data?.data as { id: string; deleted: boolean }
}

// ==================== 电网拓扑数据 ====================
export async function fetchGridBuses(params?: { zone?: string; voltageLevel?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/grid/buses', { params })
  return res.data?.data as any[]
}

export async function fetchGridLoads(params?: { zone?: string; voltageLevel?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/grid/loads', { params })
  return res.data?.data as any[]
}

export async function fetchGridGenerators(params?: { zone?: string; voltageLevel?: string }) {
  const res = await apiClient.get('/api/v1/power-flow/grid/generators', { params })
  return res.data?.data as any[]
}

export async function fetchGridBranches(params?: { zone?: string; voltageLevel?: string; feederIds?: string[] }) {
  const res = await apiClient.get('/api/v1/power-flow/grid/branches', { params })
  return res.data?.data as any[]
}

// ==================== 4.3 在线计算 ====================
export interface TaskProgress {
  status: string
  progressPct: number
  progressMessage: string | null
  etaMs: number | null
  elapsedSec: number
  checkpointAvailable: boolean
}

export async function submitStandardPF(params: any) {
  const res = await apiClient.post('/api/v1/power-flow/calculate/standard', params)
  return res.data?.data as { taskId: string; status: string }
}

export async function submitReversePF(params: any) {
  const res = await apiClient.post('/api/v1/power-flow/calculate/reverse', params)
  return res.data?.data as { taskId: string; status: string }
}

export async function submitProbabilisticPF(params: any) {
  const res = await apiClient.post('/api/v1/power-flow/calculate/probabilistic', params)
  return res.data?.data as { taskId: string; status: string }
}

export async function submitThreePhasePF(params: any) {
  const res = await apiClient.post('/api/v1/power-flow/calculate/three-phase', params)
  return res.data?.data as { taskId: string; status: string }
}

export async function getTaskProgress(taskId: string) {
  const res = await apiClient.get(`/api/v1/power-flow/calculate/${taskId}/progress`)
  return res.data?.data as TaskProgress
}

export async function pauseTask(taskId: string) {
  const res = await apiClient.post(`/api/v1/power-flow/calculate/${taskId}/pause`)
  return res.data?.data
}

export async function resumeTask(taskId: string) {
  const res = await apiClient.post(`/api/v1/power-flow/calculate/${taskId}/resume`)
  return res.data?.data
}

// 获取光伏电站列表（含出力数据）
export async function fetchSolarPVStations() {
  const res = await apiClient.get('/api/v1/power-flow/solar-stations')
  return res.data?.data as any[]
}

// 获取馈线列表（含关联光伏电站）
export async function fetchFeeders() {
  const res = await apiClient.get('/api/v1/power-flow/feeders')
  return res.data?.data as any[]
}

export interface TaskListItem {
  id: string
  task_type: string
  status: string
  progress_pct: number
  progress_message: string | null
  eta_ms: number | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  elapsedSec: number
  checkpointAvailable: boolean
}

export async function fetchTasks(params?: { taskType?: string; status?: string; limit?: number }) {
  const res = await apiClient.get('/api/v1/power-flow/tasks', { params })
  return (res.data?.data || []) as TaskListItem[]
}

export async function getTaskResult(taskId: string) {
  const res = await apiClient.get(`/api/v1/power-flow/calculate/${taskId}/result`)
  return res.data?.data
}

// ==================== 4.4 批量计算 ====================
export async function submitBatchConfig(params: {
  groupName: string
  calcType: string
  busIds: string[]
  branchIds: string[]
  parameters: Record<string, unknown>
}) {
  const res = await apiClient.post('/api/v1/power-flow/batch', params)
  return res.data?.data as { groupId: string; status: string; taskCount: number }
}

export async function fetchBatchList(params?: { status?: string; limit?: number }) {
  const res = await apiClient.get('/api/v1/power-flow/batch', { params })
  return res.data?.data as any[]
}

export async function fetchBatchGroup(groupId: string) {
  const res = await apiClient.get(`/api/v1/power-flow/batch/${groupId}`)
  return res.data?.data
}

export async function fetchBatchStatus(groupId: string) {
  const res = await apiClient.get(`/api/v1/power-flow/batch/${groupId}/status`)
  return res.data?.data as {
    group: any
    items: Array<{
      id: string; taskId: string; itemLabel: string; itemType: string
      status: string; progressPct: number; progressMessage: string | null
      etaMs: number | null; errorMessage: string | null
    }>
    overallEtaMs: number | null
  }
}

export async function cancelBatch(groupId: string) {
  const res = await apiClient.post(`/api/v1/power-flow/batch/${groupId}/cancel`)
  return res.data?.data as { groupId: string; status: string; cancelledCount: number }
}

export async function deleteBatch(groupId: string) {
  const res = await apiClient.delete(`/api/v1/power-flow/batch/${groupId}`)
  return res.data?.data as { groupId: string; deleted: boolean; deletedTasks: number }
}

export async function fetchBatchResults(groupId: string) {
  const res = await apiClient.get(`/api/v1/power-flow/batch/${groupId}/results`)
  return res.data?.data as {
    group: any
    regionStats: Array<{
      busId: string; name: string; zone: string; voltageLevel: string
      loadRate: number; voltageDeviationPct: number; isAnomaly: boolean; anomalyTypes: string[]
    }>
    anomalyItems: Array<{
      id: string; groupId: string; taskId?: string; busId?: string
      equipmentName: string; anomalyType: string; severity: string
      currentValue: string; thresholdValue: string; description: string
    }>
    capacityRanking: Array<{ equipmentId: string; equipmentName: string; loadRate: number; rank: number }>
  }
}

export async function exportBatchResults(groupId: string, format?: string) {
  const res = await apiClient.get(`/api/v1/power-flow/batch/${groupId}/export`, { params: { format } })
  return res.data?.data as { groupName: string; format: string; content: string; totalRows: number }
}

export interface PhaseDataSummary {
  loadPhase: Array<{ voltageLevel: string; count: number; ratios: number[] }>
  genPhase: Array<{ voltageLevel: string; count: number; ratios: number[] }>
  branchZeroSeq: Array<{ voltageLevel: string; count: number; avgR0R1: number; avgX0X1: number }>
}

export async function fetchPhaseDataSummary() {
  const res = await apiClient.get('/api/v1/power-flow/phase-data-summary')
  return res.data?.data as PhaseDataSummary
}

export interface PhaseDataDetail {
  loads: Array<{
    id: string; busId: string; busName: string; voltageLevel: string
    pdMw: number; qdMvar: number
    pdAMw: number; pdBMw: number; pdCMw: number
    qdAMvar: number; qdBMvar: number; qdCMvar: number
  }>
  generators: Array<{
    id: string; busId: string; busName: string; voltageLevel: string
    pgMw: number; pgAMw: number; pgBMw: number; pgCMw: number
  }>
  branches: Array<{
    id: string; fromBusId: string; toBusId: string
    fromBusName: string; toBusName: string; voltageLevel: string
    branchType: string; rOhm: number; xOhm: number
    r0Ohm: number; x0Ohm: number
  }>
}

export async function fetchPhaseDataDetail(feederIds: string[]) {
  const res = await apiClient.post('/api/v1/power-flow/phase-data/detail', { feederIds })
  return res.data?.data as PhaseDataDetail
}

// ==================== 4.5 计算历史 ====================
export interface HistoryListItem {
  id: string
  task_type: string
  scene_type: string | null
  status: string
  operator: string
  created_at: string
  is_locked: number
  data_source: string | null
  error_message: string | null
  result_id: string | null
}

export interface HistoryListResult {
  list: HistoryListItem[]
  total: number
  page: number
  pageSize: number
}

export interface VersionCompareResult {
  versionA: { taskId: string; taskType: string; createdAt: string; operator: string; summary: any }
  versionB: { taskId: string; taskType: string; createdAt: string; operator: string; summary: any }
  nodeDiff: Array<{ name: string; voltageLevel: string; phaseADiff: number; phaseBDiff: number; phaseCDiff: number; vufDiff: number; note?: string }>
  branchDiff: Array<{ fromBusName: string; toBusName: string; voltageLevel: string; phaseAPDiff: number; phaseBPDiff: number; phaseCPDiff: number; note?: string }>
}

export async function fetchHistory(params?: {
  taskType?: string; sceneType?: string; status?: string
  keyword?: string; dateFrom?: string; dateTo?: string
  page?: number; pageSize?: number
}) {
  const res = await apiClient.get('/api/v1/power-flow/history', { params })
  return res.data?.data as HistoryListResult
}

export async function compareHistoryVersions(taskIdA: string, taskIdB: string) {
  const res = await apiClient.get('/api/v1/power-flow/history/compare', { params: { taskIdA, taskIdB } })
  return res.data?.data as VersionCompareResult
}

export async function reuseHistoryParams(taskId: string) {
  const res = await apiClient.post(`/api/v1/power-flow/history/reuse/${taskId}`)
  return res.data?.data as { taskType: string; parameters: any; sceneType: string | null }
}

export async function lockHistory(taskId: string) {
  const res = await apiClient.post(`/api/v1/power-flow/history/${taskId}/lock`)
  return res.data?.data as { taskId: string; isLocked: boolean }
}

export async function deleteHistory(taskId: string) {
  const res = await apiClient.delete(`/api/v1/power-flow/history/${taskId}`)
  return res.data?.data
}

export async function cleanupExpiredHistory(days: number) {
  const res = await apiClient.post('/api/v1/power-flow/history/cleanup', { days })
  return res.data?.data as { deletedCount: number; cutoffBefore: string }
}
