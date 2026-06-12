import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.float('failure_rate').nullable()  // 年故障率（次/年），参照 IEEE Std 493
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.dropColumn('failure_rate')
  })
}
