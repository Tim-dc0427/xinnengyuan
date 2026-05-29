import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plans', (t) => {
    t.text('tech_route')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plans', (t) => {
    t.dropColumn('tech_route')
  })
}
