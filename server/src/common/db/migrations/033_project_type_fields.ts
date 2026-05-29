import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('project_types', (t) => {
    t.text('id').primary()
    t.text('name').unique().notNullable()
    t.text('code').unique().notNullable()
    t.text('description')
    t.integer('sort_order').defaultTo(0)
    t.text('created_at')
  })

  await knex.schema.createTable('project_type_fields', (t) => {
    t.text('id').primary()
    t.text('type_id').references('id').inTable('project_types').notNullable()
    t.text('field_code').notNullable()
    t.text('field_name').notNullable()
    t.text('field_type').notNullable().defaultTo('text')
    t.text('field_options')
    t.integer('is_required').defaultTo(0)
    t.integer('sort_order').defaultTo(0)
    t.text('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_type_fields')
  await knex.schema.dropTableIfExists('project_types')
}
