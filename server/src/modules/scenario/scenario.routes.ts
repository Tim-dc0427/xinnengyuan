import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { ScenarioController } from './scenario.controller.js'

export const scenarioRoutes = Router()
const ctrl = new ScenarioController()

const authAll = auth(['admin', 'planner', 'operator', 'viewer'])
const authWrite = auth(['admin', 'planner', 'operator'])

// 场景管理
scenarioRoutes.get('/scenarios', authAll, ctrl.listScenarios)
scenarioRoutes.get('/scenarios/:id', authAll, ctrl.getScenario)
scenarioRoutes.post('/scenarios', authWrite, ctrl.createScenario)
scenarioRoutes.put('/scenarios/:id', authWrite, ctrl.updateScenario)
scenarioRoutes.delete('/scenarios/:id', auth(['admin', 'planner']), ctrl.deleteScenario)
scenarioRoutes.post('/scenarios/batch-delete', auth(['admin', 'planner']), ctrl.batchDeleteScenarios)
scenarioRoutes.post('/scenarios/batch-copy', authWrite, ctrl.batchCopyScenarios)
scenarioRoutes.post('/scenarios/:id/copy', authWrite, ctrl.copyScenario)
scenarioRoutes.get('/scenarios/:id/versions', authAll, ctrl.getScenarioVersions)
scenarioRoutes.post('/scenarios/:id/restore-version/:versionId', authWrite, ctrl.restoreVersion)
scenarioRoutes.post('/scenarios/export', authAll, ctrl.exportScenarios)
scenarioRoutes.post('/scenarios/preview', authWrite, ctrl.previewScenario)

// 策略管理
scenarioRoutes.get('/strategies', authAll, ctrl.listStrategies)
scenarioRoutes.get('/strategies/:id', authAll, ctrl.getStrategy)
scenarioRoutes.post('/strategies', authWrite, ctrl.createStrategy)
scenarioRoutes.put('/strategies/:id', authWrite, ctrl.updateStrategy)
scenarioRoutes.delete('/strategies/:id', auth(['admin', 'planner']), ctrl.deleteStrategy)
scenarioRoutes.post('/strategies/generate', authWrite, ctrl.generateStrategy)

// 模拟与验证
scenarioRoutes.get('/simulations', authAll, ctrl.listSimulations)
scenarioRoutes.get('/simulations/running', authAll, ctrl.getRunningSimulations)
scenarioRoutes.get('/simulations/:id', authAll, ctrl.getSimulation)
scenarioRoutes.post('/simulations', authWrite, ctrl.startSimulation)
scenarioRoutes.put('/simulations/:id/stop', authWrite, ctrl.stopSimulation)
scenarioRoutes.delete('/simulations/:id', authWrite, ctrl.deleteSimulation)
scenarioRoutes.put('/simulations/:id/pause', authWrite, ctrl.pauseSimulation)
scenarioRoutes.put('/simulations/:id/resume', authWrite, ctrl.resumeSimulation)
scenarioRoutes.put('/simulations/:id/params', authWrite, ctrl.updateSimulationParams)
scenarioRoutes.get('/simulations/:id/execution-data', authAll, ctrl.getExecutionData)
scenarioRoutes.get('/simulations/:id/results', authAll, ctrl.getSimulationResults)
scenarioRoutes.get('/simulations/:id/live', authAll, ctrl.getSimulationLive)

// 评估
scenarioRoutes.get('/evaluations', authAll, ctrl.listEvaluations)
scenarioRoutes.get('/evaluations/:id', authAll, ctrl.getEvaluation)
scenarioRoutes.post('/evaluations/generate', authWrite, ctrl.generateEvaluation)
scenarioRoutes.get('/evaluations/:id/export', authAll, ctrl.exportEvaluation)

// 人工干预
scenarioRoutes.get('/interventions', authAll, ctrl.listInterventions)
scenarioRoutes.post('/interventions', authWrite, ctrl.createIntervention)
scenarioRoutes.get('/interventions/export', authAll, ctrl.exportInterventions)
