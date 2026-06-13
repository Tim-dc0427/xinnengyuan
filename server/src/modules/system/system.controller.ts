import { Request, Response } from 'express'
import { SystemService } from './system.service.js'
import { audit } from '../../common/audit.service.js'

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
      audit(req, 'CREATE', 'department', data.id, `创建部门「${req.body.name}」`, null, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateDepartment = async (req: Request, res: Response) => {
    try {
      await this.service.updateDepartment(req.params.id, req.body)
      audit(req, 'UPDATE', 'department', req.params.id, `修改部门「${req.body.name}」`, null, req.body)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteDepartment = async (req: Request, res: Response) => {
    try {
      await this.service.deleteDepartment(req.params.id)
      audit(req, 'DELETE', 'department', req.params.id, '删除部门', null, null)
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
      audit(req, 'CREATE', 'role', data.id, `创建角色「${req.body.name}」`, null, { name: req.body.name, permissions: req.body.permissions })
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateRole = async (req: Request, res: Response) => {
    try {
      await this.service.updateRole(req.params.id, req.body)
      audit(req, 'UPDATE', 'role', req.params.id, `修改角色「${req.body.name}」`, null, req.body)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteRole = async (req: Request, res: Response) => {
    try {
      await this.service.deleteRole(req.params.id)
      audit(req, 'DELETE', 'role', req.params.id, '删除角色', null, null)
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
      audit(req, 'CREATE', 'user', data.id, `创建用户「${req.body.username}」`, null, { username: req.body.username, displayName: req.body.displayName, roleId: req.body.roleId })
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateUser = async (req: Request, res: Response) => {
    try {
      await this.service.updateUser(req.params.id, req.body)
      audit(req, 'UPDATE', 'user', req.params.id, `修改用户「${req.body.username || req.params.id}」`, null, req.body)
      res.json({ code: 200, message: 'ok' })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteUser = async (req: Request, res: Response) => {
    try {
      await this.service.deleteUser(req.params.id)
      audit(req, 'DELETE', 'user', req.params.id, '删除用户', null, null)
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
