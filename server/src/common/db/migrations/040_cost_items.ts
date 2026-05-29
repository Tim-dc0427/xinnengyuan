import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cost_items', (t) => {
    t.text('id').primary()
    t.text('item_code').unique().notNullable()
    t.text('category').notNullable()
    t.text('sub_category')
    t.text('equipment_type')
    t.text('model_spec')
    t.text('item_name').notNullable()
    t.float('unit_price').notNullable()
    t.text('cost_unit').notNullable()
    t.text('created_at')
    t.text('updated_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cost_items')
}
