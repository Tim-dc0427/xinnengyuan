import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('station_model_params').del()

  const userId_admin = '张工'
  const userId_engineer = '李工'
  const userId_operator = '王工'

  // ============================================================
  // 模型1：大型渔光互补电站模型 (220kV级) — 4个版本
  // ============================================================
  const m1_root = uuid()

  // v1 — 初始创建
  await knex('station_model_params').insert({
    id: uuid(), root_id: m1_root, model_name: '大型渔光互补电站模型', version: 1, is_active: 0,
    rated_capacity_mw: 350, rated_voltage_kv: 220, power_factor: 0.93, efficiency_pct: 79.0, short_circuit_ratio: 1.5,
    mppt_algorithm: 'P&O', power_limit_mode: 'fixed', ramp_rate_limit: 2.0,
    lvrt_enabled: 1, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 25, design_irradiance: 1000, design_humidity_pct: 70, altitude_m: 5, soiling_factor: 0.03,
    modified_by: userId_admin, change_summary: '初始创建（基于舒能/嘉达/凌能渔光互补电站）',
    created_at: '2026-01-15T09:30:00.000Z', updated_at: '2026-01-15T09:30:00.000Z',
  })

  // v2 — MPPT算法升级 + 爬坡优化
  await knex('station_model_params').insert({
    id: uuid(), root_id: m1_root, model_name: '大型渔光互补电站模型', version: 2, is_active: 0,
    rated_capacity_mw: 350, rated_voltage_kv: 220, power_factor: 0.93, efficiency_pct: 79.0, short_circuit_ratio: 1.5,
    mppt_algorithm: 'INC', power_limit_mode: 'dispatch', ramp_rate_limit: 3.5,
    lvrt_enabled: 1, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 25, design_irradiance: 1000, design_humidity_pct: 70, altitude_m: 5, soiling_factor: 0.03,
    modified_by: userId_engineer, change_summary: 'MPPT算法从P&O切换为INC，功率限制改为调度模式，爬坡率提升至3.5MW/min以适配AGC调度',
    created_at: '2026-03-20T14:15:00.000Z', updated_at: '2026-03-20T14:15:00.000Z',
  })

  // v3 — 效率修正 + 高电压穿越启用
  await knex('station_model_params').insert({
    id: uuid(), root_id: m1_root, model_name: '大型渔光互补电站模型', version: 3, is_active: 0,
    rated_capacity_mw: 350, rated_voltage_kv: 220, power_factor: 0.93, efficiency_pct: 82.5, short_circuit_ratio: 1.5,
    mppt_algorithm: 'INC', power_limit_mode: 'dispatch', ramp_rate_limit: 3.0,
    lvrt_enabled: 1, hvrt_enabled: 1, island_protection: 1,
    design_temp_c: 25, design_irradiance: 1000, design_humidity_pct: 70, altitude_m: 5, soiling_factor: 0.03,
    modified_by: userId_admin, change_summary: '根据实测数据修正综合效率82.5%，启用HVRT高压穿越保护，爬坡率回调至3.0MW/min保守值',
    created_at: '2026-04-10T10:45:00.000Z', updated_at: '2026-04-10T10:45:00.000Z',
  })

  // v4 — 功率因数校正（当前活跃版本）
  await knex('station_model_params').insert({
    id: uuid(), root_id: m1_root, model_name: '大型渔光互补电站模型', version: 4, is_active: 1,
    rated_capacity_mw: 350, rated_voltage_kv: 220, power_factor: 0.95, efficiency_pct: 82.5, short_circuit_ratio: 1.5,
    mppt_algorithm: 'INC', power_limit_mode: 'dispatch', ramp_rate_limit: 3.0,
    lvrt_enabled: 1, hvrt_enabled: 1, island_protection: 1,
    design_temp_c: 25, design_irradiance: 1000, design_humidity_pct: 70, altitude_m: 5, soiling_factor: 0.03,
    modified_by: userId_operator, change_summary: '无功补偿优化，功率因数从0.93调整至0.95，满足电网公司最新并网要求',
    created_at: '2026-05-15T16:20:00.000Z', updated_at: '2026-05-15T16:20:00.000Z',
  })

  // ============================================================
  // 模型2：中型山地集中式电站模型 (110kV级) — 3个版本
  // ============================================================
  const m2_root = uuid()

  // v1 — 初始创建
  await knex('station_model_params').insert({
    id: uuid(), root_id: m2_root, model_name: '中型山地集中式电站模型', version: 1, is_active: 0,
    rated_capacity_mw: 80, rated_voltage_kv: 110, power_factor: 0.93, efficiency_pct: 78.0, short_circuit_ratio: 1.2,
    mppt_algorithm: 'P&O', power_limit_mode: 'fixed', ramp_rate_limit: 1.0,
    lvrt_enabled: 1, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 20, design_irradiance: 950, design_humidity_pct: 65, altitude_m: 200, soiling_factor: 0.06,
    modified_by: userId_admin, change_summary: '初始创建（基于华洋/临安山地电站）',
    created_at: '2026-02-01T08:00:00.000Z', updated_at: '2026-02-01T08:00:00.000Z',
  })

  // v2 — 扩容 + 积灰系数修正
  await knex('station_model_params').insert({
    id: uuid(), root_id: m2_root, model_name: '中型山地集中式电站模型', version: 2, is_active: 0,
    rated_capacity_mw: 100, rated_voltage_kv: 110, power_factor: 0.93, efficiency_pct: 80.0, short_circuit_ratio: 1.3,
    mppt_algorithm: 'P&O', power_limit_mode: 'fixed', ramp_rate_limit: 1.5,
    lvrt_enabled: 1, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 20, design_irradiance: 950, design_humidity_pct: 65, altitude_m: 200, soiling_factor: 0.05,
    modified_by: userId_engineer, change_summary: '华洋电站二期并网，额定容量从80MW扩容至100MW；结合现场清洁周期数据修正积灰系数0.06→0.05',
    created_at: '2026-04-05T11:30:00.000Z', updated_at: '2026-04-05T11:30:00.000Z',
  })

  // v3 — 短路比修正 + 爬坡率优化（当前活跃版本）
  await knex('station_model_params').insert({
    id: uuid(), root_id: m2_root, model_name: '中型山地集中式电站模型', version: 3, is_active: 1,
    rated_capacity_mw: 100, rated_voltage_kv: 110, power_factor: 0.93, efficiency_pct: 80.0, short_circuit_ratio: 1.3,
    mppt_algorithm: 'P&O', power_limit_mode: 'fixed', ramp_rate_limit: 1.5,
    lvrt_enabled: 1, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 20, design_irradiance: 950, design_humidity_pct: 65, altitude_m: 200, soiling_factor: 0.05,
    modified_by: userId_admin, change_summary: '短路比根据最新电网阻抗测量数据从1.2修正至1.3，爬坡率调整为1.5MW/min',
    created_at: '2026-05-20T09:00:00.000Z', updated_at: '2026-05-20T09:00:00.000Z',
  })

  // ============================================================
  // 模型3：小型分布式电站模型 (10kV级) — 2个版本
  // ============================================================
  const m3_root = uuid()

  // v1 — 初始创建
  await knex('station_model_params').insert({
    id: uuid(), root_id: m3_root, model_name: '小型分布式电站模型', version: 1, is_active: 0,
    rated_capacity_mw: 30, rated_voltage_kv: 10, power_factor: 0.90, efficiency_pct: 78.0, short_circuit_ratio: 1.1,
    mppt_algorithm: 'P&O', power_limit_mode: 'fixed', ramp_rate_limit: 0.5,
    lvrt_enabled: 0, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 25, design_irradiance: 900, design_humidity_pct: 75, altitude_m: 80, soiling_factor: 0.08,
    modified_by: userId_admin, change_summary: '初始创建（基于径山/萧山南阳/富阳渔山电站）',
    created_at: '2026-02-20T13:00:00.000Z', updated_at: '2026-02-20T13:00:00.000Z',
  })

  // v2 — 海拔修正 + 设计温度调整（当前活跃版本）
  await knex('station_model_params').insert({
    id: uuid(), root_id: m3_root, model_name: '小型分布式电站模型', version: 2, is_active: 1,
    rated_capacity_mw: 30, rated_voltage_kv: 10, power_factor: 0.90, efficiency_pct: 78.0, short_circuit_ratio: 1.1,
    mppt_algorithm: 'P&O', power_limit_mode: 'fixed', ramp_rate_limit: 0.5,
    lvrt_enabled: 0, hvrt_enabled: 0, island_protection: 1,
    design_temp_c: 25, design_irradiance: 900, design_humidity_pct: 75, altitude_m: 50, soiling_factor: 0.08,
    modified_by: userId_engineer, change_summary: '海拔从80m修正为50m（实地勘测复核），设计温度保持25°C不变',
    created_at: '2026-05-10T15:40:00.000Z', updated_at: '2026-05-10T15:40:00.000Z',
  })

  console.log('  ✓ 大型渔光互补电站模型 — 4个版本 (v1→v4)')
  console.log('  ✓ 中型山地集中式电站模型 — 3个版本 (v1→v3)')
  console.log('  ✓ 小型分布式电站模型 — 2个版本 (v1→v2)')

  // ============================================================
  // 9个实际电站各自专属模型（v1, is_active=1）
  // 每个电站一条记录，参数按电压等级分档 + 面板类型微调
  // ============================================================

  interface StationModelSeed {
    name: string
    capacityMw: number
    voltageKv: number
    pf: number
    efficiency: number
    scr: number
    mppt: string
    lvrt: number
    hvrt: number
    ramp: number
    designTemp: number
    designIrradiance: number
    humidity: number
    altitude: number
    soiling: number
  }

  const stationModels: StationModelSeed[] = [
    // ---- 220kV 级（钱塘变3站）----
    { name: '舒能渔光互补光伏项目',       capacityMw: 100, voltageKv: 220, pf: 0.93, efficiency: 78, scr: 1.5, mppt: 'P&O', lvrt: 1, hvrt: 0, ramp: 2.0, designTemp: 25, designIrradiance: 1000, humidity: 70, altitude: 5, soiling: 0.06 },
    { name: '嘉达渔光互补光伏项目',       capacityMw: 400, voltageKv: 220, pf: 0.95, efficiency: 82.5, scr: 1.5, mppt: 'INC', lvrt: 1, hvrt: 1, ramp: 3.0, designTemp: 25, designIrradiance: 1000, humidity: 70, altitude: 5, soiling: 0.03 },
    { name: '凌能渔光互补光伏项目',       capacityMw: 550, voltageKv: 220, pf: 0.95, efficiency: 83, scr: 1.5, mppt: 'INC', lvrt: 1, hvrt: 1, ramp: 3.0, designTemp: 25, designIrradiance: 1000, humidity: 70, altitude: 5, soiling: 0.03 },
    // ---- 110kV 级（建德/临安3站）----
    { name: '华洋山地光伏电站',           capacityMw: 155, voltageKv: 110, pf: 0.93, efficiency: 81, scr: 1.3, mppt: 'P&O', lvrt: 1, hvrt: 0, ramp: 1.5, designTemp: 20, designIrradiance: 950, humidity: 65, altitude: 200, soiling: 0.05 },
    { name: '临安青山集中式光伏电站',     capacityMw: 60, voltageKv: 110, pf: 0.93, efficiency: 78, scr: 1.3, mppt: 'P&O', lvrt: 1, hvrt: 0, ramp: 1.5, designTemp: 25, designIrradiance: 950, humidity: 65, altitude: 80, soiling: 0.07 },
    { name: '临安太湖源集中式光伏电站',   capacityMw: 40, voltageKv: 110, pf: 0.93, efficiency: 78, scr: 1.3, mppt: 'P&O', lvrt: 1, hvrt: 0, ramp: 1.5, designTemp: 25, designIrradiance: 950, humidity: 65, altitude: 80, soiling: 0.07 },
    // ---- 10kV 级（余杭/萧山/富阳3站）----
    { name: '径山镇宇航梦园渔光互补光伏项目', capacityMw: 5.44, voltageKv: 10, pf: 0.90, efficiency: 76, scr: 1.1, mppt: 'P&O', lvrt: 0, hvrt: 0, ramp: 0.5, designTemp: 25, designIrradiance: 900, humidity: 75, altitude: 80, soiling: 0.08 },
    { name: '萧山南阳集中式光伏电站',     capacityMw: 50, voltageKv: 10, pf: 0.90, efficiency: 79, scr: 1.1, mppt: 'P&O', lvrt: 0, hvrt: 0, ramp: 0.5, designTemp: 25, designIrradiance: 900, humidity: 75, altitude: 50, soiling: 0.07 },
    { name: '富阳渔山集中式光伏电站',     capacityMw: 30, voltageKv: 10, pf: 0.90, efficiency: 79, scr: 1.1, mppt: 'P&O', lvrt: 0, hvrt: 0, ramp: 0.5, designTemp: 25, designIrradiance: 900, humidity: 75, altitude: 50, soiling: 0.07 },
  ]

  for (const sm of stationModels) {
    await knex('station_model_params').insert({
      id: uuid(), root_id: uuid(), model_name: sm.name, version: 1, is_active: 1,
      rated_capacity_mw: sm.capacityMw, rated_voltage_kv: sm.voltageKv,
      power_factor: sm.pf, efficiency_pct: sm.efficiency, short_circuit_ratio: sm.scr,
      mppt_algorithm: sm.mppt, power_limit_mode: 'fixed', ramp_rate_limit: sm.ramp,
      lvrt_enabled: sm.lvrt, hvrt_enabled: sm.hvrt, island_protection: 1,
      design_temp_c: sm.designTemp, design_irradiance: sm.designIrradiance,
      design_humidity_pct: sm.humidity, altitude_m: sm.altitude, soiling_factor: sm.soiling,
      modified_by: '系统初始化', change_summary: '从实际电站数据生成专属模型',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
  }

  console.log('  ✓ 9个电站专属模型已创建')

  // 回填 solar_pv_stations.model_id
  for (const sm of stationModels) {
    const model = await knex('station_model_params')
      .where('model_name', sm.name).where('is_active', 1).first()
    if (!model) continue
    const station = await knex('solar_pv_stations')
      .where('station_name', sm.name).first()
    if (station) {
      await knex('solar_pv_stations').where('id', station.id).update({ model_id: model.id })
      console.log(`  ✓ ${sm.name} → model_id 已关联`)
    }
  }
}
