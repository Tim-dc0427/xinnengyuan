import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_buses', (t) => {
    t.text('physical_role').notNullable().defaultTo('SUBSTATION')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_buses', (t) => {
    t.dropColumn('physical_role')
  })
}
