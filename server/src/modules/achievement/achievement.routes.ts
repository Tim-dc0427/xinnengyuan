import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { AchievementController } from './achievement.controller.js'
import { ProjectTypeController } from './project-type.controller.js'
import { OperationProjectController } from './operation-project.controller.js'
import multer from 'multer'
import path from 'node:path'

export const achievementRoutes = Router()
const ctrl = new AchievementController()
const typeCtrl = new ProjectTypeController()
const opCtrl = new OperationProjectController()

const uploadDir = path.resolve('uploads/projects')
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => { cb(null, uploadDir) },
  filename: (_req: any, file: any, cb: any) => { cb(null, Date.now() + '-' + encodeURIComponent(file.originalname)) },
})
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.dwg', '.zip', '.rar']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) return cb(null, true)
    cb(new Error('不支持的文件类型: ' + ext))
  },
})

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

// 成效验证（旧 routes 路由，保留兼容）
achievementRoutes.post('/projects/:id/verify', auth(['admin', 'planner']), ctrl.verifyEffectiveness)

// ==================== 投运项目管理（成效验证评估） ====================
achievementRoutes.get('/available-stations', auth(['admin', 'planner', 'operator', 'viewer']), opCtrl.getAvailableStations)
achievementRoutes.get('/operation-projects', auth(['admin', 'planner', 'operator', 'viewer']), opCtrl.listProjects)
achievementRoutes.get('/operation-projects/:id', auth(['admin', 'planner', 'operator', 'viewer']), opCtrl.getProject)
achievementRoutes.post('/operation-projects', auth(['admin', 'planner']), opCtrl.createProject)
achievementRoutes.put('/operation-projects/:id', auth(['admin', 'planner']), opCtrl.updateProject)
achievementRoutes.delete('/operation-projects/:id', auth(['admin', 'planner']), opCtrl.deleteProject)

// 成效验证评估（基于投运项目）
achievementRoutes.get('/operation-projects/:id/verifications', auth(['admin', 'planner', 'operator', 'viewer']), opCtrl.listVerifications)
achievementRoutes.post('/operation-projects/:id/verifications', auth(['admin', 'planner']), opCtrl.createVerification)
achievementRoutes.put('/verifications/:vid', auth(['admin', 'planner']), opCtrl.updateVerification)

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

// ==================== 条件计划管理 ====================
achievementRoutes.get('/condition-plans', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listConditionPlans)
achievementRoutes.post('/condition-plans', auth(['admin', 'planner']), ctrl.createConditionPlan)
achievementRoutes.put('/condition-plans/:id', auth(['admin', 'planner']), ctrl.updateConditionPlan)
achievementRoutes.delete('/condition-plans/:id', auth(['admin', 'planner']), ctrl.deleteConditionPlan)

// ==================== 接入点资源管理 ====================
achievementRoutes.get('/access-points', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listAccessPoints)
achievementRoutes.post('/access-points', auth(['admin', 'planner']), ctrl.createAccessPoint)
achievementRoutes.put('/access-points/:id', auth(['admin', 'planner']), ctrl.updateAccessPoint)
achievementRoutes.post('/access-points/import', auth(['admin', 'planner']), ctrl.importAccessPoints)

// ==================== 项目字段库 ====================
achievementRoutes.get('/project-field-library', auth(['admin', 'planner', 'operator', 'viewer']), typeCtrl.listFieldLibrary)
achievementRoutes.post('/project-field-library', auth(['admin', 'planner']), typeCtrl.createFieldLibraryItem)
achievementRoutes.delete('/project-field-library/:id', auth(['admin', 'planner']), typeCtrl.deleteFieldLibraryItem)

// ==================== 项目文档管理 ====================
import fs from 'node:fs'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
achievementRoutes.get('/projects/:id/documents', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.listDocuments)
achievementRoutes.post('/projects/:id/documents', auth(['admin', 'planner']), upload.single('file'), ctrl.uploadDocument)
achievementRoutes.get('/projects/:id/documents/:docId/download', auth(['admin', 'planner', 'operator', 'viewer']), ctrl.downloadDocument)
achievementRoutes.delete('/projects/:id/documents/:docId', auth(['admin', 'planner']), ctrl.deleteDocument)
