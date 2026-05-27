import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('batch_calc_groups', (t) => {
    t.text('calc_type').defaultTo('STANDARD')
    t.text('selected_bus_ids')
    t.text('selected_branch_ids')
    t.integer('failed_tasks').defaultTo(0)
    t.text('result_summary')
    t.text('updated_at')
  })

  await knex.schema.createTable('batch_group_items', (t) => {
    t.text('id').primary()
    t.text('group_id').notNullable().references('id').inTable('batch_calc_groups').onDelete('CASCADE')
    t.text('task_id').notNullable().references('id').inTable('calc_tasks')
    t.text('item_label')
    t.text('item_type')
    t.text('bus_id')
    t.text('branch_id')
    t.text('feeder_id')
    t.integer('idx').defaultTo(0)
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_batch_group_items_group ON batch_group_items(group_id)')

  await knex.schema.createTable('batch_anomaly_items', (t) => {
    t.text('id').primary()
    t.text('group_id').notNullable().references('id').inTable('batch_calc_groups').onDelete('CASCADE')
    t.text('task_id')
    t.text('bus_id')
    t.text('equipment_name')
    t.text('anomaly_type').notNullable()
    t.text('severity').defaultTo('warning')
    t.text('current_value')
    t.text('threshold_value')
    t.text('description')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_batch_anomaly_group ON batch_anomaly_items(group_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('batch_anomaly_items')
  await knex.schema.dropTableIfExists('batch_group_items')
  await knex.schema.alterTable('batch_calc_groups', (t) => {
    t.dropColumn('calc_type')
    t.dropColumn('selected_bus_ids')
    t.dropColumn('selected_branch_ids')
    t.dropColumn('failed_tasks')
    t.dropColumn('result_summary')
    t.dropColumn('updated_at')
  })
}
