import { Request, Response } from 'express'
import { GridDiagnosisService } from './grid-diagnosis.service.js'

export class GridDiagnosisController {
  private service = new GridDiagnosisService()

  getStations = async (_req: Request, res: Response) => {
    const data = await this.service.getStations()
    res.json({ code: 200, message: 'ok', data })
  }

  getStorageList = async (_req: Request, res: Response) => {
    const data = await this.service.getStorageList()
    res.json({ code: 200, message: 'ok', data })
  }

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

  getCarbonDynamic = async (req: Request, res: Response) => {
    const data = await this.service.getCarbonDynamic(req.query as any)
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

  getStationsSnapshot = async (_req: Request, res: Response) => {
    const data = await this.service.getStationsSnapshot()
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

  getEquipmentPower = async (req: Request, res: Response) => {
    const { stationId, time } = req.query as any
    if (!stationId || !time) return res.status(400).json({ code: 400, message: '缺少参数 stationId/time' })
    const data = await this.service.getEquipmentPower(stationId, time)
    res.json({ code: 200, message: 'ok', data })
  }

  getAvailableHours = async (req: Request, res: Response) => {
    const { stationId } = req.query as any
    if (!stationId) return res.status(400).json({ code: 400, message: '缺少参数 stationId' })
    const data = await this.service.getAvailableHours(stationId)
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
    const data = await this.service.traceEventDetail(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  // Power Quality Extensions
  getVoltageFluctuationDetail = async (req: Request, res: Response) => {
    const data = await this.service.getVoltageFluctuationDetail(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getPowerReliabilityDetail = async (req: Request, res: Response) => {
    const data = await this.service.getPowerReliabilityDetail(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getQualificationRateDetail = async (req: Request, res: Response) => {
    const data = await this.service.getQualificationRateDetail(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getEquipmentImpact = async (req: Request, res: Response) => {
    const data = await this.service.getEquipmentImpact(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getComplaintStats = async (req: Request, res: Response) => {
    const data = await this.service.getComplaintStats(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getHotspotDistribution = async (req: Request, res: Response) => {
    const data = await this.service.getHotspotDistribution(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getEquipmentEvents = async (req: Request, res: Response) => {
    const data = await this.service.getEquipmentEvents(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  getComplaintTickets = async (req: Request, res: Response) => {
    const data = await this.service.getComplaintTickets(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  // 极端场景报告导出
  exportReport = async (req: Request, res: Response) => {
    const result = await this.service.simulateExtreme(req.body)
    const format = (req.query.format as string) || 'word'

    if (format === 'pdf') {
      const { buffer, filename } = await this.service.generateReportPdf(result)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      res.send(buffer)
    } else {
      const { buffer, filename } = await this.service.generateReportWord(result)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      res.send(buffer)
    }
  }
}
