import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP TABLE IF EXISTS equipment_temperature')
  await knex.schema.createTable('equipment_temperature', (t) => {
    t.text('id').primary()
    t.text('equipment_id').notNullable().references('id').inTable('equipment')
    t.text('station_id')
    t.text('time').notNullable()
    t.float('temp_c').notNullable()
    t.text('voltage_status').notNullable()
    t.float('voltage_deviation_pct')
  })
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_et_equip_time ON equipment_temperature(equipment_id, time)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('equipment_temperature')
}
