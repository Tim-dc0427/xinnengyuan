import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pv_model_params')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable('pv_model_params', (t) => {
    t.text('id').primary()
    t.text('model_name')
    t.integer('version').defaultTo(1)
    t.text('manufacturer')
    t.text('panel_type')
    t.float('max_power_w')
    t.float('voc_v')
    t.float('isc_a')
    t.float('vmp_v')
    t.float('imp_a')
    t.float('temp_coefficient_pct_per_c')
    t.float('degradation_rate_pct_per_year')
    t.float('efficiency_pct')
    t.integer('is_active').defaultTo(1)
    t.text('created_at')
  })
}
