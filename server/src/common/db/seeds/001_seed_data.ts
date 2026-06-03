import type { Knex } from 'knex'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  // Clear all tables in reverse dependency order
  await knex('effectiveness_verifications').del()
  await knex('operation_projects').del()
  await knex('outage_events').del()
  await knex('complaint_stats').del()
  await knex('equipment_temperature').del()
  await knex('solar_pv_stations').del()
  await knex('manual_intervention_log').del()
  await knex('execution_evaluations').del()
  await knex('simulation_runs').del()
  await knex('strategies').del()
  await knex('scenario_resources').del()
  await knex('scenarios').del()
  await knex('resource_relationships').del()
  await knex('resource_models').del()
  await knex('output_curve_templates').del()
  await knex('confidence_coefficient_settings').del()
  await knex('data_validation_records').del()
  await knex('batch_calc_groups').del()
  await knex('calc_results').del()
  await knex('calc_tasks').del()
  await knex('project_audit').del()
  await knex('feasibility_assessments').del()
  await knex('access_conditions').del()
  await knex('project_documents').del()
  await knex('projects').del()
  await knex('project_type_fields').del()
  await knex('project_types').del()
  await knex('access_condition_plans').del()
  await knex('access_point_resources').del()
  await knex('project_field_library').del()
  await knex('investment_config').del()
  await knex('cost_items').del()
  await knex('equipment_ledger').del()
  await knex('economic_analyses').del()
  await knex('absorption_schemes').del()
  await knex('site_recommendations').del()
  await knex('candidate_points').del()
  await knex('pv_stations').del()
  await knex('pv_cost_library').del()
  await knex('pv_model_type_fields').del()
  await knex('pv_model_types').del()
  await knex('pv_field_library').del()
  await knex('plans').del()
  await knex('carbon_emissions').del()
  await knex('alerts').del()
  await knex('voltage_measurements').del()
  await knex('battery_cycle_records').del()
  await knex('equipment_lifecycle').del()
  await knex('equipment').del()
  await knex('pv_output_measurements').del()
  await knex('audit_logs').del()
  await knex('users').del()
  await knex('roles').del()

  // Roles
  const adminRoleId = uuid()
  const plannerRoleId = uuid()
  const operatorRoleId = uuid()
  const viewerRoleId = uuid()

  await knex('roles').insert([
    { id: adminRoleId, name: 'admin', permissions: '["*"]' },
    { id: plannerRoleId, name: 'planner', permissions: '["read","write","calculate"]' },
    { id: operatorRoleId, name: 'operator', permissions: '["read","calculate"]' },
    { id: viewerRoleId, name: 'viewer', permissions: '["read"]' },
  ])

  // Users
  const passwordHash = await bcrypt.hash('password123', 10)
  await knex('users').insert([
    { id: uuid(), username: 'admin', password_hash: passwordHash, display_name: '系统管理员', role_id: adminRoleId, department: '信息中心' },
    { id: uuid(), username: 'planner', password_hash: passwordHash, display_name: '规划人员', role_id: plannerRoleId, department: '规划部' },
    { id: uuid(), username: 'operator', password_hash: passwordHash, display_name: '运行人员', role_id: operatorRoleId, department: '运检部' },
    { id: uuid(), username: 'viewer', password_hash: passwordHash, display_name: '查看人员', role_id: viewerRoleId, department: '发展部' },
  ])

  // Equipment（独立储能电站设备，不关联 power_plants）
  const eqC1Id = uuid()  // plantC 变压器
  const eqC2Id = uuid()  // plantC 电池组
  const eqC3Id = uuid()  // plantC 电池组2
  const eqC4Id = uuid()  // plantC PCS

  await knex('equipment').insert([
    // ---- 清源储能电站 (10MW STORAGE) ----
    { id: eqC1Id, name: 'S11-12500/35 主变压器', equipment_type: 'TRANSFORMER', model_number: 'S11-12500/35', rated_capacity_kva: 12500, rated_voltage_kv: 35, rated_current_a: 206, installation_date: '2024-01-01', design_life_years: 25, grade: 'A' },
    { id: eqC2Id, name: '磷酸铁锂储能电池组 5000kWh', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-40P', rated_capacity_kva: 5000, rated_voltage_kv: 768, rated_current_a: 651, installation_date: '2024-01-01', design_life_years: 12, grade: 'A' },
    { id: eqC3Id, name: '磷酸铁锂储能电池组 5000kWh（II段）', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-40P', rated_capacity_kva: 5000, rated_voltage_kv: 768, rated_current_a: 651, installation_date: '2024-01-01', design_life_years: 12, grade: 'B' },
    { id: eqC4Id, name: 'PCS-500K 储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-500K', rated_capacity_kva: 500, rated_voltage_kv: 0.8, rated_current_a: 361, installation_date: '2024-01-01', design_life_years: 15, grade: 'A' },
  ])

  // Equipment lifecycle events（仅非光伏设备）
  await knex('equipment_lifecycle').insert([
    // plantC 清源储能 (10MW)
    { id: uuid(), equipment_id: eqC1Id, event_type: 'INSTALL', event_date: '2024-01-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqC2Id, event_type: 'INSTALL', event_date: '2024-01-01', description: '1号电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqC3Id, event_type: 'INSTALL', event_date: '2024-01-01', description: '2号电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqC4Id, event_type: 'INSTALL', event_date: '2024-01-01', description: 'PCS 变流器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqC2Id, event_type: 'INSPECTION', event_date: '2025-03-10', description: '电池容量测试 — SOH 97.2%', remaining_life_years: 10.5 },
  ])

  // ==================== 电池循环记录（模拟24个月运行数据） ====================
  // 电池设备配置: { id, 额定容量kWh, 等级, 投运日期 }（仅非光伏电池）
  const batteryConfigs: Array<{ id: string; ratedKwh: number; grade: string; startDate: string }> = [
    { id: eqC2Id, ratedKwh: 5000, grade: 'A', startDate: '2024-01-01' },
    { id: eqC3Id, ratedKwh: 5000, grade: 'B', startDate: '2024-01-01' },
  ]

  // 杭州月均温度参考(°C): 1月-12月
  const monthBaseTemp = [5, 7, 12, 18, 23, 27, 31, 30, 26, 20, 14, 8]
  // 月循环基数 = 日均1~2次循环 × 30天，大电站循环更多
  function monthCycles(ratedKwh: number, month: number): number {
    const base = ratedKwh > 10000 ? 45 : ratedKwh > 5000 ? 36 : 28
    // 春秋季充放电更频繁（气温适中），夏冬季略少
    const seasonal = [3,4,5,9,10,11].includes(month) ? 1.1 : 0.9
    return Math.round(base * seasonal * (0.85 + Math.random() * 0.3))
  }

  const cycleRecords: any[] = []
  for (const cfg of batteryConfigs) {
    const start = new Date(cfg.startDate)
    // 生成到当前月份，最多24个月
    const now = new Date()
    const totalMonths = Math.min(24, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1)
    if (totalMonths < 1) continue

    let cumulativeCycles = 0
    let cumulativeEnergy = 0
    // 初始SOH，C级电池起始略低
    let soh = cfg.grade === 'C' ? 97.0 : cfg.grade === 'B' ? 98.5 : 99.5
    // 月衰减率基准，等级不同
    const baseDegradation = cfg.grade === 'C' ? 0.22 : cfg.grade === 'B' ? 0.15 : 0.10

    for (let m = 0; m < totalMonths; m++) {
      const d = new Date(start.getFullYear(), start.getMonth() + m, 1)
      const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthIdx = d.getMonth() // 0-11
      const baseTemp = monthBaseTemp[monthIdx]

      const cycles = monthCycles(cfg.ratedKwh, monthIdx)
      const avgDod = 45 + Math.round(Math.random() * 30) // 45-75%
      const avgTemp = baseTemp + (Math.random() * 5 - 2)   // 电池舱温控，波动小
      const maxTemp = avgTemp + 3 + Math.round(Math.random() * 6)
      // 温度加速因子（Arrhenius 简化）：每10°C加倍
      const tempFactor = Math.pow(2, (avgTemp - 25) / 10)
      // 循环衰减 + 日历衰减
      const cycleDeg = cycles * 0.003 * (avgDod / 50) * tempFactor
      const calendarDeg = baseDegradation * tempFactor
      soh -= cycleDeg + calendarDeg
      if (soh < 70) soh = 70 + Math.random() * 2 // 低于70%通常已更换

      cumulativeCycles += cycles
      const monthEnergy = cfg.ratedKwh * cycles * (avgDod / 100) / 1000 // MWh
      cumulativeEnergy += monthEnergy

      cycleRecords.push({
        id: uuid(),
        equipment_id: cfg.id,
        record_month: monthLabel,
        cycle_count: cycles,
        avg_dod_pct: avgDod,
        max_temp_c: Math.round(maxTemp * 10) / 10,
        avg_temp_c: Math.round(avgTemp * 10) / 10,
        soh_pct: Math.round(soh * 10) / 10,
        cumulative_cycles: cumulativeCycles,
        cumulative_energy_mwh: Math.round(cumulativeEnergy * 10) / 10,
        created_at: new Date().toISOString(),
      })
    }
  }
  if (cycleRecords.length) {
    await knex('battery_cycle_records').insert(cycleRecords)
  }

  const adminUser = await knex('users').where('username', 'admin').select('id').first()
  const adminId = adminUser?.id || 'system'
  const now = new Date().toISOString()

  // Output curve templates
  const ctSunnyId = uuid(); const ctCloudyId = uuid(); const ctRainyId = uuid(); const ctCustomId = uuid()
  await knex('output_curve_templates').insert([
    { id: ctSunnyId, root_id: ctSunnyId, name: '晴天模板', weather_type: 'sunny', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.05,0.15,0.30,0.50,0.70,0.85,0.95,1.0,0.98,0.90,0.75,0.55,0.35,0.15,0.05,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
    { id: ctCloudyId, root_id: ctCloudyId, name: '多云模板', weather_type: 'cloudy', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.02,0.08,0.18,0.35,0.55,0.70,0.80,0.85,0.80,0.70,0.55,0.40,0.25,0.10,0.03,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
    { id: ctRainyId, root_id: ctRainyId, name: '雨天模板', weather_type: 'rainy', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.01,0.04,0.10,0.20,0.35,0.45,0.50,0.52,0.50,0.45,0.35,0.25,0.15,0.08,0.02,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
    { id: ctCustomId, root_id: ctCustomId, name: '通用模板', weather_type: 'custom', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.05,0.15,0.30,0.50,0.70,0.85,0.95,1.0,0.98,0.90,0.75,0.55,0.35,0.15,0.05,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
  ])

  // Confidence coefficient settings
  const csId = uuid()
  await knex('confidence_coefficient_settings').insert([
    { id: csId, root_id: csId, name: '默认置信配置', version: 1, confidence_level: 0.95, distribution_type: 'normal',
      pdf_params: JSON.stringify({ mu: 1.0, sigma: 0.1 }), is_active: 1,
      description: '光伏出力默认置信系数配置', created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now },
  ])


  // Sample alerts（基于储能电站设备）
  await knex('alerts').insert([
    { id: uuid(), alert_level: 'WARN', source_type: 'EQUIPMENT', source_id: eqC1Id, title: '变压器温升异常', message: '清源储能#1变压器绕组温度85°C，超过预警值80°C' },
    { id: uuid(), alert_level: 'INFO', source_type: 'EQUIPMENT', source_id: eqC2Id, title: '电池组SOH下降', message: '#1电池组健康度SOH降至93.2%，建议关注' },
    { id: uuid(), alert_level: 'WARN', source_type: 'EQUIPMENT', source_id: eqC3Id, title: '电池组均衡度预警', message: '#2电池组电芯压差达150mV，超过100mV阈值' },
  ])

  // Resource models（非光伏类 + 通用模型）
  await knex('resource_models').insert([
    {
      id: uuid(), model_name: '承载力模型-10kV区域',
      model_type: 'CAPACITY', version: 1, is_active: 1,
      station_id: null,
      description: '10kV配电网区域承载能力评估模型',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { transformerCapacityKva: 50000, lineAmpacityA: 600, nMinus1Enabled: true },
        controlStrategy: { overloadThresholdPct: 120, loadBalancingMode: 'active', demandResponseEnabled: false },
        interfaceParameters: { scadaEnabled: true, loadForecastEnabled: true, topologyFormat: 'cim' },
      }),
      created_by: adminId, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '储能模型-清源站',
      model_type: 'STORAGE', version: 1, is_active: 1,
      station_id: null,
      description: '基于清源储能电站的储能调控模型',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { ratedCapacityKwh: 10000, ratedPowerKw: 5000, efficiencyPct: 92 },
        controlStrategy: { chargeMode: 'peakShaving', socLimitPct: 20, gridSupportMode: 'primaryFreq' },
        interfaceParameters: { bmsProtocol: 'can', pcsInterface: 'digital', sohReportFormat: 'json' },
      }),
      created_by: adminId, created_at: now, updated_at: now,
    },
  ])
}
