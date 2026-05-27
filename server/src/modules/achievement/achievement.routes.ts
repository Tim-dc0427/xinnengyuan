import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { AchievementController } from './achievement.controller.js'

export const achievementRoutes = Router()
const ctrl = new AchievementController()

achievementRoutes.get('/projects', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listProjects)
achievementRoutes.post('/projects', auth(['admin', 'planner']), ctrl.createProject)
achievementRoutes.put('/projects/:id', auth(['admin', 'planner']), ctrl.updateProject)
achievementRoutes.get('/projects/:id/access-conditions', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getAccessConditions)
achievementRoutes.post('/projects/:id/access-conditions', auth(['admin', 'planner']), ctrl.setAccessConditions)
achievementRoutes.post('/projects/:id/feasibility', auth(['admin', 'planner']), ctrl.runFeasibility)
achievementRoutes.get('/projects/:id/feasibility', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.getFeasibility)
achievementRoutes.post('/projects/:id/verify', auth(['admin', 'planner']), ctrl.verifyEffectiveness)
achievementRoutes.get('/projects/:id/trace', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.traceHistory)
