import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw('ALTER TABLE outage_events ADD COLUMN duration_seconds INTEGER')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('ALTER TABLE outage_events DROP COLUMN duration_seconds')
}
