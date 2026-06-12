import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

// ==================== 评估模型评分函数 ====================

interface ModelFieldRow {
  field_code: string
  field_type: 'numeric' | 'text'
  dimension: string
  base_value: number | null
  score_rule: string
  text_map: string | null
  match_value: string | null
  max_score: number
  fail_score: number
}

function calcModelScore(field: ModelFieldRow, rawVal: any): number {
  const maxScore = field.max_score ?? 100
  const failScore = field.fail_score ?? 0

  // match_full 和 map_fixed 不走 text_map → 数值 → 比值路径
  if (field.score_rule === 'match_full') {
    return String(rawVal) === String(field.match_value) ? maxScore : failScore
  }
  if (field.score_rule === 'map_fixed') {
    if (!field.text_map) return failScore
    let map: Record<string, number> = {}
    try { map = JSON.parse(field.text_map) } catch { return failScore }
    const fixedScore = map[String(rawVal)] ?? failScore
    return Math.min(maxScore, Math.max(0, fixedScore))
  }

  // 获取数值
  let val: number
  if (field.field_type === 'text') {
    if (!field.text_map) return failScore
    let map: Record<string, number> = {}
    try { map = JSON.parse(field.text_map) } catch { return failScore }
    val = map[String(rawVal)] ?? 0
  } else {
    if (rawVal === null || rawVal === undefined || rawVal === '') return failScore
    val = Number(rawVal)
    if (isNaN(val)) return failScore
  }

  if (val === 0) return failScore

  switch (field.score_rule) {
    case 'direct_ratio':
    case 'map_direct': {
      if (!field.base_value || field.base_value === 0) return failScore
      return Math.min(maxScore, (val / field.base_value) * maxScore)
    }
    case 'inverse_ratio':
    case 'map_inverse': {
      if (!field.base_value || field.base_value === 0) return failScore
      return Math.min(maxScore, (field.base_value / val) * maxScore)
    }
    case 'threshold_full': {
      if (field.base_value == null) return failScore
      return val >= field.base_value ? maxScore : failScore
    }
    default:
      return failScore
  }
}

export class AchievementService {
  async listProjects(query: { status?: string; projectType?: string; constructionProgress?: string; gridVoltage?: string; operationStatus?: string; forVerification?: boolean }) {
    if (query.forVerification) {
      // 成效验证用：只返回有电站关联的项目，JOIN 电站信息
      const rows = await db('projects as p')
        .whereNotNull('p.station_id')
        .leftJoin('solar_pv_stations as spv', 'spv.id', 'p.station_id')
        .leftJoin('grid_buses as gb', 'gb.id', 'spv.bus_id')
        .select(
          'p.*',
          'spv.station_name',
          'spv.installed_capacity_mw',
          'spv.grid_connection_voltage_kv',
          'spv.panel_type',
          'spv.longitude',
          'spv.latitude',
          'spv.address',
          'gb.zone',
        )
        .orderBy('p.created_at', 'desc')

      // 从 custom_fields JSON 中提取 planned_* 字段
      return rows.map((r: any) => {
        let cf: any = {}
        try { cf = JSON.parse(r.custom_fields || '{}') } catch { /* ignore */ }
        return {
          ...r,
          planned_annual_output_mwh: cf.planned_annual_output_mwh ?? null,
          planned_equivalent_hours: cf.planned_equivalent_hours ?? null,
          planned_absorption_rate_pct: cf.planned_absorption_rate_pct ?? null,
          planned_voltage_compliance_pct: cf.planned_voltage_compliance_pct ?? null,
          operation_start_date: r.actual_completion_date ?? null,
        }
      })
    }

    return db('projects').modify((qb) => {
      if (query.status) qb.where('status', query.status)
      if (query.projectType) qb.where('project_type', query.projectType)
      if (query.constructionProgress) qb.whereRaw("json_extract(custom_fields, '$.construction_progress') = ?", [query.constructionProgress])
      if (query.gridVoltage) qb.whereRaw("json_extract(custom_fields, '$.grid_voltage') = ?", [query.gridVoltage])
      if (query.operationStatus) qb.whereRaw("json_extract(custom_fields, '$.operation_status') = ?", [query.operationStatus])
    }).orderBy('created_at', 'desc')
  }

