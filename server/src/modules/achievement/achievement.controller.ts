import { Request, Response } from 'express'
import { AchievementService } from './achievement.service.js'
import { audit } from '../../common/audit.service.js'

export class AchievementController {
  private service = new AchievementService()

  listProjects = async (req: Request, res: Response) => {
    const data = await this.service.listProjects(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createProject = async (req: Request, res: Response) => {
    const data = await this.service.createProject(req.body, req.user!.id)
    audit(req, 'CREATE', 'project', data.id, `创建项目「${req.body.name || data.id}」`, null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updateProject = async (req: Request, res: Response) => {
    const data = await this.service.updateProject(req.params.id, req.body, req.user!.id)
    if (!data) return res.status(404).json({ code: 404, message: '项目不存在' })
    audit(req, 'UPDATE', 'project', req.params.id, '修改项目', null, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getAccessConditions = async (req: Request, res: Response) => {
    const data = await this.service.getAccessConditions(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  setAccessConditions = async (req: Request, res: Response) => {
    const data = await this.service.setAccessConditions(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  runFeasibility = async (req: Request, res: Response) => {
    const data = await this.service.runFeasibility(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getFeasibility = async (req: Request, res: Response) => {
    const data = await this.service.getFeasibility(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  verifyEffectiveness = async (req: Request, res: Response) => {
    const data = await this.service.verifyEffectiveness(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  traceHistory = async (req: Request, res: Response) => {
    const data = await this.service.traceHistory(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  listDocuments = async (req: Request, res: Response) => {
    const data = await this.service.listDocuments(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  uploadDocument = async (req: Request, res: Response) => {
    const file = req.file
    if (!file) return res.status(400).json({ code: 400, message: '请选择文件' })
    const data = await this.service.uploadDocument(req.params.id, file, req.body.docType)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteDocument = async (req: Request, res: Response) => {
    const doc = await this.service.getDocument(req.params.docId)
    if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })
    const fs = await import('node:fs')
    try { fs.unlinkSync(doc.file_path) } catch { /* ignore */ }
    await this.service.deleteDocument(req.params.docId)
    res.json({ code: 200, message: 'ok' })
  }

  downloadDocument = async (req: Request, res: Response) => {
    const doc = await this.service.getDocument(req.params.docId)
    if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })
    res.download(doc.file_path, doc.doc_name)
  }

  // ==================== 版本管理 ====================
  getProjectVersions = async (req: Request, res: Response) => {
    const data = await this.service.getProjectVersions(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  getProjectVersionDetail = async (req: Request, res: Response) => {
    const data = await this.service.getProjectVersionDetail(req.params.vid)
    if (!data) return res.status(404).json({ code: 404, message: '版本不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  compareVersions = async (req: Request, res: Response) => {
    const v1 = parseInt(req.query.v1 as string)
    const v2 = parseInt(req.query.v2 as string)
    if (isNaN(v1) || isNaN(v2)) return res.status(400).json({ code: 400, message: '版本号无效' })
    try {
      const data = await this.service.compareVersions(req.params.id, v1, v2)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  restoreProjectVersion = async (req: Request, res: Response) => {
    try {
      const data = await this.service.restoreProjectVersion(req.params.id, req.params.vid, req.user!.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  // ==================== 档案核心内容 ====================
  getProjectArchive = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getProjectArchive(req.params.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  calculateCompleteness = async (req: Request, res: Response) => {
    try {
      const data = await this.service.calculateCompleteness(req.params.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  getOutputCurve = async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as any) || 'day'
      const date = req.query.date as string | undefined
      const data = await this.service.getOutputCurve(req.params.id, period, date)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  getProjectDeviceParams = async (req: Request, res: Response) => {
    const data = await this.service.getProjectDeviceParams(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== 合规性检查 ====================
  listComplianceChecklist = async (_req: Request, res: Response) => {
    const data = await this.service.listComplianceChecklist()
    res.json({ code: 200, message: 'ok', data })
  }

  runComplianceCheck = async (req: Request, res: Response) => {
    try {
      const data = await this.service.runComplianceCheck(req.params.id, req.user!.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  getComplianceResults = async (req: Request, res: Response) => {
    const data = await this.service.getComplianceResults(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  generateComplianceReport = async (req: Request, res: Response) => {
    try {
      const data = await this.service.generateComplianceReport(req.params.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message })
    }
  }

  // ==================== 规划调整记录 ====================
  listPlanAdjustments = async (req: Request, res: Response) => {
    const data = await this.service.listPlanAdjustments(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  createPlanAdjustment = async (req: Request, res: Response) => {
    const data = await this.service.createPlanAdjustment(req.params.id, req.body, req.user!.id)
    res.json({ code: 200, message: 'ok', data })
  }

  approvePlanAdjustment = async (req: Request, res: Response) => {
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ code: 400, message: '审批状态无效' })
    }
    const data = await this.service.approvePlanAdjustment(req.params.id, req.user!.id, status)
    if (!data) return res.status(404).json({ code: 404, message: '规划调整记录不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== 条件计划 ====================
  listConditionPlans = async (req: Request, res: Response) => {
    const data = await this.service.listConditionPlans(req.query.planType as string)
    res.json({ code: 200, message: 'ok', data })
  }
  createConditionPlan = async (req: Request, res: Response) => {
    const data = await this.service.createConditionPlan(req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  updateConditionPlan = async (req: Request, res: Response) => {
    const data = await this.service.updateConditionPlan(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }
  deleteConditionPlan = async (req: Request, res: Response) => {
    await this.service.deleteConditionPlan(req.params.id)
    res.json({ code: 200, message: 'ok' })
  }

  // ==================== 接入点资源 ====================
  listAccessPoints = async (_req: Request, res: Response) => {
    const data = await this.service.listAccessPoints()
    res.json({ code: 200, message: 'ok', data })
  }

  updateAccessPoint = async (req: Request, res: Response) => {
    const data = await this.service.updateAccessPoint(req.params.id, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '接入点不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  createAccessPoint = async (req: Request, res: Response) => {
    const data = await this.service.createAccessPoint(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  importAccessPoints = async (req: Request, res: Response) => {
    const list = req.body
    if (!Array.isArray(list) || list.length === 0) return res.status(400).json({ code: 400, message: '请提供导入数据' })
    const data = await this.service.importAccessPoints(list)
    res.json({ code: 200, message: 'ok', data })
  }
}
