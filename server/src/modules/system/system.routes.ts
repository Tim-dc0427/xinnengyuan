import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { SystemController } from './system.controller.js'

export const systemRoutes = Router()
const ctrl = new SystemController()

// 部门管理
systemRoutes.get('/departments', auth(['admin']), ctrl.getDepartments)
systemRoutes.post('/departments', auth(['admin']), ctrl.createDepartment)
systemRoutes.put('/departments/:id', auth(['admin']), ctrl.updateDepartment)
systemRoutes.delete('/departments/:id', auth(['admin']), ctrl.deleteDepartment)

// 角色管理
systemRoutes.get('/roles', auth(['admin']), ctrl.getRoles)
systemRoutes.post('/roles', auth(['admin']), ctrl.createRole)
systemRoutes.put('/roles/:id', auth(['admin']), ctrl.updateRole)
systemRoutes.delete('/roles/:id', auth(['admin']), ctrl.deleteRole)

// 用户管理
systemRoutes.get('/users', auth(['admin']), ctrl.getUsers)
systemRoutes.post('/users', auth(['admin']), ctrl.createUser)
systemRoutes.put('/users/:id', auth(['admin']), ctrl.updateUser)
systemRoutes.delete('/users/:id', auth(['admin']), ctrl.deleteUser)

// 操作日志
systemRoutes.get('/audit-logs', auth(['admin']), ctrl.getAuditLogs)
systemRoutes.get('/user-options', auth(['admin']), ctrl.getUserOptions)
