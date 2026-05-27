import { Request, Response } from 'express'
import { GridDiagnosisService } from './grid-diagnosis.service.js'

export class GridDiagnosisController {
  private service = new GridDiagnosisService()

  getPvOutputStats = async (req: Request, res: Response) => {
    const data = await this.service.getPvOutputStats(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getFactors = async (req: Request, res: Response) => {
    const data = await this.service.getFactors(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  simulateExtreme = async (req: Request, res: Response) => {
    const data = await this.service.simulateExtreme(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getCarbonStats = async (req: Request, res: Response) => {
    const data = await this.service.getCarbonStats(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getJointOutputAnalysis = async (req: Request, res: Response) => {
    const data = await this.service.getJointOutputAnalysis(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  detectBackfeed = async (req: Request, res: Response) => {
    const data = await this.service.detectBackfeed(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  calculateCapacity = async (req: Request, res: Response) => {
    const data = await this.service.calculateCapacity(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  assessReliability = async (req: Request, res: Response) => {
    const data = await this.service.assessReliability(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  getLifecycle = async (req: Request, res: Response) => {
    const data = await this.service.getLifecycle(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  predictLife = async (req: Request, res: Response) => {
    const data = await this.service.predictLife(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  generateReplacementPlan = async (req: Request, res: Response) => {
    const data = await this.service.generateReplacementPlan(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getVoltageFluctuation = async (req: Request, res: Response) => {
    const data = await this.service.getVoltageFluctuation(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getPowerReliability = async (req: Request, res: Response) => {
    const data = await this.service.getPowerReliability(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getQualificationRate = async (req: Request, res: Response) => {
    const data = await this.service.getQualificationRate(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getAlerts = async (req: Request, res: Response) => {
    const data = await this.service.getAlerts(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  acknowledgeAlert = async (req: Request, res: Response) => {
    const data = await this.service.acknowledgeAlert(req.params.id, req.user!.id)
    res.json({ code: 200, message: 'ok', data })
  }

  traceEvent = async (req: Request, res: Response) => {
    const data = await this.service.traceEvent(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }
}
