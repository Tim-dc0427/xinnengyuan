import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('project_documents', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.text('doc_name').notNullable()
    t.text('doc_type').notNullable().defaultTo('其他')
    t.text('file_path').notNullable()
    t.integer('file_size').defaultTo(0)
    t.text('uploaded_at').notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_documents')
}
