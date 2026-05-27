import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // grid_loads: 分相负荷
  await knex.schema.alterTable('grid_loads', (t) => {
    t.float('pd_a_mw')
    t.float('pd_b_mw')
    t.float('pd_c_mw')
    t.float('qd_a_mvar')
    t.float('qd_b_mvar')
    t.float('qd_c_mvar')
  })

  // grid_generators: 分相发电
  await knex.schema.alterTable('grid_generators', (t) => {
    t.float('pg_a_mw')
    t.float('pg_b_mw')
    t.float('pg_c_mw')
  })

  // grid_branches: 零序参数
  await knex.schema.alterTable('grid_branches', (t) => {
    t.float('r0_ohm')
    t.float('x0_ohm')
    t.float('b0_uf')
  })

  // solar_pv_stations: 接入相别
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.text('phase_connection').defaultTo('three_phase')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('grid_loads', (t) => {
    t.dropColumn('pd_a_mw')
    t.dropColumn('pd_b_mw')
    t.dropColumn('pd_c_mw')
    t.dropColumn('qd_a_mvar')
    t.dropColumn('qd_b_mvar')
    t.dropColumn('qd_c_mvar')
  })
  await knex.schema.alterTable('grid_generators', (t) => {
    t.dropColumn('pg_a_mw')
    t.dropColumn('pg_b_mw')
    t.dropColumn('pg_c_mw')
  })
  await knex.schema.alterTable('grid_branches', (t) => {
    t.dropColumn('r0_ohm')
    t.dropColumn('x0_ohm')
    t.dropColumn('b0_uf')
  })
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.dropColumn('phase_connection')
  })
}
