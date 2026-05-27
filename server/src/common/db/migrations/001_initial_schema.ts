import type { Knex } from 'knex'

const now = "cast((julianday('now') - 2440587.5) * 86400000 as integer)"

export async function up(knex: Knex): Promise<void> {
  // ==================== Core Tables ====================
  await knex.schema.createTable('roles', (t) => {
    t.text('id').primary()
    t.text('name').notNullable().unique()
    t.text('permissions').notNullable().defaultTo('[]')
    t.text('created_at')
  })

  await knex.schema.createTable('users', (t) => {
    t.text('id').primary()
    t.text('username').notNullable().unique()
    t.text('password_hash').notNullable()
    t.text('display_name').notNullable()
    t.text('role_id').references('id').inTable('roles')
    t.text('department')
    t.integer('is_active').defaultTo(1)
    t.text('last_login_at')
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary()
    t.text('user_id')
    t.text('action').notNullable()
    t.text('resource_type').notNullable()
    t.text('resource_id')
    t.text('old_value')
    t.text('new_value')
    t.text('ip_address')
    t.text('user_agent')
    t.text('created_at')
  })

  // ==================== Grid Diagnosis Tables ====================
  await knex.schema.createTable('power_plants', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('plant_type').notNullable()
    t.float('capacity_kw').notNullable()
    t.text('installed_date')
    t.float('longitude')
    t.float('latitude')
    t.text('address')
    t.text('status').defaultTo('active')
    t.text('metadata')
    t.text('created_at')
  })

  await knex.schema.createTable('pv_output_measurements', (t) => {
    t.text('id').primary()
    t.text('time').notNullable()
    t.text('plant_id').notNullable()
    t.float('active_power_kw')
    t.float('reactive_power_kvar')
    t.float('voltage_v')
    t.float('current_a')
    t.float('frequency_hz')
    t.float('power_factor')
    t.float('temperature_c')
    t.float('irradiance_wm2')
    t.float('humidity_pct')
    t.float('inverter_efficiency')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pv_plant_time ON pv_output_measurements(plant_id, time)')

  await knex.schema.createTable('equipment', (t) => {
    t.text('id').primary()
    t.text('plant_id').references('id').inTable('power_plants')
    t.text('equipment_type').notNullable()
    t.text('model_number')
    t.text('manufacturer')
    t.float('rated_capacity_kva')
    t.float('rated_voltage_kv')
    t.float('rated_current_a')
    t.text('installation_date')
    t.integer('design_life_years')
    t.float('longitude')
    t.float('latitude')
    t.text('parent_equipment_id')
    t.text('grade')
    t.text('status').defaultTo('operational')
    t.text('metadata')
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.schema.createTable('equipment_lifecycle', (t) => {
    t.text('id').primary()
    t.text('equipment_id').references('id').inTable('equipment').notNullable()
    t.text('event_type').notNullable()
    t.text('event_date').notNullable()
    t.text('description')
    t.float('cost')
    t.text('performed_by')
    t.float('remaining_life_years')
    t.text('next_maintenance_date')
    t.text('created_at')
  })

  await knex.schema.createTable('voltage_measurements', (t) => {
    t.text('id').primary()
    t.text('time').notNullable()
    t.text('equipment_id').notNullable()
    t.float('phase_a_v')
    t.float('phase_b_v')
    t.float('phase_c_v')
    t.float('voltage_deviation_pct')
    t.float('flicker_severity')
    t.float('thd_pct')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_voltage_equip_time ON voltage_measurements(equipment_id, time)')

  await knex.schema.createTable('alerts', (t) => {
    t.text('id').primary()
    t.text('alert_level').notNullable()
    t.text('source_type').notNullable()
    t.text('source_id').notNullable()
    t.text('title').notNullable()
    t.text('message')
    t.text('triggered_at')
    t.text('acknowledged_by')
    t.text('acknowledged_at')
    t.text('resolved_at')
    t.text('metadata')
  })

  await knex.schema.createTable('carbon_emissions', (t) => {
    t.text('id').primary()
    t.text('plant_id').references('id').inTable('power_plants').notNullable()
    t.text('period_type').notNullable()
    t.text('period_start').notNullable()
    t.float('total_output_kwh')
    t.float('co2_reduction_kg')
    t.float('coal_saving_ton')
    t.float('so2_reduction_kg')
    t.float('nox_reduction_kg')
  })

  // ==================== Planning Tables ====================
  await knex.schema.createTable('plans', (t) => {
    t.text('id').primary()
    t.text('plan_name').notNullable()
    t.text('plan_type').notNullable()
    t.integer('plan_year').notNullable()
    t.text('description')
    t.text('status').defaultTo('draft')
    t.text('created_by').references('id').inTable('users')
    t.text('approved_by').references('id').inTable('users')
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.schema.createTable('site_recommendations', (t) => {
    t.text('id').primary()
    t.text('plan_id').references('id').inTable('plans')
    t.float('longitude')
    t.float('latitude')
    t.float('recommended_capacity_kw')
    t.float('score')
    t.float('solar_irradiance_score')
    t.float('grid_access_score')
    t.float('land_use_score')
    t.float('economic_score')
    t.text('constraint_description')
    t.text('status').defaultTo('proposed')
    t.text('created_at')
  })

  await knex.schema.createTable('absorption_schemes', (t) => {
    t.text('id').primary()
    t.text('plan_id').references('id').inTable('plans')
    t.text('scheme_name').notNullable()
    t.text('scheme_type').notNullable()
    t.float('energy_storage_capacity_kwh')
    t.float('energy_storage_power_kw')
    t.float('reactive_compensation_kvar')
    t.text('line_modification_description')
    t.float('estimated_cost')
    t.float('expected_absorption_improvement_pct')
    t.text('created_at')
  })

  await knex.schema.createTable('economic_analyses', (t) => {
    t.text('id').primary()
    t.text('plan_id').references('id').inTable('plans')
    t.text('absorption_scheme_id').references('id').inTable('absorption_schemes')
    t.float('total_investment')
    t.float('unit_cost_per_kw')
    t.float('annual_operating_cost')
    t.float('annual_revenue')
    t.float('payback_period_years')
    t.float('irr_pct')
    t.float('npv')
    t.text('analysis_date')
  })

  await knex.schema.createTable('equipment_ledger', (t) => {
    t.text('id').primary()
    t.text('plan_id').references('id').inTable('plans')
    t.text('equipment_id').references('id').inTable('equipment')
    t.text('equipment_type').notNullable()
    t.integer('quantity').defaultTo(1)
    t.float('unit_price')
    t.text('procurement_status').defaultTo('planned')
    t.text('planned_install_date')
    t.text('notes')
  })

  // ==================== Achievement Tables ====================
  await knex.schema.createTable('projects', (t) => {
    t.text('id').primary()
    t.text('project_code').unique().notNullable()
    t.text('project_name').notNullable()
    t.text('project_type').notNullable()
    t.text('pv_type')
    t.text('plan_id').references('id').inTable('plans')
    t.float('capacity_kw')
    t.float('budget')
    t.float('actual_cost')
    t.text('status').defaultTo('initiated')
    t.text('start_date')
    t.text('expected_completion_date')
    t.text('actual_completion_date')
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.schema.createTable('access_conditions', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.text('condition_type').notNullable()
    t.text('requirement')
    t.text('actual_value')
    t.integer('is_satisfied')
    t.text('verified_by').references('id').inTable('users')
    t.text('verified_at')
  })

  await knex.schema.createTable('feasibility_assessments', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').unique().notNullable()
    t.float('technical_score')
    t.float('economic_score')
    t.float('environmental_score')
    t.float('social_score')
    t.float('comprehensive_score')
    t.text('assessment_report')
    t.text('assessed_by').references('id').inTable('users')
    t.text('assessed_at')
  })

  await knex.schema.createTable('effectiveness_verifications', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.text('verification_date').notNullable()
    t.float('planned_output_kwh')
    t.float('actual_output_kwh')
    t.float('absorption_rate_pct')
    t.float('voltage_compliance_pct')
    t.integer('is_effective')
    t.text('remarks')
    t.text('verified_by').references('id').inTable('users')
    t.text('created_at')
  })

  await knex.schema.createTable('project_audit', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.text('action').notNullable()
    t.text('old_status')
    t.text('new_status')
    t.text('comment')
    t.text('performed_by').references('id').inTable('users')
    t.text('created_at')
  })

  // ==================== Power Flow Tables ====================
  await knex.schema.createTable('calc_tasks', (t) => {
    t.text('id').primary()
    t.text('task_type').notNullable()
    t.text('status').defaultTo('queued')
    t.text('parameters').notNullable()
    t.integer('progress_pct').defaultTo(0)
    t.text('error_message')
    t.integer('priority').defaultTo(0)
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
    t.text('started_at')
    t.text('completed_at')
  })

  await knex.schema.createTable('calc_results', (t) => {
    t.text('id').primary()
    t.text('task_id').references('id').inTable('calc_tasks').notNullable()
    t.integer('version').notNullable().defaultTo(1)
    t.integer('is_latest').defaultTo(1)
    t.text('node_results')
    t.text('branch_results')
    t.text('summary')
    t.integer('reverse_power_detected')
    t.float('three_phase_imbalance_pct')
    t.float('total_loss_kw')
    t.integer('computation_time_ms')
    t.text('created_at')
  })

  await knex.schema.createTable('batch_calc_groups', (t) => {
    t.text('id').primary()
    t.text('group_name').notNullable()
    t.text('parameter_template')
    t.text('parameter_variations')
    t.text('status').defaultTo('pending')
    t.integer('total_tasks')
    t.integer('completed_tasks').defaultTo(0)
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
    t.text('completed_at')
  })

  await knex.schema.createTable('data_validation_records', (t) => {
    t.text('id').primary()
    t.text('check_type').notNullable()
    t.text('data_source_table')
    t.integer('records_checked')
    t.integer('records_passed')
    t.integer('records_failed')
    t.text('failure_details')
    t.text('checked_at')
  })

  await knex.schema.createTable('pv_model_params', (t) => {
    t.text('id').primary()
    t.text('model_name').notNullable()
    t.integer('version').notNullable()
    t.text('manufacturer')
    t.text('panel_type')
    t.float('max_power_w')
    t.float('voc_v')
    t.float('isc_a')
    t.float('vmp_v')
    t.float('imp_a')
    t.float('temp_coefficient_pct_per_c')
    t.float('degradation_rate_pct_per_year')
    t.float('efficiency_pct')
    t.integer('is_active').defaultTo(1)
    t.text('created_at')
  })

  // ==================== Resource Tables ====================
  await knex.schema.createTable('resource_models', (t) => {
    t.text('id').primary()
    t.text('model_name').notNullable()
    t.text('model_type').notNullable()
    t.text('model_parameters').notNullable()
    t.text('plant_id').references('id').inTable('power_plants')
    t.text('description')
    t.integer('version').defaultTo(1)
    t.integer('is_active').defaultTo(1)
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.schema.createTable('resource_relationships', (t) => {
    t.text('id').primary()
    t.text('source_model_id').references('id').inTable('resource_models').notNullable()
    t.text('target_model_id').references('id').inTable('resource_models').notNullable()
    t.text('relationship_type').notNullable()
    t.text('topology_edge_data')
    t.text('location_line')
    t.text('created_at')
  })

  await knex.schema.createTable('scenarios', (t) => {
    t.text('id').primary()
    t.text('scenario_name').notNullable()
    t.text('description')
    t.text('scenario_type')
    t.text('status').defaultTo('draft')
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
    t.text('updated_at')
  })

  await knex.schema.createTable('scenario_resources', (t) => {
    t.text('id').primary()
    t.text('scenario_id').references('id').inTable('scenarios').notNullable()
    t.text('resource_model_id').references('id').inTable('resource_models').notNullable()
    t.text('override_parameters')
  })

  await knex.schema.createTable('strategies', (t) => {
    t.text('id').primary()
    t.text('scenario_id').references('id').inTable('scenarios').notNullable()
    t.text('strategy_name').notNullable()
    t.text('strategy_type').notNullable()
    t.text('generation_algorithm')
    t.text('strategy_data').notNullable()
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
  })

  await knex.schema.createTable('simulation_runs', (t) => {
    t.text('id').primary()
    t.text('scenario_id').references('id').inTable('scenarios').notNullable()
    t.text('strategy_id').references('id').inTable('strategies')
    t.text('status').defaultTo('pending')
    t.text('input_summary')
    t.text('result_data')
    t.float('execution_score')
    t.text('started_at')
    t.text('completed_at')
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
  })

  await knex.schema.createTable('execution_evaluations', (t) => {
    t.text('id').primary()
    t.text('simulation_id').references('id').inTable('simulation_runs').unique().notNullable()
    t.float('absorption_rate_pct')
    t.float('voltage_stability_score')
    t.float('economic_score')
    t.float('reliability_score')
    t.float('comprehensive_score')
    t.text('recommendation')
    t.text('evaluated_by').references('id').inTable('users')
    t.text('evaluation_date')
  })

  await knex.schema.createTable('manual_intervention_log', (t) => {
    t.text('id').primary()
    t.text('simulation_id').references('id').inTable('simulation_runs').notNullable()
    t.text('operator_id').references('id').inTable('users')
    t.text('action_type').notNullable()
    t.text('parameter_changes')
    t.text('created_at')
    t.text('reason')
  })
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'manual_intervention_log', 'execution_evaluations', 'simulation_runs',
    'strategies', 'scenario_resources', 'scenarios', 'resource_relationships', 'resource_models',
    'pv_model_params', 'data_validation_records', 'batch_calc_groups', 'calc_results', 'calc_tasks',
    'project_audit', 'effectiveness_verifications', 'feasibility_assessments', 'access_conditions', 'projects',
    'equipment_ledger', 'economic_analyses', 'absorption_schemes', 'site_recommendations', 'plans',
    'carbon_emissions', 'alerts', 'voltage_measurements', 'equipment_lifecycle', 'equipment',
    'pv_output_measurements', 'power_plants',
    'audit_logs', 'users', 'roles',
  ]
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table)
  }
}
