import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calc_tasks', (t) => {
    t.text('scene_type')
    t.integer('is_locked').defaultTo(0)
    t.text('data_source')
  })

  await knex.schema.alterTable('calc_results', (t) => {
    t.integer('is_locked').defaultTo(0)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calc_tasks', (t) => {
    t.dropColumn('scene_type')
    t.dropColumn('is_locked')
    t.dropColumn('data_source')
  })

  await knex.schema.alterTable('calc_results', (t) => {
    t.dropColumn('is_locked')
  })
}
