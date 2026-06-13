import { Request, Response } from 'express'
import { ScenarioService } from './scenario.service.js'
import { audit } from '../../common/audit.service.js'

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
    audit(req, 'CREATE', 'scenario', data.id, `创建场景「${req.body.name || data.id}」`, null, req.body)
    res.json({ code: 200, message: '创建成功', data })
  }

  updateScenario = async (req: Request, res: Response) => {
    const data = await this.service.updateScenario(req.params.id, req.body, req.user!.id)
    if (!data) return res.status(404).json({ code: 404, message: '场景不存在' })
    audit(req, 'UPDATE', 'scenario', req.params.id, '修改场景', null, req.body)
    res.json({ code: 200, message: '更新成功', data })
  }

  deleteScenario = async (req: Request, res: Response) => {
    await this.service.deleteScenario(req.params.id)
    audit(req, 'DELETE', 'scenario', req.params.id, '删除场景', null, null)
    res.json({ code: 200, message: '删除成功' })
  }

  batchDeleteScenarios = async (req: Request, res: Response) => {
    const data = await this.service.batchDeleteScenarios(req.body.ids)
    audit(req, 'DELETE', 'scenario', null, `批量删除 ${data.deleted} 个场景`, null, null)
    res.json({ code: 200, message: `已删除 ${data.deleted} 个场景`, data })
  }

  copyScenario = async (req: Request, res: Response) => {
    const data = await this.service.copyScenario(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '场景不存在' })
    audit(req, 'CREATE', 'scenario', data.id, '复制场景', null, null)
    res.json({ code: 200, message: '复制成功', data })
  }

  batchCopyScenarios = async (req: Request, res: Response) => {
    const data = await this.service.batchCopyScenarios(req.body.ids)
    audit(req, 'CREATE', 'scenario', null, `批量复制 ${data.copied} 个场景`, null, null)
    res.json({ code: 200, message: `已复制 ${data.copied} 个场景`, data })
  }

  getScenarioVersions = async (req: Request, res: Response) => {
    const data = await this.service.getScenarioVersions(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  restoreVersion = async (req: Request, res: Response) => {
    const data = await this.service.restoreVersion(req.params.id, req.params.versionId, req.user!.id)
    if (!data) return res.status(404).json({ code: 404, message: '版本不存在' })
    audit(req, 'EXECUTE', 'scenario', req.params.id, `恢复版本「${req.params.versionId}」`, null, null)
    res.json({ code: 200, message: '版本已恢复', data })
  }

  exportScenarios = async (req: Request, res: Response) => {
    const ids = req.body.ids ?? (req.query.ids ? String(req.query.ids).split(',') : [])
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
    audit(req, 'CREATE', 'strategy', data.id, '创建策略', null, req.body)
    res.json({ code: 200, message: '创建成功', data })
  }

  updateStrategy = async (req: Request, res: Response) => {
    const data = await this.service.updateStrategy(req.params.id, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '策略不存在' })
    audit(req, 'UPDATE', 'strategy', req.params.id, '修改策略', null, req.body)
    res.json({ code: 200, message: '更新成功', data })
  }

  deleteStrategy = async (req: Request, res: Response) => {
    await this.service.deleteStrategy(req.params.id)
    audit(req, 'DELETE', 'strategy', req.params.id, '删除策略', null, null)
    res.json({ code: 200, message: '删除成功' })
  }

  generateStrategy = async (req: Request, res: Response) => {
    try {
      const data = await this.service.generateStrategy(req.body.scenario_id)
      audit(req, 'EXECUTE', 'scenario', req.body.scenario_id, '生成策略', null, req.body)
      res.json({ code: 200, message: '策略生成成功', data })
    } catch (e: any) { res.status(e.statusCode || 400).json({ code: e.statusCode || 400, message: e.message || '生成策略失败' }) }
  }

  // ==================== 模拟与验证 ====================

  listSimulations = async (req: Request, res: Response) => {
    const data = await this.service.listSimulations(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  startSimulation = async (req: Request, res: Response) => {
    const data = await this.service.startSimulation(req.body, (req as any).user!.id)
    audit(req, 'EXECUTE', 'simulation', data.id, '启动场景模拟', null, req.body)
    res.json({ code: 200, message: '模拟已启动', data })
  }

  getSimulation = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getSimulation(req.params.id)
      if (!data) return res.status(404).json({ code: 404, message: '模拟记录不存在' })
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) }
  }

  stopSimulation = async (req: Request, res: Response) => {
    const data = await this.service.stopSimulation(req.params.id)
    audit(req, 'EXECUTE', 'simulation', req.params.id, '停止模拟', null, null)
    res.json({ code: 200, message: '模拟已停止', data })
  }

  deleteSimulation = async (req: Request, res: Response) => {
    try {
      const data = await this.service.deleteSimulation(req.params.id)
      res.json({ code: 200, message: '模拟已删除', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message || '删除失败' }) }
  }

  pauseSimulation = async (req: Request, res: Response) => {
    try {
      const data = await this.service.pauseSimulation(req.params.id)
      audit(req, 'EXECUTE', 'simulation', req.params.id, '暂停模拟', null, null)
      res.json({ code: 200, message: '模拟已暂停', data })
    } catch (e: any) { res.status(e.statusCode || 400).json({ code: e.statusCode || 400, message: e.message || '暂停失败' }) }
  }

  resumeSimulation = async (req: Request, res: Response) => {
    try {
      const data = await this.service.resumeSimulation(req.params.id)
      audit(req, 'EXECUTE', 'simulation', req.params.id, '恢复模拟', null, null)
      res.json({ code: 200, message: '模拟已恢复', data })
    } catch (e: any) { res.status(e.statusCode || 400).json({ code: e.statusCode || 400, message: e.message || '恢复失败' }) }
  }

  updateSimulationParams = async (req: Request, res: Response) => {
    try {
      const data = await this.service.updateSimulationParams(req.params.id, req.body)
      res.json({ code: 200, message: '参数已更新', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message || '更新失败' }) }
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

  getExecutionData = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getExecutionData(req.params.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(e.statusCode || 500).json({ code: e.statusCode || 500, message: e.message }) }
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
    try {
      const data = await this.service.generateEvaluation(req.body.simulation_id)
      res.json({ code: 200, message: '评估报告已生成', data })
    } catch (e: any) { res.status(e.statusCode || 500).json({ code: e.statusCode || 500, message: e.message }) }
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
    try {
      const operator = (req as any).user?.username || 'anonymous'
      const data = await this.service.createIntervention(req.body, operator)
      res.json({ code: 200, message: '干预记录已创建', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message || '干预操作失败' }) }
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
