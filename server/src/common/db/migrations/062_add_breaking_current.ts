import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    // 额定开断电流 (kA) — 开关设备/断路器能安全分断的最大短路电流有效值
    table.float('rated_breaking_current_ka')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.dropColumn('rated_breaking_current_ka')
  })
}
