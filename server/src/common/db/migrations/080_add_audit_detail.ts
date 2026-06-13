import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('audit_logs', (t) => {
    t.text('detail').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('audit_logs', (t) => {
    t.dropColumn('detail')
  })
}
