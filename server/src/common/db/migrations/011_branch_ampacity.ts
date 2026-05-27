import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_branches', (t) => {
    t.float('ampacity_mva')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_branches', (t) => {
    t.dropColumn('ampacity_mva')
  })
}
