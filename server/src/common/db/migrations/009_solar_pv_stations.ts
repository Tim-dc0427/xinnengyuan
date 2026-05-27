import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('solar_pv_stations', (t) => {
    t.text('id').primary()
    t.text('station_name').notNullable()
    t.text('bus_id').notNullable().references('id').inTable('grid_buses')
    t.text('plant_id').references('id').inTable('power_plants')
    t.float('installed_capacity_mw').notNullable()
    t.text('panel_type')
    t.float('inverter_capacity_mw')
    t.float('grid_connection_voltage_kv')
    t.float('longitude')
    t.float('latitude')
    t.text('address')
    t.text('status').defaultTo('active')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_spv_bus ON solar_pv_stations(bus_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_spv_plant ON solar_pv_stations(plant_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('solar_pv_stations')
}
