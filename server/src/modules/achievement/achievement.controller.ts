import { Request, Response } from 'express'
import { AchievementService } from './achievement.service.js'

export class AchievementController {
  private service = new AchievementService()

  listProjects = async (req: Request, res: Response) => {
    const data = await this.service.listProjects(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createProject = async (req: Request, res: Response) => {
    const data = await this.service.createProject(req.body, req.user!.id)
    res.json({ code: 200, message: 'ok', data })
  }

  updateProject = async (req: Request, res: Response) => {
    const data = await this.service.updateProject(req.params.id, req.body)
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
}
