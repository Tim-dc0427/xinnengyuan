import type { Request, Response } from 'express'
import { OperationProjectService } from './operation-project.service.js'

export class OperationProjectController {
  private service = new OperationProjectService()

  // ==================== 投运项目管理 ====================

  listProjects = async (req: Request, res: Response) => {
    const data = await this.service.listProjects(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getProject = async (req: Request, res: Response) => {
    const data = await this.service.getProject(req.params.id as string)
    if (!data) return res.status(404).json({ code: 404, message: '投运项目不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  createProject = async (req: Request, res: Response) => {
    const data = await this.service.createProject(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updateProject = async (req: Request, res: Response) => {
    const data = await this.service.updateProject(req.params.id as string, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '投运项目不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  deleteProject = async (req: Request, res: Response) => {
    await this.service.deleteProject(req.params.id as string)
    res.json({ code: 200, message: 'ok' })
  }

  getAvailableStations = async (_req: Request, res: Response) => {
    const data = await this.service.getAvailableStations()
    res.json({ code: 200, message: 'ok', data })
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
}
