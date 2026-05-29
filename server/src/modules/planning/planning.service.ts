import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

export class PlanningService {
  // ==================== Plan (existing) ====================
  async listPlans(query: { status?: string; planYear?: number }) {
    return db('plans').modify((qb) => {
      if (query.status) qb.where('status', query.status)
      if (query.planYear) qb.where('plan_year', query.planYear)
    }).orderBy('created_at', 'desc')
  }

  async createPlan(data: any, userId: string) {
    const [plan] = await db('plans').insert({
      id: uuid(),
      plan_name: data.planName,
      plan_type: data.planType,
      plan_year: data.planYear,
      tech_route: data.techRoute,
      description: data.description,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning('*')
    return plan
  }

  async updatePlan(id: string, data: any) {
    const updateData: any = { updated_at: new Date().toISOString() }
    if (data.planName !== undefined) updateData.plan_name = data.planName
    if (data.planType !== undefined) updateData.plan_type = data.planType
    if (data.planYear !== undefined) updateData.plan_year = data.planYear
    if (data.techRoute !== undefined) updateData.tech_route = data.techRoute
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    const [plan] = await db('plans').where('id', id).update(updateData).returning('*')
    return plan
  }

  // ==================== PV Stations (2.1.1) ====================
  async listPvStations(query: { planId?: string; status?: string }) {
    try {
      return db('pv_stations').modify((qb) => {
        if (query.planId) qb.where('plan_id', query.planId)
        if (query.status) qb.where('status', query.status)
      }).orderBy('created_at', 'desc')
    } catch {
      return this.mockPvStations()
    }
  }

  async createPvStation(data: any) {
    const [station] = await db('pv_stations').insert({
      id: uuid(),
      name: data.name,
      capacity_kw: data.capacityKw ?? 0,
      panel_type: data.panelType ?? '',
      rated_voltage_kv: data.ratedVoltageKv ?? 0,
      longitude: data.longitude ?? 0,
      latitude: data.latitude ?? 0,
      land_type: data.landType ?? '',
      land_area_mu: data.landAreaMu ?? 0,
      electrical_params: JSON.stringify(data.electricalParams || {}),
      equipment_list: JSON.stringify(data.equipmentList || []),
      status: data.status || 'planning',
      plan_id: data.planId || null,
      model_type_id: data.modelTypeId || null,
      custom_fields: data.customFields ? JSON.stringify(data.customFields) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning('*')
    return station
  }

  async updatePvStation(id: string, data: any) {
    const updateData: any = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updateData.name = data.name
    if (data.capacityKw !== undefined) updateData.capacity_kw = data.capacityKw
    if (data.panelType !== undefined) updateData.panel_type = data.panelType
    if (data.ratedVoltageKv !== undefined) updateData.rated_voltage_kv = data.ratedVoltageKv
    if (data.longitude !== undefined) updateData.longitude = data.longitude
    if (data.latitude !== undefined) updateData.latitude = data.latitude
    if (data.landType !== undefined) updateData.land_type = data.landType
    if (data.status !== undefined) updateData.status = data.status
    if (data.electricalParams !== undefined) updateData.electrical_params = JSON.stringify(data.electricalParams)
    if (data.equipmentList !== undefined) updateData.equipment_list = JSON.stringify(data.equipmentList)
    if (data.modelTypeId !== undefined) updateData.model_type_id = data.modelTypeId
    if (data.customFields !== undefined) updateData.custom_fields = JSON.stringify(data.customFields)

    const [station] = await db('pv_stations').where('id', id).update(updateData).returning('*')
    return station
  }

  async deletePvStation(id: string) {
    await db('pv_stations').where('id', id).del()
    return { success: true }
  }

  private mockPvStations() {
    return [
      { id: 'pv-1', name: '瓶窑镇北湖规划电站', capacity_kw: 55000, panel_type: 'mono-si', panel_type_label: '单晶硅', rated_voltage_kv: 220, longitude: 119.92, latitude: 30.42, land_type: 'unused', land_area_mu: 580, electrical_params: { efficiency: 21.5, temperature_coefficient: -0.35 }, status: 'planning', address: '余杭区瓶窑镇北湖草荡周边' },
      { id: 'pv-2', name: '径山镇南部规划电站', capacity_kw: 35000, panel_type: 'mono-si', panel_type_label: '单晶硅', rated_voltage_kv: 110, longitude: 119.83, latitude: 30.37, land_type: 'unused', land_area_mu: 320, electrical_params: { efficiency: 21.5, temperature_coefficient: -0.35 }, status: 'planning', address: '余杭区径山镇南部区块' },
      { id: 'pv-3', name: '中泰街道南峰规划电站', capacity_kw: 40000, panel_type: 'poly-si', panel_type_label: '多晶硅', rated_voltage_kv: 110, longitude: 119.91, latitude: 30.21, land_type: 'unused', land_area_mu: 420, electrical_params: { efficiency: 20.5, temperature_coefficient: -0.38 }, status: 'planning', address: '余杭区中泰街道南峰区块' },
    ]
  }

  // ==================== PV Cost Library (2.1.1) ====================
  async listPvCostLibrary(query: { modelType?: string; modelTypeId?: string }) {
    try {
      return db('pv_cost_library').modify((qb) => {
        if (query.modelType) qb.where('model_type', query.modelType)
        if (query.modelTypeId) qb.where('model_type_id', query.modelTypeId)
      }).orderBy('created_at', 'desc')
    } catch {
      return this.mockCostLibrary()
    }
  }

  async upsertCostLibraryItem(data: any) {
    const existing = await db('pv_cost_library').where('model_type_id', data.modelTypeId).first()
    if (existing) {
      await db('pv_cost_library').where('id', existing.id).update({
        unit_cost_per_kw: data.unitCostPerKw ?? existing.unit_cost_per_kw,
        remark: data.remark ?? existing.remark,
      })
      return db('pv_cost_library').where('id', existing.id).first()
    }
    await db('pv_cost_library').insert({
      id: uuid(),
      model_name: '综合造价评估',
      model_type: 'comprehensive',
      unit_cost_per_kw: data.unitCostPerKw || 0,
      remark: data.remark || '',
      model_type_id: data.modelTypeId,
      created_at: new Date().toISOString(),
    })
    return db('pv_cost_library').where('model_type_id', data.modelTypeId).first()
  }

  // ==================== PV Model Types (规划工具) ====================
  async listPvModelTypes() {
    try {
      return db('pv_model_types').orderBy('sort_order', 'asc')
    } catch {
      return []
    }
  }

  async listPvModelTypesWithFields() {
    try {
      const types = await db('pv_model_types').orderBy('sort_order', 'asc')
      const result = []
      for (const t of types) {
        const fields = await db('pv_model_type_fields').where('type_id', t.id).orderBy('sort_order', 'asc')
        result.push({ ...t, fields })
      }
      return result
    } catch {
      return []
    }
  }

  async getPvModelTypeWithFields(typeIdOrCode: string) {
    let type = await db('pv_model_types').where('id', typeIdOrCode).first()
    if (!type) type = await db('pv_model_types').where('code', typeIdOrCode).first()
    if (!type) return null
    const fields = await db('pv_model_type_fields').where('type_id', type.id).orderBy('sort_order', 'asc')
    return { ...type, fields }
  }

  async createPvModelType(data: { name: string; code: string; description?: string; sortOrder?: number }) {
    const [type] = await db('pv_model_types').insert({
      id: uuid(),
      name: data.name,
      code: data.code,
      description: data.description,
      sort_order: data.sortOrder || 0,
      created_at: new Date().toISOString(),
    }).returning('*')
    return type
  }

  async updatePvModelType(id: string, data: { name?: string; description?: string; sortOrder?: number }) {
    const [type] = await db('pv_model_types').where('id', id).update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sortOrder !== undefined && { sort_order: data.sortOrder }),
    }).returning('*')
    return type
  }

  async deletePvModelType(id: string) {
    await db('pv_model_type_fields').where('type_id', id).delete()
    await db('pv_model_types').where('id', id).delete()
  }

  async listPvModelTypeFields(typeId: string) {
    return db('pv_model_type_fields').where('type_id', typeId).orderBy('sort_order', 'asc')
  }

  async savePvModelTypeFields(typeId: string, fields: Array<{
    fieldCode: string; fieldName: string; fieldType: string
    fieldOptions?: string; isRequired: boolean; sortOrder: number
  }>) {
    const type = await db('pv_model_types').where('id', typeId).first()
    if (!type) throw new Error(`模型类型不存在: ${typeId}`)
    await db('pv_model_type_fields').where('type_id', typeId).delete()
    if (fields.length > 0) {
      await db('pv_model_type_fields').insert(
        fields.map((f) => ({
          id: uuid(),
          type_id: typeId,
          field_code: f.fieldCode,
          field_name: f.fieldName,
          field_type: f.fieldType,
          field_options: f.fieldOptions || null,
          is_required: f.isRequired ? 1 : 0,
          sort_order: f.sortOrder,
          created_at: new Date().toISOString(),
        })),
      )
    }
    return this.listPvModelTypeFields(typeId)
  }

  // ==================== Field Library (字段库) ====================
  async listFieldLibrary(query?: { keyword?: string }) {
    let qb = db('pv_field_library').orderBy('field_code', 'asc')
    if (query?.keyword) {
      const kw = `%${query.keyword}%`
      qb = qb.where(function () {
        this.where('field_code', 'like', kw).orWhere('field_name', 'like', kw)
      })
    }
    return qb
  }

  async createFieldLibraryItem(data: { fieldCode: string; fieldName: string; fieldType: string; fieldOptions?: string; category?: string }) {
    const existing = await db('pv_field_library').where('field_code', data.fieldCode).first()
    if (existing) return existing
    const [item] = await db('pv_field_library').insert({
      id: uuid(),
      field_code: data.fieldCode,
      field_name: data.fieldName,
      field_type: data.fieldType,
      field_options: data.fieldOptions || null,
      category: data.category || '基础信息',
      created_at: new Date().toISOString(),
    }).returning('*')
    return item
  }

  private mockCostLibrary() {
    return [
      { id: 'cl-1', model_name: '高效单晶组件HC-550W', model_type: 'pv_module', manufacturer: '隆基', unit_cost_per_kw: 1800, rated_power_kw: 0.55, efficiency_pct: 21.5, lifespan_years: 30, remark: '主流高效型号' },
      { id: 'cl-2', model_name: '组串式逆变器SG-250KW', model_type: 'inverter', manufacturer: '华为', unit_cost_per_kw: 350, rated_power_kw: 250, efficiency_pct: 98.5, lifespan_years: 15, remark: '智能运维' },
      { id: 'cl-3', model_name: '双面双玻组件T-660W', model_type: 'pv_module', manufacturer: '天合', unit_cost_per_kw: 2100, rated_power_kw: 0.66, efficiency_pct: 22.3, lifespan_years: 30, remark: '高发电量' },
      { id: 'cl-4', model_name: '集中式逆变器SG-2500KW', model_type: 'inverter', manufacturer: '阳光电源', unit_cost_per_kw: 280, rated_power_kw: 2500, efficiency_pct: 98.2, lifespan_years: 20, remark: '大型电站适用' },
      { id: 'cl-5', model_name: '箱式变压器S11-2000', model_type: 'transformer', manufacturer: '特变电工', unit_cost_per_kw: 120, rated_power_kw: 2000, efficiency_pct: 99.0, lifespan_years: 25, remark: '升压并网' },
    ]
  }

  // ==================== Constraint Rules (2.1.2) ====================
  async listConstraintRules(query: { planId?: string }) {
    try {
      return db('constraint_rules').modify((qb) => {
        if (query.planId) qb.where('plan_id', query.planId)
      }).orderBy('weight', 'desc')
    } catch {
      return this.mockConstraintRules()
    }
  }

  async saveConstraintRules(data: any[]) {
    // delete existing then re-insert
    const planId = data[0]?.planId
    if (planId) {
      await db('constraint_rules').where('plan_id', planId).del()
    }
    const records = data.map((r: any) => ({
      id: r.id || uuid(),
      rule_name: r.ruleName,
      rule_type: r.ruleType,
      weight: r.weight,
      enabled: r.enabled !== false,
      params: JSON.stringify(r.params || {}),
      description: r.description || '',
      plan_id: r.planId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    await db('constraint_rules').insert(records)
    return records
  }

  private mockConstraintRules() {
    return [
      { id: 'cr-1', ruleName: '最小光照资源', ruleType: 'irradiance', weight: 0.30, enabled: true, params: { minAnnualIrradiance: 1300, unit: 'kWh/m²' }, description: '年均日照辐射量不低于1300kWh/m²' },
      { id: 'cr-2', ruleName: '并网距离约束', ruleType: 'grid', weight: 0.25, enabled: true, params: { maxDistanceKm: 20 }, description: '接入点距最近变电站不超过20km' },
      { id: 'cr-3', ruleName: '土地可用性', ruleType: 'land', weight: 0.20, enabled: true, params: { minAreaMu: 100, maxSlopeDeg: 15 }, description: '可用土地面积≥100亩，坡度≤15°' },
      { id: 'cr-4', ruleName: '环境敏感区避让', ruleType: 'environment', weight: 0.15, enabled: true, params: { bufferKm: 2 }, description: '避开自然保护区、水源地等环境敏感区域2km以上' },
      { id: 'cr-5', ruleName: '负荷中心距离', ruleType: 'custom', weight: 0.10, enabled: true, params: { maxDistanceToLoadKm: 30 }, description: '距负荷中心不超过30km' },
    ]
  }

  // ==================== Potential Sites (接入点数据源) ====================
  async listPotentialSites() {
    return this.potentialSites
  }

  /** 综合指标评估：对所有潜在接入点生成评估数据 */
  async runEvaluation() {
    const now = new Date().toISOString()
    return this.potentialSites.map((site) => {
      // 消纳能力（随时间变化 — 模拟不同时期调度数据）
      const maxLoad = Math.round(site.availableCapacityMw * 1000 * (1.8 + Math.random() * 0.7))
      const minLoad = Math.round(site.availableCapacityMw * 1000 * (0.5 + Math.random() * 0.3))
      const peakReg = Math.round(site.availableCapacityMw * 1000 * (0.3 + Math.random() * 0.25))
      const acceptable = Math.round(Math.min(maxLoad + peakReg, site.availableCapacityMw * 1000 * 1.2))

      // 送出通道
      const lineKm = site.distanceToSubstationKm                                 // 固定不变
      const difficulty = lineKm <= 5 ? '低' : lineKm <= 12 ? '中' : '高'          // 固定不变
      const constCost = Math.round(lineKm * (150 + Math.random() * 100))         // 建设成本随市场变化

      // 经济性
      const landCost = Math.round(site.landCostPerMu * site.areaMu * (0.9 + Math.random() * 0.2))  // 地价随市场波动
      const rentCost = Math.round(landCost * (0.03 + Math.random() * 0.05))                        // 租金随行就市
      const envLevel = site.isForbidden ? 'I' : (site.landType === 'forest' || site.landType === 'agricultural') ? 'II' : 'III'  // 固定不变

      return {
        siteId: site.id,
        locationDesc: site.name,
        evaluationTime: now,
        localMaxLoadKw: maxLoad,
        localMinLoadKw: minLoad,
        peakRegulationCapacityKw: peakReg,
        acceptableCapacityKw: acceptable,
        lineLengthKm: lineKm,
        constructionDifficulty: difficulty,
        constructionCostTenThousand: constCost,
        landAcquisitionCostTenThousand: landCost,
        rentalCostTenThousandPerYear: rentCost,
        envAssessmentLevel: envLevel,
      }
    })
  }

  // ==================== Candidate Points (2.1.2) ====================
  async runSpatialAnalysis(params: any) {
    return this.doFilterPotentialSites(params)
  }

  async listCandidatePoints(query: { planId?: string; status?: string }) {
    try {
      const rows = await db('candidate_points').modify((qb) => {
        if (query.planId) qb.where('plan_id', query.planId)
        if (query.status) qb.where('status', query.status)
      }).orderBy('comprehensive_score', 'desc')
      return rows.map((r: any) => ({
        id: r.id,
        planId: r.plan_id ?? r.planId,
        stationId: r.station_id ?? r.stationId,
        longitude: r.longitude,
        latitude: r.latitude,
        locationDesc: r.location_desc ?? r.locationDesc,
        recommendedCapacityKw: r.recommended_capacity_kw ?? r.recommendedCapacityKw,
        comprehensiveScore: r.comprehensive_score ?? r.comprehensiveScore,
        scores: typeof r.scores === 'string' ? JSON.parse(r.scores) : (r.scores ?? {}),
        absorptionCapacityKw: r.absorption_capacity_kw ?? r.absorptionCapacityKw,
        transmissionLineLengthKm: r.transmission_line_length_km ?? r.transmissionLineLengthKm,
        transmissionCost: r.transmission_cost ?? r.transmissionCost,
        landCost: r.land_cost ?? r.landCost,
        constraintDescription: r.constraint_description ?? r.constraintDescription,
        priority: r.priority,
        status: r.status,
      }))
    } catch {
      return this.doFilterPotentialSites()
    }
  }

  /** 余杭区潜在接入点基础数据（含完整资源/电网/土地信息） */
  private potentialSites = [
    { id: 'ps-1', name: '径山镇南部区块', longitude: 119.83, latitude: 30.37, areaMu: 320, landType: 'unused', terrainType: 'hill', landCostPerMu: 1.2, isForbidden: false, annualIrradiance: 1350, equivHours: 1250, annualSunshineHours: 1350, peakSunHours: 4.2, distanceToSubstationKm: 8.5, availableCapacityMw: 35, shortCircuitMva: 280, slopeDeg: 8, description: '低山丘陵区，光照条件好，土地成本低，距110kV变电站约8.5km' },
    { id: 'ps-2', name: '瓶窑镇北湖区块', longitude: 119.92, latitude: 30.42, areaMu: 580, landType: 'unused', terrainType: 'plain', landCostPerMu: 1.5, isForbidden: false, annualIrradiance: 1420, equivHours: 1320, annualSunshineHours: 1420, peakSunHours: 4.5, distanceToSubstationKm: 6.2, availableCapacityMw: 55, shortCircuitMva: 420, slopeDeg: 3, description: '北湖草荡周边，地势开阔，距220kV变电站约6km，土地性质以未利用地为主' },
    { id: 'ps-3', name: '仁和街道工业园区', longitude: 120.14, latitude: 30.43, areaMu: 180, landType: 'other', terrainType: 'plain', landCostPerMu: 4.8, isForbidden: false, annualIrradiance: 1180, equivHours: 1080, annualSunshineHours: 1200, peakSunHours: 3.6, distanceToSubstationKm: 3.0, availableCapacityMw: 25, shortCircuitMva: 520, slopeDeg: 1, description: '工业屋顶资源丰富，接入条件极佳，但土地/屋顶成本较高' },
    { id: 'ps-4', name: '余杭街道城西区块', longitude: 119.94, latitude: 30.26, areaMu: 260, landType: 'agricultural', terrainType: 'plain', landCostPerMu: 3.5, isForbidden: false, annualIrradiance: 1280, equivHours: 1150, annualSunshineHours: 1280, peakSunHours: 3.9, distanceToSubstationKm: 4.5, availableCapacityMw: 30, shortCircuitMva: 350, slopeDeg: 2, description: '城郊结合部，可利用闲置用地，距变电站较近' },
    { id: 'ps-5', name: '中泰街道南峰区块', longitude: 119.91, latitude: 30.21, areaMu: 420, landType: 'unused', terrainType: 'hill', landCostPerMu: 1.0, isForbidden: false, annualIrradiance: 1400, equivHours: 1280, annualSunshineHours: 1400, peakSunHours: 4.4, distanceToSubstationKm: 12.0, availableCapacityMw: 40, shortCircuitMva: 220, slopeDeg: 12, description: '低丘缓坡地，光照充足，土地成本低，但送出距离较远' },
    { id: 'ps-6', name: '良渚街道安溪区块', longitude: 120.05, latitude: 30.40, areaMu: 150, landType: 'agricultural', terrainType: 'plain', landCostPerMu: 4.2, isForbidden: true, annualIrradiance: 1220, equivHours: 1100, annualSunshineHours: 1220, peakSunHours: 3.7, distanceToSubstationKm: 7.0, availableCapacityMw: 18, shortCircuitMva: 300, slopeDeg: 2, description: '靠近良渚遗址保护区，可用地有限，接入条件一般' },
    { id: 'ps-7', name: '仓前街道高铁新城', longitude: 120.00, latitude: 30.29, areaMu: 90, landType: 'other', terrainType: 'plain', landCostPerMu: 6.0, isForbidden: false, annualIrradiance: 1150, equivHours: 1050, annualSunshineHours: 1150, peakSunHours: 3.5, distanceToSubstationKm: 2.0, availableCapacityMw: 15, shortCircuitMva: 600, slopeDeg: 1, description: '未来科技城核心区，接入极佳但土地成本极高，适合屋顶分布式' },
    { id: 'ps-8', name: '闲林街道万景区块', longitude: 120.01, latitude: 30.24, areaMu: 200, landType: 'forest', terrainType: 'hill', landCostPerMu: 3.8, isForbidden: false, annualIrradiance: 1250, equivHours: 1120, annualSunshineHours: 1250, peakSunHours: 3.8, distanceToSubstationKm: 9.5, availableCapacityMw: 22, shortCircuitMva: 260, slopeDeg: 10, description: '近城区丘陵地，光照一般，土地成本中等' },
    { id: 'ps-9', name: '黄湖镇青山区块', longitude: 119.78, latitude: 30.35, areaMu: 360, landType: 'unused', terrainType: 'hill', landCostPerMu: 0.8, isForbidden: false, annualIrradiance: 1380, equivHours: 1260, annualSunshineHours: 1380, peakSunHours: 4.3, distanceToSubstationKm: 15.0, availableCapacityMw: 28, shortCircuitMva: 180, slopeDeg: 14, description: '西部山区，光照充足、土地成本极低，但送出距离远、施工难度大' },
    { id: 'ps-10', name: '百丈镇溪口区块', longitude: 119.72, latitude: 30.45, areaMu: 280, landType: 'forest', terrainType: 'mountain', landCostPerMu: 0.6, isForbidden: true, annualIrradiance: 1300, equivHours: 1180, annualSunshineHours: 1300, peakSunHours: 4.0, distanceToSubstationKm: 22.0, availableCapacityMw: 12, shortCircuitMva: 120, slopeDeg: 18, description: '西北部山区，属于生态保护红线范围，禁止建设' },
    { id: 'ps-11', name: '鸬鸟镇前庄区块', longitude: 119.68, latitude: 30.39, areaMu: 200, landType: 'agricultural', terrainType: 'mountain', landCostPerMu: 0.9, isForbidden: false, annualIrradiance: 1320, equivHours: 1200, annualSunshineHours: 1320, peakSunHours: 4.1, distanceToSubstationKm: 18.0, availableCapacityMw: 20, shortCircuitMva: 150, slopeDeg: 16, description: '西部山区，光照尚可，土地成本低，但送出距离远' },
    { id: 'ps-12', name: '未来科技城南部', longitude: 120.03, latitude: 30.26, areaMu: 120, landType: 'other', terrainType: 'plain', landCostPerMu: 5.5, isForbidden: false, annualIrradiance: 1200, equivHours: 1100, annualSunshineHours: 1200, peakSunHours: 3.6, distanceToSubstationKm: 3.5, availableCapacityMw: 20, shortCircuitMva: 480, slopeDeg: 1, description: '城区南部预留地块，接入条件好，土地成本高' },
  ]

  /** 从接入点数据中按约束条件筛选，形成候选接入点 */
  private doFilterPotentialSites(params?: any) {
    const planId = params?.planId || 'plan-1'
    const c = params?.constraints || {}
    const minIrradiance = (c.annualIrradiance ?? 1300) as number
    const maxDistance = (c.maxDistanceToSubstationKm ?? 20) as number
    const allowedLandTypes = (c.landTypes ?? ['desert', 'gobi', 'agricultural', 'unused']) as string[]
    const minEquivHours = (c.equivHours ?? 1000) as number
    const maxSlope = (c.maxSlope ?? 20) as number

    const filtered = this.potentialSites.filter((site) => {
      if (site.isForbidden) return false
      if (site.annualIrradiance < minIrradiance) return false
      if (site.equivHours < minEquivHours) return false
      if (site.distanceToSubstationKm > maxDistance) return false
      if (!allowedLandTypes.includes(site.landType)) return false
      if (site.slopeDeg > maxSlope) return false
      return true
    })

    return filtered.map((site, idx) => {
      const irradianceScore = Math.round(Math.min(99, 60 + (site.annualIrradiance / 1500) * 40))
      const gridScore = Math.round(Math.min(99, 100 - (site.distanceToSubstationKm / maxDistance) * 50))
      const landScore = Math.round(Math.max(40, 99 - (site.landCostPerMu / 10) * 60))
      const finalScore = Math.round(irradianceScore * 0.35 + gridScore * 0.35 + landScore * 0.30)
      const baseCapacity = Math.round(site.availableCapacityMw * 0.85 * 1000)

      return {
        id: `cp-${site.id}`,
        planId,
        locationDesc: site.name,
        longitude: site.longitude,
        latitude: site.latitude,
        recommendedCapacityKw: baseCapacity + Math.round((Math.random() - 0.3) * 3000),
        comprehensiveScore: finalScore,
        scores: {
          absorption: Math.min(99, Math.max(40, irradianceScore + Math.round(Math.random() * 8 - 4))),
          transmission: Math.min(99, Math.max(40, gridScore + Math.round(Math.random() * 8 - 4))),
          economic: Math.min(99, Math.max(40, landScore + Math.round(Math.random() * 8 - 4))),
        },
        absorptionCapacityKw: Math.round(baseCapacity * (0.7 + Math.random() * 0.25)),
        transmissionLineLengthKm: site.distanceToSubstationKm,
        transmissionCost: Math.round(site.distanceToSubstationKm * 150 * 10000),
        landCost: Math.round(site.landCostPerMu * site.areaMu * 10000),
        constraintDescription: site.description,
        priority: idx + 1,
        status: idx === 0 ? 'selected' : 'pending' as string,
      }
    })
  }

  // ==================== Absorption Plans (2.1.3) ====================
  async generateAbsorptionPlan(data: any) {
    const cp = data.candidatePointData
    const capacityKw = cp?.recommendedCapacityKw || 50000
    const peakPvKw = Math.round(capacityKw * 0.8)

    // 生成 24 时段光伏出力曲线（6:00-18:00 有出力，正午达到峰值）
    const pvProfile: Array<{ time: string; outputKw: number }> = []
    const pvHours = [0,0,0,0,0,0, 6000,18000,32000,42000,48000, peakPvKw, peakPvKw, 46000,38000,28000,15000,5000,0,0,0,0,0,0]
    for (let h = 0; h < 24; h++) {
      const ratio = pvHours[h] / peakPvKw
      pvProfile.push({ time: `${String(h).padStart(2, '0')}:00`, outputKw: Math.round(capacityKw * 0.8 * ratio) })
    }

    // 生成 24 时段负荷曲线（白天高夜间低）
    const loadProfile: Array<{ time: string; loadKw: number }> = []
    const loadRatios = [0.35,0.30,0.28,0.25,0.30,0.50,0.70,0.85,0.90,0.95,1.0,0.95,0.90,0.85,0.80,0.85,0.90,0.95,0.85,0.70,0.60,0.50,0.45,0.40]
    for (let h = 0; h < 24; h++) {
      loadProfile.push({ time: `${String(h).padStart(2, '0')}:00`, loadKw: Math.round(capacityKw * loadRatios[h]) })
    }

    const absorptionKw = cp?.absorptionCapacityKw || data.absorptionCapacityKw || Math.round(capacityKw * 0.85)

    const mockPlan: any = {
      id: uuid(),
      candidate_point_id: data.candidatePointId,
      plan_name: `${data.planName || '储能配置'}方案`,
      storage_config: JSON.stringify(data.storageConfig || { requiredCapacityKwh: 20000, requiredPowerKw: 10000, storageType: 'lithium', durationHours: 2, estimatedCost: 3000, layoutPlan: '集中式布置于升压站附近' }),
      reactive_comp_config: JSON.stringify(data.reactiveCompConfig || { compType: 'SVG', requiredCapacityKvar: 8000, targetPowerFactor: 0.95, estimatedCost: 480 }),
      line_modification: JSON.stringify(data.lineModification || { modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: 12.5, estimatedCost: 1250, description: '导线截面升级，提升输送容量' }),
      pv_output_profile: JSON.stringify(data.pvOutputProfile?.length ? data.pvOutputProfile : pvProfile),
      load_profile: JSON.stringify(data.loadProfile?.length ? data.loadProfile : loadProfile),
      absorption_capacity_kw: absorptionKw,
      investment_cost: data.investmentCost || 4730,
      annual_benefit: data.annualBenefit || Math.round((data.investmentCost || 4730) * 0.35),
      parameters: JSON.stringify(data.parameters || {}),
      status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const [plan] = await db('absorption_plans').insert({
        ...mockPlan,
        scheme_id: data.schemeId || null,
      }).returning('*')
      return plan
    } catch {
      return { ...mockPlan, scheme_id: data.schemeId || null }
    }
  }

  async getAbsorptionPlan(id: string) {
    try {
      const plan = await db('absorption_plans').where('id', id).first()
      if (plan) return plan
    } catch { /* fall through */ }
    // Return mock detail
    return this.mockAbsorptionPlan(id)
  }

  async updateAbsorptionPlan(id: string, data: any) {
    const updateData: any = { updated_at: new Date().toISOString() }
    if (data.storageConfig) updateData.storage_config = JSON.stringify(data.storageConfig)
    if (data.reactiveCompConfig) updateData.reactive_comp_config = JSON.stringify(data.reactiveCompConfig)
    if (data.lineModification) updateData.line_modification = JSON.stringify(data.lineModification)
    if (data.parameters) updateData.parameters = JSON.stringify(data.parameters)
    if (data.absorptionCapacityKw !== undefined) updateData.absorption_capacity_kw = data.absorptionCapacityKw
    if (data.investmentCost !== undefined) updateData.investment_cost = data.investmentCost
    if (data.annualBenefit !== undefined) updateData.annual_benefit = data.annualBenefit

    try {
      const [plan] = await db('absorption_plans').where('id', id).update(updateData).returning('*')
      return plan
    } catch {
      return { id, ...updateData }
    }
  }

  private mockAbsorptionPlan(id: string) {
    return {
      id, scheme_id: 'scheme-1', plan_name: '规划光伏站消纳方案', candidate_point_id: 'cp-1',
      storage_config: { requiredCapacityKwh: 20000, requiredPowerKw: 10000, storageType: 'lithium', durationHours: 2, estimatedCost: 3000, layoutPlan: '集中式布置于升压站附近' },
      reactive_comp_config: { compType: 'SVG', requiredCapacityKvar: 8000, targetPowerFactor: 0.95, estimatedCost: 480 },
      line_modification: { modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: 12.5, estimatedCost: 1250, description: '导线截面升级，提升输送容量' },
      pv_output_profile: [
        { time: '00:00', outputKw: 0 }, { time: '04:00', outputKw: 0 }, { time: '06:00', outputKw: 5000 },
        { time: '08:00', outputKw: 25000 }, { time: '10:00', outputKw: 42000 }, { time: '12:00', outputKw: 50000 },
        { time: '14:00', outputKw: 45000 }, { time: '16:00', outputKw: 30000 }, { time: '18:00', outputKw: 10000 },
        { time: '20:00', outputKw: 0 }, { time: '23:00', outputKw: 0 },
      ],
      load_profile: [
        { time: '00:00', loadKw: 15000 }, { time: '04:00', loadKw: 12000 }, { time: '06:00', loadKw: 18000 },
        { time: '08:00', loadKw: 35000 }, { time: '10:00', loadKw: 42000 }, { time: '12:00', loadKw: 38000 },
        { time: '14:00', loadKw: 36000 }, { time: '16:00', loadKw: 40000 }, { time: '18:00', loadKw: 45000 },
        { time: '20:00', loadKw: 35000 }, { time: '23:00', loadKw: 20000 },
      ],
      absorption_capacity_kw: 45000, investment_cost: 4730, annual_benefit: 1850,
      parameters: { peakShavingRatio: 0.25, selfConsumptionRate: 0.60, curtailmentRate: 0.05 },
      status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
  }

  // ==================== Scheme Variants (多方案对比) ====================
  async getAbsorptionPlanVariants(parentId: string) {
    try {
      const rows = await db('absorption_plans').where('parent_id', parentId).orderBy('created_at', 'desc')
      return rows.map((r: any) => this.toVariant(r))
    } catch {
      return this.mockVariants(parentId)
    }
  }

  async saveAbsorptionPlanVariant(data: {
    parentPlanId: string; variantName: string
    storageConfig: any; reactiveCompConfig: any; lineModification: any
    computedIndicators: any
  }) {
    const now = new Date().toISOString()
    const record = {
      id: uuid(),
      parent_id: data.parentPlanId,
      plan_name: data.variantName,
      candidate_point_id: '',
      storage_config: JSON.stringify(data.storageConfig || {}),
      reactive_comp_config: JSON.stringify(data.reactiveCompConfig || {}),
      line_modification: JSON.stringify(data.lineModification || {}),
      pv_output_profile: '[]',
      load_profile: '[]',
      absorption_capacity_kw: data.computedIndicators?.absorptionCapacityKw ?? 0,
      investment_cost: data.computedIndicators?.totalInvestmentTenThousand ?? 0,
      annual_benefit: data.computedIndicators?.annualBenefitTenThousand ?? 0,
      parameters: JSON.stringify(data.computedIndicators || {}),
      status: 'completed',
      created_at: now,
      updated_at: now,
    }
    try {
      const [plan] = await db('absorption_plans').insert(record).returning('*')
      return this.toVariant(plan)
    } catch {
      return this.toVariant(record)
    }
  }

  async deleteAbsorptionPlanVariant(variantId: string) {
    try {
      await db('absorption_plans').where('id', variantId).del()
    } catch { /* ignore */ }
    return { success: true }
  }

  private toVariant(r: any): any {
    const parseJSON = (val: any, fallback: any = null) => {
      if (!val) return fallback
      if (typeof val === 'string') { try { return JSON.parse(val) } catch { return fallback } }
      return val
    }
    const indicators = parseJSON(r.parameters ?? r.parameters, {})
    return {
      id: r.id,
      name: r.plan_name ?? r.planName ?? '',
      parentPlanId: r.parent_id ?? r.parentId ?? '',
      storageConfig: parseJSON(r.storage_config ?? r.storageConfig, {}),
      reactiveCompConfig: parseJSON(r.reactive_comp_config ?? r.reactiveCompConfig, {}),
      lineModification: parseJSON(r.line_modification ?? r.lineModification, {}),
      computedIndicators: {
        totalInvestmentTenThousand: indicators.totalInvestmentTenThousand ?? r.investment_cost ?? r.investmentCost ?? 0,
        annualBenefitTenThousand: indicators.annualBenefitTenThousand ?? r.annual_benefit ?? r.annualBenefit ?? 0,
        absorptionCapacityKw: indicators.absorptionCapacityKw ?? r.absorption_capacity_kw ?? r.absorptionCapacityKw ?? 0,
        absorptionImprovementPct: indicators.absorptionImprovementPct ?? 0,
        paybackPeriodYears: indicators.paybackPeriodYears ?? 0,
        irrPct: indicators.irrPct ?? null,
        npv: indicators.npv ?? null,
        storageCostBreakdown: indicators.storageCostBreakdown ?? { equipmentCost: 0, constructionCost: 0, otherCost: 0 },
        annualCashflow: indicators.annualCashflow ?? [],
      },
      createdAt: r.created_at ?? r.createdAt ?? '',
    }
  }

  private mockVariants(parentId: string) {
    const now = new Date().toISOString()
    return [
      {
        id: `var-${Date.now()}-1`, name: '方案A-保守配置', parentPlanId: parentId,
        storageConfig: { requiredCapacityKwh: 20000, requiredPowerKw: 10000, storageType: 'lithium', durationHours: 2, estimatedCost: 3000, layoutPlan: '' },
        reactiveCompConfig: { compType: 'SVG', requiredCapacityKvar: 8000, targetPowerFactor: 0.95, estimatedCost: 480 },
        lineModification: { modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: 12.5, estimatedCost: 1250, description: '' },
        computedIndicators: { totalInvestmentTenThousand: 4730, annualBenefitTenThousand: 1656, absorptionCapacityKw: 45000, absorptionImprovementPct: 12.5, paybackPeriodYears: 2.9, irrPct: 12.5, npv: 38000000, storageCostBreakdown: { equipmentCost: 1500, constructionCost: 300, otherCost: 200 }, annualCashflow: [] },
        createdAt: now,
      },
      {
        id: `var-${Date.now()}-2`, name: '方案B-强化配置', parentPlanId: parentId,
        storageConfig: { requiredCapacityKwh: 40000, requiredPowerKw: 20000, storageType: 'lithium', durationHours: 2, estimatedCost: 6000, layoutPlan: '' },
        reactiveCompConfig: { compType: 'SVG', requiredCapacityKvar: 12000, targetPowerFactor: 0.98, estimatedCost: 720 },
        lineModification: { modificationType: 'new_tie_line', currentSpec: 'LGJ-240', targetSpec: 'LGJ-630', lineLengthKm: 15.0, estimatedCost: 2500, description: '' },
        computedIndicators: { totalInvestmentTenThousand: 9220, annualBenefitTenThousand: 3227, absorptionCapacityKw: 52000, absorptionImprovementPct: 28.3, paybackPeriodYears: 2.9, irrPct: 14.2, npv: 52000000, storageCostBreakdown: { equipmentCost: 3000, constructionCost: 600, otherCost: 400 }, annualCashflow: [] },
        createdAt: now,
      },
    ]
  }

  // ==================== Cost Items (造价参数管理) ====================
  async listCostItems(query: {
    category?: string; subCategory?: string; equipmentType?: string; itemCode?: string
  }) {
    try {
      return db('cost_items').modify((qb) => {
        if (query.category) qb.where('category', query.category)
        if (query.subCategory) qb.where('sub_category', query.subCategory)
        if (query.equipmentType) qb.where('equipment_type', query.equipmentType)
        if (query.itemCode) qb.where('item_code', 'like', `%${query.itemCode}%`)
      }).orderBy('category').orderBy('item_code')
    } catch {
      return []
    }
  }

  async createCostItem(data: any) {
    const existing = await db('cost_items').where('item_code', data.itemCode).first()
    if (existing) throw new Error('设备编号已存在')
    const [item] = await db('cost_items').insert({
      id: crypto.randomUUID(),
      item_code: data.itemCode,
      category: data.category,
      sub_category: data.subCategory || null,
      equipment_type: data.equipmentType || null,
      model_spec: data.modelSpec || null,
      item_name: data.itemName,
      unit_price: data.unitPrice,
      cost_unit: data.costUnit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning('*')
    return item
  }

  async updateCostItem(id: string, data: any) {
    if (data.itemCode) {
      const existing = await db('cost_items').where('item_code', data.itemCode).whereNot('id', id).first()
      if (existing) throw new Error('设备编号已存在')
    }
    const [item] = await db('cost_items').where('id', id).update({
      ...(data.itemCode !== undefined && { item_code: data.itemCode }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.subCategory !== undefined && { sub_category: data.subCategory || null }),
      ...(data.equipmentType !== undefined && { equipment_type: data.equipmentType || null }),
      ...(data.modelSpec !== undefined && { model_spec: data.modelSpec || null }),
      ...(data.itemName !== undefined && { item_name: data.itemName }),
      ...(data.unitPrice !== undefined && { unit_price: data.unitPrice }),
      ...(data.costUnit !== undefined && { cost_unit: data.costUnit }),
      updated_at: new Date().toISOString(),
    }).returning('*')
    return item
  }

  async deleteCostItem(id: string) {
    await db('cost_items').where('id', id).delete()
  }

  // ==================== Cost Management (2.1.4) ====================
  async listUnitCostParams(query: { category?: string }) {
    try {
      return db('unit_cost_params').modify((qb) => {
        if (query.category) qb.where('category', query.category)
      }).orderBy('category')
    } catch {
      return this.mockUnitCostParams()
    }
  }

  // ==================== Investment Config (投资配置方案) ====================
  async listInvestmentConfig(query: { planId?: string }) {
    try {
      return db('investment_config')
        .join('cost_items', 'investment_config.cost_item_id', 'cost_items.id')
        .modify((qb) => {
          if (query.planId) qb.where('investment_config.plan_id', query.planId)
        })
        .select(
          'investment_config.*',
          'cost_items.item_code',
          'cost_items.equipment_type',
          'cost_items.model_spec',
          'cost_items.item_name as cost_item_name',
          'cost_items.cost_unit',
        )
        .orderBy('cost_items.equipment_type')
    } catch { return [] }
  }

  async saveInvestmentConfig(planId: string, items: Array<{
    costItemId: string; quantity: number
  }>) {
    await db('investment_config').where('plan_id', planId).delete()
    if (items.length === 0) return []
    const costItems = await db('cost_items').whereIn('id', items.map(i => i.costItemId)).select('id', 'unit_price')
    const priceMap = new Map(costItems.map((c: any) => [c.id, c.unit_price]))
    const rows = items.map(i => ({
      id: crypto.randomUUID(),
      plan_id: planId,
      cost_item_id: i.costItemId,
      quantity: i.quantity,
      unit_price: priceMap.get(i.costItemId) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    await db('investment_config').insert(rows)
    return this.listInvestmentConfig({ planId })
  }

  async calculateInvestment(data: { capacityKw?: number; planId?: string }) {
    let equipmentCost = 0, constructionCost = 0, landCost = 0, otherCost = 0
    let configDetails: any[] = []
    let capacityKw = data.capacityKw || 50000

    // 基于配置方案汇总全部类别费用
    if (data.planId) {
      const config = await this.listInvestmentConfig({ planId: data.planId })
      if (config.length > 0) {
        // 从 cost_items join 结果中取 category
        const items = await db('investment_config')
          .join('cost_items', 'investment_config.cost_item_id', 'cost_items.id')
          .where('investment_config.plan_id', data.planId)
          .select('investment_config.*', 'cost_items.category', 'cost_items.item_code', 'cost_items.equipment_type', 'cost_items.model_spec', 'cost_items.item_name as cost_item_name', 'cost_items.cost_unit')

        for (const row of items) {
          let subtotal = 0
          const unit = (row.cost_unit || '')
          // 按容量计价：总价 = 容量 × 单价
          if (unit.endsWith('/kW')) {
            subtotal = capacityKw * (row.unit_price || 0)
          } else if (unit.endsWith('/W') || unit.endsWith('/Wp')) {
            subtotal = capacityKw * 1000 * (row.unit_price || 0)
          } else {
            // 按数量计价：总价 = 数量 × 单价
            subtotal = (row.quantity || 0) * (row.unit_price || 0)
          }
          // 按造价库类别分摊到四项费用
          switch (row.category) {
            case 'equipment': equipmentCost += subtotal; break
            case 'construction': constructionCost += subtotal; break
            case 'other': otherCost += subtotal; break
            default: otherCost += subtotal
          }
          configDetails.push({
            category: row.category,
            itemCode: row.item_code,
            equipmentType: row.equipment_type,
            modelSpec: row.model_spec,
            costItemName: row.cost_item_name,
            quantity: row.quantity,
            unitPrice: row.unit_price,
            costUnit: row.cost_unit,
            subtotal: Math.round(subtotal * 100) / 100,
          })
        }
      }
    }

    // 无planId且有配置数据时，从配置计算；无planId=pure容量估算
    if (!data.planId && equipmentCost === 0 && constructionCost === 0) {
      equipmentCost = capacityKw * 1800
      constructionCost = capacityKw * 600
      landCost = capacityKw * 400
      otherCost = (equipmentCost + constructionCost + landCost) * 0.08
    }

    const total = equipmentCost + constructionCost + landCost + otherCost

    return {
      totalInvestment: Math.round(total / 10000) * 10000,
      unitCostPerKw: capacityKw > 0 ? Math.round(total / capacityKw) : 0,
      basedOnConfig: configDetails.length > 0,
      configDetails,
      breakdown: {
        equipmentCost: Math.round(equipmentCost),
        constructionCost: Math.round(constructionCost),
        landCost: Math.round(landCost),
        otherCost: Math.round(otherCost),
      },
      details: [
        { itemName: '设备投资', amount: Math.round(equipmentCost / 10000) * 10000, proportion: total > 0 ? +(equipmentCost / total * 100).toFixed(1) : 0 },
        { itemName: '建设安装', amount: Math.round(constructionCost / 10000) * 10000, proportion: total > 0 ? +(constructionCost / total * 100).toFixed(1) : 0 },
        { itemName: '土地费用', amount: Math.round(landCost / 10000) * 10000, proportion: total > 0 ? +(landCost / total * 100).toFixed(1) : 0 },
        { itemName: '其他费用', amount: Math.round(otherCost / 10000) * 10000, proportion: total > 0 ? +(otherCost / total * 100).toFixed(1) : 0 },
      ],
    }
  }

  async compareCost(data: { planIdA?: string; planIdB?: string }) {
    // 分别计算两个方案的投资
    const invA = data.planIdA ? await this.calculateInvestment({ planId: data.planIdA }) : null
    const invB = data.planIdB ? await this.calculateInvestment({ planId: data.planIdB }) : null

    const pvUnitCost = invA?.unitCostPerKw || 0
    const tradUnitCost = invB?.unitCostPerKw || 0
    const pvTotalCost = invA?.totalInvestment || 0
    const tradTotalCost = invB?.totalInvestment || 0

    return {
      pvUnitCost,
      pvTotalCost,
      traditionalUnitCost: tradUnitCost,
      traditionalTotalCost: tradTotalCost,
      costAdvantagePct: +((tradUnitCost - pvUnitCost) / tradUnitCost * 100).toFixed(1),
      pvBreakdown: invA?.breakdown || null,
      traditionalBreakdown: invB?.breakdown || null,
      pvConfigDetails: invA?.configDetails || [],
      traditionalConfigDetails: invB?.configDetails || [],
      comparisonChart: {
        labels: ['设备投资', '建设安装', '土地费用', '其他费用'],
        pvValues: invA ? [
          Math.round(invA.breakdown.equipmentCost / 10000),
          Math.round(invA.breakdown.constructionCost / 10000),
          Math.round(invA.breakdown.landCost / 10000),
          Math.round(invA.breakdown.otherCost / 10000),
        ] : [0, 0, 0, 0],
        traditionalValues: invB ? [
          Math.round(invB.breakdown.equipmentCost / 10000),
          Math.round(invB.breakdown.constructionCost / 10000),
          Math.round(invB.breakdown.landCost / 10000),
          Math.round(invB.breakdown.otherCost / 10000),
        ] : [0, 0, 0, 0],
      },
    }
  }

  async roiAnalysis(data: {
    planId?: string; capacityKw?: number; investment?: number
    annualHours?: number; gridPrice?: number
    subsidyPrice?: number; carbonPrice?: number; omRate?: number; projectLife?: number
  }) {
    const annualHours = data.annualHours || 1300
    const gridPrice = data.gridPrice || 0.42
    const subsidyPrice = data.subsidyPrice || 0
    const carbonPrice = data.carbonPrice || 0
    const omRate = (data.omRate || 2) / 100
    const projectLife = data.projectLife || 25

    let totalInvestment = 0
    let capacityKw = 50000
    let breakdown = { equipmentCost: 0, constructionCost: 0, landCost: 0, otherCost: 0 }

    if (data.planId) {
      const inv = await this.calculateInvestment({ planId: data.planId })
      totalInvestment = inv.totalInvestment
      capacityKw = inv.unitCostPerKw > 0 ? Math.round(inv.totalInvestment / inv.unitCostPerKw) : 50000
      breakdown = inv.breakdown
    } else if (data.capacityKw) {
      capacityKw = data.capacityKw
      totalInvestment = data.investment || capacityKw * 4200
    }

    const annualKwh = capacityKw * annualHours
    const powerIncome = annualKwh * gridPrice
    const subsidyIncome = subsidyPrice > 0 ? annualKwh * subsidyPrice : 0
    const carbonTons = annualKwh * 0.0008
    const carbonIncome = carbonPrice > 0 ? carbonTons * carbonPrice : 0
    const totalRevenue = powerIncome + subsidyIncome + carbonIncome

    const annualExpense = totalInvestment * omRate
    const annualNet = totalRevenue - annualExpense

    const cashflows: { year: number; netCashflow: number; cumulativeCashflow: number }[] = []
    let cum = -totalInvestment
    for (let i = 0; i < projectLife; i++) {
      cum += annualNet
      cashflows.push({ year: i + 1, netCashflow: Math.round(annualNet), cumulativeCashflow: Math.round(cum) })
    }

    let paybackYears = projectLife
    for (const y of cashflows) {
      if (y.cumulativeCashflow >= 0) {
        const prevCum = y.year > 1 ? cashflows[y.year - 2].cumulativeCashflow : -totalInvestment
        paybackYears = y.year - 1 + Math.abs(prevCum) / y.netCashflow
        break
      }
    }

    const irr = this.calcIrr(totalInvestment, cashflows.map(c => c.netCashflow))
    const npv = this.calcNpv(0.06, totalInvestment, cashflows.map(c => c.netCashflow))

    return {
      upfrontCosts: {
        equipmentInvestment: Math.round(breakdown.equipmentCost),
        landCost: Math.round(breakdown.landCost),
        constructionCost: Math.round(breakdown.constructionCost),
        otherCost: Math.round(breakdown.otherCost),
        total: Math.round(totalInvestment),
      },
      annualRevenue: {
        powerGenerationIncome: Math.round(powerIncome / 10000),
        greenSubsidy: Math.round(subsidyIncome / 10000),
        carbonTradingIncome: Math.round(carbonIncome / 10000),
        total: Math.round(totalRevenue / 10000),
      },
      annualExpenses: {
        operationCost: Math.round(annualExpense / 10000),
        maintenanceCost: 0,
        insuranceCost: 0,
        otherCost: 0,
        total: Math.round(annualExpense / 10000),
      },
      financialIndicators: {
        irrPct: +irr.toFixed(2),
        npv: Math.round(npv),
        paybackPeriodYears: +paybackYears.toFixed(1),
        roiPct: totalInvestment > 0 ? +((totalRevenue / totalInvestment) * 100).toFixed(1) : 0,
      },
      yearlyCashflow: cashflows,
    }
  }

  private calcNpv(rate: number, initial: number, cashflows: number[]): number {
    return cashflows.reduce((npv, cf, i) => npv + cf / Math.pow(1 + rate, i + 1), -initial)
  }

  private calcIrr(initial: number, cashflows: number[]): number {
    let guess = 0.1
    for (let iter = 0; iter < 100; iter++) {
      let npv = -initial
      let dnpv = 0
      for (let i = 0; i < cashflows.length; i++) {
        npv += cashflows[i] / Math.pow(1 + guess, i + 1)
        dnpv -= (i + 1) * cashflows[i] / Math.pow(1 + guess, i + 2)
      }
      if (Math.abs(dnpv) < 1e-10) break
      const next = guess - npv / dnpv
      if (Math.abs(next - guess) < 1e-6) return next * 100
      guess = next
    }
    return Math.max(guess * 100, 0)
  }

  private mockUnitCostParams() {
    return [
      { id: 'uc-1', category: 'equipment', item_name: '光伏组件(单晶硅)', unit_cost: 1800, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '主流市场价' },
      { id: 'uc-2', category: 'equipment', item_name: '组串式逆变器', unit_cost: 350, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '含智能运维系统' },
      { id: 'uc-3', category: 'construction', item_name: '土建安装', unit_cost: 500, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '含基础施工' },
      { id: 'uc-4', category: 'construction', item_name: '电气安装', unit_cost: 100, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '并网接入' },
      { id: 'uc-5', category: 'land', item_name: '土地征用(戈壁)', unit_cost: 1.5, unit: '万元/亩', cost_type: 'per_mu', effective_date: '2026-01-01', remark: '西部地区参考价' },
      { id: 'uc-6', category: 'land', item_name: '土地征用(农用地)', unit_cost: 4.0, unit: '万元/亩', cost_type: 'per_mu', effective_date: '2026-01-01', remark: '需审批' },
      { id: 'uc-7', category: 'other', item_name: '勘察设计费', unit_cost: 120, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '可研+初设' },
    ]
  }

  // ==================== Equipment Ledger (2.1.5) ====================
  async getEquipmentLedger(planId: string) {
    try {
      return db('equipment_ledger').where('plan_id', planId)
    } catch {
      return this.mockEquipmentLedger(planId)
    }
  }

  async getEquipmentByStation(stationId: string) {
    try {
      // 先查 equipment_ledger（规划台账）
      const ledgerRows = await db('equipment_ledger').where('station_id', stationId).orderBy('created_at', 'asc')
      if (ledgerRows.length > 0) return ledgerRows

      // fallback：查 equipment 表（实际设备），做字段映射
      const eqRows = await db('equipment').where('station_id', stationId).orderBy('created_at', 'asc')
      const typeLabelMap: Record<string, string> = {
        TRANSFORMER: '变压器', INVERTER: '逆变器', BATTERY: '电池组',
        PV_MODULE: '光伏组件', CABLE: '电缆', SWITCHGEAR: '开关柜', OTHER: '其他',
      }
      const statusMap: Record<string, string> = {
        operational: 'operating', maintenance: 'fault', retired: 'retired',
        installed: 'installed', standby: 'installed',
      }
      // 按设备类型映射 ratedParams，key 对齐前端 equipmentFieldConfigs
      const typeParamsMap: Record<string, (r: any) => Record<string, any>> = {
        TRANSFORMER: (r) => ({
          ratedCapacity: r.rated_capacity_kva,
          primaryVoltage: r.rated_voltage_kv,
          ratedCurrent: r.rated_current_a,
        }),
        INVERTER: (r) => ({
          ratedPower: r.rated_capacity_kva,
          acOutputVoltage: r.rated_voltage_kv,
          ratedOutputCurrent: r.rated_current_a,
        }),
        BATTERY: (r) => ({
          ratedCapacity: r.rated_capacity_kva,
          ratedVoltage: r.rated_voltage_kv,
          ratedCurrent: r.rated_current_a,
        }),
      }
      const defaultParams = (r: any) => ({
        ratedCapacityKva: r.rated_capacity_kva,
        ratedVoltageKv: r.rated_voltage_kv,
        ratedCurrentA: r.rated_current_a,
      })
      const eqType = (r: any) => r.equipment_type || 'OTHER'
      return eqRows.map((r: any) => ({
        id: r.id,
        planId: '',
        stationId: r.station_id || '',
        equipmentType: eqType(r).toLowerCase(),
        equipmentTypeLabel: typeLabelMap[eqType(r)] || eqType(r) || '其他',
        equipmentCode: '',
        modelNumber: r.model_number || '',
        manufacturer: r.manufacturer || '',
        ratedParams: (typeParamsMap[eqType(r)] || defaultParams)(r),
        quantity: 1,
        installDate: r.installation_date || '',
        status: statusMap[r.status] || 'installed',
        locationDesc: '',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))
    } catch {
      return this.mockEquipmentLedger(stationId).map((e: any) => ({ ...e, station_id: stationId }))
    }
  }

  async createEquipmentItem(data: any) {
    const now = new Date().toISOString()
    const [item] = await db('equipment_ledger').insert({
      id: uuid(),
      station_id: data.stationId,
      equipment_type: data.equipmentType,
      equipment_type_label: data.equipmentTypeLabel,
      equipment_code: data.equipmentCode || `EQ-${Date.now()}`,
      model_number: data.modelNumber,
      manufacturer: data.manufacturer,
      rated_params: JSON.stringify(data.ratedParams || {}),
      quantity: data.quantity || 1,
      install_date: data.installDate || null,
      status: data.status || 'installed',
      location_desc: data.locationDesc || '',
      created_at: now,
      updated_at: now,
    }).returning('*')
    return item
  }

  async updateEquipmentItem(id: string, data: any) {
    const updateData: any = { updated_at: new Date().toISOString() }
    if (data.equipmentType !== undefined) updateData.equipment_type = data.equipmentType
    if (data.equipmentTypeLabel !== undefined) updateData.equipment_type_label = data.equipmentTypeLabel
    if (data.equipmentCode !== undefined) updateData.equipment_code = data.equipmentCode
    if (data.modelNumber !== undefined) updateData.model_number = data.modelNumber
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.installDate !== undefined) updateData.install_date = data.installDate
    if (data.status !== undefined) updateData.status = data.status
    if (data.locationDesc !== undefined) updateData.location_desc = data.locationDesc
    if (data.ratedParams !== undefined) updateData.rated_params = JSON.stringify(data.ratedParams)
    const [item] = await db('equipment_ledger').where('id', id).update(updateData).returning('*')
    return item
  }

  async deleteEquipmentItem(id: string) {
    await db('equipment_ledger').where('id', id).del()
    return { success: true }
  }

  async createLifecycleRecord(data: any) {
    const [record] = await db('equipment_lifecycle_records').insert({
      id: uuid(),
      equipment_id: data.equipmentId,
      event_type: data.eventType,
      event_type_label: data.eventTypeLabel,
      event_time: data.eventTime || new Date().toISOString(),
      operator: data.operator || 'system',
      description: data.description || '',
      attachments: JSON.stringify(data.attachments || []),
      event_data: JSON.stringify(data.eventData || {}),
      created_at: new Date().toISOString(),
    }).returning('*')
    return record
  }

  async getLifecycleRecords(equipmentId: string) {
    try {
      return db('equipment_lifecycle_records').where('equipment_id', equipmentId).orderBy('event_time', 'asc')
    } catch {
      return this.mockLifecycleRecords(equipmentId)
    }
  }

  private mockEquipmentLedger(planId: string) {
    return [
      { id: 'eq-1', plan_id: planId, equipment_type: 'pv_module', equipment_type_label: '光伏组件', equipment_code: 'PV-2026-001', model_number: 'HC-550W', manufacturer: '隆基绿能', rated_params: { ratedPower: 550, voc: 49.6, isc: 13.9, efficiency: 21.5 }, quantity: 91000, install_date: '2026-03-15', status: 'operating', location_desc: 'A区-1#方阵' },
      { id: 'eq-2', plan_id: planId, equipment_type: 'inverter', equipment_type_label: '逆变器', equipment_code: 'INV-2026-001', model_number: 'SG-250KW', manufacturer: '华为数字能源', rated_params: { ratedPower: 250, maxEfficiency: 98.5, mpptVoltageRange: '200-1000' }, quantity: 200, install_date: '2026-03-20', status: 'operating', location_desc: 'A区逆变器房' },
      { id: 'eq-3', plan_id: planId, equipment_type: 'transformer', equipment_type_label: '变压器', equipment_code: 'TF-2026-001', model_number: 'S11-2000', manufacturer: '特变电工', rated_params: { ratedCapacity: 2000, voltageRatio: '10/0.4', connectionGroup: 'Dyn11' }, quantity: 25, install_date: '2026-03-10', status: 'installed', location_desc: '1#-25#箱变' },
    ]
  }

  private mockLifecycleRecords(equipmentId: string) {
    return [
      { id: 'lr-1', equipment_id: equipmentId, event_type: 'design', event_type_label: '设计选型', event_time: '2025-06-15', operator: '张工', description: '根据光照资源条件选择HC-550W高效单晶组件', attachments: ['选型报告.pdf'], event_data: { designLife: 30, designParams: { efficiency: 21.5 } } },
      { id: 'lr-2', equipment_id: equipmentId, event_type: 'procurement', event_type_label: '采购到货', event_time: '2026-01-20', operator: '李采购', description: '第一批次50000块组件到货，抽检合格率99.8%', attachments: ['到货验收单.pdf', '检测报告.pdf'], event_data: { batchNumber: 'B202601', quantity: 50000, passRate: 99.8 } },
      { id: 'lr-3', equipment_id: equipmentId, event_type: 'commissioning', event_type_label: '安装投运', event_time: '2026-03-15', operator: '王安装', description: 'A区1#方阵安装完成，调试并网成功', attachments: ['调试记录.pdf'], event_data: { commissioningVoltage: 10.2, commissioningPower: 495, gridConnectionTime: '2026-03-15 14:30' } },
      { id: 'lr-4', equipment_id: equipmentId, event_type: 'maintenance', event_type_label: '检修维护', event_time: '2026-05-10', operator: '赵维护', description: '季度巡检：组件清洗、接线检查，发现3处MC4接头松动已处理', attachments: ['巡检报告.pdf'], event_data: { maintenanceType: 'quarterly', issuesFound: 3, resolvedCount: 3 } },
    ]
  }

  // ==================== Legacy methods ====================
  async integratePv(planId: string, modelData: any) {
    return db('resource_models').insert({
      model_name: modelData.name,
      model_type: 'PV_OUTPUT',
      model_parameters: modelData.electricalParams,
      created_by: modelData.userId,
    }).returning('*')
  }

  async recommendSites(query: any) {
    const sites = await db('site_recommendations')
      .orderBy('score', 'desc')
      .limit(20)
    return sites
  }

  async createSite(data: any) {
    const [site] = await db('site_recommendations').insert({
      plan_id: data.planId,
      site_location: db.raw(`ST_SetSRID(ST_MakePoint(?, ?), 4326)`, [data.longitude, data.latitude]),
      recommended_capacity_kw: data.recommendedCapacityKw,
      score: data.comprehensiveScore,
      solar_irradiance_score: data.solarIrradianceScore,
      grid_access_score: data.gridAccessScore,
      land_use_score: data.landUseScore,
      economic_score: data.economicScore,
    }).returning('*')
    return site
  }

  async compileScheme(data: any) {
    const [scheme] = await db('absorption_schemes').insert({
      plan_id: data.planId,
      scheme_name: data.schemeName,
      scheme_type: data.schemeType,
      energy_storage_capacity_kwh: data.energyStorageCapacityKwh || 0,
      energy_storage_power_kw: data.energyStoragePowerKw || 0,
      reactive_compensation_kvar: data.reactiveCompensationKvar || 0,
      estimated_cost: data.estimatedCost,
    }).returning('*')
    return scheme
  }

  async getCost(schemeId: string) {
    return db('economic_analyses').where('absorption_scheme_id', schemeId).first()
  }

  async getRoi(schemeId: string) {
    const analysis = await db('economic_analyses').where('absorption_scheme_id', schemeId).first()
    if (!analysis) throw new Error('Analysis not found')
    return {
      totalInvestment: analysis.total_investment,
      unitCostPerKw: analysis.unit_cost_per_kw,
      paybackPeriodYears: analysis.payback_period_years,
      irrPct: analysis.irr_pct,
      npv: analysis.npv,
    }
  }

  async getLedger(planId: string) {
    return db('equipment_ledger').where('plan_id', planId)
  }
}
