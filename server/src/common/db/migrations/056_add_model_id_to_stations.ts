import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF')
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.text('model_id')
  })
  await knex.raw('PRAGMA foreign_keys = ON')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF')
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.dropColumn('model_id')
  })
  await knex.raw('PRAGMA foreign_keys = ON')
}
