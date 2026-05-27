import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_buses', (t) => {
    t.float('longitude')
    t.float('latitude')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_buses', (t) => {
    t.dropColumn('longitude')
    t.dropColumn('latitude')
  })
}
