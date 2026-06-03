import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

export class AchievementService {
  async listProjects(query: { status?: string; projectType?: string; constructionProgress?: string; gridVoltage?: string; operationStatus?: string }) {
    return db('projects').modify((qb) => {
      if (query.status) qb.where('status', query.status)
      if (query.projectType) qb.where('project_type', query.projectType)
      if (query.constructionProgress) qb.whereRaw("json_extract(custom_fields, '$.construction_progress') = ?", [query.constructionProgress])
      if (query.gridVoltage) qb.whereRaw("json_extract(custom_fields, '$.grid_voltage') = ?", [query.gridVoltage])
      if (query.operationStatus) qb.whereRaw("json_extract(custom_fields, '$.operation_status') = ?", [query.operationStatus])
    }).orderBy('created_at', 'desc')
  }

  async createProject(data: any, userId: string) {
    const [project] = await db('projects').insert({
      project_code: data.projectCode,
      project_name: data.projectName,
      project_type: data.projectType,
      pv_type: data.pvType,
      plan_id: data.planId,
      capacity_kw: data.capacityKw,
      budget: data.budget,
      custom_fields: data.customFields ? JSON.stringify(data.customFields) : '{}',
      created_by: userId,
    }).returning('*')
    return project
  }

  async updateProject(id: string, data: any) {
    const [project] = await db('projects').where('id', id).update({
      project_name: data.projectName,
      status: data.status,
      actual_cost: data.actualCost,
      actual_completion_date: data.actualCompletionDate,
      updated_at: new Date().toISOString(),
    }).returning('*')
    return project
  }

  async getAccessConditions(projectId: string) {
    return db('access_conditions').where('project_id', projectId)
  }

  async setAccessConditions(projectId: string, conditions: any[]) {
    await db('access_conditions').where('project_id', projectId).delete()
    if (conditions.length > 0) {
      await db('access_conditions').insert(
        conditions.map((c) => ({
          project_id: projectId,
          condition_type: c.conditionType,
          requirement: c.requirement,
          actual_value: c.actualValue,
          is_satisfied: c.isSatisfied,
        })),
      )
    }
    return this.getAccessConditions(projectId)
  }

