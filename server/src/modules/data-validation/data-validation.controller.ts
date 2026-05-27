import { Request, Response } from 'express'
import { DataValidationService } from './data-validation.service.js'

export class DataValidationController {
  private service = new DataValidationService()

  checkPVCompleteness = async (req: Request, res: Response) => {
    res.json({ code: 200, message: 'ok', data: await this.service.checkPVCompleteness(req.body) })
  }

  checkBoundaryReasonability = async (req: Request, res: Response) => {
    res.json({ code: 200, message: 'ok', data: await this.service.checkBoundaryReasonability(req.body) })
  }

  checkTimeSeriesConsistency = async (req: Request, res: Response) => {
    res.json({ code: 200, message: 'ok', data: await this.service.checkTimeSeriesConsistency(req.body) })
  }
}
