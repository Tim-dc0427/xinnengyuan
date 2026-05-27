import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('battery_cycle_records', (table) => {
    table.string('id').primary()
    table.string('equipment_id').notNullable().references('id').inTable('equipment')
    table.string('record_month').notNullable()       // YYYY-MM 格式
    table.integer('cycle_count').notNullable()        // 当月充放电循环次数
    table.float('avg_dod_pct').notNullable()          // 平均放电深度 %
    table.float('max_temp_c')                         // 最高温度 °C
    table.float('avg_temp_c')                         // 平均温度 °C
    table.float('soh_pct').notNullable()              // 月末健康度 SOH %
    table.integer('cumulative_cycles').notNullable()  // 累计循环次数
    table.float('cumulative_energy_mwh')              // 累计吞吐电量 MWh
    table.string('created_at')
  })
  await knex.schema.raw('CREATE INDEX idx_bcr_equipment ON battery_cycle_records(equipment_id)')
  await knex.schema.raw('CREATE INDEX idx_bcr_month ON battery_cycle_records(record_month)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('battery_cycle_records')
}
