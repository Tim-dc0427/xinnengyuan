import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 创建负荷实体表
  await knex.schema.createTable('load_entities', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('load_type').notNullable().defaultTo('INDUSTRIAL')
    t.text('bus_id').references('id').inTable('grid_buses')
    t.text('voltage_level')
    t.float('peak_load_kw')
    t.float('annual_consumption_mwh')
    t.text('zone')
    t.text('address')
    t.float('longitude')
    t.float('latitude')
    t.text('status').defaultTo('active')
    t.text('description')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_le_bus ON load_entities(bus_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_le_type ON load_entities(load_type)')

  // 2. 创建储能实体表
  await knex.schema.createTable('storage_entities', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('storage_type').notNullable().defaultTo('BATTERY')
    t.text('bus_id').references('id').inTable('grid_buses')
    t.float('rated_power_kw')
    t.float('rated_capacity_kwh')
    t.float('efficiency_pct').defaultTo(90)
    t.text('charge_mode').defaultTo('PEAK_SHAVING')
    t.text('voltage_level')
    t.text('zone')
    t.float('longitude')
    t.float('latitude')
    t.text('status').defaultTo('active')
    t.text('description')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_se_bus ON storage_entities(bus_id)')

  // 3. 改造 resource_connection_attrs —— 从特定电站关联改为通用源/目标结构
  // 3a. 新增四列
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.text('source_node_type')
    t.text('source_node_id')
    t.text('target_node_type')
    t.text('target_node_id')
  })

  // 3b. 回填旧数据：solar_pv_station_id → source(SOURCE=plant_id), target(GRID=bus_id)
  await knex.raw(`
    UPDATE resource_connection_attrs SET
      source_node_type = 'SOURCE',
      source_node_id = (SELECT plant_id FROM solar_pv_stations WHERE solar_pv_stations.id = resource_connection_attrs.solar_pv_station_id),
      target_node_type = 'GRID',
      target_node_id = (SELECT bus_id FROM solar_pv_stations WHERE solar_pv_stations.id = resource_connection_attrs.solar_pv_station_id)
    WHERE solar_pv_station_id IS NOT NULL
  `)

  // 3c. 删除旧列和外键约束（SQLite 不直接支持 DROP CONSTRAINT，通过重建表实现）
  // 使用更简单的方式：直接 drop column（Knex + better-sqlite3 支持）
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.dropColumn('solar_pv_station_id')
  })

  // 3d. 复合索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_conn_source ON resource_connection_attrs(source_node_type, source_node_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_conn_target ON resource_connection_attrs(target_node_type, target_node_id)')
}

export async function down(knex: Knex): Promise<void> {
  // 还原 resource_connection_attrs
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.text('solar_pv_station_id')
  })
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.dropColumn('source_node_type')
    t.dropColumn('source_node_id')
    t.dropColumn('target_node_type')
    t.dropColumn('target_node_id')
  })
  await knex.schema.dropTableIfExists('storage_entities')
  await knex.schema.dropTableIfExists('load_entities')
}
