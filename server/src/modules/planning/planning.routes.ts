import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { PlanningController } from './planning.controller.js'

export const planningRoutes = Router()
const ctrl = new PlanningController()

// ==================== Plan (existing) ====================
planningRoutes.get('/', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listPlans)
planningRoutes.post('/', auth(['admin', 'planner']), ctrl.createPlan)
planningRoutes.put('/:id', auth(['admin', 'planner']), ctrl.updatePlan)
planningRoutes.post('/:id/integrate-pv', auth(['admin', 'planner']), ctrl.integratePv)

// ==================== PV Stations (2.1.1) ====================
planningRoutes.get('/pv-stations', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listPvStations)
planningRoutes.post('/pv-stations', auth(['admin', 'planner']), ctrl.createPvStation)
planningRoutes.put('/pv-stations/:id', auth(['admin', 'planner']), ctrl.updatePvStation)
planningRoutes.delete('/pv-stations/:id', auth(['admin', 'planner']), ctrl.deletePvStation)

// ==================== PV Cost Library (2.1.1) ====================
planningRoutes.get('/pv-cost-library', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listPvCostLibrary)
planningRoutes.post('/pv-cost-library', auth(['admin', 'planner']), ctrl.upsertCostLibraryItem)

// ==================== PV Model Types (规划工具) ====================
planningRoutes.get('/pv-model-types', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listPvModelTypes)
planningRoutes.get('/pv-model-types/:id/with-fields', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getPvModelTypeWithFields)
planningRoutes.post('/pv-model-types', auth(['admin', 'planner']), ctrl.createPvModelType)
planningRoutes.put('/pv-model-types/:id', auth(['admin', 'planner']), ctrl.updatePvModelType)
planningRoutes.delete('/pv-model-types/:id', auth(['admin', 'planner']), ctrl.deletePvModelType)
planningRoutes.get('/pv-model-types/:id/fields', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listModelTypeFields)
planningRoutes.post('/pv-model-types/:id/fields', auth(['admin', 'planner']), ctrl.saveModelTypeFields)

// ==================== Field Library (字段库) ====================
planningRoutes.get('/field-library', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listFieldLibrary)
planningRoutes.post('/field-library', auth(['admin', 'planner']), ctrl.createFieldLibraryItem)

// ==================== Constraint Rules (2.1.2) ====================
planningRoutes.get('/constraint-rules', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listConstraintRules)
planningRoutes.post('/constraint-rules', auth(['admin', 'planner']), ctrl.saveConstraintRules)

// ==================== Potential Sites & Evaluation ====================
planningRoutes.get('/potential-sites', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listPotentialSites)
planningRoutes.get('/evaluate', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.runEvaluation)

// ==================== Candidate Points (2.1.2) ====================
planningRoutes.post('/spatial-analysis', auth(['admin', 'planner']), ctrl.runSpatialAnalysis)
planningRoutes.get('/candidate-points', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listCandidatePoints)

// ==================== Absorption Plans (2.1.3) ====================
planningRoutes.post('/absorption-plans', auth(['admin', 'planner']), ctrl.generateAbsorptionPlan)
planningRoutes.get('/absorption-plans/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getAbsorptionPlan)
planningRoutes.put('/absorption-plans/:id', auth(['admin', 'planner']), ctrl.updateAbsorptionPlan)
planningRoutes.get('/absorption-plans/:id/variants', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listVariants)
planningRoutes.post('/absorption-plans/:id/variants', auth(['admin', 'planner']), ctrl.createVariant)
planningRoutes.delete('/absorption-plans/variants/:id', auth(['admin', 'planner']), ctrl.deleteVariant)

// ==================== Investment Config (投资配置方案) ====================
planningRoutes.get('/investment-config', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listInvestmentConfig)
planningRoutes.post('/investment-config/:planId', auth(['admin', 'planner']), ctrl.saveInvestmentConfig)

// ==================== Cost Items (造价参数管理) ====================
planningRoutes.get('/cost-items', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listCostItems)
planningRoutes.post('/cost-items', auth(['admin', 'planner']), ctrl.createCostItem)
planningRoutes.put('/cost-items/:id', auth(['admin', 'planner']), ctrl.updateCostItem)
planningRoutes.delete('/cost-items/:id', auth(['admin', 'planner']), ctrl.deleteCostItem)

// ==================== Cost Management (2.1.4) ====================
planningRoutes.get('/unit-cost-params', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listUnitCostParams)
planningRoutes.post('/calculate-investment', auth(['admin', 'planner']), ctrl.calculateInvestment)
planningRoutes.post('/compare-cost', auth(['admin', 'planner']), ctrl.compareCost)
planningRoutes.post('/roi-analysis', auth(['admin', 'planner']), ctrl.roiAnalysis)

// ==================== Equipment Ledger (2.1.5) ====================
planningRoutes.get('/equipment-by-station/:stationId', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getEquipmentByStation)
planningRoutes.post('/equipment-items', auth(['admin', 'planner']), ctrl.createEquipmentItem)
planningRoutes.put('/equipment-items/:id', auth(['admin', 'planner']), ctrl.updateEquipmentItem)
planningRoutes.delete('/equipment-items/:id', auth(['admin', 'planner']), ctrl.deleteEquipmentItem)
planningRoutes.get('/equipment-ledger/:planId', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getEquipmentLedger)
planningRoutes.post('/equipment-lifecycle', auth(['admin', 'planner']), ctrl.createLifecycleRecord)
planningRoutes.get('/equipment-lifecycle/:equipmentId', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getLifecycleRecords)

// ==================== Legacy methods ====================
planningRoutes.get('/sites/recommend', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.recommendSites)
planningRoutes.post('/sites', auth(['admin', 'planner']), ctrl.createSite)
planningRoutes.post('/schemes/compile', auth(['admin', 'planner']), ctrl.compileScheme)
planningRoutes.get('/schemes/:id/cost', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getCost)
planningRoutes.get('/schemes/:id/roi', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getRoi)
