import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_output_measurements', (t) => {
    t.float('confidence_pct').defaultTo(100)
    t.text('expected_weather').defaultTo('晴')
    t.text('actual_weather').defaultTo('晴')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_output_measurements', (t) => {
    t.dropColumn('confidence_pct')
    t.dropColumn('expected_weather')
    t.dropColumn('actual_weather')
  })
}
