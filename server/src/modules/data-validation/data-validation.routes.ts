import { Router } from 'express'
import { DataValidationController } from './data-validation.controller.js'

const controller = new DataValidationController()
export const dataValidationRoutes = Router()

dataValidationRoutes.post('/pv-completeness', controller.checkPVCompleteness)
dataValidationRoutes.post('/boundary', controller.checkBoundaryReasonability)
dataValidationRoutes.post('/time-series', controller.checkTimeSeriesConsistency)