  async runFeasibility(projectId: string, params: any) {
    const w = params.weights || { resource: 0.25, grid: 0.25, investment: 0.25, environment: 0.25 }

    // 基准值
    const base: Record<string, number> = {
      annual_irradiance: 1600,
      sunshine_hours: 1400,
      solar_grade: 3,        // A=4, B=3, C=2
      capacity_mwp: 50,
      unit_cost: 3.5,        // 越低越好
      payback_years: 6,      // 越低越好
      irr_pct: 10,
      grid_voltage: 110,
      short_circuit_capacity_mva: 200,
      transmission_distance_km: 5,  // 越低越好
      corridor_available: 2, // 可用=3,受限=2,不可用=1
      land_type: 2,          // 未利用地=4,建设用地=3,草地=2,农用地=1,林地=1
      env_sensitivity: 3,    // 不敏感=3,一般=2,敏感=1
      geohazard_risk: 3,     // 低=3,中=2,高=1
    }

    const p = params.params || {}
    const gradeMap: Record<string, number> = { 'A': 4, 'B': 3, 'C': 2 }
    const corrMap: Record<string, number> = { '可用': 3, '受限': 2, '不可用': 1 }
    const landMap: Record<string, number> = { '未利用地': 4, '建设用地': 3, '草地': 2, '农用地': 1, '林地': 1 }
    const sensMap: Record<string, number> = { '不敏感': 3, '一般': 2, '敏感': 1 }
    const riskMap: Record<string, number> = { '低': 3, '中': 2, '高': 1 }
    const voltMap: Record<string, number> = { '220V': 0.22, '380V': 0.38, '10kV': 10, '35kV': 35, '110kV': 110, '220kV': 220 }

    function getVal(code: string): number {
      const v = p[code]
      if (v === null || v === undefined || v === '') return 0
      if (code === 'solar_grade') return gradeMap[String(v)] || 0
      if (code === 'corridor_available') return corrMap[String(v)] || 0
      if (code === 'land_type') return landMap[String(v)] || 0
      if (code === 'env_sensitivity') return sensMap[String(v)] || 0
      if (code === 'geohazard_risk') return riskMap[String(v)] || 0
      if (code === 'grid_voltage') return voltMap[String(v)] || Number(v) || 0
      return Number(v)
    }

    function score(code: string): number {
      const val = getVal(code)
      const b = base[code]
      if (!b || val === 0) return 0
      // 指标越低越好的：取反比
      if (['unit_cost', 'payback_years', 'transmission_distance_km'].includes(code)) {
        return Math.min(100, (b / val) * 100)
      }
      return Math.min(100, (val / b) * 100)
    }

    const resourceScore = (score('annual_irradiance') + score('sunshine_hours') + score('solar_grade') + score('capacity_mwp')) / 4
    const gridScore = (score('grid_voltage') + score('short_circuit_capacity_mva') + score('transmission_distance_km') + score('corridor_available')) / 4
    const investScore = (score('unit_cost') + score('payback_years') + score('irr_pct')) / 3
    const envScore = (score('land_type') + score('env_sensitivity') + score('geohazard_risk')) / 3

    const comprehensive =
      resourceScore * w.resource +
      gridScore * w.grid +
      investScore * w.investment +
      envScore * w.environment

    const [result] = await db('feasibility_assessments')
      .insert({
        project_id: projectId,
        technical_score: resourceScore,       // 资源维度得分
        economic_score: investScore,           // 投资维度得分
        environmental_score: envScore,         // 环境维度得分
        social_score: gridScore,                // 电网维度得分
        comprehensive_score: comprehensive,
        evaluation_params: JSON.stringify(p),
        weights: JSON.stringify(w),
        access_point_id: params.accessPointId || null,
      })
      .onConflict('project_id')
      .merge()
      .returning('*')

    return result
  }

  async getFeasibility(projectId: string) {
    return db('feasibility_assessments').where('project_id', projectId).first()
  }

  async verifyEffectiveness(projectId: string, data: any) {
    const [verification] = await db('effectiveness_verifications').insert({
      project_id: projectId,
      verification_date: new Date().toISOString(),
      planned_output_kwh: data.plannedOutputKwh,
      actual_output_kwh: data.actualOutputKwh,
      absorption_rate_pct: data.absorptionRatePct,
      voltage_compliance_pct: data.voltageCompliancePct,
      is_effective: data.isEffective,
      remarks: data.remarks,
    }).returning('*')
    return verification
  }

  async traceHistory(projectId: string) {
    return db('project_audit').where('project_id', projectId).orderBy('created_at', 'desc')
  }

  async listDocuments(projectId: string) {
    return db('project_documents').where('project_id', projectId).orderBy('uploaded_at', 'desc')
  }

  async uploadDocument(projectId: string, file: Express.Multer.File, docType?: string) {
    const [doc] = await db('project_documents').insert({
      id: uuid(), project_id: projectId, doc_name: file.originalname,
      doc_type: docType || '其他', file_path: file.path, file_size: file.size,
      uploaded_at: new Date().toISOString(),
    }).returning('*')
    return doc
  }

  async deleteDocument(docId: string) {
    await db('project_documents').where('id', docId).del()
  }

  async getDocument(docId: string) {
    return db('project_documents').where('id', docId).first()
  }

  // ==================== 条件计划 ====================
  async listConditionPlans(planType?: string) {
    let q = db('access_condition_plans')
    if (planType) q = q.where('plan_type', planType)
    return q.orderBy('created_at', 'desc')
  }

  async createConditionPlan(data: { name: string; planType: string; conditions: any }) {
    const [row] = await db('access_condition_plans').insert({
      id: uuid(), name: data.name, plan_type: data.planType,
      conditions: JSON.stringify(data.conditions),
      created_at: new Date().toISOString(),
    }).returning('*')
    return row
  }

