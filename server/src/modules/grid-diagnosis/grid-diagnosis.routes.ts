import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { GridDiagnosisController } from './grid-diagnosis.controller.js'

export const gridDiagnosisRoutes = Router()
const ctrl = new GridDiagnosisController()

// PV Output
gridDiagnosisRoutes.get('/pv-output/stats', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getPvOutputStats)
gridDiagnosisRoutes.get('/pv-output/factors', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getFactors)
gridDiagnosisRoutes.post('/pv-output/simulate-extreme', auth(['admin', 'planner']), ctrl.simulateExtreme)

// Carbon
gridDiagnosisRoutes.get('/carbon/stats', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getCarbonStats)

// Joint Output
gridDiagnosisRoutes.get('/joint-output/analysis', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getJointOutputAnalysis)

// Backfeed
gridDiagnosisRoutes.post('/backfeed/detect', auth(['admin', 'planner', 'operator']), ctrl.detectBackfeed)

// Equipment
gridDiagnosisRoutes.get('/equipment/capacity', auth(['admin', 'planner', 'operator']), ctrl.calculateCapacity)
gridDiagnosisRoutes.get('/equipment/reliability/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.assessReliability)
gridDiagnosisRoutes.get('/equipment/lifecycle/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getLifecycle)
gridDiagnosisRoutes.post('/equipment/lifecycle/predict', auth(['admin', 'planner']), ctrl.predictLife)
gridDiagnosisRoutes.post('/equipment/lifecycle/replacement-plan', auth(['admin', 'planner']), ctrl.generateReplacementPlan)

// Voltage
gridDiagnosisRoutes.get('/voltage/fluctuation', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getVoltageFluctuation)
gridDiagnosisRoutes.get('/voltage/reliability', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getPowerReliability)
gridDiagnosisRoutes.get('/voltage/qualification-rate', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getQualificationRate)

// Alerts
gridDiagnosisRoutes.get('/alerts', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getAlerts)
gridDiagnosisRoutes.post('/alerts/:id/acknowledge', auth(['admin', 'planner', 'operator']), ctrl.acknowledgeAlert)

// Events
gridDiagnosisRoutes.get('/events/:id/trace', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.traceEvent)
