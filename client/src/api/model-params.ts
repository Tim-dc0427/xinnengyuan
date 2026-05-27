import { apiClient } from './client'

// ==================== 出力曲线模板 ====================

export interface CurveTemplate {
  id: string
  root_id: string
  name: string
  weather_type: 'sunny' | 'cloudy' | 'rainy' | 'custom'
  version: number
  is_preset: number
  is_active: number
  coefficients: string // JSON
  description: string | null
  created_by: string | null
  modified_by: string | null
  change_summary: string | null
  created_at: string
  updated_at: string | null
}

export function fetchCurveTemplates() {
  return apiClient.get('/api/v1/power-flow/model-params/curve-templates')
}

export function createCurveTemplate(data: any) {
  return apiClient.post('/api/v1/power-flow/model-params/curve-templates', data)
}

export function updateCurveTemplate(id: string, data: any) {
  return apiClient.put(`/api/v1/power-flow/model-params/curve-templates/${id}`, data)
}

export function deleteCurveTemplate(id: string) {
  return apiClient.delete(`/api/v1/power-flow/model-params/curve-templates/${id}`)
}

export function rollbackCurveTemplate(id: string) {
  return apiClient.post(`/api/v1/power-flow/model-params/curve-templates/${id}/rollback`)
}

export function fetchCurveTemplateVersionHistory(rootId: string) {
  return apiClient.get(`/api/v1/power-flow/model-params/curve-templates/${rootId}/versions`)
}

// ==================== 置信系数设置 ====================

export interface ConfidenceSetting {
  id: string
  root_id: string
  name: string | null
  version: number
  confidence_level: number
  distribution_type: 'normal' | 'beta' | 'weibull'
  pdf_params: string // JSON
  is_active: number
  description: string | null
  created_by: string | null
  modified_by: string | null
  change_summary: string | null
  created_at: string
}

export function fetchConfidenceSettings() {
  return apiClient.get('/api/v1/power-flow/model-params/confidence-settings')
}

export function fetchAllConfidenceSettings(rootId?: string) {
  return apiClient.get('/api/v1/power-flow/model-params/confidence-settings/all', { params: { rootId } })
}

export function createConfidenceSetting(data: any) {
  return apiClient.post('/api/v1/power-flow/model-params/confidence-settings', data)
}

export function updateConfidenceSetting(id: string, data: any) {
  return apiClient.put(`/api/v1/power-flow/model-params/confidence-settings/${id}`, data)
}

export function deleteConfidenceSetting(id: string) {
  return apiClient.delete(`/api/v1/power-flow/model-params/confidence-settings/${id}`)
}

export function rollbackConfidenceSetting(id: string) {
  return apiClient.post(`/api/v1/power-flow/model-params/confidence-settings/${id}/rollback`)
}

export function fetchConfidenceSettingVersionHistory(rootId: string) {
  return apiClient.get(`/api/v1/power-flow/model-params/confidence-settings/${rootId}/versions`)
}

// ==================== 集中式光伏电站模型参数 ====================

export interface StationModelParam {
  id: string
  root_id: string
  model_name: string
  version: number
  is_active: number

  // 电气参数
  rated_capacity_mw: number
  rated_voltage_kv: number
  power_factor: number
  efficiency_pct: number
  short_circuit_ratio: number

  // 控制参数
  mppt_algorithm: string
  power_limit_mode: string
  ramp_rate_limit: number
  lvrt_enabled: number
  hvrt_enabled: number
  island_protection: number

  // 环境参数
  design_temp_c: number
  design_irradiance: number
  design_humidity_pct: number
  altitude_m: number
  soiling_factor: number

  modified_by: string | null
  change_summary: string | null
  created_at: string
  updated_at: string | null
}

export function fetchStationModels() {
  return apiClient.get('/api/v1/power-flow/model-params/station-models')
}

export function fetchAllStationModels(rootId?: string) {
  return apiClient.get('/api/v1/power-flow/model-params/station-models/all', { params: { rootId } })
}

export function fetchStationModel(id: string) {
  return apiClient.get(`/api/v1/power-flow/model-params/station-models/${id}`)
}

export function createStationModel(data: any) {
  return apiClient.post('/api/v1/power-flow/model-params/station-models', data)
}

export function updateStationModel(id: string, data: any) {
  return apiClient.put(`/api/v1/power-flow/model-params/station-models/${id}`, data)
}

export function rollbackStationModel(id: string) {
  return apiClient.post(`/api/v1/power-flow/model-params/station-models/${id}/rollback`)
}

export function exportStationModels(ids: string[]) {
  return apiClient.post('/api/v1/power-flow/model-params/station-models/export', { ids })
}

export function fetchStationModelVersionHistory(rootId: string) {
  return apiClient.get(`/api/v1/power-flow/model-params/station-models/${rootId}/versions`)
}

export function compareStationModelVersions(idA: string, idB: string) {
  return apiClient.get('/api/v1/power-flow/model-params/station-models/compare', { params: { idA, idB } })
}
