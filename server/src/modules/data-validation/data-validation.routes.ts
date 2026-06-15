import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { DataValidationController } from './data-validation.controller.js'

const controller = new DataValidationController()
export const dataValidationRoutes = Router()

dataValidationRoutes.post('/pv-completeness', auth(['admin', 'planner', 'operator']), controller.checkPVCompleteness)
dataValidationRoutes.post('/boundary', auth(['admin', 'planner', 'operator']), controller.checkBoundaryReasonability)
dataValidationRoutes.post('/time-series', auth(['admin', 'planner', 'operator']), controller.checkTimeSeriesConsistency)
