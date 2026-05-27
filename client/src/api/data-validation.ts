import { apiClient } from './client'

export async function checkPVCompleteness(params?: { plantId?: string; startDate?: string; endDate?: string }) {
  const res = await apiClient.post('/api/v1/data-validation/pv-completeness', params || {})
  return res.data?.data
}

export async function checkBoundaryReasonability(params?: { voltageLevel?: string; region?: string }) {
  const res = await apiClient.post('/api/v1/data-validation/boundary', params || {})
  return res.data?.data
}

export async function checkTimeSeriesConsistency(params?: { startDate?: string; endDate?: string }) {
  const res = await apiClient.post('/api/v1/data-validation/time-series', params || {})
  return res.data?.data
}
