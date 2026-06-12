import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_model_type_fields', (t) => {
    t.text('category').defaultTo('基础信息')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_model_type_fields', (t) => {
    t.dropColumn('category')
  })
}
