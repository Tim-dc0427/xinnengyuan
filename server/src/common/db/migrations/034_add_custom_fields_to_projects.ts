import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.text('custom_fields').defaultTo('{}')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('custom_fields')
  })
}
