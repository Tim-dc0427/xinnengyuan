import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('access_point_resources', (t) => {
    t.text('id').primary()
    t.text('source_type').notNullable()
    t.text('source_id').notNullable()
    t.text('name').notNullable()
    t.text('zone')
    // 光伏资源
    t.float('annual_irradiance')
    t.float('sunshine_hours')
    t.text('solar_grade')
    // 电网条件
    t.float('voltage_kv')
    t.float('short_circuit_capacity_mva')
    t.text('corridor_available')
    t.float('transmission_line_length_km')
    // 投资条件
    t.float('unit_cost')
    t.float('payback_years')
    t.float('irr_pct')
    // 环境条件
    t.text('land_type')
    t.text('env_sensitivity')
    t.text('geohazard_risk')
    // 元数据
    t.text('created_at')
    t.text('updated_at')
    t.unique(['source_type', 'source_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('access_point_resources')
}
