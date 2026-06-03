import { apiClient } from './client'
import type { ResourceModelType, PvAbsorptionModelParams, PvOutputModelParams, CapacityModelParams, StorageModelParams } from '@new-energy/shared'

export type ModelParams = PvAbsorptionModelParams | PvOutputModelParams | CapacityModelParams | StorageModelParams

export interface CreateModelPayload {
  modelName: string
  modelType: ResourceModelType
  parameters: ModelParams
  plantId?: string | null
  description?: string
}

export interface UpdateModelPayload {
  modelName?: string
  parameters?: ModelParams
  description?: string
}

export async function fetchModels(modelType?: ResourceModelType) {
  const params: Record<string, string> = {}
  if (modelType) params.modelType = modelType
  const res = await apiClient.get('/api/v1/resource/models', { params })
  return res.data.data as any[]
}

export async function createModel(data: CreateModelPayload) {
  const res = await apiClient.post('/api/v1/resource/models', data)
  return res.data.data
}

export async function updateModel(id: string, data: UpdateModelPayload) {
  const res = await apiClient.put(`/api/v1/resource/models/${id}`, data)
  return res.data.data
}

export async function deleteModel(id: string) {
  const res = await apiClient.delete(`/api/v1/resource/models/${id}`)
  return res.data.data
}

export async function getHealth(modelId: string) {
  const res = await apiClient.get(`/api/v1/resource/models/${modelId}/health`)
  return res.data.data as { modelId: string; healthScore: number; status: 'healthy' | 'warning' | 'critical'; anomalyList: Array<{ metric: string; value: number; threshold: number }>; lastUpdated: string }
}

export async function getStorageLife(modelId: string) {
  const res = await apiClient.get(`/api/v1/resource/models/${modelId}/storage-life`)
  return res.data.data as { modelId: string; currentSoh: number; remainingCycleLife: number; remainingCalendarLifeYears: number; degradationRatePerCycle: number; recommendedReplacementDate: string }
}

// ==================== Power Plants (层2实体) ====================
export async function fetchPowerPlants() {
  const res = await apiClient.get('/api/v1/resource/power-plants')
  return res.data.data as any[]
}

export async function fetchPowerPlant(id: string) {
  const res = await apiClient.get(`/api/v1/resource/power-plants/${id}`)
  return res.data.data as any
}

export async function updatePowerPlant(id: string, data: { name?: string; plantType?: string; capacityKw?: number; installedDate?: string; address?: string; longitude?: number; latitude?: number; status?: string }) {
  const res = await apiClient.put(`/api/v1/resource/power-plants/${id}`, data)
  return res.data.data
}

export async function deletePowerPlant(id: string) {
  const res = await apiClient.delete(`/api/v1/resource/power-plants/${id}`)
  return res.data.data
}

export async function fetchPowerPlantVersions(plantId: string) {
  const res = await apiClient.get(`/api/v1/resource/power-plants/${plantId}/versions`)
  return res.data.data as any[]
}

export async function bindModelsToPlant(plantId: string, modelIds: string[]) {
  const res = await apiClient.post(`/api/v1/resource/power-plants/${plantId}/bind-models`, { modelIds })
  return res.data.data as any[]
}

export interface CreatePowerPlantPayload {
  name: string
  plantType: string
  capacityKw: number
  installedDate?: string
  longitude?: number
  latitude?: number
  address?: string
  status?: string
}

export async function createPowerPlant(data: CreatePowerPlantPayload) {
  const res = await apiClient.post('/api/v1/resource/power-plants', data)
  return res.data.data
}

export async function batchImportPowerPlants(plants: CreatePowerPlantPayload[]) {
  const res = await apiClient.post('/api/v1/resource/power-plants/batch-import', { plants })
  return res.data.data as { imported: number }
}

// ==================== Equipment (层2实体) ====================
export async function fetchEquipment(params?: { plantId?: string; stationId?: string; equipmentType?: string }) {
  const res = await apiClient.get('/api/v1/resource/equipment', { params })
  return res.data.data as any[]
}

export async function fetchEquipmentDetail(id: string) {
  const res = await apiClient.get(`/api/v1/resource/equipment/${id}`)
  return res.data.data as any
}

export async function updateEquipment(id: string, data: { modelNumber?: string; ratedCapacityKva?: number; ratedVoltageKv?: number; ratedCurrentA?: number; installationDate?: string; status?: string; grade?: string }) {
  const res = await apiClient.put(`/api/v1/resource/equipment/${id}`, data)
  return res.data.data
}

