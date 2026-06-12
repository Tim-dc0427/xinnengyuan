import { Request, Response } from 'express'
import { PowerFlowService } from './power-flow.service.js'

export class PowerFlowController {
  private service = new PowerFlowService()

  getIndicators = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getIndicators(req.query as any) }) }
  getNodeStability = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getNodeStability(req.query as any) }) }
  getThreePhase = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getThreePhase(req.query as any) }) }
  getThreePhaseTrend = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getThreePhaseTrend(req.query as any) }) }

  getThresholds = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getThresholds(req.query as any) }) }
  updateThresholds = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateThresholds(req.body) }) }
  deleteThreshold = async (req: Request, res: Response) => {
    try { res.json({ code: 200, message: 'ok', data: await this.service.deleteThreshold(req.params.id) }) }
    catch (e: any) { res.status(400).json({ code: 400, message: e.message || '删除失败' }) }
  }

  checkCompleteness = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.checkCompleteness(req.body) }) }
  checkBoundary = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.checkBoundary(req.body) }) }
  checkConsistency = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.checkConsistency(req.body) }) }

  submitCalculation = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.submitCalculation(req.body, req.user!.id) }) }
  getTaskStatus = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getTaskStatus(req.params.taskId) }) }
  getTaskResult = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getTaskResult(req.params.taskId) }) }

  // ==================== Batch Calculation ====================
  submitBatchConfig = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.submitBatchConfig(req.body, req.user!.id) }) } catch (e: any) { console.error('[submitBatchConfig]', e.message, e.stack); res.status(500).json({ code: 500, message: e.message || '提交失败' }) } }
  listBatches = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.listBatches(req.query as any) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  getBatchGroup = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.getBatchGroup(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  getBatchStatus = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.getBatchStatus(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  cancelBatch = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.cancelBatch(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '取消失败' }) } }
  deleteBatch = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.deleteBatch(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '删除失败' }) } }
  getBatchResults = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.getBatchResults(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  exportBatchResults = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.exportBatchResults(req.params.groupId, req.query.format as string) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '导出失败' }) } }

  listHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listHistory(req.query as any) }) }
  compareVersions = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.compareVersions(req.query as any) }) }
  reuseHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.reuseHistory(req.params.id) }) }
  lockHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.lockHistory(req.params.taskId) }) }
  deleteHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deleteHistory(req.params.taskId) }) }
  cleanupExpired = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.cleanupExpired(req.body.days || 30) }) }

  // Curve templates (version controlled)
  listCurveTemplates = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listCurveTemplates() }) }
  listAllCurveTemplates = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listAllCurveTemplates(req.query.rootId as string) }) }
  createCurveTemplate = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createCurveTemplate(req.body, req.user!.id) }) }
  updateCurveTemplate = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateCurveTemplate(req.params.id, req.body, req.user!.id) }) }
  deleteCurveTemplate = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deleteCurveTemplate(req.params.id) }) }
  rollbackCurveTemplate = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.rollbackCurveTemplate(req.params.id, req.user!.id) }) }
  getCurveTemplateVersionHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getCurveTemplateVersionHistory(req.params.rootId) }) }

  // Confidence coefficient settings (version controlled)
  listConfidenceSettings = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listConfidenceSettings() }) }
  listAllConfidenceSettings = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listAllConfidenceSettings(req.query.rootId as string) }) }
  createConfidenceSetting = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createConfidenceSetting(req.body, req.user!.id) }) }
  updateConfidenceSetting = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateConfidenceSetting(req.params.id, req.body, req.user!.id) }) }
  deleteConfidenceSetting = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deleteConfidenceSetting(req.params.id) }) }
  rollbackConfidenceSetting = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.rollbackConfidenceSetting(req.params.id, req.user!.id) }) }
  getConfidenceSettingVersionHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getConfidenceSettingVersionHistory(req.params.rootId) }) }

  // ==================== Station Model Params (集中式光伏电站模型) ====================
  listStationModels = async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : undefined
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
    res.json({ code: 200, message: 'ok', data: await this.service.listStationModels({ page, pageSize }) })
  }
  deleteStationModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.deleteStationModel(req.params.id, req.user!.id) }) }
  listAllStationModels = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listAllStationModels(req.query.rootId as string) }) }
  getStationModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getStationModel(req.params.id) }) }
  createStationModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.createStationModel(req.body, req.user!.id) }) }
  updateStationModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.updateStationModel(req.params.id, req.body, req.user!.id) }) }
  rollbackStationModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.rollbackStationModel(req.params.id, req.user!.id) }) }
  exportStationModels = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.exportStationModels(req.body.ids) }) }
  getStationModelVersionHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getStationModelVersionHistory(req.params.rootId) }) }
  compareStationModelVersions = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.compareStationModelVersions(req.query.idA as string, req.query.idB as string) }) }

  getGridBuses = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getGridBuses(req.query as any) }) }
  getGridLoads = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getGridLoads(req.query as any) }) }
  getGridGenerators = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getGridGenerators(req.query as any) }) }
  getGridBranches = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getGridBranches(req.query as any) }) }
  getSolarStations = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getSolarStations() }) }
  getFeeders = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getFeeders() }) }

  // ==================== 4.3 在线计算 ====================
  submitStandardPF = async (req: Request, res: Response) => {
    try {
      res.json({ code: 200, message: 'ok', data: await this.service.submitStandardPF(req.body, req.user!.id) })
    } catch (e: any) {
      console.error('[submitStandardPF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  submitReversePF = async (req: Request, res: Response) => {
    try {
      res.json({ code: 200, message: 'ok', data: await this.service.submitReversePF(req.body, req.user!.id) })
    } catch (e: any) {
      console.error('[submitReversePF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  submitProbabilisticPF = async (req: Request, res: Response) => {
    try {
      res.json({ code: 200, message: 'ok', data: await this.service.submitProbabilisticPF(req.body, req.user!.id) })
    } catch (e: any) {
      console.error('[submitProbabilisticPF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  submitThreePhasePF = async (req: Request, res: Response) => {
    try {
      res.json({ code: 200, message: 'ok', data: await this.service.submitThreePhasePF(req.body, req.user!.id) })
    } catch (e: any) {
      console.error('[submitThreePhasePF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  getTaskProgress = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getProgress(req.params.taskId) }) }
  pauseTask = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.pauseTask(req.params.taskId) }) }
  resumeTask = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.resumeTask(req.params.taskId) }) }
  listTasks = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listTasks(req.query as any) }) }

  getPhaseDataSummary = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getPhaseDataSummary() }) }

  getPhaseDataDetail = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getPhaseDataDetail(req.body) }) }
}
