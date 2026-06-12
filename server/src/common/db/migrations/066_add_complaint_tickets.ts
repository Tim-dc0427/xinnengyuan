import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('complaint_tickets', (t) => {
    t.text('id').primary()
    t.text('ticket_no').notNullable().unique()
    t.text('station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.text('industry').notNullable()
    t.text('issue_desc')
    t.integer('is_voltage_related').notNullable().defaultTo(0)
    t.text('voltage_issue_type')
    t.float('loss_estimate_wan').defaultTo(0)
    t.text('status').defaultTo('已处理')
    t.text('reported_at')
    t.text('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('complaint_tickets')
}