  async getProject(id: string) {
    return db('projects').where('id', id).first()
  }

  async getProjectWithStation(id: string) {
    const row = await db('projects as p')
      .where('p.id', id)
      .leftJoin('solar_pv_stations as spv', 'spv.id', 'p.station_id')
      .leftJoin('grid_buses as gb', 'gb.id', 'spv.bus_id')
      .select(
        'p.*',
        'spv.station_name',
        'spv.installed_capacity_mw',
        'spv.grid_connection_voltage_kv',
        'spv.panel_type',
        'spv.longitude',
        'spv.latitude',
        'spv.address',
        'spv.land_area_mu',
        'gb.zone',
      )
      .first()

    if (!row) return null

    let cf: any = {}
    try { cf = JSON.parse(row.custom_fields || '{}') } catch { /* ignore */ }
    return {
      ...row,
      planned_annual_output_mwh: cf.planned_annual_output_mwh ?? null,
      planned_equivalent_hours: cf.planned_equivalent_hours ?? null,
      planned_absorption_rate_pct: cf.planned_absorption_rate_pct ?? null,
      planned_voltage_compliance_pct: cf.planned_voltage_compliance_pct ?? null,
      operation_start_date: row.actual_completion_date ?? null,
    }
  }

  async createProject(data: any, userId: string) {
    // 合并规划目标字段到 custom_fields
    const cf = data.customFields ? { ...data.customFields } : {}
    if (data.plannedAnnualOutputMwh != null) cf.planned_annual_output_mwh = data.plannedAnnualOutputMwh
    if (data.plannedEquivalentHours != null) cf.planned_equivalent_hours = data.plannedEquivalentHours
    if (data.plannedAbsorptionRatePct != null) cf.planned_absorption_rate_pct = data.plannedAbsorptionRatePct
    if (data.plannedVoltageCompliancePct != null) cf.planned_voltage_compliance_pct = data.plannedVoltageCompliancePct

    const now = new Date().toISOString()
    const [project] = await db('projects').insert({
      id: uuid(),
      project_code: data.projectCode,
      project_name: data.projectName,
      project_type: data.projectType,
      pv_type: data.pvType,
      plan_id: data.planId,
      station_id: data.stationId || null,
      capacity_kw: data.capacityKw,
      budget: data.budget,
      actual_cost: data.actualCost ?? null,
      status: data.status || 'initiated',
      start_date: data.startDate || now,
      expected_completion_date: data.expectedCompletionDate || null,
      actual_completion_date: data.actualCompletionDate || null,
      custom_fields: JSON.stringify(cf),
      created_by: userId,
      created_at: now,
      updated_at: now,
    }).returning('*')
    return project
  }