export interface CreateEquipmentPayload {
  stationId: string
  equipmentType: string
  modelNumber?: string
  manufacturer?: string
  ratedCapacityKva?: number
  ratedVoltageKv?: number
  ratedCurrentA?: number
  installationDate?: string
  designLifeYears?: number
  status?: string
  grade?: string
}

export async function createEquipment(data: CreateEquipmentPayload) {
  const res = await apiClient.post('/api/v1/resource/equipment', data)
  return res.data.data
}

// ==================== Topology ====================
import type { PvGridTopology } from '@new-energy/shared'

export async function fetchPvGridTopology() {
  const res = await apiClient.get('/api/v1/resource/topology')
  return res.data.data as PvGridTopology
}

export async function fetchNodesByType(nodeType: string) {
  const res = await apiClient.get(`/api/v1/resource/topology/nodes-by-type/${nodeType}`)
  return res.data.data as any[]
}

export async function createSourceNode(data: { name: string; capacityKw?: number; voltageLevel?: string; zone?: string; longitude?: number; latitude?: number }) {
  const res = await apiClient.post('/api/v1/resource/topology/source-nodes', data)
  return res.data.data
}

export async function createGridNode(data: { name: string; voltageLevel?: string; zone?: string; longitude?: number; latitude?: number }) {
  const res = await apiClient.post('/api/v1/resource/topology/grid-nodes', data)
  return res.data.data
}

export async function fetchConnectionAttrs(params?: { sourceNodeType?: string; targetNodeType?: string; page?: number; pageSize?: number }) {
  const res = await apiClient.get('/api/v1/resource/topology/connections', { params })
  return res.data.data as { list: any[]; total: number; page: number; pageSize: number }
}

export async function createConnectionAttr(data: {
  sourceNodeType: string; sourceNodeId: string; targetNodeType: string; targetNodeId: string
  topologyType?: string; voltageLevelHierarchy?: string; operationMode?: string
  intermediateEquipment?: string; topologyDesc?: string
  flowDirection?: string; forwardPowerMaxKw?: number; reversePowerMaxKw?: number; flowDesc?: string
  maxCapacityKw?: number; controlLogic?: any
  controlSubject?: string; controlType?: string; triggerCondition?: string
  executeAction?: string; syncObjects?: string; dataInteraction?: string; statusSyncRule?: string
}) {
  const res = await apiClient.post('/api/v1/resource/topology/connections', data)
  return res.data.data
}

export async function updateConnectionAttr(id: string, data: Record<string, any>) {
  const res = await apiClient.put(`/api/v1/resource/topology/connections/${id}`, data)
  return res.data.data
}

export async function deleteConnectionAttr(id: string) {
  const res = await apiClient.delete(`/api/v1/resource/topology/connections/${id}`)
  return res.data.data
}

// ==================== Load Entities ====================
export async function fetchLoadEntities(params?: { loadType?: string; zone?: string }) {
  const res = await apiClient.get('/api/v1/resource/topology/load-entities', { params })
  return res.data.data as any[]
}

export async function createLoadEntity(data: { name: string; loadType?: string; busId?: string; voltageLevel?: string; peakLoadKw?: number; annualConsumptionMwh?: number; zone?: string; address?: string; longitude?: number; latitude?: number; description?: string }) {
  const res = await apiClient.post('/api/v1/resource/topology/load-entities', data)
  return res.data.data
}

export async function updateLoadEntity(id: string, data: any) {
  const res = await apiClient.put(`/api/v1/resource/topology/load-entities/${id}`, data)
  return res.data.data
}

export async function deleteLoadEntity(id: string) {
  const res = await apiClient.delete(`/api/v1/resource/topology/load-entities/${id}`)
  return res.data.data
}

// ==================== Storage Entities ====================
export async function fetchStorageEntities(params?: { storageType?: string; zone?: string }) {
  const res = await apiClient.get('/api/v1/resource/topology/storage-entities', { params })
  return res.data.data as any[]
}

export async function createStorageEntity(data: { name: string; storageType?: string; busId?: string; ratedPowerKw?: number; ratedCapacityKwh?: number; efficiencyPct?: number; chargeMode?: string; voltageLevel?: string; zone?: string; longitude?: number; latitude?: number; description?: string }) {
  const res = await apiClient.post('/api/v1/resource/topology/storage-entities', data)
  return res.data.data
}

export async function updateStorageEntity(id: string, data: any) {
  const res = await apiClient.put(`/api/v1/resource/topology/storage-entities/${id}`, data)
  return res.data.data
}

export async function deleteStorageEntity(id: string) {
  const res = await apiClient.delete(`/api/v1/resource/topology/storage-entities/${id}`)
  return res.data.data
}
