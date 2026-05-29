import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // ==================== solar_pv_stations：补充规划字段 ====================
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.text('land_type')
    t.float('land_area_mu')
    t.text('electrical_params')
  })

  // ==================== pv_stations：补充实际电站字段 ====================
  await knex.schema.alterTable('pv_stations', (t) => {
    t.text('address')
    t.text('installed_date')
    t.float('inverter_capacity_mw')
    t.text('phase_connection')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.dropColumn('land_type')
    t.dropColumn('land_area_mu')
    t.dropColumn('electrical_params')
  })

  await knex.schema.alterTable('pv_stations', (t) => {
    t.dropColumn('address')
    t.dropColumn('installed_date')
    t.dropColumn('inverter_capacity_mw')
    t.dropColumn('phase_connection')
  })
}
