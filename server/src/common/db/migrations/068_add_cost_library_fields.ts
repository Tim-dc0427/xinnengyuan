import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_cost_library', (t) => {
    t.float('installed_capacity_kw')
    t.float('comprehensive_cost')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_cost_library', (t) => {
    t.dropColumn('comprehensive_cost')
    t.dropColumn('installed_capacity_kw')
  })
}
