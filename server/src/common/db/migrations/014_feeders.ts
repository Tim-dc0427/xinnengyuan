import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feeders', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('substation_name')        // 所属变电站
    t.text('voltage_level')           // 电压等级，如 10kV
    t.text('zone')                    // 区域
  })

  await knex.schema.createTable('feeder_buses', (t) => {
    t.text('feeder_id').notNullable().references('id').inTable('feeders')
    t.text('bus_id').notNullable().references('id').inTable('grid_buses')
    t.primary(['feeder_id', 'bus_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('feeder_buses')
  await knex.schema.dropTableIfExists('feeders')
}
