import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 集中式光伏电站版本历史表 — 对应 solar_pv_stations
  await knex.schema.createTable('station_versions', (t) => {
    t.text('id').primary()
    t.text('station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.integer('version').notNullable()
    t.text('station_name')
    t.float('installed_capacity_mw')
    t.text('installed_date')
    t.float('longitude')
    t.float('latitude')
    t.text('address')
    t.text('status')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_station_ver ON station_versions(station_id, version)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('station_versions')
}
