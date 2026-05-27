import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('resource_connection_attrs', (t) => {
    t.text('id').primary()
    t.text('solar_pv_station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.text('flow_direction').notNullable().defaultTo('FORWARD')   // FORWARD / REVERSE / BIDIRECTIONAL
    t.float('max_capacity_kw')                                     // 最大输送容量
    t.text('control_logic')                                        // 控制策略 JSON
    t.text('status').defaultTo('active')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_rca_spv ON resource_connection_attrs(solar_pv_station_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('resource_connection_attrs')
}
