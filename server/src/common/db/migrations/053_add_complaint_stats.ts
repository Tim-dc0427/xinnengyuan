import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('complaint_stats', (t) => {
    t.text('id').primary()
    t.text('station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.text('industry').notNullable()
    t.integer('complaints').notNullable().defaultTo(0)
    t.float('loss_estimate_wan').defaultTo(0)
    t.text('main_issue')
    t.text('period').notNullable()
    t.text('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('complaint_stats')
}
