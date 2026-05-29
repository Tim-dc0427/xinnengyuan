import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scenario_interventions', (t) => {
    t.text('params_before').nullable()
    t.text('params_after').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scenario_interventions', (t) => {
    t.dropColumn('params_before')
    t.dropColumn('params_after')
  })
}
