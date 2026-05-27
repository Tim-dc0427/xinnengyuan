import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('power_plants', (t) => {
    t.integer('version').defaultTo(1)
    t.text('updated_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('power_plants', (t) => {
    t.dropColumn('version')
    t.dropColumn('updated_at')
  })
}
