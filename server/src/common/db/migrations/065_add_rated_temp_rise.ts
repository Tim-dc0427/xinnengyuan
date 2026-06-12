import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.float('rated_temp_rise_c').nullable()  // 额定温升阈值(°C)，电压事件期间允许的最大温升
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.dropColumn('rated_temp_rise_c')
  })
}
