import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 扩展 pv_model_params 表
  await knex.schema.alterTable('pv_model_params', (t) => {
    t.text('root_id')
    t.text('mppt_algorithm').defaultTo('P&O')
    t.float('power_limit_w')
    t.float('ramp_rate_w_per_min')
    t.float('temp_range_min_c').defaultTo(-40)
    t.float('temp_range_max_c').defaultTo(85)
    t.float('irradiance_range_min_wm2').defaultTo(0)
    t.float('irradiance_range_max_wm2').defaultTo(1200)
    t.float('humidity_range_min_pct').defaultTo(0)
    t.float('humidity_range_max_pct').defaultTo(100)
    t.text('modified_by')
    t.text('change_summary')
  })

  // 回填现有数据的 root_id = 自身 id
  await knex.schema.raw(`UPDATE pv_model_params SET root_id = id WHERE root_id IS NULL`)
  // 回填有默认值的字段，确保旧数据兼容
  await knex.schema.raw(`UPDATE pv_model_params SET mppt_algorithm = 'P&O' WHERE mppt_algorithm IS NULL`)
  await knex.schema.raw(`UPDATE pv_model_params SET temp_range_min_c = -40 WHERE temp_range_min_c IS NULL`)
  await knex.schema.raw(`UPDATE pv_model_params SET temp_range_max_c = 85 WHERE temp_range_max_c IS NULL`)
  await knex.schema.raw(`UPDATE pv_model_params SET irradiance_range_min_wm2 = 0 WHERE irradiance_range_min_wm2 IS NULL`)
  await knex.schema.raw(`UPDATE pv_model_params SET irradiance_range_max_wm2 = 1200 WHERE irradiance_range_max_wm2 IS NULL`)
  await knex.schema.raw(`UPDATE pv_model_params SET humidity_range_min_pct = 0 WHERE humidity_range_min_pct IS NULL`)
  await knex.schema.raw(`UPDATE pv_model_params SET humidity_range_max_pct = 100 WHERE humidity_range_max_pct IS NULL`)

  // 2. 出力曲线模板表
  await knex.schema.createTable('output_curve_templates', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('weather_type').notNullable()
    t.integer('is_preset').defaultTo(0)
    t.text('coefficients').notNullable()
    t.text('description')
    t.text('created_by')
    t.text('created_at')
    t.text('updated_at')
  })

  // 3. 置信系数设置表
  await knex.schema.createTable('confidence_coefficient_settings', (t) => {
    t.text('id').primary()
    t.text('name')
    t.float('confidence_level').notNullable()
    t.text('distribution_type').notNullable()
    t.text('pdf_params').notNullable()
    t.integer('is_active').defaultTo(1)
    t.text('description')
    t.text('created_by')
    t.text('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_model_params', (t) => {
    t.dropColumn('root_id')
    t.dropColumn('mppt_algorithm')
    t.dropColumn('power_limit_w')
    t.dropColumn('ramp_rate_w_per_min')
    t.dropColumn('temp_range_min_c')
    t.dropColumn('temp_range_max_c')
    t.dropColumn('irradiance_range_min_wm2')
    t.dropColumn('irradiance_range_max_wm2')
    t.dropColumn('humidity_range_min_pct')
    t.dropColumn('humidity_range_max_pct')
    t.dropColumn('modified_by')
    t.dropColumn('change_summary')
  })
  await knex.schema.dropTableIfExists('output_curve_templates')
  await knex.schema.dropTableIfExists('confidence_coefficient_settings')
}
