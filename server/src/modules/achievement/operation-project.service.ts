import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

export class OperationProjectService {
  // ==================== 投运项目管理 ====================

  async listProjects(query?: { status?: string; stationId?: string }) {
    const qb = db('operation_projects as op')
      .leftJoin('solar_pv_stations as spv', 'spv.id', 'op.station_id')
      .leftJoin('grid_buses as gb', 'gb.id', 'spv.bus_id')
      .select(
        'op.*',
        'spv.station_name',
        'spv.installed_capacity_mw',
        'spv.grid_connection_voltage_kv',
        'spv.panel_type',
        'spv.longitude',
        'spv.latitude',
        'spv.address',
        'gb.zone',
        'gb.voltage_level',
      )
      .orderBy('op.created_at', 'desc')

    if (query?.status) qb.where('op.status', query.status)
    if (query?.stationId) qb.where('op.station_id', query.stationId)

    return qb
  }

  async getProject(id: string) {
    return db('operation_projects as op')
      .leftJoin('solar_pv_stations as spv', 'spv.id', 'op.station_id')
      .leftJoin('grid_buses as gb', 'gb.id', 'spv.bus_id')
      .select(
        'op.*',
        'spv.station_name',
        'spv.installed_capacity_mw',
        'spv.grid_connection_voltage_kv',
        'spv.panel_type',
        'spv.longitude',
        'spv.latitude',
        'spv.address',
        'gb.zone',
        'gb.voltage_level',
      )
      .where('op.id', id)
      .first()
  }

  async createProject(data: any) {
    const id = uuid()
    const now = new Date().toISOString()
    await db('operation_projects').insert({
      id,
      project_code: data.projectCode,
      project_name: data.projectName,
      station_id: data.stationId,
      operation_start_date: data.operationStartDate || null,
      planned_annual_output_mwh: data.plannedAnnualOutputMwh ?? null,
      planned_equivalent_hours: data.plannedEquivalentHours ?? null,
      planned_absorption_rate_pct: data.plannedAbsorptionRatePct ?? null,
      planned_voltage_compliance_pct: data.plannedVoltageCompliancePct ?? null,
      status: 'active',
      remarks: data.remarks || null,
      created_at: now,
      updated_at: now,
    })
    return this.getProject(id)
  }

  async updateProject(id: string, data: any) {
    const current = await db('operation_projects').where('id', id).first()
    if (!current) return null

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (data.projectName !== undefined) updateData.project_name = data.projectName
    if (data.operationStartDate !== undefined) updateData.operation_start_date = data.operationStartDate
    if (data.plannedAnnualOutputMwh !== undefined) updateData.planned_annual_output_mwh = data.plannedAnnualOutputMwh
    if (data.plannedEquivalentHours !== undefined) updateData.planned_equivalent_hours = data.plannedEquivalentHours
    if (data.plannedAbsorptionRatePct !== undefined) updateData.planned_absorption_rate_pct = data.plannedAbsorptionRatePct
    if (data.plannedVoltageCompliancePct !== undefined) updateData.planned_voltage_compliance_pct = data.plannedVoltageCompliancePct
    if (data.status !== undefined) updateData.status = data.status
    if (data.remarks !== undefined) updateData.remarks = data.remarks

    await db('operation_projects').where('id', id).update(updateData)
    return this.getProject(id)
  }

  async deleteProject(id: string) {
    await db('operation_projects').where('id', id).update({ status: 'closed', updated_at: new Date().toISOString() })
    return { deleted: true }
  }

  // ==================== 可选电站（尚未关联投运项目的 active 电站） ====================

  async getAvailableStations() {
    const linkedIds = await db('operation_projects')
      .where('status', 'active')
      .select('station_id')
    const linkedSet = new Set(linkedIds.map((r: any) => r.station_id))

    const all = await db('solar_pv_stations')
      .where('status', 'active')
      .select('id', 'station_name', 'installed_capacity_mw', 'grid_connection_voltage_kv', 'address', 'installed_date')
      .orderBy('installed_date', 'desc')

    return all.filter((s: any) => !linkedSet.has(s.id))
  }

  // ==================== 成效验证评估 ====================

  async listVerifications(projectId: string) {
    return db('effectiveness_verifications')
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
  }

  async getVerification(id: string) {
    return db('effectiveness_verifications').where('id', id).first()
  }

