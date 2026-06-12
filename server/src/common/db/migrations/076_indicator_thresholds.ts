import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('indicator_thresholds', (t) => {
    t.text('id').primary()
    t.text('indicator_name').notNullable()
    t.text('indicator_label').notNullable()
    t.float('warning_threshold').notNullable()
    t.float('critical_threshold').notNullable()
    t.text('unit').notNullable().defaultTo('%')
    t.text('voltage_level')
    t.text('region')
    t.integer('enabled').notNullable().defaultTo(1)
    t.integer('is_custom').notNullable().defaultTo(0)
    t.text('created_at').notNullable()
    t.text('updated_at').notNullable()
    t.unique(['indicator_name', 'voltage_level', 'region'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('indicator_thresholds')
}
