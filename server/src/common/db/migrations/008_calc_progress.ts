import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calc_tasks', (t) => {
    t.text('progress_message')
    t.text('checkpoint_data')
    t.integer('eta_ms')
  })

  await knex.schema.createTable('calc_checkpoints', (t) => {
    t.text('id').primary()
    t.text('task_id').notNullable().references('id').inTable('calc_tasks').onDelete('CASCADE')
    t.integer('iteration').notNullable()
    t.text('checkpoint_data').notNullable()
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_checkpoint_task ON calc_checkpoints(task_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('calc_checkpoints')
  await knex.schema.alterTable('calc_tasks', (t) => {
    t.dropColumn('progress_message')
    t.dropColumn('checkpoint_data')
    t.dropColumn('eta_ms')
  })
}