  async createVerification(projectId: string, data: any, userId: string) {
    const project = await this.getProject(projectId)
    if (!project) throw new Error('投运项目不存在')

    const id = uuid()
    const periodStart = data.periodStart
    const periodEnd = data.periodEnd
    const stationId = (project as any).station_id
    const installedCapacityMw = (project as any).installed_capacity_mw || 0

    // 从 pv_output_measurements 自动聚合实际运行数据
    const autoValues = await this.aggregateMeasurements(
      stationId,
      periodStart,
      periodEnd,
      installedCapacityMw,
      (project as any).grid_connection_voltage_kv || 220,
    )

    // 手动修正值
    const finalOutputKwh = data.finalOutputKwh ?? null
    const finalEquivalentHours = data.finalEquivalentHours ?? null
    const finalVoltageCompliancePct = data.finalVoltageCompliancePct ?? null
    const finalFrequencyCompliancePct = data.finalFrequencyCompliancePct ?? null
    const finalPowerFactorRate = data.finalPowerFactorRate ?? null
    const finalCompletenessPct = data.finalCompletenessPct ?? null
    const correctionNote = data.correctionNote || null

    const hasManualOverride = (
      finalOutputKwh !== null ||
      finalEquivalentHours !== null ||
      finalVoltageCompliancePct !== null ||
      finalFrequencyCompliancePct !== null ||
      finalPowerFactorRate !== null ||
      finalCompletenessPct !== null
    ) ? 1 : 0

    // 规划目标从项目表带入（快照）
    const plannedOutputMwh = (project as any).planned_annual_output_mwh ?? null
    const plannedEquivalentHours = (project as any).planned_equivalent_hours ?? null
    const plannedAbsorptionRatePct = (project as any).planned_absorption_rate_pct ?? null
    const plannedVoltageCompliancePct = (project as any).planned_voltage_compliance_pct ?? null

    // 消纳率（无法从 measurements 自动算，传入手动值）
    const absorptionRatePct = data.absorptionRatePct ?? null

    // 判定逻辑：任一偏差 > 10% 则标记不达标
    let isEffective = 1
    const finalOut = finalOutputKwh ?? autoValues.outputKwh
    const finalVol = finalVoltageCompliancePct ?? autoValues.voltageCompliancePct
    const finalFreq = finalFrequencyCompliancePct ?? autoValues.frequencyCompliancePct
    const finalPF = finalPowerFactorRate ?? autoValues.powerFactorRate

    if (plannedOutputMwh && finalOut) {
      const dev = Math.abs((finalOut / 10000 - plannedOutputMwh) / plannedOutputMwh * 100)
      if (dev > 10) isEffective = 0
    }
    if (plannedVoltageCompliancePct && finalVol) {
      if (Math.abs(finalVol - plannedVoltageCompliancePct) > 10) isEffective = 0
    }
    if (finalFreq && finalFreq < 99) isEffective = 0
    if (finalPF && finalPF < 95) isEffective = 0

    await db('effectiveness_verifications').insert({
      id,
      project_id: projectId,
      period_start: periodStart,
      period_end: periodEnd,

      auto_output_kwh: autoValues.outputKwh,
      auto_equivalent_hours: autoValues.equivalentHours,
      auto_voltage_compliance_pct: autoValues.voltageCompliancePct,
      auto_frequency_compliance_pct: autoValues.frequencyCompliancePct,
      auto_power_factor_rate: autoValues.powerFactorRate,
      auto_completeness_pct: autoValues.completenessPct,

      final_output_kwh: finalOutputKwh,
      final_equivalent_hours: finalEquivalentHours,
      final_voltage_compliance_pct: finalVoltageCompliancePct,
      final_frequency_compliance_pct: finalFrequencyCompliancePct,
      final_power_factor_rate: finalPowerFactorRate,
      final_completeness_pct: finalCompletenessPct,

      absorption_rate_pct: absorptionRatePct,

      planned_output_mwh: plannedOutputMwh,
      planned_equivalent_hours: plannedEquivalentHours,
      planned_absorption_rate_pct: plannedAbsorptionRatePct,
      planned_voltage_compliance_pct: plannedVoltageCompliancePct,

      manual_override: hasManualOverride,
      correction_note: correctionNote,

      is_effective: isEffective,
      remarks: data.remarks || null,

      verified_by: userId,
      created_at: new Date().toISOString(),
    })

    return this.getVerification(id)
  }

