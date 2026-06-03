import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('outage_events', (t) => {
    t.text('id').primary()
    t.text('station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.text('start_time').notNullable()
    t.text('end_time')
    t.integer('duration_minutes')
    t.text('cause').notNullable()
    t.text('affected_equipment_id')
    t.text('description')
    t.text('created_at')
  })

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_outage_station ON outage_events(station_id)')
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_outage_time ON outage_events(start_time)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('outage_events')
}
