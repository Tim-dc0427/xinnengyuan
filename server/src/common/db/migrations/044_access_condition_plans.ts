import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('access_condition_plans', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('plan_type').notNullable().defaultTo('normal')
    t.text('conditions').notNullable()
    t.text('created_at')
    t.text('updated_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('access_condition_plans')
}