  async updateVerification(id: string, data: any) {
    const current = await db('effectiveness_verifications').where('id', id).first()
    if (!current) return null

    // 仅允许更新手动修正字段和备注
    const updateData: Record<string, any> = {}
    if (data.finalOutputKwh !== undefined) updateData.final_output_kwh = data.finalOutputKwh
    if (data.finalEquivalentHours !== undefined) updateData.final_equivalent_hours = data.finalEquivalentHours
    if (data.finalVoltageCompliancePct !== undefined) updateData.final_voltage_compliance_pct = data.finalVoltageCompliancePct
    if (data.finalFrequencyCompliancePct !== undefined) updateData.final_frequency_compliance_pct = data.finalFrequencyCompliancePct
    if (data.finalPowerFactorRate !== undefined) updateData.final_power_factor_rate = data.finalPowerFactorRate
    if (data.finalCompletenessPct !== undefined) updateData.final_completeness_pct = data.finalCompletenessPct
    if (data.absorptionRatePct !== undefined) updateData.absorption_rate_pct = data.absorptionRatePct
    if (data.correctionNote !== undefined) updateData.correction_note = data.correctionNote
    if (data.remarks !== undefined) updateData.remarks = data.remarks
    if (data.isEffective !== undefined) updateData.is_effective = data.isEffective

    // 重新判定是否有人工修正
    const merged = { ...current, ...updateData }
    const hasManualOverride = (
      merged.final_output_kwh !== null ||
      merged.final_equivalent_hours !== null ||
      merged.final_voltage_compliance_pct !== null ||
      merged.final_frequency_compliance_pct !== null ||
      merged.final_power_factor_rate !== null ||
      merged.final_completeness_pct !== null
    ) ? 1 : 0
    updateData.manual_override = hasManualOverride

    // 重算达标判定
    const finalOut = merged.final_output_kwh ?? merged.auto_output_kwh
    const finalVol = merged.final_voltage_compliance_pct ?? merged.auto_voltage_compliance_pct
    const finalFreq = merged.final_frequency_compliance_pct ?? merged.auto_frequency_compliance_pct
    const finalPF = merged.final_power_factor_rate ?? merged.auto_power_factor_rate
    const planned = merged.planned_output_mwh
    const plannedVol = merged.planned_voltage_compliance_pct

    let isEffective = 1
    if (planned && finalOut) {
      const dev = Math.abs((finalOut / 10000 - planned) / planned * 100)
      if (dev > 10) isEffective = 0
    }
    if (plannedVol && finalVol) {
      if (Math.abs(finalVol - plannedVol) > 10) isEffective = 0
    }
    if (finalFreq && finalFreq < 99) isEffective = 0
    if (finalPF && finalPF < 95) isEffective = 0
    updateData.is_effective = isEffective

    await db('effectiveness_verifications').where('id', id).update(updateData)
    return this.getVerification(id)
  }

  // ==================== 自动聚合计算 ====================

  private async aggregateMeasurements(
    stationId: string,
    periodStart: string,
    periodEnd: string,
    installedCapacityMw: number,
    nominalVoltageKv: number,
  ) {
    const rows = await db('pv_output_measurements')
      .where('station_id', stationId)
      .where('time', '>=', periodStart)
      .where('time', '<=', periodEnd)
      .select(
        'active_power_kw',
        'voltage_v',
        'frequency_hz',
        'power_factor',
      )

    const total = rows.length
    if (total === 0) {
      return {
        outputKwh: null,
        equivalentHours: null,
        voltageCompliancePct: null,
        frequencyCompliancePct: null,
        powerFactorRate: null,
        completenessPct: 0,
      }
    }

    // 发电量：SUM(active_power_kw × 0.25h)  (15min 粒度)
    let totalOutputKwh = 0
    let voltageOk = 0
    let frequencyOk = 0
    let powerFactorOk = 0

    const vMin = nominalVoltageKv * 1000 * 0.93     // 额定电压 ±7%
    const vMax = nominalVoltageKv * 1000 * 1.07

    for (const r of rows as any[]) {
      totalOutputKwh += (r.active_power_kw || 0) * 0.25

      const v = r.voltage_v || 0
      if (v >= vMin && v <= vMax) voltageOk++

      const f = r.frequency_hz || 0
      if (f >= 49.5 && f <= 50.5) frequencyOk++

      const pf = r.power_factor || 0
      if (pf >= 0.9) powerFactorOk++
    }

    // 理论总点数 = 天数 × 96（15min粒度）
    const startMs = new Date(periodStart).getTime()
    const endMs = new Date(periodEnd).getTime()
    const days = Math.max(1, Math.ceil((endMs - startMs) / (24 * 3600 * 1000)))
    const expectedPoints = days * 96

    return {
      outputKwh: Math.round(totalOutputKwh * 100) / 100,
      equivalentHours: installedCapacityMw > 0
        ? Math.round((totalOutputKwh / (installedCapacityMw * 1000)) * 100) / 100
        : null,
      voltageCompliancePct: Math.round((voltageOk / total) * 10000) / 100,
      frequencyCompliancePct: Math.round((frequencyOk / total) * 10000) / 100,
      powerFactorRate: Math.round((powerFactorOk / total) * 10000) / 100,
      completenessPct: Math.round((total / expectedPoints) * 10000) / 100,
    }
  }
}
