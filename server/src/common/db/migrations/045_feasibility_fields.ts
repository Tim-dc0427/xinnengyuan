import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feasibility_assessments', (t) => {
    t.text('evaluation_params')
    t.text('weights')
    t.text('access_point_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feasibility_assessments', (t) => {
    t.dropColumn('access_point_id')
    t.dropColumn('weights')
    t.dropColumn('evaluation_params')
  })
}
