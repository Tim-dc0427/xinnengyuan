import type { Request, Response } from 'express'
import { AssessmentModelService } from './assessment-model.service.js'

const service = new AssessmentModelService()

export class AssessmentModelController {
  listFields = async (_req: Request, res: Response) => {
    const data = await service.listFields()
    res.json({ code: 200, message: 'ok', data })
  }

  createField = async (req: Request, res: Response) => {
    const data = await service.createField(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updateField = async (req: Request, res: Response) => {
    const data = await service.updateField(req.params.id, req.body)
    if (!data) return res.status(404).json({ code: 404, message: '字段不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  deleteField = async (req: Request, res: Response) => {
    await service.deleteField(req.params.id)
    res.json({ code: 200, message: 'ok' })
  }

  resetToDefaults = async (_req: Request, res: Response) => {
    const data = await service.resetToDefaults()
    res.json({ code: 200, message: 'ok', data })
  }
}
