import { Request, Response } from 'express'
import { SystemService } from './system.service.js'

export class SystemController {
  private service = new SystemService()

  // ==================== 部门 ====================
  getDepartments = async (_req: Request, res: Response) => {
    const data = await this.service.getDepartments()
    res.json({ code: 200, message: 'ok', data })
  }

  createDepartment = async (req: Request, res: Response) => {
    try {
      const data = await this.service.createDepartment(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateDepartment = async (req: Request, res: Response) => {
    try {
      await this.service.updateDepartment(req.params.id, req.body)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteDepartment = async (req: Request, res: Response) => {
    try {
      await this.service.deleteDepartment(req.params.id)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  // ==================== 角色 ====================
  getRoles = async (_req: Request, res: Response) => {
    const data = await this.service.getRoles()
    res.json({ code: 200, message: 'ok', data })
  }

  createRole = async (req: Request, res: Response) => {
    try {
      const data = await this.service.createRole(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateRole = async (req: Request, res: Response) => {
    try {
      await this.service.updateRole(req.params.id, req.body)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteRole = async (req: Request, res: Response) => {
    try {
      await this.service.deleteRole(req.params.id)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  // ==================== 用户 ====================
  getUsers = async (req: Request, res: Response) => {
    const data = await this.service.getUsers(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createUser = async (req: Request, res: Response) => {
    try {
      const data = await this.service.createUser(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateUser = async (req: Request, res: Response) => {
    try {
      await this.service.updateUser(req.params.id, req.body)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteUser = async (req: Request, res: Response) => {
    try {
      await this.service.deleteUser(req.params.id)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  // ==================== 操作日志 ====================
  getAuditLogs = async (req: Request, res: Response) => {
    const data = await this.service.getAuditLogs(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getUserOptions = async (_req: Request, res: Response) => {
    const data = await this.service.getUserOptions()
    res.json({ code: 200, message: 'ok', data })
  }

  getDataRanges = async (_req: Request, res: Response) => {
    const data = await this.service.getDataRanges()
    res.json({ code: 200, message: 'ok', data })
  }
}
