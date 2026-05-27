import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 电网拓扑：节点（母线）
  await knex.schema.createTable('grid_buses', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('zone').notNullable()
    t.text('voltage_level').notNullable()
    t.float('base_kv').notNullable()
    t.text('bus_type').notNullable()       // slack / pv / pq
    t.text('remark')
  })
  await knex.raw('CREATE INDEX idx_bus_zone ON grid_buses(zone)')
  await knex.raw('CREATE INDEX idx_bus_voltage ON grid_buses(voltage_level)')

  // 电网拓扑：支路（线路+变压器）
  await knex.schema.createTable('grid_branches', (t) => {
    t.text('id').primary()
    t.text('from_bus_id').notNullable().references('id').inTable('grid_buses')
    t.text('to_bus_id').notNullable().references('id').inTable('grid_buses')
    t.text('zone')
    t.text('voltage_level')
    t.text('branch_type').defaultTo('LINE')   // LINE / TRANSFORMER
    t.float('r_ohm')
    t.float('x_ohm')
    t.float('b_uf')
    t.float('tap_ratio')
    t.text('remark')
  })

  // 电网拓扑：发电机/等值电源
  await knex.schema.createTable('grid_generators', (t) => {
    t.text('id').primary()
    t.text('bus_id').notNullable().references('id').inTable('grid_buses')
    t.float('pg_mw')
    t.float('vg_kv')
    t.float('qmax_mvar')
    t.float('qmin_mvar')
    t.text('remark')
  })

  // 电网拓扑：负荷
  await knex.schema.createTable('grid_loads', (t) => {
    t.text('id').primary()
    t.text('bus_id').notNullable().references('id').inTable('grid_buses')
    t.float('pd_mw')
    t.float('qd_mvar')
    t.text('remark')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('grid_loads')
  await knex.schema.dropTableIfExists('grid_generators')
  await knex.schema.dropTableIfExists('grid_branches')
  await knex.schema.dropTableIfExists('grid_buses')
}
