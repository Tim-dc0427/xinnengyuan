import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.string('name')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.dropColumn('name')
  })
}
