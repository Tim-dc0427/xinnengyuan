import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('load_measurements', (t) => {
    t.text('id').primary()
    t.text('time').notNullable()
    t.text('bus_id').notNullable().references('id').inTable('grid_buses')
    t.float('active_power_mw')
    t.float('reactive_power_mvar')
    t.text('data_type').defaultTo('actual')    // actual / forecast
    t.float('temperature_c')
    t.float('humidity_pct')
    t.text('remark')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_load_bus_time ON load_measurements(bus_id, time)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('load_measurements')
}
