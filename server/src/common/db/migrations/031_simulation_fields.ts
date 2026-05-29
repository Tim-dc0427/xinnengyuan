import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scenario_simulations', (t) => {
    t.integer('step_interval_minutes').defaultTo(1)
    t.integer('speed_multiplier').defaultTo(1)
    t.integer('current_step').defaultTo(0)
    t.text('paused_params').nullable()
  })

  // 现有数据默认值
  await knex.raw(`
    UPDATE scenario_simulations
    SET step_interval_minutes = 1, speed_multiplier = 1, current_step = 0
    WHERE step_interval_minutes IS NULL
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scenario_simulations', (t) => {
    t.dropColumn('step_interval_minutes')
    t.dropColumn('speed_multiplier')
    t.dropColumn('current_step')
    t.dropColumn('paused_params')
  })
}
