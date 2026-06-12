import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  // 清理（保护外键依赖顺序：先删子表再删父表）
  await knex('project_compliance_results').del()
  await knex('plan_adjustments').del()
  await knex('project_audit').del()
  await knex('project_versions').del()
  await knex('project_documents').del()
  await knex('access_conditions').del()
  await knex('feasibility_assessments').del()
  await knex('effectiveness_verifications').del()
  await knex('projects').del()

  const types = await knex('project_types').select('id', 'code', 'name')
  const typeCodeMap: Record<string, string> = {}
  for (const t of types) {
    typeCodeMap[(t as any).code] = (t as any).code
  }

  const stations = await knex('solar_pv_stations').select('id', 'station_name', 'installed_capacity_mw', 'grid_connection_voltage_kv', 'installed_date', 'actual_runtime_hours', 'prev_actual_runtime_hours')
  const stationMap: Record<string, any> = {}
  for (const s of stations) {
    stationMap[(s as any).station_name] = s
  }

  const adminUser = await knex('users').where('username', 'admin').select('id').first()
  const adminId = adminUser?.id

  const now = new Date().toISOString()

  const tPvGrid = typeCodeMap['PV_GRID_CONNECTION']
  const tPvStorage = typeCodeMap['PV_STORAGE']
  const tPvDistributed = typeCodeMap['PV_DISTRIBUTED']

  // 辅助函数：根据电站名获取 station id
  function getStationId(name: string): string | null {
    return stationMap[name]?.id ?? null
  }

  // ==================== 所有项目数据（14 条） ====================

  const projects = [
    // ========== 已投运项目（station_id 不为空，status='operation'） ==========

    // 1. 华洋山地光伏电站（原 PV-GC-2024-001，修改）
    {
      id: uuid(),
      project_code: 'PV-GC-2024-001',
      project_name: '华洋山地光伏电站',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('华洋山地光伏电站'),
      capacity_kw: 155000,
      budget: 62000,
      actual_cost: 62000,
      status: 'operation',
      start_date: '2024-01-01',
      expected_completion_date: '2024-08-01',
      actual_completion_date: '2024-08-30',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 155,
        land_type: '未利用地',
        grid_voltage: '110kV',
        target_substation: '寿昌变',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2024-08-30',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1350,
        sunshine_hours: 1450,
        solar_grade: 'B',
        unit_cost: 4.0,
        payback_years: 8.5,
        irr_pct: 10.2,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 350,
        transmission_distance_km: 3.2,
        corridor_available: '可用',
        planned_annual_output_mwh: 15500,
        planned_equivalent_hours: 1000,
        planned_absorption_rate_pct: 95,
        planned_voltage_compliance_pct: 99,
      }),
    },

    // 2. 临安青山集中式光伏电站（原 PV-GC-2024-002，修改）
    {
      id: uuid(),
      project_code: 'PV-GC-2024-002',
      project_name: '临安青山集中式光伏电站',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('临安青山集中式光伏电站'),
      capacity_kw: 60000,
      budget: 24000,
      actual_cost: 24000,
      status: 'operation',
      start_date: '2024-03-01',
      expected_completion_date: '2025-06-01',
      actual_completion_date: '2024-06-15',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 60,
        land_type: '农用地',
        grid_voltage: '110kV',
        target_substation: '锦城变',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2025-06-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1400,
        sunshine_hours: 1520,
        solar_grade: 'A',
        unit_cost: 4.0,
        payback_years: 8.0,
        irr_pct: 11.5,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 280,
        transmission_distance_km: 1.8,
        corridor_available: '可用',
        planned_annual_output_mwh: 6000,
        planned_equivalent_hours: 1000,
        planned_absorption_rate_pct: 96,
        planned_voltage_compliance_pct: 99,
      }),
    },

    // 3. 萧山南阳集中式光伏电站（原 PV-GC-2024-003，修改）
    {
      id: uuid(),
      project_code: 'PV-GC-2024-003',
      project_name: '萧山南阳集中式光伏电站',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('萧山南阳集中式光伏电站'),
      capacity_kw: 50000,
      budget: 20000,
      actual_cost: 20000,
      status: 'operation',
      start_date: '2024-04-01',
      expected_completion_date: '2025-09-01',
      actual_completion_date: '2024-09-01',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 50,
        land_type: '建设用地',
        grid_voltage: '10kV',
        target_substation: '建设四路开闭所',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2024-09-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1420,
        sunshine_hours: 1550,
        solar_grade: 'A',
        unit_cost: 4.0,
        payback_years: 7.8,
        irr_pct: 12.0,
        env_sensitivity: '不敏感',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 120,
        transmission_distance_km: 0.5,
        corridor_available: '可用',
        planned_annual_output_mwh: 5000,
        planned_equivalent_hours: 1000,
        planned_absorption_rate_pct: 94,
        planned_voltage_compliance_pct: 98.5,
      }),
    },

    // 4. 临安太湖源集中式光伏电站（补建）
    {
      id: uuid(),
      project_code: 'PV-GC-2024-004',
      project_name: '临安太湖源集中式光伏电站',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('临安太湖源集中式光伏电站'),
      capacity_kw: 40000,
      budget: 16000,
      actual_cost: 16000,
      status: 'operation',
      start_date: '2024-01-01',
      expected_completion_date: '2024-06-15',
      actual_completion_date: '2024-06-15',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 40,
        land_type: '农用地',
        grid_voltage: '110kV',
        target_substation: '科创变',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2024-06-15',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1400,
        sunshine_hours: 1520,
        solar_grade: 'A',
        unit_cost: 4.0,
        payback_years: 8.5,
        irr_pct: 11.0,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 200,
        transmission_distance_km: 2.0,
        corridor_available: '可用',
        planned_annual_output_mwh: 4480,
        planned_equivalent_hours: 1120,
        planned_absorption_rate_pct: 95,
        planned_voltage_compliance_pct: 99,
      }),
    },

    // 5. 富阳渔山集中式光伏电站（补建）
    {
      id: uuid(),
      project_code: 'PV-GC-2024-005',
      project_name: '富阳渔山集中式光伏电站',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('富阳渔山集中式光伏电站'),
      capacity_kw: 30000,
      budget: 12000,
      actual_cost: 12000,
      status: 'operation',
      start_date: '2024-02-01',
      expected_completion_date: '2024-05-01',
      actual_completion_date: '2024-05-01',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 30,
        land_type: '未利用地',
        grid_voltage: '10kV',
        target_substation: '富春路开闭所',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2024-05-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1380,
        sunshine_hours: 1480,
        solar_grade: 'B',
        unit_cost: 4.0,
        payback_years: 9.0,
        irr_pct: 10.0,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 150,
        transmission_distance_km: 3.5,
        corridor_available: '可用',
        planned_annual_output_mwh: 3000,
        planned_equivalent_hours: 1000,
        planned_absorption_rate_pct: 93,
        planned_voltage_compliance_pct: 98,
      }),
    },

    // 6. 径山镇宇航梦园渔光互补光伏项目（补建）
    {
      id: uuid(),
      project_code: 'PV-GC-2026-001',
      project_name: '径山镇宇航梦园渔光互补光伏项目',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('径山镇宇航梦园渔光互补光伏项目'),
      capacity_kw: 5440,
      budget: 2176,
      actual_cost: 2176,
      status: 'operation',
      start_date: '2026-01-01',
      expected_completion_date: '2026-04-01',
      actual_completion_date: '2026-04-01',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 5.44,
        land_type: '水域',
        grid_voltage: '10kV',
        target_substation: '文一西路开闭所',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2026-04-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1380,
        sunshine_hours: 1480,
        solar_grade: 'A',
        unit_cost: 4.0,
        payback_years: 7.5,
        irr_pct: 12.5,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 80,
        transmission_distance_km: 1.5,
        corridor_available: '可用',
        planned_annual_output_mwh: 544,
        planned_equivalent_hours: 1000,
        planned_absorption_rate_pct: 92,
        planned_voltage_compliance_pct: 98,
      }),
    },

    // 7. 舒能渔光互补光伏项目（补建）
    {
      id: uuid(),
      project_code: 'PV-GC-2015-001',
      project_name: '舒能渔光互补光伏项目',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('舒能渔光互补光伏项目'),
      capacity_kw: 100000,
      budget: 40000,
      actual_cost: 40000,
      status: 'operation',
      start_date: '2014-06-01',
      expected_completion_date: '2015-06-01',
      actual_completion_date: '2015-06-01',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 100,
        land_type: '水域',
        grid_voltage: '220kV',
        target_substation: '义蓬变',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2015-06-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1350,
        sunshine_hours: 1420,
        solar_grade: 'B',
        unit_cost: 4.0,
        payback_years: 10.0,
        irr_pct: 8.5,
        env_sensitivity: '敏感',
        geohazard_risk: '中',
        short_circuit_capacity_mva: 400,
        transmission_distance_km: 3.0,
        corridor_available: '可用',
        planned_annual_output_mwh: 10800,
        planned_equivalent_hours: 1080,
        planned_absorption_rate_pct: 95,
        planned_voltage_compliance_pct: 99,
      }),
    },

    // 8. 嘉达渔光互补光伏项目（补建）
    {
      id: uuid(),
      project_code: 'PV-GC-2025-003',
      project_name: '嘉达渔光互补光伏项目',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('嘉达渔光互补光伏项目'),
      capacity_kw: 400000,
      budget: 160000,
      actual_cost: 160000,
      status: 'operation',
      start_date: '2025-06-01',
      expected_completion_date: '2025-12-01',
      actual_completion_date: '2025-12-01',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 400,
        land_type: '水域',
        grid_voltage: '220kV',
        target_substation: '临江变',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2025-12-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1380,
        sunshine_hours: 1480,
        solar_grade: 'A',
        unit_cost: 3.8,
        payback_years: 7.5,
        irr_pct: 13.0,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 600,
        transmission_distance_km: 2.5,
        corridor_available: '可用',
        planned_annual_output_mwh: 51200,
        planned_equivalent_hours: 1280,
        planned_absorption_rate_pct: 95,
        planned_voltage_compliance_pct: 99,
      }),
    },

    // 9. 凌能渔光互补光伏项目（补建）
    {
      id: uuid(),
      project_code: 'PV-GC-2025-004',
      project_name: '凌能渔光互补光伏项目',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: getStationId('凌能渔光互补光伏项目'),
      capacity_kw: 550000,
      budget: 220000,
      actual_cost: 220000,
      status: 'operation',
      start_date: '2025-06-01',
      expected_completion_date: '2025-12-01',
      actual_completion_date: '2025-12-01',
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 550,
        land_type: '水域',
        grid_voltage: '220kV',
        target_substation: '新湾变',
        access_approval_status: '已取得',
        filing_status: '已备案',
        planned_grid_date: '2025-12-01',
        construction_progress: '已完工',
        operation_status: '正常运行',
        annual_irradiance: 1380,
        sunshine_hours: 1480,
        solar_grade: 'A',
        unit_cost: 3.8,
        payback_years: 7.2,
        irr_pct: 13.5,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 800,
        transmission_distance_km: 3.0,
        corridor_available: '可用',
        planned_annual_output_mwh: 71500,
        planned_equivalent_hours: 1300,
        planned_absorption_rate_pct: 95,
        planned_voltage_compliance_pct: 99,
      }),
    },

    // ========== 规划/建设阶段项目（station_id=NULL） ==========

    // 10. 钱塘区舒能渔光互补（规划）
    {
      id: uuid(),
      project_code: 'PV-GC-2025-001',
      project_name: '钱塘区舒能渔光互补（规划）',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: null,
      capacity_kw: 400000,
      budget: 160000,
      actual_cost: null,
      status: 'feasibility',
      start_date: '2025-01-01',
      expected_completion_date: '2026-06-01',
      actual_completion_date: null,
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 400,
        land_type: '水域',
        grid_voltage: '220kV',
        target_substation: '义蓬变',
        access_approval_status: '办理中',
        filing_status: '备案中',
        planned_grid_date: '2026-06-01',
        construction_progress: '未开工',
        operation_status: '在建',
        annual_irradiance: 1380,
        sunshine_hours: 1480,
        solar_grade: 'A',
        unit_cost: 3.8,
        payback_years: 7.2,
        irr_pct: 13.5,
        env_sensitivity: '一般',
        geohazard_risk: '低',
        short_circuit_capacity_mva: 600,
        transmission_distance_km: 2.5,
        corridor_available: '可用',
      }),
    },

    // 11. 余杭光储联合示范项目
    {
      id: uuid(),
      project_code: 'PV-ST-2024-001',
      project_name: '余杭光储联合示范项目',
      project_type: tPvStorage,
      pv_type: '集中式',
      station_id: null,
      capacity_kw: 30000,
      budget: 18000,
      actual_cost: null,
      status: 'feasibility',
      start_date: '2024-06-01',
      expected_completion_date: '2025-12-01',
      actual_completion_date: null,
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 30,
        storage_capacity_mwh: 10,
        land_type: '未利用地',
        grid_voltage: '35kV',
        target_substation: '余杭变35kV',
        access_approval_status: '办理中',
        filing_status: '已备案',
        planned_grid_date: '2025-12-01',
        construction_progress: '未开工',
        operation_status: '在建',
        annual_irradiance: 1380,
        sunshine_hours: 1500,
        solar_grade: 'A',
        unit_cost: 4.5,
        payback_years: 9.0,
        irr_pct: 9.8,
        env_sensitivity: '不敏感',
        geohazard_risk: '低',
      }),
    },

    // 12. 临安太湖源分布式光伏项目
    {
      id: uuid(),
      project_code: 'PV-DT-2024-001',
      project_name: '临安太湖源分布式光伏项目',
      project_type: tPvDistributed,
      pv_type: '分布式',
      station_id: null,
      capacity_kw: 3000,
      budget: 1200,
      actual_cost: null,
      status: 'initiated',
      start_date: '2024-07-01',
      expected_completion_date: '2025-03-01',
      actual_completion_date: null,
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 3,
        roof_area_sqm: 25000,
        land_type: '建设用地',
        grid_voltage: '380V',
        target_substation: '临安10kV',
        access_approval_status: '未办理',
        filing_status: '备案中',
        planned_grid_date: '2025-03-01',
        construction_progress: '未开工',
        operation_status: '在建',
        annual_irradiance: 1400,
        sunshine_hours: 1520,
        solar_grade: 'A',
        unit_cost: 4.0,
        payback_years: 6.5,
        irr_pct: 15.0,
        env_sensitivity: '不敏感',
        geohazard_risk: '低',
      }),
    },

    // 13. 滨江屋顶分布式光伏项目
    {
      id: uuid(),
      project_code: 'PV-DT-2024-002',
      project_name: '滨江屋顶分布式光伏项目',
      project_type: tPvDistributed,
      pv_type: '分布式',
      station_id: null,
      capacity_kw: 1500,
      budget: 600,
      actual_cost: null,
      status: 'feasibility',
      start_date: '2024-09-01',
      expected_completion_date: '2025-06-01',
      actual_completion_date: null,
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 1.5,
        roof_area_sqm: 12000,
        land_type: '建设用地',
        grid_voltage: '380V',
        target_substation: '滨江10kV',
        access_approval_status: '未办理',
        filing_status: '已备案',
        planned_grid_date: '2025-06-01',
        construction_progress: '未开工',
        operation_status: '在建',
        annual_irradiance: 1420,
        sunshine_hours: 1550,
        solar_grade: 'A',
        unit_cost: 4.0,
        payback_years: 6.0,
        irr_pct: 16.5,
        env_sensitivity: '不敏感',
        geohazard_risk: '低',
      }),
    },

    // 14. 富阳渔山二期扩产项目
    {
      id: uuid(),
      project_code: 'PV-GC-2025-002',
      project_name: '富阳渔山二期扩产项目',
      project_type: tPvGrid,
      pv_type: '集中式',
      station_id: null,
      capacity_kw: 20000,
      budget: 8000,
      actual_cost: null,
      status: 'initiated',
      start_date: '2025-03-01',
      expected_completion_date: '2026-03-01',
      actual_completion_date: null,
      created_by: adminId,
      created_at: now,
      updated_at: now,
      custom_fields: JSON.stringify({
        capacity_mwp: 20,
        land_type: '未利用地',
        grid_voltage: '10kV',
        target_substation: '富春路开闭所',
        access_approval_status: '未办理',
        filing_status: '未备案',
        planned_grid_date: '2026-03-01',
        construction_progress: '未开工',
        operation_status: '在建',
        annual_irradiance: 1360,
        sunshine_hours: 1420,
        solar_grade: 'B',
        unit_cost: 4.2,
        payback_years: 9.5,
        irr_pct: 8.5,
        env_sensitivity: '敏感',
        geohazard_risk: '中',
        short_circuit_capacity_mva: 100,
        transmission_distance_km: 4.0,
        corridor_available: '受限',
      }),
    },
  ]

  await knex('projects').insert(projects)
  console.log(`  ✓ ${projects.length} 个项目已创建（${projects.filter(p => p.station_id).length} 个已投运 + ${projects.filter(p => !p.station_id).length} 个规划中）`)

  // 补充项目基础台账字段到 custom_fields
  const archiveDefaults: Record<string, any> = {
    dc_capacity_kw: null,
    ac_rated_capacity_kw: null,
    access_line_code: null,
    dispatch_boundary: null,
    array_count: null,
    reactive_compensation_capacity_kvar: null,
    design_tilt_angle: null,
    design_azimuth_angle: null,
  }
  for (const p of projects) {
    let cf: any = {}
    try { cf = JSON.parse(p.custom_fields || '{}') } catch { /* */ }
    let changed = false
    for (const [k, dv] of Object.entries(archiveDefaults)) {
      if (!(k in cf)) { cf[k] = dv; changed = true }
    }
    if (changed) {
      await knex('projects').where('id', p.id).update({ custom_fields: JSON.stringify(cf) })
    }
  }
  console.log(`  ✓ 项目基础台账字段已补充`)

  // ==================== 项目版本快照 ====================
  await knex('project_versions').del()
  await knex('project_audit').del()
  await knex('plan_adjustments').del()

  const opProjects = projects.filter(p => p.station_id)
  const allVersions: any[] = []
  const allAudits: any[] = []
  const allAdjustments: any[] = []

  for (const p of opProjects) {
    const station = stationMap[Object.keys(stationMap).find(k => stationMap[k].id === p.station_id) || ''] || null
    const snapshot = JSON.stringify({ project: p, station })
    const stages = ['initiated', 'feasibility', 'construction', 'operation'] as const
    const stageDates = [
      p.start_date,
      new Date(new Date(p.start_date).getTime() + 60 * 86400000).toISOString().slice(0, 10),
      new Date(new Date(p.start_date).getTime() + 120 * 86400000).toISOString().slice(0, 10),
      p.actual_completion_date || p.start_date,
    ]

    // 跳过 initiated 在 start_date 才存在的项目
    for (let i = 0; i < stages.length; i++) {
      if (stages[i] === 'operation' && !p.actual_completion_date) continue
      if (stages[i] === 'construction' && !p.actual_completion_date) continue

      const stageStatus = stages[i] === 'operation' ? 'operation'
        : stages[i] === 'construction' ? 'construction'
        : stages[i] === 'feasibility' ? 'feasibility'
        : 'initiated'

      allVersions.push({
        id: uuid(),
        project_id: p.id,
        version_number: i + 1,
        stage: stages[i],
        snapshot,
        changed_fields: i === 0 ? null : JSON.stringify([{ field: 'status', oldValue: stages[i - 1], newValue: stages[i] }]),
        changelog: i === 0 ? '项目立项' : `阶段变更：${stages[i - 1]} → ${stages[i]}`,
        created_by: p.created_by,
        created_at: stageDates[i],
      })
    }

    // 审计记录
    allAudits.push({
      id: uuid(),
      project_id: p.id,
      action: 'created',
      old_status: null,
      new_status: 'initiated',
      comment: '项目创建',
      performed_by: p.created_by,
      changed_fields: null,
      version_id: null,
      stage: 'initiated',
      snapshot: JSON.stringify({ project: { ...p, status: 'initiated' } }),
      created_at: p.start_date,
    })
    if (p.actual_completion_date) {
      allAudits.push({
        id: uuid(),
        project_id: p.id,
        action: 'status_change',
        old_status: 'construction',
        new_status: 'operation',
        comment: '项目投产',
        performed_by: p.created_by,
        changed_fields: JSON.stringify([{ field: 'status', oldValue: 'construction', newValue: 'operation' }]),
        version_id: null,
        stage: 'operation',
        snapshot: JSON.stringify({ project: p }),
        created_at: p.actual_completion_date,
      })
    }
  }

  // 为规划阶段项目也添加审计记录
  for (const p of projects.filter(p => !p.station_id)) {
    allAudits.push({
      id: uuid(),
      project_id: p.id,
      action: 'created',
      old_status: null,
      new_status: p.status,
      comment: '项目创建',
      performed_by: p.created_by,
      changed_fields: null,
      version_id: null,
      stage: p.status,
      snapshot: JSON.stringify({ project: p }),
      created_at: p.start_date,
    })
  }

  if (allVersions.length > 0) {
    await knex('project_versions').insert(allVersions)
    console.log(`  ✓ ${allVersions.length} 条项目版本快照已创建`)
  }
  if (allAudits.length > 0) {
    await knex('project_audit').insert(allAudits)
    console.log(`  ✓ ${allAudits.length} 条审计记录已创建`)
  }

  // ==================== 规划调整记录 ====================
  // 为部分已投运项目添加调整记录
  const adjProject = opProjects[0]  // 华洋山地光伏电站
  if (adjProject) {
    allAdjustments.push({
      id: uuid(),
      project_id: adjProject.id,
      adjustment_type: 'capacity_change',
      field_path: 'capacity_kw',
      old_value: '150000',
      new_value: '155000',
      reason: '优化组件布局，增加装机容量 5MW',
      approval_status: 'approved',
      approved_by: adminId,
      approved_at: '2024-04-01',
      created_by: adminId,
      created_at: '2024-03-15',
    })
  }
  const adjProject2 = opProjects[1]  // 临安青山集中式光伏电站
  if (adjProject2) {
    allAdjustments.push({
      id: uuid(),
      project_id: adjProject2.id,
      adjustment_type: 'schedule_change',
      field_path: 'expected_completion_date',
      old_value: '2025-06-01',
      new_value: '2024-06-15',
      reason: '建设进度提前，预计投产时间提前约1年',
      approval_status: 'approved',
      approved_by: adminId,
      approved_at: '2024-05-20',
      created_by: adminId,
      created_at: '2024-05-10',
    })
  }
  const adjProject3 = opProjects[5]  // 径山镇宇航梦园
  if (adjProject3) {
    allAdjustments.push({
      id: uuid(),
      project_id: adjProject3.id,
      adjustment_type: 'budget_change',
      field_path: 'budget',
      old_value: '2000',
      new_value: '2176',
      reason: '组件采购价格上浮，预算增加',
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      created_by: adminId,
      created_at: '2026-02-01',
    })
  }

  if (allAdjustments.length > 0) {
    await knex('plan_adjustments').insert(allAdjustments)
    console.log(`  ✓ ${allAdjustments.length} 条规划调整记录已创建`)
  }
}
