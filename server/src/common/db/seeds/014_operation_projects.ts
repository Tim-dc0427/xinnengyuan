import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('effectiveness_verifications').del()
  await knex('operation_projects').del()

  const stations = await knex('solar_pv_stations')
    .select('id', 'station_name', 'installed_capacity_mw', 'grid_connection_voltage_kv', 'installed_date')
  if (stations.length === 0) {
    console.log('  No solar PV stations, skipping operation projects seed.')
    return
  }

  const stationMap: Record<string, any> = {}
  for (const s of stations) {
    stationMap[(s as any).station_name] = s
  }

  interface OpProjectDef {
    stationName: string
    projectCode: string
    projectName: string
    plannedAnnualOutputMwh: number | null
    plannedEquivalentHours: number | null
    plannedAbsorptionRatePct: number | null
    plannedVoltageCompliancePct: number | null
    operationStartDate: string | null
  }

  const defs: OpProjectDef[] = [
    {
      stationName: '华洋山地光伏电站',
      projectCode: 'OP-2024-001',
      projectName: '华洋山地光伏电站投运项目',
      plannedAnnualOutputMwh: 15500,
      plannedEquivalentHours: 1000,
      plannedAbsorptionRatePct: 95,
      plannedVoltageCompliancePct: 99,
      operationStartDate: '2024-08-30',
    },
    {
      stationName: '临安青山集中式光伏电站',
      projectCode: 'OP-2024-002',
      projectName: '临安青山集中式光伏电站投运项目',
      plannedAnnualOutputMwh: 6000,
      plannedEquivalentHours: 1000,
      plannedAbsorptionRatePct: 96,
      plannedVoltageCompliancePct: 99,
      operationStartDate: '2024-06-15',
    },
    {
      stationName: '萧山南阳集中式光伏电站',
      projectCode: 'OP-2024-003',
      projectName: '萧山南阳集中式光伏电站投运项目',
      plannedAnnualOutputMwh: 5000,
      plannedEquivalentHours: 1000,
      plannedAbsorptionRatePct: 94,
      plannedVoltageCompliancePct: 98.5,
      operationStartDate: '2024-09-01',
    },
    {
      stationName: '富阳渔山集中式光伏电站',
      projectCode: 'OP-2024-004',
      projectName: '富阳渔山集中式光伏电站投运项目',
      plannedAnnualOutputMwh: 3000,
      plannedEquivalentHours: 1000,
      plannedAbsorptionRatePct: 93,
      plannedVoltageCompliancePct: 98,
      operationStartDate: '2024-05-01',
    },
    {
      stationName: '径山镇宇航梦园渔光互补光伏项目',
      projectCode: 'OP-2026-001',
      projectName: '径山镇宇航梦园渔光互补光伏项目',
      plannedAnnualOutputMwh: 544,
      plannedEquivalentHours: 1000,
      plannedAbsorptionRatePct: 92,
      plannedVoltageCompliancePct: 98,
      operationStartDate: '2026-04-01',
    },
  ]

  const now = new Date().toISOString()
  const insertedProjects: Array<{ id: string; stationId: string; stationName: string }> = []

  for (const def of defs) {
    const station = stationMap[def.stationName]
    if (!station) {
      console.log(`  ⚠ Station "${def.stationName}" not found, skipping`)
      continue
    }

    const id = uuid()
    await knex('operation_projects').insert({
      id,
      project_code: def.projectCode,
      project_name: def.projectName,
      station_id: (station as any).id,
      operation_start_date: def.operationStartDate,
      planned_annual_output_mwh: def.plannedAnnualOutputMwh,
      planned_equivalent_hours: def.plannedEquivalentHours,
      planned_absorption_rate_pct: def.plannedAbsorptionRatePct,
      planned_voltage_compliance_pct: def.plannedVoltageCompliancePct,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    insertedProjects.push({ id, stationId: (station as any).id, stationName: def.stationName })
  }

  console.log(`  ✓ ${insertedProjects.length} operation projects created`)

  // 为有测量数据的电站预置一条成效评估记录（2026-05-15 ~ 2026-05-17）
  if (insertedProjects.length > 0) {
    const adminUser = await knex('users').where('username', 'admin').select('id').first()
    const adminId = adminUser?.id

    // 选取第一个项目创建评估（数据在 pv_output_measurements 中已有）
    const sampleProject = insertedProjects[0]
    const sampleStation = stationMap[sampleProject.stationName] as any

    const verificationId = uuid()
    const periodStart = '2026-05-15T00:00:00.000Z'
    const periodEnd = '2026-05-17T23:59:59.000Z'

    // 从 pv_output_measurements 聚合实际数据
    const rows = await knex('pv_output_measurements')
      .where('station_id', sampleProject.stationId)
      .where('time', '>=', periodStart)
      .where('time', '<=', periodEnd)
      .select('active_power_kw', 'voltage_v', 'frequency_hz', 'power_factor')

    let totalOutputKwh = 0
    let voltageOk = 0
    let frequencyOk = 0
    let powerFactorOk = 0
    const total = rows.length
    const nominalVoltageKv = sampleStation?.grid_connection_voltage_kv || 110
    const vMin = nominalVoltageKv * 1000 * 0.93
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

    // 理论总点数
    const days = 3
    const expectedPoints = days * 96

    const installedMw = sampleStation?.installed_capacity_mw || 0

    const autoOutputKwh = total > 0 ? Math.round(totalOutputKwh * 100) / 100 : null
    const autoEquivalentHours = total > 0 && installedMw > 0
      ? Math.round((totalOutputKwh / (installedMw * 1000)) * 100) / 100
      : null
    const autoVoltage = total > 0 ? Math.round((voltageOk / total) * 10000) / 100 : null
    const autoFreq = total > 0 ? Math.round((frequencyOk / total) * 10000) / 100 : null
    const autoPF = total > 0 ? Math.round((powerFactorOk / total) * 10000) / 100 : null
    const autoCompleteness = Math.round((total / expectedPoints) * 10000) / 100

    const planned = insertedProjects.find(p => p.stationId === sampleProject.stationId)
      ? (stationMap[sampleProject.stationName] ? defs.find(d => d.stationName === sampleProject.stationName)?.plannedAnnualOutputMwh : null)
      : null

    let isEffective = 1
    if (autoOutputKwh) {
      const outputMwh = autoOutputKwh / 10000
      const plannedMwh = 15500 / 365 * 3 // 3天计划值 ≈ 127.4万kWh
      const dev = Math.abs((outputMwh - plannedMwh) / plannedMwh * 100)
      if (dev > 10) isEffective = 0
    }

    await knex('effectiveness_verifications').insert({
      id: verificationId,
      project_id: sampleProject.id,
      period_start: periodStart,
      period_end: periodEnd,

      auto_output_kwh: autoOutputKwh,
      auto_equivalent_hours: autoEquivalentHours,
      auto_voltage_compliance_pct: autoVoltage,
      auto_frequency_compliance_pct: autoFreq,
      auto_power_factor_rate: autoPF,
      auto_completeness_pct: autoCompleteness,

      final_output_kwh: null,
      final_equivalent_hours: null,
      final_voltage_compliance_pct: null,
      final_frequency_compliance_pct: null,
      final_power_factor_rate: null,
      final_completeness_pct: null,

      absorption_rate_pct: 95,

      planned_output_mwh: 15500,
      planned_equivalent_hours: 1000,
      planned_absorption_rate_pct: 95,
      planned_voltage_compliance_pct: 99,

      manual_override: 0,
      correction_note: null,

      is_effective: isEffective,
      remarks: '种子预置示例评估记录',

      verified_by: adminId,
      created_at: now,
    })

    console.log(`  ✓ 1 sample verification created (${total} measurement points, completeness: ${autoCompleteness}%)`)
  }
}
