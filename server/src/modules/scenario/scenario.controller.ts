import { Request, Response } from 'express'
import { ScenarioService } from './scenario.service.js'

export class ScenarioController {
  private service = new ScenarioService()

  // ==================== 场景管理 ====================

  listScenarios = async (req: Request, res: Response) => {
    const data = await this.service.listScenarios(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getScenario = async (req: Request, res: Response) => {
    const data = await this.service.getScenario(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '场景不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  createScenario = async (req: Request, res: Response) => {
    const data = await this.service.createScenario(req.body, (req as any).user!.id)
    res.json({ code: 200, message: '创建成功', data })
  }

  updateScenario = async (req: Request, res: Response) => {
    const data = await this.service.updateScenario(req.params.id, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '场景不存在' })
    res.json({ code: 200, message: '更新成功', data })
  }

  deleteScenario = async (req: Request, res: Response) => {
    await this.service.deleteScenario(req.params.id)
    res.json({ code: 200, message: '删除成功' })
  }

  batchDeleteScenarios = async (req: Request, res: Response) => {
    const data = await this.service.batchDeleteScenarios(req.body.ids)
    res.json({ code: 200, message: `已删除 ${data.deleted} 个场景`, data })
  }

  copyScenario = async (req: Request, res: Response) => {
    const data = await this.service.copyScenario(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '场景不存在' })
    res.json({ code: 200, message: '复制成功', data })
  }

  batchCopyScenarios = async (req: Request, res: Response) => {
    const data = await this.service.batchCopyScenarios(req.body.ids)
    res.json({ code: 200, message: `已复制 ${data.copied} 个场景`, data })
  }

  getScenarioVersions = async (req: Request, res: Response) => {
    const data = await this.service.getScenarioVersions(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  restoreVersion = async (req: Request, res: Response) => {
    const data = await this.service.restoreVersion(req.params.id, req.params.versionId)
    if (!data) return res.status(404).json({ code: 404, message: '版本不存在' })
    res.json({ code: 200, message: '版本已恢复', data })
  }

  exportScenarios = async (req: Request, res: Response) => {
    const ids = req.body.ids || req.query.ids ? String(req.query.ids).split(',') : []
    const data = await this.service.exportScenarios(ids)
    res.json({ code: 200, message: 'ok', data })
  }

  previewScenario = async (req: Request, res: Response) => {
    const data = await this.service.previewScenario(req.body.config || req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== 策略管理 ====================

  listStrategies = async (req: Request, res: Response) => {
    const data = await this.service.listStrategies(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getStrategy = async (req: Request, res: Response) => {
    const data = await this.service.getStrategy(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '策略不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  createStrategy = async (req: Request, res: Response) => {
    const data = await this.service.createStrategy(req.body)
    res.json({ code: 200, message: '创建成功', data })
  }

  updateStrategy = async (req: Request, res: Response) => {
    const data = await this.service.updateStrategy(req.params.id, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '策略不存在' })
    res.json({ code: 200, message: '更新成功', data })
  }

  deleteStrategy = async (req: Request, res: Response) => {
    await this.service.deleteStrategy(req.params.id)
    res.json({ code: 200, message: '删除成功' })
  }

  generateStrategy = async (req: Request, res: Response) => {
    const data = await this.service.generateStrategy(req.body.scenario_id)
    res.json({ code: 200, message: '策略生成成功', data })
  }

  // ==================== 模拟与验证 ====================

  listSimulations = async (req: Request, res: Response) => {
    const data = await this.service.listSimulations(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  startSimulation = async (req: Request, res: Response) => {
    const data = await this.service.startSimulation(req.body, (req as any).user!.id)
    res.json({ code: 200, message: '模拟已启动', data })
  }

  getSimulation = async (req: Request, res: Response) => {
    const data = await this.service.getSimulation(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '模拟记录不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  stopSimulation = async (req: Request, res: Response) => {
    const data = await this.service.stopSimulation(req.params.id)
    res.json({ code: 200, message: '模拟已停止', data })
  }

  pauseSimulation = async (req: Request, res: Response) => {
    const data = await this.service.pauseSimulation(req.params.id)
    res.json({ code: 200, message: '模拟已暂停', data })
  }

  resumeSimulation = async (req: Request, res: Response) => {
    const data = await this.service.resumeSimulation(req.params.id)
    res.json({ code: 200, message: '模拟已恢复', data })
  }

  updateSimulationParams = async (req: Request, res: Response) => {
    const data = await this.service.updateSimulationParams(req.params.id, req.body)
    res.json({ code: 200, message: '参数已更新', data })
  }

  getSimulationResults = async (req: Request, res: Response) => {
    const data = await this.service.getSimulationResults(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  getSimulationLive = async (req: Request, res: Response) => {
    const sinceStep = parseInt(req.query.since_step as string, 10) || 0
    const data = await this.service.getSimulationLive(req.params.id, sinceStep)
    if (!data) return res.status(404).json({ code: 404, message: '模拟记录不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== 评估 ====================

  listEvaluations = async (req: Request, res: Response) => {
    const data = await this.service.listEvaluations(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getEvaluation = async (req: Request, res: Response) => {
    const data = await this.service.getEvaluation(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '评估记录不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  generateEvaluation = async (req: Request, res: Response) => {
    const data = await this.service.generateEvaluation(req.body.simulation_id)
    res.json({ code: 200, message: '评估报告已生成', data })
  }

  exportEvaluation = async (req: Request, res: Response) => {
    const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'word'
    const result = await this.service.exportEvaluation(req.params.id, format)
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`)
    res.send(result.buffer)
  }

  // ==================== 人工干预 ====================

  listInterventions = async (req: Request, res: Response) => {
    const data = await this.service.listInterventions(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createIntervention = async (req: Request, res: Response) => {
    const data = await this.service.createIntervention(req.body, (req as any).user!.id)
    res.json({ code: 200, message: '干预记录已创建', data })
  }

  exportInterventions = async (req: Request, res: Response) => {
    const data = await this.service.exportInterventions(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getRunningSimulations = async (_req: Request, res: Response) => {
    const data = await this.service.getRunningSimulations()
    res.json({ code: 200, message: 'ok', data })
  }
}
