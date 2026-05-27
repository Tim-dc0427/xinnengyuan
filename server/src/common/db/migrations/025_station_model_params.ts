import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 集中式光伏电站模型参数表
  await knex.schema.createTable('station_model_params', (t) => {
    t.text('id').primary()
    t.text('root_id')
    t.text('model_name').notNullable()
    t.integer('version').defaultTo(1)
    t.integer('is_active').defaultTo(1)

    // 电气参数
    t.float('rated_capacity_mw')
    t.float('rated_voltage_kv')
    t.float('power_factor')
    t.float('efficiency_pct')
    t.float('short_circuit_ratio')

    // 控制参数
    t.text('mppt_algorithm').defaultTo('P&O')
    t.text('power_limit_mode')
    t.float('ramp_rate_limit')
    t.integer('lvrt_enabled').defaultTo(1)
    t.integer('hvrt_enabled').defaultTo(0)
    t.integer('island_protection').defaultTo(1)

    // 环境参数
    t.float('design_temp_c')
    t.float('design_irradiance')
    t.float('design_humidity_pct')
    t.float('altitude_m')
    t.float('soiling_factor')

    // 审计字段
    t.text('modified_by')
    t.text('change_summary')
    t.text('created_at')
    t.text('updated_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_smp_root ON station_model_params(root_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_smp_active ON station_model_params(is_active)')

  // 2. 出力曲线模板 — 加版本控制字段
  await knex.schema.alterTable('output_curve_templates', (t) => {
    t.text('root_id')
    t.integer('version').defaultTo(1)
    t.integer('is_active').defaultTo(1)
    t.text('modified_by')
    t.text('change_summary')
  })
  await knex.raw(`UPDATE output_curve_templates SET root_id = id WHERE root_id IS NULL`)

  // 3. 置信系数设置 — 加版本控制字段
  await knex.schema.alterTable('confidence_coefficient_settings', (t) => {
    t.text('root_id')
    t.integer('version').defaultTo(1)
    t.text('modified_by')
    t.text('change_summary')
  })
  await knex.raw(`UPDATE confidence_coefficient_settings SET root_id = id WHERE root_id IS NULL`)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('station_model_params')

  await knex.schema.alterTable('output_curve_templates', (t) => {
    t.dropColumn('root_id')
    t.dropColumn('version')
    t.dropColumn('is_active')
    t.dropColumn('modified_by')
    t.dropColumn('change_summary')
  })

  await knex.schema.alterTable('confidence_coefficient_settings', (t) => {
    t.dropColumn('root_id')
    t.dropColumn('version')
    t.dropColumn('modified_by')
    t.dropColumn('change_summary')
  })
}
