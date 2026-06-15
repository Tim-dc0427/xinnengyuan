import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { ResourceController } from './resource.controller.js'
import { TopologyController } from './topology.controller.js'

export const resourceRoutes = Router()
const ctrl = new ResourceController()
const topoCtrl = new TopologyController()

// Models
resourceRoutes.get('/models', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listModels)
resourceRoutes.post('/models', auth(['admin', 'planner']), ctrl.createModel)
resourceRoutes.put('/models/:id', auth(['admin', 'planner']), ctrl.updateModel)
resourceRoutes.delete('/models/:id', auth(['admin', 'planner']), ctrl.deleteModel)
resourceRoutes.put('/models/:id/toggle-status', auth(['admin', 'planner']), ctrl.toggleModelStatus)
resourceRoutes.delete('/models/:id/hard', auth(['admin', 'planner']), ctrl.hardDeleteModel)

// Health
resourceRoutes.get('/models/:id/health', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getHealth)
resourceRoutes.get('/models/:id/storage-life', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getStorageLife)

// Solar Stations (集中式光伏电站，数据源：solar_pv_stations)
resourceRoutes.get('/solar-stations', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listSolarStations)
resourceRoutes.get('/solar-stations/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getSolarStation)
resourceRoutes.post('/solar-stations', auth(['admin', 'planner']), ctrl.createSolarStation)
resourceRoutes.post('/solar-stations/batch-import', auth(['admin', 'planner']), ctrl.batchImportSolarStations)
resourceRoutes.put('/solar-stations/:id', auth(['admin', 'planner']), ctrl.updateSolarStation)
resourceRoutes.delete('/solar-stations/:id', auth(['admin', 'planner']), ctrl.deleteSolarStation)
resourceRoutes.put('/solar-stations/:id/toggle-status', auth(['admin', 'planner']), ctrl.toggleStationStatus)
resourceRoutes.delete('/solar-stations/:id/hard', auth(['admin', 'planner']), ctrl.hardDeleteSolarStation)
resourceRoutes.get('/solar-stations/:id/versions', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getSolarStationVersions)
resourceRoutes.post('/solar-stations/:id/bind-models', auth(['admin', 'planner']), ctrl.bindModelsToStation)

// Equipment (层2)
resourceRoutes.get('/equipment', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listEquipment)
resourceRoutes.get('/equipment/:id', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getEquipment)
resourceRoutes.post('/equipment', auth(['admin', 'planner']), ctrl.createEquipment)
resourceRoutes.put('/equipment/:id', auth(['admin', 'planner']), ctrl.updateEquipment)

// Relationships
resourceRoutes.get('/relationships', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listRelationships)
resourceRoutes.post('/relationships', auth(['admin', 'planner']), ctrl.createRelationship)

// Topology
resourceRoutes.get('/topology', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.getPvGridTopology)
resourceRoutes.get('/topology/nodes-by-type/:type', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.listAvailableNodesByType)
resourceRoutes.post('/topology/source-nodes', auth(['admin', 'planner']), topoCtrl.createSourceNode)
resourceRoutes.post('/topology/grid-nodes', auth(['admin', 'planner']), topoCtrl.createGridNode)
resourceRoutes.get('/topology/connections', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.listConnectionAttrs)
resourceRoutes.post('/topology/connections', auth(['admin', 'planner']), topoCtrl.createConnectionAttr)
resourceRoutes.put('/topology/connections/:id', auth(['admin', 'planner']), topoCtrl.updateConnectionAttr)
resourceRoutes.delete('/topology/connections/:id', auth(['admin', 'planner']), topoCtrl.deleteConnectionAttr)
// Load Entities
resourceRoutes.get('/topology/load-entities', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.listLoadEntities)
resourceRoutes.get('/topology/load-entities/:id', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.getLoadEntity)
resourceRoutes.post('/topology/load-entities', auth(['admin', 'planner']), topoCtrl.createLoadEntity)
resourceRoutes.put('/topology/load-entities/:id', auth(['admin', 'planner']), topoCtrl.updateLoadEntity)
resourceRoutes.delete('/topology/load-entities/:id', auth(['admin', 'planner']), topoCtrl.deleteLoadEntity)
// Storage Entities
resourceRoutes.get('/topology/storage-entities', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.listStorageEntities)
resourceRoutes.get('/topology/storage-entities/:id', auth(['admin', 'planner', 'operator', 'viewer']), topoCtrl.getStorageEntity)
resourceRoutes.post('/topology/storage-entities', auth(['admin', 'planner']), topoCtrl.createStorageEntity)
resourceRoutes.put('/topology/storage-entities/:id', auth(['admin', 'planner']), topoCtrl.updateStorageEntity)
resourceRoutes.delete('/topology/storage-entities/:id', auth(['admin', 'planner']), topoCtrl.deleteStorageEntity)

// Scenarios
resourceRoutes.get('/scenarios', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listScenarios)
resourceRoutes.post('/scenarios', auth(['admin', 'planner']), ctrl.createScenario)
resourceRoutes.put('/scenarios/:id', auth(['admin', 'planner']), ctrl.updateScenario)
resourceRoutes.delete('/scenarios/:id', auth(['admin', 'planner']), ctrl.deleteScenario)

// Scenario Resources
resourceRoutes.post('/scenarios/:id/assign-resources', auth(['admin', 'planner']), ctrl.assignResources)

// Strategies
resourceRoutes.post('/scenarios/:id/generate-strategy', auth(['admin', 'planner']), ctrl.generateStrategy)
resourceRoutes.post('/scenarios/:id/strategies', auth(['admin', 'planner']), ctrl.createStrategy)

// Simulation
resourceRoutes.post('/scenarios/:id/simulate', auth(['admin', 'planner', 'operator']), ctrl.runSimulation)
resourceRoutes.get('/scenarios/:id/simulations/:simId', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getSimulation)
resourceRoutes.post('/scenarios/:id/simulations/:simId/evaluate', auth(['admin', 'planner']), ctrl.evaluateSimulation)

// Intervention
resourceRoutes.post('/scenarios/:id/simulations/:simId/intervene', auth(['admin', 'planner', 'operator']), ctrl.intervene)
