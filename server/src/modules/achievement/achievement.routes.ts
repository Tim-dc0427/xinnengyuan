import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { AchievementController } from './achievement.controller.js'
import { ProjectTypeController } from './project-type.controller.js'

export const achievementRoutes = Router()
const ctrl = new AchievementController()
const typeCtrl = new ProjectTypeController()

// 项目管理
achievementRoutes.get('/projects', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listProjects)
achievementRoutes.post('/projects', auth(['admin', 'planner']), ctrl.createProject)
achievementRoutes.put('/projects/:id', auth(['admin', 'planner']), ctrl.updateProject)

// 接入条件
achievementRoutes.get('/projects/:id/access-conditions', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getAccessConditions)
achievementRoutes.post('/projects/:id/access-conditions', auth(['admin', 'planner']), ctrl.setAccessConditions)

// 可行性评估
achievementRoutes.post('/projects/:id/feasibility', auth(['admin', 'planner']), ctrl.runFeasibility)
achievementRoutes.get('/projects/:id/feasibility', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getFeasibility)

// 成效验证
achievementRoutes.post('/projects/:id/verify', auth(['admin', 'planner']), ctrl.verifyEffectiveness)

// 历史追溯
achievementRoutes.get('/projects/:id/trace', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.traceHistory)

// ==================== 项目类型管理 ====================
achievementRoutes.get('/project-types', auth(['admin', 'planner', 'operator', 'viewer']), typeCtrl.listTypes)
achievementRoutes.get('/project-types/with-fields', auth(['admin', 'planner', 'operator', 'viewer']), typeCtrl.getAllWithFields)
achievementRoutes.get('/project-types/:id/with-fields', auth(['admin', 'planner', 'operator', 'viewer']), typeCtrl.getTypeWithFields)
achievementRoutes.post('/project-types', auth(['admin', 'planner']), typeCtrl.createType)
achievementRoutes.put('/project-types/:id', auth(['admin', 'planner']), typeCtrl.updateType)
achievementRoutes.delete('/project-types/:id', auth(['admin', 'planner']), typeCtrl.deleteType)
achievementRoutes.get('/project-types/:id/fields', auth(['admin', 'planner', 'operator', 'viewer']), typeCtrl.listFields)
achievementRoutes.post('/project-types/:id/fields', auth(['admin', 'planner']), typeCtrl.saveFields)
