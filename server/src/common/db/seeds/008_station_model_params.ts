import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  // 清空（子表无外键依赖，直接删）
  await knex('station_model_params').del()

  const now = new Date().toISOString()
  const userId = 'system'

  // ============================================================
  // 模型1：大型渔光互补电站 (220kV级)
  // 适用：舒能400MW、嘉达350MW、凌能250MW
  // ============================================================
  const m1Id = uuid()
  await knex('station_model_params').insert({
    id: m1Id,
    root_id: m1Id,
    model_name: '大型渔光互补电站模型',
    version: 1,
    is_active: 1,
    // 电气参数
    rated_capacity_mw: 350,           // 典型350MW
    rated_voltage_kv: 220,
    power_factor: 0.95,
    efficiency_pct: 82.5,
    short_circuit_ratio: 1.5,
    // 控制参数
    mppt_algorithm: 'INC',
    power_limit_mode: 'dispatch',
    ramp_rate_limit: 3.0,
    lvrt_enabled: 1,
    hvrt_enabled: 1,
    island_protection: 1,
    // 环境参数
    design_temp_c: 25,
    design_irradiance: 1000,
    design_humidity_pct: 70,
    altitude_m: 5,
    soiling_factor: 0.03,
    // 审计
    modified_by: userId,
    change_summary: '初始创建（基于舒能/嘉达/凌能渔光互补电站）',
    created_at: now,
    updated_at: now,
  })

  // ============================================================
  // 模型2：中型山地集中式电站 (110kV级)
  // 适用：华洋155MW、临安青山60MW、临安太湖源40MW、绿能B 30MW
  // ============================================================
  const m2Id = uuid()
  await knex('station_model_params').insert({
    id: m2Id,
    root_id: m2Id,
    model_name: '中型山地集中式电站模型',
    version: 1,
    is_active: 1,
    // 电气参数
    rated_capacity_mw: 100,
    rated_voltage_kv: 110,
    power_factor: 0.93,
    efficiency_pct: 80.0,
    short_circuit_ratio: 1.3,
    // 控制参数
    mppt_algorithm: 'P&O',
    power_limit_mode: 'fixed',
    ramp_rate_limit: 1.5,
    lvrt_enabled: 1,
    hvrt_enabled: 0,
    island_protection: 1,
    // 环境参数
    design_temp_c: 20,
    design_irradiance: 950,
    design_humidity_pct: 65,
    altitude_m: 200,
    soiling_factor: 0.05,
    // 审计
    modified_by: userId,
    change_summary: '初始创建（基于华洋/临安青山/太湖源山地电站）',
    created_at: now,
    updated_at: now,
  })

  // ============================================================
  // 模型3：小型分布式电站 (10kV级)
  // 适用：径山5.44MW、萧山南阳50MW、富阳渔山30MW
  // ============================================================
  const m3Id = uuid()
  await knex('station_model_params').insert({
    id: m3Id,
    root_id: m3Id,
    model_name: '小型分布式电站模型',
    version: 1,
    is_active: 1,
    // 电气参数
    rated_capacity_mw: 30,
    rated_voltage_kv: 10,
    power_factor: 0.90,
    efficiency_pct: 78.0,
    short_circuit_ratio: 1.1,
    // 控制参数
    mppt_algorithm: 'P&O',
    power_limit_mode: 'fixed',
    ramp_rate_limit: 0.5,
    lvrt_enabled: 0,
    hvrt_enabled: 0,
    island_protection: 1,
    // 环境参数
    design_temp_c: 25,
    design_irradiance: 900,
    design_humidity_pct: 75,
    altitude_m: 50,
    soiling_factor: 0.08,
    // 审计
    modified_by: userId,
    change_summary: '初始创建（基于径山/萧山南阳/富阳渔山电站）',
    created_at: now,
    updated_at: now,
  })

  console.log('  ✓ 大型渔光互补电站模型 (220kV/350MW)')
  console.log('  ✓ 中型山地集中式电站模型 (110kV/100MW)')
  console.log('  ✓ 小型分布式电站模型 (10kV/30MW)')
}
