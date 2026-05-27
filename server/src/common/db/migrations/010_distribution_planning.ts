import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 集中式光伏电站
  await knex.schema.createTable('pv_stations', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.float('capacity_kw').notNullable()
    t.text('panel_type')
    t.float('rated_voltage_kv')
    t.float('longitude')
    t.float('latitude')
    t.text('land_type')
    t.float('land_area_mu')
    t.json('electrical_params')
    t.json('equipment_list')
    t.text('status').defaultTo('planning')
    t.text('plan_id')
    t.text('created_at')
    t.text('updated_at')
  })

  // 设备综合造价库
  await knex.schema.createTable('pv_cost_library', (t) => {
    t.text('id').primary()
    t.text('model_name').notNullable()
    t.text('model_type')
    t.text('manufacturer')
    t.float('unit_cost_per_kw')
    t.float('rated_power_kw')
    t.float('efficiency_pct')
    t.float('lifespan_years')
    t.json('technical_params')
    t.text('remark')
    t.text('created_at')
  })

  // 布点约束规则
  await knex.schema.createTable('constraint_rules', (t) => {
    t.text('id').primary()
    t.text('rule_name').notNullable()
    t.text('rule_type').notNullable()
    t.float('weight').defaultTo(1.0)
    t.boolean('enabled').defaultTo(true)
    t.json('params')
    t.text('description')
    t.text('plan_id')
    t.text('created_at')
    t.text('updated_at')
  })

  // 候选接入点
  await knex.schema.createTable('candidate_points', (t) => {
    t.text('id').primary()
    t.text('plan_id')
    t.text('station_id')
    t.float('longitude')
    t.float('latitude')
    t.text('location_desc')
    t.float('recommended_capacity_kw')
    t.float('comprehensive_score')
    t.json('scores')
    t.float('absorption_capacity_kw')
    t.float('transmission_line_length_km')
    t.float('transmission_cost')
    t.float('land_cost')
    t.text('constraint_description')
    t.integer('priority').defaultTo(0)
    t.text('status').defaultTo('pending')
    t.text('created_at')
    t.text('updated_at')
  })

  // 消纳方案详情
  await knex.schema.createTable('absorption_plans', (t) => {
    t.text('id').primary()
    t.text('scheme_id')
    t.text('plan_name').notNullable()
    t.text('candidate_point_id')
    t.json('storage_config')
    t.json('reactive_comp_config')
    t.json('line_modification')
    t.json('pv_output_profile')
    t.json('load_profile')
    t.float('absorption_capacity_kw')
    t.float('investment_cost')
    t.float('annual_benefit')
    t.json('parameters')
    t.text('status').defaultTo('draft')
    t.text('created_at')
    t.text('updated_at')
  })

  // 单位造价参数
  await knex.schema.createTable('unit_cost_params', (t) => {
    t.text('id').primary()
    t.text('category').notNullable()
    t.text('item_name').notNullable()
    t.float('unit_cost').notNullable()
    t.text('unit')
    t.text('cost_type')
    t.text('effective_date')
    t.text('remark')
    t.text('created_at')
    t.text('updated_at')
  })

  // 造价对比记录
  await knex.schema.createTable('cost_comparison_records', (t) => {
    t.text('id').primary()
    t.text('plan_id')
    t.json('pv_cost_data')
    t.json('traditional_cost_data')
    t.json('comparison_result')
    t.text('created_at')
  })

  // 设备全生命周期记录
  await knex.schema.createTable('equipment_lifecycle_records', (t) => {
    t.text('id').primary()
    t.text('equipment_id').notNullable()
    t.text('event_type').notNullable()
    t.text('event_type_label')
    t.text('event_time')
    t.text('operator')
    t.text('description')
    t.json('attachments')
    t.json('event_data')
    t.text('created_at')
  })

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pv_stations_plan ON pv_stations(plan_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_candidate_points_plan ON candidate_points(plan_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_absorption_plans_scheme ON absorption_plans(scheme_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_lifecycle_records_equipment ON equipment_lifecycle_records(equipment_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('equipment_lifecycle_records')
  await knex.schema.dropTableIfExists('cost_comparison_records')
  await knex.schema.dropTableIfExists('unit_cost_params')
  await knex.schema.dropTableIfExists('absorption_plans')
  await knex.schema.dropTableIfExists('candidate_points')
  await knex.schema.dropTableIfExists('constraint_rules')
  await knex.schema.dropTableIfExists('pv_cost_library')
  await knex.schema.dropTableIfExists('pv_stations')
}
