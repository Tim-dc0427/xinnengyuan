import { Request, Response } from 'express'
import { ResourceService } from './resource.service.js'
import { audit } from '../../common/audit.service.js'

export class ResourceController {
  private service = new ResourceService()

  listModels = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listModels(req.query as any) }) }
  createModel = async (req: Request, res: Response) => {
    const data = await this.service.createModel(req.body, req.user!.id)
    audit(req, 'CREATE', 'resource_model', data.id, '创建资源模型', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  updateModel = async (req: Request, res: Response) => {
    const data = await this.service.updateModel(req.params.id, req.body)
    audit(req, 'UPDATE', 'resource_model', req.params.id, '修改资源模型', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteModel = async (req: Request, res: Response) => {
    const data = await this.service.deleteModel(req.params.id)
    audit(req, 'DELETE', 'resource_model', req.params.id, '删除资源模型', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  getHealth = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getHealth(req.params.id) }) }
  getStorageLife = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getStorageLife(req.params.id) }) }

  listSolarStations = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listSolarStations() }) }
  createSolarStation = async (req: Request, res: Response) => {
    const data = await this.service.createSolarStation(req.body)
    audit(req, 'CREATE', 'solar_station', data.id, `创建电站「${req.body.name}」`, null, { name: req.body.name, capacityMw: req.body.capacityMw || (req.body.capacityKw ? req.body.capacityKw / 1000 : 0) })
    res.json({ code: 200, message: 'ok', data })
  }
  batchImportSolarStations = async (req: Request, res: Response) => {
    const data = await this.service.batchImportSolarStations(req.body.plants || [])
    audit(req, 'CREATE', 'solar_station', null, `批量导入 ${(req.body.plants || []).length} 个电站`, null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  getSolarStation = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getSolarStation(req.params.id) }) }
  updateSolarStation = async (req: Request, res: Response) => {
    const data = await this.service.updateSolarStation(req.params.id, req.body)
    audit(req, 'UPDATE', 'solar_station', req.params.id, `修改电站「${req.body.name || req.params.id}」`, null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteSolarStation = async (req: Request, res: Response) => {
    const data = await this.service.deleteSolarStation(req.params.id)
    audit(req, 'DELETE', 'solar_station', req.params.id, '删除电站', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  getSolarStationVersions = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getSolarStationVersions(req.params.id) }) }
  bindModelsToStation = async (req: Request, res: Response) => {
    const data = await this.service.bindModelsToStation(req.params.id, req.body.modelIds || [])
    audit(req, 'UPDATE', 'solar_station', req.params.id, '绑定设备型号', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  listEquipment = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listEquipment(req.query as any) }) }
  getEquipment = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getEquipment(req.params.id) }) }
  updateEquipment = async (req: Request, res: Response) => {
    const data = await this.service.updateEquipment(req.params.id, req.body)
    audit(req, 'UPDATE', 'equipment', req.params.id, '修改设备', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  createEquipment = async (req: Request, res: Response) => {
    const data = await this.service.createEquipment(req.body)
    audit(req, 'CREATE', 'equipment', data.id, `创建设备「${req.body.name || req.body.model_number || data.id}」`, null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  listRelationships = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listRelationships(req.query as any) }) }
  createRelationship = async (req: Request, res: Response) => {
    const data = await this.service.createRelationship(req.body)
    audit(req, 'CREATE', 'resource_relationship', data.id, '创建资源关系', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  listScenarios = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listScenarios(req.query as any) }) }
  createScenario = async (req: Request, res: Response) => {
    const data = await this.service.createScenario(req.body, req.user!.id)
    audit(req, 'CREATE', 'scenario', data.id, '创建场景', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  updateScenario = async (req: Request, res: Response) => {
    const data = await this.service.updateScenario(req.params.id, req.body)
    audit(req, 'UPDATE', 'scenario', req.params.id, '修改场景', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteScenario = async (req: Request, res: Response) => {
    const data = await this.service.deleteScenario(req.params.id)
    audit(req, 'DELETE', 'scenario', req.params.id, '删除场景', null, null)
    res.json({ code: 200, message: 'ok', data })
  }

  assignResources = async (req: Request, res: Response) => {
    const data = await this.service.assignResources(req.params.id, req.body)
    audit(req, 'UPDATE', 'scenario', req.params.id, '分配资源', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  generateStrategy = async (req: Request, res: Response) => {
    const data = await this.service.generateStrategy(req.params.id, req.body)
    audit(req, 'EXECUTE', 'scenario', req.params.id, '生成策略', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  createStrategy = async (req: Request, res: Response) => {
    const data = await this.service.createStrategy(req.params.id, req.body, req.user!.id)
    audit(req, 'CREATE', 'strategy', data.id, '创建策略', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  runSimulation = async (req: Request, res: Response) => {
    const data = await this.service.runSimulation(req.params.id, req.body, req.user!.id)
    audit(req, 'EXECUTE', 'simulation', data.id, '启动模拟', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  getSimulation = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getSimulation(req.params.simId) }) }
  evaluateSimulation = async (req: Request, res: Response) => {
    const data = await this.service.evaluateSimulation(req.params.simId, req.body)
    audit(req, 'EXECUTE', 'simulation', req.params.simId, '评估模拟结果', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  intervene = async (req: Request, res: Response) => {
    const data = await this.service.intervene(req.params.simId, req.body, req.user!.id)
    audit(req, 'EXECUTE', 'simulation', req.params.simId, `手动干预: ${req.body.operation_type || 'unknown'}`, null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
}
