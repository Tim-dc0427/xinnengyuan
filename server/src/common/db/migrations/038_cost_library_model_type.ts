import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_cost_library', (t) => {
    t.text('model_type_id').references('id').inTable('pv_model_types')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_cost_library', (t) => {
    t.dropColumn('model_type_id')
  })
}
