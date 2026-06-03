import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('batch_calc_groups', (t) => {
    t.text('error_message')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('batch_calc_groups', (t) => {
    t.dropColumn('error_message')
  })
}