  async updateProject(id: string, data: any, userId?: string) {
    // 读取旧数据用于 diff
    const oldProject = await db('projects').where('id', id).first()
    if (!oldProject) return null

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    const fieldMap: Record<string, string> = {
      projectName: 'project_name', status: 'status', actualCost: 'actual_cost',
      actualCompletionDate: 'actual_completion_date', stationId: 'station_id',
      capacityKw: 'capacity_kw',
    }
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) updateData[col] = data[k]
    }
    if (data.customFields !== undefined) updateData.custom_fields = JSON.stringify(data.customFields)

    const [project] = await db('projects').where('id', id).update(updateData).returning('*')

    // 生成变更字段列表
    const changedFields: Array<{ field: string; oldValue: any; newValue: any }> = []
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) {
        const oldVal = oldProject[col]
        const newVal = updateData[col]
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          changedFields.push({ field: col, oldValue: oldVal ?? '', newValue: newVal ?? '' })
        }
      }
    }
    if (data.customFields !== undefined) {
      const oldCf = oldProject.custom_fields || '{}'
      const newCf = updateData.custom_fields || '{}'
      if (oldCf !== newCf) changedFields.push({ field: 'custom_fields', oldValue: oldCf, newValue: newCf })
    }

    const now = new Date().toISOString()

    // 创建版本快照
    const stationData = oldProject.station_id
      ? await db('solar_pv_stations').where('id', oldProject.station_id).first()
      : null
    const curVersion = await db('project_versions')
      .where('project_id', id).max('version_number as max').first()
    const versionNumber = ((curVersion as any)?.max ?? 0) + 1

    const snapshot = JSON.stringify({
      project: oldProject,
      station: stationData || null,
    })

    await db('project_versions').insert({
      id: uuid(),
      project_id: id,
      version_number: versionNumber,
      stage: project.status || oldProject.status,
      snapshot,
      changed_fields: changedFields.length > 0 ? JSON.stringify(changedFields) : null,
      changelog: data.changelog || '更新项目',
      created_by: userId || null,
      created_at: now,
    })

    // 版本数量控制（保留最近 50 条）
    const versions = await db('project_versions').where('project_id', id)
      .orderBy('version_number', 'desc').select('id', 'version_number')
    if (versions.length > 50) {
      const toDelete = versions.slice(50).map((v: any) => v.id)
      await db('project_versions').whereIn('id', toDelete).del()
    }

    // 写入 project_audit
    await db('project_audit').insert({
      id: uuid(),
      project_id: id,
      action: data.status && data.status !== oldProject.status ? 'status_change' : 'updated',
      old_status: oldProject.status,
      new_status: project.status,
      comment: data.comment || data.changelog || null,
      performed_by: userId || null,
      changed_fields: changedFields.length > 0 ? JSON.stringify(changedFields) : null,
      stage: project.status || oldProject.status,
      snapshot: JSON.stringify({ project: oldProject }),
      created_at: now,
    })

    return project
  }

  // 可选电站：尚未被 projects 关联的 active 电站
  async getAvailableStations() {
    const linkedIds = await db('projects')
      .whereNotNull('station_id')
      .where('status', '!=', 'closed')
      .select('station_id')
    const linkedSet = new Set(linkedIds.map((r: any) => r.station_id))

    const all = await db('solar_pv_stations')
      .where('status', 'active')
      .select('id', 'station_name', 'installed_capacity_mw', 'grid_connection_voltage_kv', 'address', 'installed_date')
      .orderBy('installed_date', 'desc')

    return all.filter((s: any) => !linkedSet.has(s.id))
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
    const p = params.params || {}

    // 从模型表读取激活的评估指标
    const modelFields = await db('assessment_model_fields')
      .where('is_active', 1)
      .orderBy('dimension')
      .orderBy('sort_order')

    if (modelFields.length === 0) {
      throw new Error('评估模型未配置，请先在"四维评估模型构建"中维护评估指标')
    }

    // 按维度分组收集得分
    const dimensionScores: Record<string, number[]> = {
      resource: [],
      grid: [],
      investment: [],
      environment: [],
    }

    for (const field of modelFields) {
      const rawVal = p[field.field_code]
      const s = calcModelScore(field, rawVal)
      if (dimensionScores[field.dimension]) {
        dimensionScores[field.dimension].push(s)
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const resourceScore = avg(dimensionScores.resource)
    const gridScore = avg(dimensionScores.grid)
    const investScore = avg(dimensionScores.investment)
    const envScore = avg(dimensionScores.environment)

    const comprehensive =
      resourceScore * w.resource +
      gridScore * w.grid +
      investScore * w.investment +
      envScore * w.environment

    const [result] = await db('feasibility_assessments')
      .insert({
        project_id: projectId,
        technical_score: resourceScore,
        economic_score: investScore,
        environmental_score: envScore,
        social_score: gridScore,
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

  // ==================== 项目版本管理 ====================

  async getProjectVersions(projectId: string) {
    return db('project_versions')
      .where('project_id', projectId)
      .orderBy('version_number', 'desc')
  }

  async getProjectVersionDetail(versionId: string) {
    const version = await db('project_versions').where('id', versionId).first()
    if (!version) return null
    let changedFields: any = null
    try { changedFields = JSON.parse(version.changed_fields || 'null') } catch { /* */ }
    let snapshot: any = null
    try { snapshot = JSON.parse(version.snapshot || 'null') } catch { /* */ }
    return { ...version, changedFields, snapshot }
  }

  async compareVersions(projectId: string, v1: number, v2: number) {
    const ver1 = await db('project_versions').where({ project_id: projectId, version_number: v1 }).first()
    const ver2 = await db('project_versions').where({ project_id: projectId, version_number: v2 }).first()
    if (!ver1 || !ver2) throw new Error('版本不存在')

    const snap1 = JSON.parse(ver1.snapshot || '{}')
    const snap2 = JSON.parse(ver2.snapshot || '{}')
    const diffs: Array<{ field: string; v1Value: any; v2Value: any }> = []
    const allKeys = new Set([...Object.keys(snap1.project || {}), ...Object.keys(snap2.project || {})])
    for (const key of allKeys) {
      const a = (snap1.project || {})[key]
      const b = (snap2.project || {})[key]
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffs.push({ field: key, v1Value: a ?? '', v2Value: b ?? '' })
      }
    }
    return { v1: ver1, v2: ver2, diffs }
  }

  async restoreProjectVersion(projectId: string, versionId: string, userId: string) {
    const version = await db('project_versions').where('id', versionId).first()
    if (!version) throw new Error('版本不存在')

    const snap = JSON.parse(version.snapshot || '{}')
    const oldProject = snap.project
    if (!oldProject) throw new Error('版本快照中无项目数据')

    const now = new Date().toISOString()
    const curVersion = await db('project_versions')
      .where('project_id', projectId).max('version_number as max').first()
    const newVersion = ((curVersion as any)?.max ?? 0) + 1

    // 验证快照中的 station 是否仍然存在（seed 重跑后 UUID 可能变化，按名称重新匹配）
    let stationIdToRestore = oldProject.station_id
    if (stationIdToRestore) {
      const stationExists = await db('solar_pv_stations').where('id', stationIdToRestore).first()
      if (!stationExists) {
        const stationName = snap.station?.station_name || ''
        if (stationName) {
          const matchedStation = await db('solar_pv_stations').where('station_name', stationName).first()
          stationIdToRestore = matchedStation?.id || null
        } else {
          stationIdToRestore = null
        }
      }
    }

    // 更新项目到历史版本
    await db('projects').where('id', projectId).update({
      project_name: oldProject.project_name,
      status: oldProject.status,
      actual_cost: oldProject.actual_cost,
      actual_completion_date: oldProject.actual_completion_date,
      station_id: stationIdToRestore,
      capacity_kw: oldProject.capacity_kw,
      budget: oldProject.budget,
      custom_fields: oldProject.custom_fields,
      updated_at: now,
    })

    // 创建恢复版本记录
    const snapshot = JSON.stringify({ project: oldProject, station: snap.station || null })
    await db('project_versions').insert({
      id: uuid(),
      project_id: projectId,
      version_number: newVersion,
      stage: oldProject.status || 'other',
      snapshot,
      changed_fields: JSON.stringify([{ field: '__restored__', oldValue: '', newValue: `从版本 ${version.version_number} 恢复` }]),
      changelog: `从版本 v${version.version_number} 恢复`,
      created_by: userId,
      created_at: now,
    })

    return db('projects').where('id', projectId).first()
  }

  // ==================== 项目档案核心内容 ====================

  async getProjectArchive(projectId: string) {
    const project = await this.getProjectWithStation(projectId)
    if (!project) throw new Error('项目不存在')

    const deviceParams = await this.getProjectDeviceParams(projectId)
    const documents = await this.listDocuments(projectId)
    const adjustments = await this.listPlanAdjustments(projectId)
    const completeness = await this.calculateCompleteness(projectId)

    return { project, deviceParams, documents, adjustments, completeness }
  }

  async calculateCompleteness(projectId: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project) throw new Error('项目不存在')

    const requiredFields = [
      { field: 'project_name', value: project.project_name },
      { field: 'project_type', value: project.project_type },
      { field: 'capacity_kw', value: project.capacity_kw },
      { field: 'budget', value: project.budget },
      { field: 'status', value: project.status },
      { field: 'start_date', value: project.start_date },
      { field: 'expected_completion_date', value: project.expected_completion_date },
    ]

    let cf: any = {}
    try { cf = JSON.parse(project.custom_fields || '{}') } catch { /* */ }
    const cfFields = ['planned_annual_output_mwh', 'planned_equivalent_hours', 'construction_progress', 'grid_voltage']
    for (const f of cfFields) {
      requiredFields.push({ field: `custom_fields.${f}`, value: cf[f] })
    }

    if (project.station_id) {
      const station = await db('solar_pv_stations').where('id', project.station_id).first()
      if (station) {
        requiredFields.push(
          { field: 'station.longitude', value: station.longitude },
          { field: 'station.latitude', value: station.latitude },
          { field: 'station.installed_capacity_mw', value: station.installed_capacity_mw },
          { field: 'station.grid_connection_voltage_kv', value: station.grid_connection_voltage_kv },
        )
      }
    }

    const missingFields: string[] = []
    let filledFields = 0
    for (const f of requiredFields) {
      if (f.value !== null && f.value !== undefined && f.value !== '') filledFields++
      else missingFields.push(f.field)
    }

    return {
      totalFields: requiredFields.length,
      filledFields,
      rate: requiredFields.length > 0 ? Math.round((filledFields / requiredFields.length) * 100) / 100 : 0,
      missingFields,
    }
  }

  async getOutputCurve(projectId: string, period: 'day' | 'week' | 'month' = 'day', date?: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project || !project.station_id) throw new Error('项目未关联电站，无出力数据')

    const stationId = project.station_id
    const targetDate = date || new Date().toISOString().slice(0, 10)

    // 根据 period 确定时间范围和查询方式
    let startTime: string, endTime: string
    if (period === 'day') {
      startTime = targetDate + 'T00:00:00'
      endTime = targetDate + 'T23:59:59'
    } else if (period === 'week') {
      const d = new Date(targetDate)
      const dayOfWeek = d.getDay()
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      startTime = monday.toISOString().slice(0, 10) + 'T00:00:00'
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      endTime = sunday.toISOString().slice(0, 10) + 'T23:59:59'
    } else {
      startTime = targetDate.slice(0, 7) + '-01T00:00:00'
      const lastDay = new Date(parseInt(targetDate.slice(0, 4)), parseInt(targetDate.slice(5, 7)), 0).getDate()
      endTime = targetDate.slice(0, 7) + `-${String(lastDay).padStart(2, '0')}T23:59:59`
    }

    // 从 pv_output_measurements 查询
    const rows = await db('pv_output_measurements')
      .where('station_id', stationId)
      .where('time', '>=', startTime)
      .where('time', '<=', endTime)
      .orderBy('time', 'asc')
      .select('time', 'active_power_kw', 'voltage_v', 'current_a', 'power_factor')

    // 根据 period 聚合
    if (period === 'month') {
      // 按天聚合
      const grouped: Record<string, { sumPower: number; sumVoltage: number; sumPF: number; count: number }> = {}
      for (const r of rows) {
        const day = (r.time as string).slice(0, 10)
        if (!grouped[day]) grouped[day] = { sumPower: 0, sumVoltage: 0, sumPF: 0, count: 0 }
        grouped[day].sumPower += Number(r.active_power_kw) || 0
        grouped[day].sumVoltage += Number(r.voltage_v) || 0
        grouped[day].sumPF += Number(r.power_factor) || 0
        grouped[day].count++
      }
      return Object.entries(grouped).map(([day, v]) => ({
        time: day,
        activePower: v.sumPower / v.count,
        voltage: v.sumVoltage / v.count,
        powerFactor: v.sumPF / v.count,
      }))
    }

    return rows.map((r: any) => ({
      time: r.time,
      activePower: Number(r.active_power_kw) || 0,
      voltage: Number(r.voltage_v) || 0,
      powerFactor: Number(r.power_factor) || 0,
    }))
  }

  async getProjectDeviceParams(projectId: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project || !project.station_id) return []

    const station = await db('solar_pv_stations').where('id', project.station_id).first()
    if (!station || !station.model_id) return []

    const params = await db('station_model_params').where('id', station.model_id).first()

    if (!params) return []

    return [{
      id: params.id,
      rootId: params.root_id,
      modelName: params.model_name,
      version: params.version,
      ratedCapacityMw: params.rated_capacity_mw,
      ratedVoltageKv: params.rated_voltage_kv,
      powerFactor: params.power_factor,
      efficiencyPct: params.efficiency_pct,
      shortCircuitRatio: params.short_circuit_ratio,
      mpptAlgorithm: params.mppt_algorithm,
      powerLimitMode: params.power_limit_mode,
      rampRateLimit: params.ramp_rate_limit,
      lvrtEnabled: params.lvrt_enabled,
      hvrtEnabled: params.hvrt_enabled,
      islandProtection: params.island_protection,
      designTempC: params.design_temp_c,
      designIrradiance: params.design_irradiance,
      designHumidityPct: params.design_humidity_pct,
      altitudeM: params.altitude_m,
      soilingFactor: params.soiling_factor,
      changeSummary: params.change_summary,
      createdAt: params.created_at,
    }]
  }

  // ==================== 合规性检查 ====================

  async listComplianceChecklist() {
    return db('compliance_checklist').where('is_enabled', 1).orderBy('sort_order')
  }

  async runComplianceCheck(projectId: string, userId: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project) throw new Error('项目不存在')

    const checklist = await this.listComplianceChecklist()
    const now = new Date().toISOString()
    const results: any[] = []

    // 先清除旧的检查结果
    await db('project_compliance_results').where('project_id', projectId).del()

    for (const item of checklist) {
      let ruleConfig: any = {}
      try { ruleConfig = JSON.parse(item.rule_config || '{}') } catch { /* */ }

      const { checkStatus, actualValue, detail } = await this._evaluateCheckRule(
        project, item.check_rule, ruleConfig,
      )

      const [result] = await db('project_compliance_results').insert({
        id: uuid(),
        project_id: projectId,
        checklist_item_id: item.id,
        check_status: checkStatus,
        actual_value: actualValue,
        detail: JSON.stringify(detail),
        checked_by: userId,
        checked_at: now,
        updated_at: now,
      }).returning('*')

      results.push({
        ...result,
        checkItemName: item.name,
        checkItemCode: item.code,
        category: item.category,
      })
    }

    return results
  }

  async getComplianceResults(projectId: string) {
    const rows = await db('project_compliance_results as r')
      .join('compliance_checklist as c', 'c.id', 'r.checklist_item_id')
      .where('r.project_id', projectId)
      .select('r.*', 'c.code as checkItemCode', 'c.name as checkItemName', 'c.category')
      .orderBy('c.sort_order')

    return rows.map((r: any) => {
      let detail: any = null
      try { detail = JSON.parse(r.detail || 'null') } catch { /* */ }
      return { ...r, detail }
    })
  }

  async generateComplianceReport(projectId: string) {
    const project = await this.getProjectWithStation(projectId)
    if (!project) throw new Error('项目不存在')

    const results = await this.getComplianceResults(projectId)
    const passCount = results.filter((r: any) => r.check_status === 'pass').length
    const failCount = results.filter((r: any) => r.check_status === 'fail').length
    const pendingCount = results.filter((r: any) => r.check_status === 'pending').length

    let overallVerdict = '待完善'
    if (failCount === 0 && pendingCount === 0 && passCount > 0) overallVerdict = '合规'
    else if (failCount > 0) overallVerdict = '不合规'
    else if (pendingCount > 0 && failCount === 0) overallVerdict = '部分待检'

    return {
      projectInfo: {
        projectCode: project.project_code,
        projectName: project.project_name,
        stationName: (project as any).station_name || '-',
        capacityMw: (project as any).installed_capacity_mw || project.capacity_kw,
        gridVoltageKv: (project as any).grid_connection_voltage_kv || '-',
        status: project.status,
      },
      checkedAt: results.length > 0 ? (results[0] as any).checked_at : new Date().toISOString(),
      results,
      summary: { passCount, failCount, pendingCount, total: results.length },
      overallVerdict,
    }
  }

  // 合规检查规则评估（私有方法）
  async _evaluateCheckRule(project: any, checkRule: string, ruleConfig: any) {
    const stationId = project.station_id

    switch (checkRule) {
      case 'existence': {
        if (ruleConfig.type === 'document_exists') {
          const docs = await db('project_documents')
            .where('project_id', project.id)
            .where('doc_type', ruleConfig.doc_type)
          if (docs.length > 0) {
            return { checkStatus: 'pass', actualValue: `已上传 ${docs.length} 份`, detail: { docCount: docs.length } }
          }
          return { checkStatus: 'fail', actualValue: '未上传', detail: { docCount: 0 } }
        }
        if (ruleConfig.type === 'record_exists') {
          const rows = await db(ruleConfig.table).where('project_id', project.id)
            .modify((qb: any) => {
              if (ruleConfig.condition) {
                for (const [k, v] of Object.entries(ruleConfig.condition)) {
                  qb.where(k, v)
                }
              }
            })
          if (rows.length > 0) {
            return { checkStatus: 'pass', actualValue: `已存在 ${rows.length} 条`, detail: { count: rows.length } }
          }
          return { checkStatus: 'fail', actualValue: '无记录', detail: { count: 0 } }
        }
        if (ruleConfig.type === 'lifecycle_event_exists') {
          if (!stationId) return { checkStatus: 'na', actualValue: '未关联电站', detail: {} }
          const events = await db(ruleConfig.table)
            .where('event_type', ruleConfig.event_type)
          if (events.length > 0) {
            return { checkStatus: 'pass', actualValue: `已存在 ${events.length} 条`, detail: { count: events.length } }
          }
          return { checkStatus: 'fail', actualValue: '无记录', detail: { count: 0 } }
        }
        break
      }

      case 'field_compare': {
        if (ruleConfig.type === 'coordinate_range') {
          if (!stationId) return { checkStatus: 'na', actualValue: '未关联电站', detail: {} }
          const station = await db('solar_pv_stations').where('id', stationId).first()
          if (station && station.longitude != null && station.latitude != null) {
            // 检查坐标是否在有效范围内（中国大致范围）
            const lon = Number(station.longitude)
            const lat = Number(station.latitude)
            const inRange = lon >= 73 && lon <= 135 && lat >= 18 && lat <= 54
            return {
              checkStatus: inRange ? 'pass' : 'fail',
              actualValue: `经度 ${lon}, 纬度 ${lat}`,
              detail: { longitude: lon, latitude: lat, inRange },
            }
          }
          return { checkStatus: 'fail', actualValue: '坐标数据缺失', detail: {} }
        }
        if (ruleConfig.type === 'cross_table_compare') {
          if (!stationId) return { checkStatus: 'na', actualValue: '未关联电站', detail: {} }
          const station = await db('solar_pv_stations').where('id', stationId).first()
          if (!station || !station.model_id) return { checkStatus: 'pending', actualValue: '电站未关联设备模型', detail: {} }
          const params = await db('station_model_params').where('id', station.model_id).first()
          if (!params) return { checkStatus: 'pending', actualValue: '无设备参数数据', detail: {} }

          const fields = ruleConfig.fields || []
          let allMatch = true
          const fieldResults: any[] = []
          for (const f of fields) {
            const modelVal = Number(params[f.modelField]) || 0
            let projectVal: number = 0
            if (f.projectField === 'capacity_kw') {
              projectVal = Number(project.capacity_kw) || 0
            } else if (f.projectField.startsWith('custom_fields.')) {
              let cf: any = {}
              try { cf = JSON.parse(project.custom_fields || '{}') } catch { /* */ }
              const cfKey = f.projectField.replace('custom_fields.', '')
              projectVal = parseFloat(cf[cfKey]) || 0
            }
            // 容量比较时统一单位（MW vs kW）
            if (f.modelField === 'rated_capacity_mw' && f.projectField === 'capacity_kw') {
              projectVal = projectVal / 1000
            }
            const tolerance = f.tolerance || 0.1
            const deviation = modelVal > 0 ? Math.abs(projectVal - modelVal) / modelVal : 1
            const match = deviation <= tolerance
            if (!match) allMatch = false
            fieldResults.push({ field: f.modelField, modelVal, projectVal, deviation, match })
          }
          return {
            checkStatus: allMatch ? 'pass' : 'fail',
            actualValue: fieldResults.map((r: any) => `${r.field}: ${r.match ? '一致' : '偏差' + (r.deviation * 100).toFixed(0) + '%'}`).join('; '),
            detail: { fieldResults },
          }
        }
        break
      }

      case 'threshold': {
        if (ruleConfig.type === 'field_threshold') {
          const budget = parseFloat(project.budget) || 0
          const actual = parseFloat(project.actual_cost) || 0
          if (budget === 0 && actual === 0) {
            return { checkStatus: 'pending', actualValue: '预算和实际成本均未填写', detail: {} }
          }
          if (budget === 0) {
            return { checkStatus: 'fail', actualValue: '预算未填写', detail: { budget: 0 } }
          }
          const deviationPct = Math.abs(actual - budget) / budget * 100
          const pass = deviationPct <= (ruleConfig.maxDeviationPct || 20)
          return {
            checkStatus: pass ? 'pass' : 'fail',
            actualValue: `偏差 ${deviationPct.toFixed(1)}%`,
            detail: { budget, actual, deviationPct },
          }
        }
        break
      }
    }

    return { checkStatus: 'pending', actualValue: '规则未匹配', detail: {} }
  }

  // ==================== 规划调整记录 ====================

  async listPlanAdjustments(projectId: string) {
    return db('plan_adjustments').where('project_id', projectId).orderBy('created_at', 'desc')
  }

  async createPlanAdjustment(projectId: string, data: any, userId: string) {
    const now = new Date().toISOString()
    const [row] = await db('plan_adjustments').insert({
      id: uuid(),
      project_id: projectId,
      adjustment_type: data.adjustmentType,
      field_path: data.fieldPath || null,
      old_value: data.oldValue || null,
      new_value: data.newValue || null,
      reason: data.reason,
      approval_status: 'pending',
      created_by: userId,
      created_at: now,
    }).returning('*')
    return row
  }

  async approvePlanAdjustment(id: string, userId: string, status: 'approved' | 'rejected') {
    const now = new Date().toISOString()
    const [row] = await db('plan_adjustments').where('id', id).update({
      approval_status: status,
      approved_by: userId,
      approved_at: now,
    }).returning('*')
    return row
  }
}
