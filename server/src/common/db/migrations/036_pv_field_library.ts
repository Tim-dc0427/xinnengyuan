import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pv_field_library', (t) => {
    t.text('id').primary()
    t.text('field_code').unique().notNullable()
    t.text('field_name').notNullable()
    t.text('field_type').notNullable().defaultTo('text')
    t.text('field_options')
    t.text('created_at')
  })

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_field_library_code ON pv_field_library(field_code)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pv_field_library')
}
