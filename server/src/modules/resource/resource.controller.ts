import { Request, Response } from 'express'
import { ResourceService } from './resource.service.js'

export class ResourceController {
  private service = new ResourceService()

  listModels = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listModels(req.query as any) }) }
  createModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createModel(req.body, req.user!.id) }) }
  updateModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateModel(req.params.id, req.body) }) }
  deleteModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deleteModel(req.params.id) }) }
  getHealth = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getHealth(req.params.id) }) }
  getStorageLife = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getStorageLife(req.params.id) }) }

  listPowerPlants = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listPowerPlants() }) }
  createPowerPlant = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createPowerPlant(req.body) }) }
  batchImportPowerPlants = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.batchImportPowerPlants(req.body.plants || []) }) }
  getPowerPlant = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getPowerPlant(req.params.id) }) }
  updatePowerPlant = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updatePowerPlant(req.params.id, req.body) }) }
  deletePowerPlant = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deletePowerPlant(req.params.id) }) }
  getPowerPlantVersions = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getPowerPlantVersions(req.params.id) }) }
  bindModelsToPlant = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.bindModelsToPlant(req.params.id, req.body.modelIds || []) }) }
  listEquipment = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listEquipment(req.query as any) }) }
  getEquipment = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getEquipment(req.params.id) }) }
  updateEquipment = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateEquipment(req.params.id, req.body) }) }
  createEquipment = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createEquipment(req.body) }) }

  listRelationships = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listRelationships(req.query as any) }) }
  createRelationship = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createRelationship(req.body) }) }

  listScenarios = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listScenarios(req.query as any) }) }
  createScenario = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createScenario(req.body, req.user!.id) }) }
  updateScenario = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateScenario(req.params.id, req.body) }) }
  deleteScenario = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deleteScenario(req.params.id) }) }

  assignResources = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.assignResources(req.params.id, req.body) }) }
  generateStrategy = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.generateStrategy(req.params.id, req.body) }) }
  createStrategy = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createStrategy(req.params.id, req.body, req.user!.id) }) }

  runSimulation = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.runSimulation(req.params.id, req.body, req.user!.id) }) }
  getSimulation = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getSimulation(req.params.simId) }) }
  evaluateSimulation = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.evaluateSimulation(req.params.simId, req.body) }) }

  intervene = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.intervene(req.params.simId, req.body, req.user!.id) }) }
}
