import { apiClient } from './client'

export interface ScenarioForm {
  name: string
  type: string
  description?: string
  config?: any
  control_logic?: any
  tags?: string[]
  status?: string
}

export interface StrategyForm {
  scenario_id: string
  name: string
  strategy_type: string
  config?: any
  constraints?: any
  economic_targets?: any
  status?: string
}

export interface SimulationForm {
  scenario_id: string
  strategy_id?: string
  boundary_conditions?: any
  time_range?: any
}

export interface InterventionForm {
  scenario_id: string
  simulation_id?: string
  operation_type: string
  operation_params?: any
  reason?: string
}

// 场景管理
export async function fetchScenarios(params?: any) {
  const res = await apiClient.get('/api/v1/scenario/scenarios', { params })
  return res.data.data
}

export async function fetchScenario(id: string) {
  const res = await apiClient.get(`/api/v1/scenario/scenarios/${id}`)
  return res.data.data
}

export async function createScenario(data: ScenarioForm) {
  const res = await apiClient.post('/api/v1/scenario/scenarios', data)
  return res.data.data
}

export async function updateScenario(id: string, data: Partial<ScenarioForm>) {
  const res = await apiClient.put(`/api/v1/scenario/scenarios/${id}`, data)
  return res.data.data
}

export async function deleteScenario(id: string) {
  const res = await apiClient.delete(`/api/v1/scenario/scenarios/${id}`)
  return res.data.data
}

export async function batchDeleteScenarios(ids: string[]) {
  const res = await apiClient.post('/api/v1/scenario/scenarios/batch-delete', { ids })
  return res.data.data
}

export async function copyScenario(id: string) {
  const res = await apiClient.post(`/api/v1/scenario/scenarios/${id}/copy`)
  return res.data.data
}

export async function batchCopyScenarios(ids: string[]) {
  const res = await apiClient.post('/api/v1/scenario/scenarios/batch-copy', { ids })
  return res.data.data
}

export async function fetchScenarioVersions(scenarioId: string) {
  const res = await apiClient.get(`/api/v1/scenario/scenarios/${scenarioId}/versions`)
  return res.data.data
}

export async function restoreVersion(scenarioId: string, versionId: string) {
  const res = await apiClient.post(`/api/v1/scenario/scenarios/${scenarioId}/restore-version/${versionId}`)
  return res.data.data
}

export async function exportScenarios(ids: string[]) {
  const res = await apiClient.post('/api/v1/scenario/scenarios/export', { ids })
  return res.data.data
}

export async function previewScenario(config: any) {
  const res = await apiClient.post('/api/v1/scenario/scenarios/preview', { config })
  return res.data.data
}

// 策略管理
export async function fetchStrategies(params?: any) {
  const res = await apiClient.get('/api/v1/scenario/strategies', { params })
  return res.data.data
}

export async function fetchStrategy(id: string) {
  const res = await apiClient.get(`/api/v1/scenario/strategies/${id}`)
  return res.data.data
}

export async function createStrategy(data: StrategyForm) {
  const res = await apiClient.post('/api/v1/scenario/strategies', data)
  return res.data.data
}

export async function updateStrategy(id: string, data: Partial<StrategyForm>) {
  const res = await apiClient.put(`/api/v1/scenario/strategies/${id}`, data)
  return res.data.data
}

export async function deleteStrategy(id: string) {
  const res = await apiClient.delete(`/api/v1/scenario/strategies/${id}`)
  return res.data.data
}

export async function generateStrategy(scenarioId: string) {
  const res = await apiClient.post('/api/v1/scenario/strategies/generate', { scenario_id: scenarioId })
  return res.data.data
}

// 模拟与验证
export async function fetchSimulations(params?: any) {
  const res = await apiClient.get('/api/v1/scenario/simulations', { params })
  return res.data.data
}

export async function fetchSimulation(id: string) {
  const res = await apiClient.get(`/api/v1/scenario/simulations/${id}`)
  return res.data.data
}

export async function startSimulation(data: SimulationForm) {
  const res = await apiClient.post('/api/v1/scenario/simulations', data)
  return res.data.data
}

export async function deleteSimulation(id: string) {
  return (await apiClient.delete(`/api/v1/scenario/simulations/${id}`)).data.data
}

export async function stopSimulation(id: string) {
  const res = await apiClient.put(`/api/v1/scenario/simulations/${id}/stop`)
  return res.data.data
}

export async function pauseSimulation(id: string) {
  const res = await apiClient.put(`/api/v1/scenario/simulations/${id}/pause`)
  return res.data.data
}

export async function resumeSimulation(id: string) {
  const res = await apiClient.put(`/api/v1/scenario/simulations/${id}/resume`)
  return res.data.data
}

export async function updateSimulationParams(id: string, params: any) {
  const res = await apiClient.put(`/api/v1/scenario/simulations/${id}/params`, params)
  return res.data.data
}

export async function fetchSimulationResults(id: string) {
  const res = await apiClient.get(`/api/v1/scenario/simulations/${id}/results`)
  return res.data.data
}

export async function fetchSimulationLive(id: string, sinceStep: number = 0) {
  const res = await apiClient.get(`/api/v1/scenario/simulations/${id}/live`, { params: { since_step: sinceStep } })
  return res.data.data
}

export async function fetchExecutionData(id: string) {
  const res = await apiClient.get(`/api/v1/scenario/simulations/${id}/execution-data`)
  return res.data.data
}

export async function fetchRunningSimulations() {
  const res = await apiClient.get('/api/v1/scenario/simulations/running')
  return res.data.data
}

// 评估
export async function fetchEvaluations(params?: any) {
  const res = await apiClient.get('/api/v1/scenario/evaluations', { params })
  return res.data.data
}

export async function fetchEvaluation(id: string) {
  const res = await apiClient.get(`/api/v1/scenario/evaluations/${id}`)
  return res.data.data
}

export async function generateEvaluation(simulationId: string) {
  const res = await apiClient.post('/api/v1/scenario/evaluations/generate', { simulation_id: simulationId })
  return res.data.data
}

export async function exportEvaluation(id: string, format: 'word' | 'pdf' = 'word') {
  const res = await apiClient.get(`/api/v1/scenario/evaluations/${id}/export`, {
    params: { format },
    responseType: 'blob',
  })
  return res.data
}

// 人工干预
export async function fetchInterventions(params?: any) {
  const res = await apiClient.get('/api/v1/scenario/interventions', { params })
  return res.data.data
}

export async function createIntervention(data: InterventionForm) {
  const res = await apiClient.post('/api/v1/scenario/interventions', data)
  return res.data.data
}

export async function exportInterventions(params?: any) {
  const res = await apiClient.get('/api/v1/scenario/interventions/export', { params })
  return res.data.data
}