  async updateConditionPlan(id: string, data: { name?: string; conditions?: any }) {
    const upd: Record<string, any> = { updated_at: new Date().toISOString() }
    if (data.name) upd.name = data.name
    if (data.conditions) upd.conditions = JSON.stringify(data.conditions)
    const [row] = await db('access_condition_plans').where('id', id).update(upd).returning('*')
    return row
  }

  async deleteConditionPlan(id: string) {
    await db('access_condition_plans').where('id', id).del()
  }

  // ==================== 接入点资源 ====================
  async listAccessPoints() {
    return db('access_point_resources').orderBy('name')
  }

  async createAccessPoint(data: Record<string, any>) {
    const [row] = await db('access_point_resources').insert({
      id: uuid(),
      source_type: 'manual',
      source_id: uuid(),
      name: data.name,
      zone: data.zone || null,
      voltage_kv: data.voltageKv || null,
      annual_irradiance: data.annualIrradiance || null,
      sunshine_hours: data.sunshineHours || null,
      solar_grade: data.solarGrade || null,
      short_circuit_capacity_mva: data.shortCircuitCapacityMva || null,
      corridor_available: data.corridorAvailable || null,
      transmission_line_length_km: data.transmissionLineLengthKm || null,
      unit_cost: data.unitCost || null,
      payback_years: data.paybackYears || null,
      irr_pct: data.irrPct || null,
      land_type: data.landType || null,
      env_sensitivity: data.envSensitivity || null,
      geohazard_risk: data.geohazardRisk || null,
      created_at: new Date().toISOString(),
    }).returning('*')
    return row
  }

  async importAccessPoints(list: any[]) {
    const rows = list.map((item: any) => ({
      id: uuid(),
      source_type: 'manual',
      source_id: uuid(),
      name: item.name || item['名称'] || item['接入点名称'],
      zone: item.zone || item['区域'] || null,
      voltage_kv: item.voltageKv || item['电压等级(kV)'] || null,
      annual_irradiance: item.annualIrradiance || item['年均辐照度'] || null,
      sunshine_hours: item.sunshineHours || item['年日照小时数'] || null,
      solar_grade: item.solarGrade || item['资源等级'] || null,
      short_circuit_capacity_mva: item.shortCircuitCapacityMva || item['短路容量(MVA)'] || null,
      corridor_available: item.corridorAvailable || item['走廊可用性'] || null,
      transmission_line_length_km: item.transmissionLineLengthKm || item['接入距离(km)'] || null,
      unit_cost: item.unitCost || item['单位造价'] || null,
      payback_years: item.paybackYears || item['投资回收期'] || null,
      irr_pct: item.irrPct || item['内部收益率'] || null,
      land_type: item.landType || item['土地性质'] || null,
      env_sensitivity: item.envSensitivity || item['环保敏感性'] || null,
      geohazard_risk: item.geohazardRisk || item['地质灾害风险'] || null,
      created_at: new Date().toISOString(),
    }))
    if (rows.length > 0) await db('access_point_resources').insert(rows)
    return { inserted: rows.length }
  }

  async updateAccessPoint(id: string, data: Record<string, any>) {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    const fieldMap: Record<string, string> = {
      shortCircuitCapacityMva: 'short_circuit_capacity_mva',
      corridorAvailable: 'corridor_available',
      transmissionLineLengthKm: 'transmission_line_length_km',
      unitCost: 'unit_cost',
      paybackYears: 'payback_years',
      irrPct: 'irr_pct',
      landType: 'land_type',
      envSensitivity: 'env_sensitivity',
      geohazardRisk: 'geohazard_risk',
      annualIrradiance: 'annual_irradiance',
      sunshineHours: 'sunshine_hours',
      solarGrade: 'solar_grade',
      voltageKv: 'voltage_kv',
    }
    for (const [k, v] of Object.entries(data)) {
      const col = fieldMap[k]
      if (col && v !== undefined) updateData[col] = v
    }
    const [row] = await db('access_point_resources').where('id', id).update(updateData).returning('*')
    return row
  }
}
