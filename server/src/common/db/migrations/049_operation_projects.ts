import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 创建 operation_projects 表
  await knex.schema.createTable('operation_projects', (t) => {
    t.text('id').primary()
    t.text('project_code').unique().notNullable()
    t.text('project_name').notNullable()
    t.text('station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.text('operation_start_date')

    // 规划目标（建项目时手动填入，来自可研报告/设计文件）
    t.float('planned_annual_output_mwh')                    // 计划年发电量（万kWh）
    t.float('planned_equivalent_hours')                     // 计划等效利用小时数（h）
    t.float('planned_absorption_rate_pct')                  // 计划消纳率（%）
    t.float('planned_voltage_compliance_pct')               // 计划电压合格率（%）

    t.text('status').defaultTo('active')                    // active / closed
    t.text('remarks')
    t.text('created_at')
    t.text('updated_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_op_station ON operation_projects(station_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_op_status ON operation_projects(status)')

  // 2. 重建 effectiveness_verifications 表（外键切到 operation_projects）
  await knex.schema.dropTableIfExists('effectiveness_verifications')

  await knex.schema.createTable('effectiveness_verifications', (t) => {
    t.text('id').primary()
    t.text('project_id').notNullable().references('id').inTable('operation_projects')

    // 评估周期
    t.text('period_start').notNullable()
    t.text('period_end').notNullable()

    // 自动聚合值（从 pv_output_measurements 计算）
    t.float('auto_output_kwh')                             // 自动聚合实际发电量（kWh）
    t.float('auto_equivalent_hours')                       // 自动计算等效利用小时
    t.float('auto_voltage_compliance_pct')                 // 自动计算电压合格率
    t.float('auto_frequency_compliance_pct')               // 自动计算频率合格率
    t.float('auto_power_factor_rate')                      // 自动计算功率因数达标率
    t.float('auto_completeness_pct')                       // 自动计算数据完整率

    // 手动修正值（为空则采用自动值）
    t.float('final_output_kwh')
    t.float('final_equivalent_hours')
    t.float('final_voltage_compliance_pct')
    t.float('final_frequency_compliance_pct')
    t.float('final_power_factor_rate')
    t.float('final_completeness_pct')

    // 消纳率（无法从 measurements 自动算，需手动录入）
    t.float('absorption_rate_pct')

    // 规划目标（从 operation_projects 带入快照）
    t.float('planned_output_mwh')
    t.float('planned_equivalent_hours')
    t.float('planned_absorption_rate_pct')
    t.float('planned_voltage_compliance_pct')

    // 修正标记
    t.integer('manual_override').defaultTo(0)
    t.text('correction_note')

    // 判定
    t.integer('is_effective')
    t.text('remarks')

    t.text('verified_by').references('id').inTable('users')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_ev_project ON effectiveness_verifications(project_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('effectiveness_verifications')

  // 恢复旧 effectiveness_verifications 表（引用 projects 表）
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

  await knex.schema.dropTableIfExists('operation_projects')
}
