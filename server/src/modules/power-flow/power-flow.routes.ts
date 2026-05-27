import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { PowerFlowController } from './power-flow.controller.js'

export const powerFlowRoutes = Router()
const ctrl = new PowerFlowController()

// Indicators
powerFlowRoutes.get('/indicators', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getIndicators)
powerFlowRoutes.get('/indicators/node-stability', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getNodeStability)
powerFlowRoutes.get('/indicators/three-phase', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getThreePhase)

// Thresholds
powerFlowRoutes.get('/thresholds', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getThresholds)
powerFlowRoutes.put('/thresholds', auth(['admin', 'planner']), ctrl.updateThresholds)

// Data Validation
powerFlowRoutes.post('/validation/completeness', auth(['admin', 'planner', 'operator']), ctrl.checkCompleteness)
powerFlowRoutes.post('/validation/boundary', auth(['admin', 'planner', 'operator']), ctrl.checkBoundary)
powerFlowRoutes.post('/validation/consistency', auth(['admin', 'planner', 'operator']), ctrl.checkConsistency)

// Calculation
powerFlowRoutes.post('/calculate', auth(['admin', 'planner', 'operator']), ctrl.submitCalculation)
powerFlowRoutes.get('/calculate/:taskId/status', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getTaskStatus)
powerFlowRoutes.get('/calculate/:taskId/result', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getTaskResult)

// Batch Calculation (4.4)
powerFlowRoutes.post('/batch', auth(['admin', 'planner']), ctrl.submitBatchConfig)
powerFlowRoutes.get('/batch', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listBatches)
powerFlowRoutes.get('/batch/:groupId', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getBatchGroup)
powerFlowRoutes.get('/batch/:groupId/status', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getBatchStatus)
powerFlowRoutes.post('/batch/:groupId/cancel', auth(['admin', 'planner']), ctrl.cancelBatch)
powerFlowRoutes.get('/batch/:groupId/results', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getBatchResults)
powerFlowRoutes.get('/batch/:groupId/export', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.exportBatchResults)

// History
powerFlowRoutes.get('/history', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listHistory)
powerFlowRoutes.get('/history/compare', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.compareVersions)
powerFlowRoutes.post('/history/reuse/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.reuseHistory)
powerFlowRoutes.post('/history/:taskId/lock', auth(['admin', 'planner', 'operator']), ctrl.lockHistory)
powerFlowRoutes.delete('/history/:taskId', auth(['admin', 'planner']), ctrl.deleteHistory)
powerFlowRoutes.post('/history/cleanup', auth(['admin', 'planner']), ctrl.cleanupExpired)

// Curve Templates (version controlled)
powerFlowRoutes.get('/model-params/curve-templates', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listCurveTemplates)
powerFlowRoutes.post('/model-params/curve-templates', auth(['admin', 'planner']), ctrl.createCurveTemplate)
powerFlowRoutes.put('/model-params/curve-templates/:id', auth(['admin', 'planner']), ctrl.updateCurveTemplate)
powerFlowRoutes.delete('/model-params/curve-templates/:id', auth(['admin', 'planner']), ctrl.deleteCurveTemplate)
powerFlowRoutes.post('/model-params/curve-templates/:id/rollback', auth(['admin']), ctrl.rollbackCurveTemplate)
powerFlowRoutes.get('/model-params/curve-templates/:rootId/versions', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getCurveTemplateVersionHistory)

// Confidence Coefficient Settings (version controlled)
powerFlowRoutes.get('/model-params/confidence-settings', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listConfidenceSettings)
powerFlowRoutes.get('/model-params/confidence-settings/all', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listAllConfidenceSettings)
powerFlowRoutes.post('/model-params/confidence-settings', auth(['admin', 'planner']), ctrl.createConfidenceSetting)
powerFlowRoutes.put('/model-params/confidence-settings/:id', auth(['admin', 'planner']), ctrl.updateConfidenceSetting)
powerFlowRoutes.delete('/model-params/confidence-settings/:id', auth(['admin', 'planner']), ctrl.deleteConfidenceSetting)
powerFlowRoutes.post('/model-params/confidence-settings/:id/rollback', auth(['admin']), ctrl.rollbackConfidenceSetting)
powerFlowRoutes.get('/model-params/confidence-settings/:rootId/versions', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getConfidenceSettingVersionHistory)

// Station Model Params (集中式光伏电站模型)
powerFlowRoutes.get('/model-params/station-models', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listStationModels)
powerFlowRoutes.get('/model-params/station-models/all', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listAllStationModels)
powerFlowRoutes.post('/model-params/station-models', auth(['admin', 'planner']), ctrl.createStationModel)
powerFlowRoutes.post('/model-params/station-models/export', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.exportStationModels)
powerFlowRoutes.get('/model-params/station-models/compare', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.compareStationModelVersions)
powerFlowRoutes.get('/model-params/station-models/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getStationModel)
powerFlowRoutes.put('/model-params/station-models/:id', auth(['admin', 'planner']), ctrl.updateStationModel)
powerFlowRoutes.post('/model-params/station-models/:id/rollback', auth(['admin']), ctrl.rollbackStationModel)
powerFlowRoutes.get('/model-params/station-models/:rootId/versions', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getStationModelVersionHistory)

// Grid Topology Data
powerFlowRoutes.get('/grid/buses', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getGridBuses)
powerFlowRoutes.get('/grid/loads', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getGridLoads)
powerFlowRoutes.get('/grid/generators', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getGridGenerators)
powerFlowRoutes.get('/grid/branches', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getGridBranches)
powerFlowRoutes.get('/solar-stations', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getSolarStations)
powerFlowRoutes.get('/feeders', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getFeeders)

// ==================== 4.3 Online Calculation ====================
powerFlowRoutes.post('/calculate/standard', auth(['admin', 'planner', 'operator']), ctrl.submitStandardPF)
powerFlowRoutes.post('/calculate/reverse', auth(['admin', 'planner', 'operator']), ctrl.submitReversePF)
powerFlowRoutes.post('/calculate/probabilistic', auth(['admin', 'planner', 'operator']), ctrl.submitProbabilisticPF)
powerFlowRoutes.post('/calculate/three-phase', auth(['admin', 'planner', 'operator']), ctrl.submitThreePhasePF)
powerFlowRoutes.get('/calculate/:taskId/progress', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getTaskProgress)
powerFlowRoutes.post('/calculate/:taskId/pause', auth(['admin', 'planner', 'operator']), ctrl.pauseTask)
powerFlowRoutes.post('/calculate/:taskId/resume', auth(['admin', 'planner', 'operator']), ctrl.resumeTask)
powerFlowRoutes.get('/tasks', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listTasks)

// Phase data summary
powerFlowRoutes.get('/phase-data-summary', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getPhaseDataSummary)
powerFlowRoutes.post('/phase-data/detail', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getPhaseDataDetail)
