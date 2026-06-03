import { Request, Response } from 'express'
import { PlanningService } from './planning.service.js'

export class PlanningController {
  private service = new PlanningService()

  // ==================== Plan (existing) ====================
  listPlans = async (req: Request, res: Response) => {
    const data = await this.service.listPlans(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createPlan = async (req: Request, res: Response) => {
    const data = await this.service.createPlan(req.body, req.user!.id)
    res.json({ code: 200, message: 'ok', data })
  }

  updatePlan = async (req: Request, res: Response) => {
    const data = await this.service.updatePlan(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Investment Plans (造价模块投资方案) ====================
  listInvestmentPlans = async (_req: Request, res: Response) => {
    const data = await this.service.listInvestmentPlans()
    res.json({ code: 200, message: 'ok', data })
  }

  createInvestmentPlan = async (req: Request, res: Response) => {
    const data = await this.service.createInvestmentPlan(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updateInvestmentPlan = async (req: Request, res: Response) => {
    const data = await this.service.updateInvestmentPlan(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteInvestmentPlan = async (req: Request, res: Response) => {
    await this.service.deleteInvestmentPlan(req.params.id)
    res.json({ code: 200, message: 'ok' })
  }

  // ==================== PV Stations (2.1.1) ====================
  listPvStations = async (req: Request, res: Response) => {
    const data = await this.service.listPvStations(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createPvStation = async (req: Request, res: Response) => {
    const data = await this.service.createPvStation(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updatePvStation = async (req: Request, res: Response) => {
    const data = await this.service.updatePvStation(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deletePvStation = async (req: Request, res: Response) => {
    const data = await this.service.deletePvStation(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== PV Cost Library (2.1.1) ====================
  listPvCostLibrary = async (req: Request, res: Response) => {
    const data = await this.service.listPvCostLibrary(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  upsertCostLibraryItem = async (req: Request, res: Response) => {
    const data = await this.service.upsertCostLibraryItem(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== PV Model Types (规划工具) ====================
  listPvModelTypes = async (_req: Request, res: Response) => {
    const data = await this.service.listPvModelTypesWithFields()
    res.json({ code: 200, message: 'ok', data })
  }

  getPvModelTypeWithFields = async (req: Request, res: Response) => {
    const data = await this.service.getPvModelTypeWithFields(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  createPvModelType = async (req: Request, res: Response) => {
    const data = await this.service.createPvModelType(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updatePvModelType = async (req: Request, res: Response) => {
    const data = await this.service.updatePvModelType(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deletePvModelType = async (req: Request, res: Response) => {
    await this.service.deletePvModelType(req.params.id)
    res.json({ code: 200, message: 'ok', data: null })
  }

  listModelTypeFields = async (req: Request, res: Response) => {
    const data = await this.service.listPvModelTypeFields(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  saveModelTypeFields = async (req: Request, res: Response) => {
    try {
      const data = await this.service.savePvModelTypeFields(req.params.id, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(400).json({ code: 400, message: e.message || '保存失败', data: null })
    }
  }

  // ==================== Field Library (字段库) ====================
  listFieldLibrary = async (req: Request, res: Response) => {
    const data = await this.service.listFieldLibrary(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createFieldLibraryItem = async (req: Request, res: Response) => {
    const data = await this.service.createFieldLibraryItem(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteFieldLibraryItem = async (req: Request, res: Response) => { await this.service.deleteFieldLibraryItem(req.params.id); res.json({ code: 200, message: 'ok' }) }

  // ==================== Constraint Rules (2.1.2) ====================
  listConstraintRules = async (req: Request, res: Response) => {
    const data = await this.service.listConstraintRules(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  saveConstraintRules = async (req: Request, res: Response) => {
    const data = await this.service.saveConstraintRules(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Potential Sites & Evaluation ====================
  listPotentialSites = async (_req: Request, res: Response) => {
    const data = await this.service.listPotentialSites()
    res.json({ code: 200, message: 'ok', data })
  }

  runEvaluation = async (_req: Request, res: Response) => {
    const data = await this.service.runEvaluation()
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Candidate Points (2.1.2) ====================
  runSpatialAnalysis = async (req: Request, res: Response) => {
    const data = await this.service.runSpatialAnalysis(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  listCandidatePoints = async (req: Request, res: Response) => {
    const data = await this.service.listCandidatePoints(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Absorption Plans (2.1.3) ====================
  generateAbsorptionPlan = async (req: Request, res: Response) => {
    const data = await this.service.generateAbsorptionPlan(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getAbsorptionPlan = async (req: Request, res: Response) => {
    const data = await this.service.getAbsorptionPlan(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  updateAbsorptionPlan = async (req: Request, res: Response) => {
    const data = await this.service.updateAbsorptionPlan(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Scheme Variants (多方案对比) ====================
  listVariants = async (req: Request, res: Response) => {
    const data = await this.service.getAbsorptionPlanVariants(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  createVariant = async (req: Request, res: Response) => {
    const data = await this.service.saveAbsorptionPlanVariant(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteVariant = async (req: Request, res: Response) => {
    const data = await this.service.deleteAbsorptionPlanVariant(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Cost Management (2.1.4) ====================
  listUnitCostParams = async (req: Request, res: Response) => {
    const data = await this.service.listUnitCostParams(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Cost Items ====================
  listCostItems = async (req: Request, res: Response) => {
    const data = await this.service.listCostItems(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createCostItem = async (req: Request, res: Response) => {
    try {
      const data = await this.service.createCostItem(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  updateCostItem = async (req: Request, res: Response) => {
    try {
      const data = await this.service.updateCostItem(req.params.id, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) { res.status(400).json({ code: 400, message: e.message }) }
  }

  deleteCostItem = async (req: Request, res: Response) => {
    await this.service.deleteCostItem(req.params.id)
    res.json({ code: 200, message: 'ok' })
  }

  // ==================== Investment Config ====================
  listInvestmentConfig = async (req: Request, res: Response) => {
    const data = await this.service.listInvestmentConfig(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  saveInvestmentConfig = async (req: Request, res: Response) => {
    const data = await this.service.saveInvestmentConfig(req.params.investmentPlanId, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  calculateInvestment = async (req: Request, res: Response) => {
    const data = await this.service.calculateInvestment(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  compareCost = async (req: Request, res: Response) => {
    const data = await this.service.compareCost(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  roiAnalysis = async (req: Request, res: Response) => {
    const data = await this.service.roiAnalysis(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Equipment Ledger (2.1.5) ====================
  getEquipmentLedger = async (req: Request, res: Response) => {
    const data = await this.service.getEquipmentLedger(req.params.planId)
    res.json({ code: 200, message: 'ok', data })
  }

  getEquipmentByStation = async (req: Request, res: Response) => {
    const data = await this.service.getEquipmentByStation(req.params.stationId)
    res.json({ code: 200, message: 'ok', data })
  }

  createEquipmentItem = async (req: Request, res: Response) => {
    const data = await this.service.createEquipmentItem(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  updateEquipmentItem = async (req: Request, res: Response) => {
    const data = await this.service.updateEquipmentItem(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  deleteEquipmentItem = async (req: Request, res: Response) => {
    const data = await this.service.deleteEquipmentItem(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  createLifecycleRecord = async (req: Request, res: Response) => {
    const data = await this.service.createLifecycleRecord(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getLifecycleRecords = async (req: Request, res: Response) => {
    const data = await this.service.getLifecycleRecords(req.params.equipmentId)
    res.json({ code: 200, message: 'ok', data })
  }

  // ==================== Legacy methods ====================
  integratePv = async (req: Request, res: Response) => {
    const data = await this.service.integratePv(req.params.id, req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  recommendSites = async (req: Request, res: Response) => {
    const data = await this.service.recommendSites(req.query as any)
    res.json({ code: 200, message: 'ok', data })
  }

  createSite = async (req: Request, res: Response) => {
    const data = await this.service.createSite(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  compileScheme = async (req: Request, res: Response) => {
    const data = await this.service.compileScheme(req.body)
    res.json({ code: 200, message: 'ok', data })
  }

  getCost = async (req: Request, res: Response) => {
    const data = await this.service.getCost(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  getRoi = async (req: Request, res: Response) => {
    const data = await this.service.getRoi(req.params.id)
    res.json({ code: 200, message: 'ok', data })
  }

  getLedger = async (req: Request, res: Response) => {
    const data = await this.service.getLedger(req.params.planId)
    res.json({ code: 200, message: 'ok', data })
  }
}
