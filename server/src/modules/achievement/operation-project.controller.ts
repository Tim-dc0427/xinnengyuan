import type { Request, Response } from 'express'
import { OperationProjectService } from './operation-project.service.js'
import { AchievementService } from './achievement.service.js'

export class OperationProjectController {
  private service = new OperationProjectService()
  private achievementService = new AchievementService()

  // ==================== 投运项目管理（委托给 AchievementService） ====================

  listProjects = async (req: Request, res: Response) => {
    const data = await this.achievementService.listProjects({ ...(req.query as any), forVerification: true })
    res.json({ code: 200, message: 'ok', data })
  }

  getProject = async (req: Request, res: Response) => {
    const data = await this.achievementService.getProjectWithStation(req.params.id as string)
    if (!data) return res.status(404).json({ code: 404, message: '项目不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  createProject = async (req: Request, res: Response) => {
    const data = await this.achievementService.createProject(req.body, req.user!.id)
    res.json({ code: 200, message: 'ok', data })
  }

  updateProject = async (req: Request, res: Response) => {
    const data = await this.achievementService.updateProject(req.params.id as string, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '项目不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  deleteProject = async (req: Request, res: Response) => {
    await this.achievementService.updateProject(req.params.id as string, { status: 'closed' })
    res.json({ code: 200, message: 'ok' })
  }

  getAvailableStations = async (_req: Request, res: Response) => {
    const data = await this.achievementService.getAvailableStations()
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== 运行数据实时聚合 ====================

  getCompletionComparison = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getCompletionComparison(req.params.id as string)
      res.json({ code: 200, message: 'ok', data })
    } catch (err: any) {
      res.status(400).json({ code: 400, message: err.message || '获取竣工对标失败' })
    }
  }

  updateCompletionTargets = async (req: Request, res: Response) => {
    try {
      const data = await this.service.updateCompletionTargets(req.params.id as string, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (err: any) {
      res.status(400).json({ code: 400, message: err.message || '保存目标失败' })
    }
  }

  getRunningStats = async (req: Request, res: Response) => {
    try {
      const { periodStart, periodEnd } = req.query as any
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ code: 400, message: '请指定时间范围' })
      }
      const data = await this.service.getRunningStats(req.params.id as string, periodStart, periodEnd)
      res.json({ code: 200, message: 'ok', data })
    } catch (err: any) {
      res.status(400).json({ code: 400, message: err.message || '获取运行数据失败' })
    }
  }

  // ==================== 成效验证评估 ====================

  listVerifications = async (req: Request, res: Response) => {
    const data = await this.service.listVerifications(req.params.id as string)
    res.json({ code: 200, message: 'ok', data })
  }

  createVerification = async (req: Request, res: Response) => {
    try {
      const data = await this.service.createVerification(req.params.id as string, req.body, req.user!.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (err: any) {
      res.status(400).json({ code: 400, message: err.message || '创建评估失败' })
    }
  }

  updateVerification = async (req: Request, res: Response) => {
    const data = await this.service.updateVerification(req.params.vid as string, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '评估记录不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== 评估报告 ====================

  getReport = async (req: Request, res: Response) => {
    try {
      const data = await this.service.generateReport(req.params.vid as string)
      res.json({ code: 200, message: 'ok', data })
    } catch (err: any) {
      res.status(400).json({ code: 400, message: err.message || '生成报告失败' })
    }
  }

  // ==================== 经验教训案例库 ====================

  listLessons = async (req: Request, res: Response) => {
    const data = await this.service.listLessons(req.params.id as string)
    res.json({ code: 200, message: 'ok', data })
  }

  createLesson = async (req: Request, res: Response) => {
    const data = await this.service.createLesson(req.body, req.user!.id)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteLesson = async (req: Request, res: Response) => {
    await this.service.deleteLesson(req.params.lid as string)
    res.json({ code: 200, message: 'ok' })
  }
}
