import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('assessment_model_fields', (t) => {
    t.text('id').primary()
    t.text('field_code').notNullable()
    t.text('field_name').notNullable()
    t.text('field_desc')
    t.text('field_type').notNullable().defaultTo('numeric')
    t.text('dimension').notNullable()
    t.float('base_value')
    t.text('score_rule').notNullable().defaultTo('direct_ratio')
    t.text('text_map')
    t.text('match_value')
    t.float('max_score').defaultTo(100)
    t.float('fail_score').defaultTo(0)
    t.integer('sort_order').notNullable().defaultTo(0)
    t.integer('is_active').notNullable().defaultTo(1)
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_model_field_code ON assessment_model_fields(field_code) WHERE is_active = 1',
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('assessment_model_fields')
}
