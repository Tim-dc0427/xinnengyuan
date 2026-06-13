import { Request, Response } from 'express'
import { PowerFlowService } from './power-flow.service.js'
import { audit } from '../../common/audit.service.js'

function calcTypeLabel(type: string): string {
  const m: Record<string, string> = { STANDARD: '标准潮流', REVERSE: '反向潮流', PROBABILISTIC: '概率潮流', THREE_PHASE: '三相潮流' }
  return m[type] || type
}

export class PowerFlowController {
  private service = new PowerFlowService()

  getIndicators = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getIndicators(req.query as any) }) }
  getNodeStability = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getNodeStability(req.query as any) }) }
  getThreePhase = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getThreePhase(req.query as any) }) }
  getThreePhaseTrend = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getThreePhaseTrend(req.query as any) }) }

  getThresholds = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getThresholds(req.query as any) }) }
  updateThresholds = async (req: Request, res: Response) => {
    const data = await this.service.updateThresholds(req.body)
    audit(req, 'UPDATE', 'threshold', null, '更新指标阈值', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteThreshold = async (req: Request, res: Response) => {
    try {
      const data = await this.service.deleteThreshold(req.params.id)
      audit(req, 'DELETE', 'threshold', req.params.id, '删除指标阈值', null, null)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message || '删除失败' }) }
  }

  checkCompleteness = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.checkCompleteness(req.body) }) }
  checkBoundary = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.checkBoundary(req.body) }) }
  checkConsistency = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.checkConsistency(req.body) }) }

  submitCalculation = async (req: Request, res: Response) => {
    const data = await this.service.submitCalculation(req.body, req.user!.id)
    audit(req, 'EXECUTE', 'calculation', data.taskId, `提交${calcTypeLabel(req.body.calcType || 'STANDARD')}计算`, null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  getTaskStatus = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getTaskStatus(req.params.taskId) }) }
  getTaskResult = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getTaskResult(req.params.taskId) }) }

  // ==================== Batch Calculation ====================
  submitBatchConfig = async (req: Request, res: Response) => {
    try {
      const data = await this.service.submitBatchConfig(req.body, req.user!.id)
      audit(req, 'EXECUTE', 'batch_calc', data.groupId, `提交批量计算「${req.body.groupName || data.groupId}」`, null, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { console.error('[submitBatchConfig]', e.message, e.stack); res.status(500).json({ code: 500, message: e.message || '提交失败' }) }
  }
  listBatches = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.listBatches(req.query as any) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  getBatchGroup = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.getBatchGroup(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  getBatchStatus = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.getBatchStatus(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  cancelBatch = async (req: Request, res: Response) => {
    try {
      const data = await this.service.cancelBatch(req.params.groupId)
      audit(req, 'EXECUTE', 'batch_calc', req.params.groupId, '取消批量计算', null, null)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '取消失败' }) }
  }
  deleteBatch = async (req: Request, res: Response) => {
    try {
      const data = await this.service.deleteBatch(req.params.groupId)
      audit(req, 'DELETE', 'batch_calc', req.params.groupId, '删除批量计算', null, null)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '删除失败' }) }
  }
  getBatchResults = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.getBatchResults(req.params.groupId) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '查询失败' }) } }
  exportBatchResults = async (req: Request, res: Response) => { try { res.json({ code: 200, message: 'ok', data: await this.service.exportBatchResults(req.params.groupId, req.query.format as string) }) } catch (e: any) { res.status(500).json({ code: 500, message: e.message || '导出失败' }) } }

  listHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listHistory(req.query as any) }) }
  compareVersions = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.compareVersions(req.query as any) }) }
  reuseHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.reuseHistory(req.params.id) }) }
  lockHistory = async (req: Request, res: Response) => {
    const data = await this.service.lockHistory(req.params.taskId)
    audit(req, 'UPDATE', 'calc_history', req.params.taskId, '锁定计算历史', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteHistory = async (req: Request, res: Response) => {
    const data = await this.service.deleteHistory(req.params.taskId)
    audit(req, 'DELETE', 'calc_history', req.params.taskId, '删除计算历史', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  cleanupExpired = async (req: Request, res: Response) => {
    const data = await this.service.cleanupExpired(req.body.days || 30)
    audit(req, 'DELETE', 'calc_history', null, `清理 ${req.body.days || 30} 天前过期历史`, null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  getHistoryRetentionDays = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getHistoryRetentionDays() }) }

  // Curve templates (version controlled)
  listCurveTemplates = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listCurveTemplates() }) }
  listAllCurveTemplates = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listAllCurveTemplates(req.query.rootId as string) }) }
  createCurveTemplate = async (req: Request, res: Response) => {
    const data = await this.service.createCurveTemplate(req.body, req.user!.id)
    audit(req, 'CREATE', 'curve_template', data.id, '创建出力曲线模板', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  updateCurveTemplate = async (req: Request, res: Response) => {
    const data = await this.service.updateCurveTemplate(req.params.id, req.body, req.user!.id)
    audit(req, 'UPDATE', 'curve_template', req.params.id, '修改出力曲线模板', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteCurveTemplate = async (req: Request, res: Response) => {
    const data = await this.service.deleteCurveTemplate(req.params.id)
    audit(req, 'DELETE', 'curve_template', req.params.id, '删除出力曲线模板', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  rollbackCurveTemplate = async (req: Request, res: Response) => {
    const data = await this.service.rollbackCurveTemplate(req.params.id, req.user!.id)
    audit(req, 'EXECUTE', 'curve_template', req.params.id, '回退出力曲线模板版本', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  getCurveTemplateVersionHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getCurveTemplateVersionHistory(req.params.rootId) }) }

  // Confidence coefficient settings (version controlled)
  listConfidenceSettings = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listConfidenceSettings() }) }
  listAllConfidenceSettings = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listAllConfidenceSettings(req.query.rootId as string) }) }
  createConfidenceSetting = async (req: Request, res: Response) => {
    const data = await this.service.createConfidenceSetting(req.body, req.user!.id)
    audit(req, 'CREATE', 'confidence_setting', data.id, '创建置信系数设置', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  updateConfidenceSetting = async (req: Request, res: Response) => {
    const data = await this.service.updateConfidenceSetting(req.params.id, req.body, req.user!.id)
    audit(req, 'UPDATE', 'confidence_setting', req.params.id, '修改置信系数设置', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteConfidenceSetting = async (req: Request, res: Response) => {
    const data = await this.service.deleteConfidenceSetting(req.params.id)
    audit(req, 'DELETE', 'confidence_setting', req.params.id, '删除置信系数设置', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  rollbackConfidenceSetting = async (req: Request, res: Response) => {
    const data = await this.service.rollbackConfidenceSetting(req.params.id, req.user!.id)
    audit(req, 'EXECUTE', 'confidence_setting', req.params.id, '回退置信系数设置版本', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  getConfidenceSettingVersionHistory = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getConfidenceSettingVersionHistory(req.params.rootId) }) }

  // ==================== Station Model Params ====================
  listStationModels = async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : undefined
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
    res.json({ code: 200, message: 'ok', data: await this.service.listStationModels({ page, pageSize }) })
  }
  deleteStationModel = async (req: Request, res: Response) => {
    const data = await this.service.deleteStationModel(req.params.id, req.user!.id)
    audit(req, 'DELETE', 'station_model', req.params.id, '删除电站模型', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  listAllStationModels = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listAllStationModels(req.query.rootId as string) }) }
  getStationModel = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getStationModel(req.params.id) }) }
  createStationModel = async (req: Request, res: Response) => {
    const data = await this.service.createStationModel(req.body, req.user!.id)
    audit(req, 'CREATE', 'station_model', data.id, '创建电站模型', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  updateStationModel = async (req: Request, res: Response) => {
    const data = await this.service.updateStationModel(req.params.id, req.body, req.user!.id)
    audit(req, 'UPDATE', 'station_model', req.params.id, '修改电站模型', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  rollbackStationModel = async (req: Request, res: Response) => {
    const data = await this.service.rollbackStationModel(req.params.id, req.user!.id)
    audit(req, 'EXECUTE', 'station_model', req.params.id, '回退电站模型版本', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
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
      const data = await this.service.submitStandardPF(req.body, req.user!.id)
      audit(req, 'EXECUTE', 'calculation', data.taskId, '提交标准潮流计算', null, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      console.error('[submitStandardPF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  submitReversePF = async (req: Request, res: Response) => {
    try {
      const data = await this.service.submitReversePF(req.body, req.user!.id)
      audit(req, 'EXECUTE', 'calculation', data.taskId, '提交反向潮流计算', null, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      console.error('[submitReversePF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  submitProbabilisticPF = async (req: Request, res: Response) => {
    try {
      const data = await this.service.submitProbabilisticPF(req.body, req.user!.id)
      audit(req, 'EXECUTE', 'calculation', data.taskId, '提交概率潮流计算', null, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      console.error('[submitProbabilisticPF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  submitThreePhasePF = async (req: Request, res: Response) => {
    try {
      const data = await this.service.submitThreePhasePF(req.body, req.user!.id)
      audit(req, 'EXECUTE', 'calculation', data.taskId, '提交三相不平衡计算', null, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      console.error('[submitThreePhasePF] error:', e.message, e.stack)
      res.status(500).json({ code: 500, message: e.message || '提交失败', data: null })
    }
  }
  getTaskProgress = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getProgress(req.params.taskId) }) }
  pauseTask = async (req: Request, res: Response) => {
    const data = await this.service.pauseTask(req.params.taskId)
    audit(req, 'EXECUTE', 'calculation', req.params.taskId, '暂停计算任务', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  resumeTask = async (req: Request, res: Response) => {
    const data = await this.service.resumeTask(req.params.taskId)
    audit(req, 'EXECUTE', 'calculation', req.params.taskId, '恢复计算任务', null, null)
    res.json({ code: 200, message: 'ok', data })
  }
  listTasks = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.listTasks(req.query as any) }) }

  getPhaseDataSummary = async (_req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getPhaseDataSummary() }) }

  getPhaseDataDetail = async (req: Request, res: Response) => { res.json({ code: 200, message: 'ok', data: await this.service.getPhaseDataDetail(req.body) }) }
}
