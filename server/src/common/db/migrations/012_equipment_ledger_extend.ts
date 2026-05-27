import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Add station-specific columns to equipment_ledger
  await knex.schema.alterTable('equipment_ledger', (t) => {
    t.text('station_id').nullable()
    t.text('equipment_code').nullable()
    t.text('model_number').nullable()
    t.text('manufacturer').nullable()
    t.text('install_date').nullable()
    t.text('status').defaultTo('installed')
    t.text('location_desc').nullable()
    t.json('rated_params').nullable()
    t.text('equipment_type_label').nullable()
    t.text('created_at').nullable()
    t.text('updated_at').nullable()
  })

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_el_station ON equipment_ledger(station_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment_ledger', (t) => {
    t.dropColumn('station_id')
    t.dropColumn('equipment_code')
    t.dropColumn('model_number')
    t.dropColumn('manufacturer')
    t.dropColumn('install_date')
    t.dropColumn('status')
    t.dropColumn('location_desc')
    t.dropColumn('rated_params')
    t.dropColumn('equipment_type_label')
    t.dropColumn('created_at')
    t.dropColumn('updated_at')
  })
}
