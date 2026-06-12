import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('three_phase_snapshots', (t) => {
    t.text('id').primary()
    t.text('bus_id').notNullable()
    t.text('recorded_at').notNullable()
    t.float('imbalance_pct').notNullable().defaultTo(0)
    t.float('vuf')
    t.float('cuf')
    t.float('phase_a_kv')
    t.float('phase_b_kv')
    t.float('phase_c_kv')
    t.float('phase_a_current')
    t.float('phase_b_current')
    t.float('phase_c_current')
    t.text('zone')
    t.text('voltage_level')
    t.text('physical_role').defaultTo('SUBSTATION')
    t.integer('pv_related').defaultTo(0)
    t.text('plant_name')
  })
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_tps_bus_time ON three_phase_snapshots(bus_id, recorded_at)')
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_tps_time ON three_phase_snapshots(recorded_at)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('three_phase_snapshots')
}
