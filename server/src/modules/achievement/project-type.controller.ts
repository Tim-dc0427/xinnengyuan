import { Request, Response } from 'express'
import { ProjectTypeService } from './project-type.service.js'

export class ProjectTypeController {
  private service = new ProjectTypeService()

  listTypes = async (_req: Request, res: Response) => {
    const data = await this.service.listTypes()
    res.json({ code: 200, message: 'ok', data })
  }

  getAllWithFields = async (_req: Request, res: Response) => {
    const data = await this.service.getAllTypesWithFields()
    res.json({ code: 200, message: 'ok', data })
  }

  getTypeWithFields = async (req: Request, res: Response) => {
    const data = await this.service.getTypeWithFields(req.params.id)
    if (!data) return res.status(404).json({ code: 404, message: '项目类型不存在' })
    res.json({ code: 200, message: 'ok', data })
  }

  createType = async (req: Request, res: Response) => {
    const data = await this.service.createType(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updateType = async (req: Request, res: Response) => {
    const data = await this.service.updateType(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteType = async (req: Request, res: Response) => {
    await this.service.deleteType(req.params.id)
    res.json({ code: 200, message: 'ok' })
  }

  listFields = async (req: Request, res: Response) => {
    const data = await this.service.listFields(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  saveFields = async (req: Request, res: Response) => {
    const data = await this.service.saveFields(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  listFieldLibrary = async (req: Request, res: Response) => { const data = await this.service.listFieldLibrary(req.query as any); res.json({ code: 200, message: 'ok', data }) }
  createFieldLibraryItem = async (req: Request, res: Response) => { const data = await this.service.createFieldLibraryItem(req.body); res.json({ code: 200, message: 'ok', data }) }
  deleteFieldLibraryItem = async (req: Request, res: Response) => { await this.service.deleteFieldLibraryItem(req.params.id); res.json({ code: 200, message: 'ok' }) }
}
