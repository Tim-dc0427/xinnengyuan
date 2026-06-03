import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.text('metadata')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.dropColumn('metadata')
  })
}
