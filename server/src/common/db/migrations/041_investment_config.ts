import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('investment_config', (t) => {
    t.text('id').primary()
    t.text('plan_id').references('id').inTable('plans')
    t.text('cost_item_id').references('id').inTable('cost_items').notNullable()
    t.integer('quantity').notNullable().defaultTo(1)
    t.float('unit_price').notNullable()
    t.text('created_at')
    t.text('updated_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('investment_config')
}
