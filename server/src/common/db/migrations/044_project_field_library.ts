import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('project_field_library', (t) => {
    t.text('id').primary()
    t.text('field_code').unique().notNullable()
    t.text('field_name').notNullable()
    t.text('field_type').notNullable().defaultTo('text')
    t.text('field_options')
    t.text('category').defaultTo('项目基础信息')
    t.text('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_field_library')
}
