import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('project_type_fields', (t) => {
    t.text('category').defaultTo('项目基础信息')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('project_type_fields', (t) => {
    t.dropColumn('category')
  })
}
