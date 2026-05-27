import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.text('edge_type').defaultTo('PHYSICAL')
  })
  // 存量数据默认填 PHYSICAL
  await knex('resource_connection_attrs').whereNull('edge_type').update('edge_type', 'PHYSICAL')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.dropColumn('edge_type')
  })
}
