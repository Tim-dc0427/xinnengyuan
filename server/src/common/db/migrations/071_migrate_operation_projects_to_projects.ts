import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. projects 表增加 station_id 列（用原生 SQL 避免 SQLite alterTable 重建表导致的 FK 冲突）
  await knex.raw('ALTER TABLE projects ADD COLUMN station_id TEXT REFERENCES solar_pv_stations(id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_projects_station ON projects(station_id)')

  // 2. 迁移 operation_projects 数据到 projects（按 project_name 前缀匹配）
  //    将 station_id 和 planned_* 规划目标写入匹配到的 projects
  const opRows = await knex('operation_projects').select('*')
  for (const op of opRows) {
    const station = await knex('solar_pv_stations').where('id', op.station_id).first()
    const stationName = station?.station_name || ''

    // 按电站名称前缀匹配 projects 中的记录
    const matched = await knex('projects')
      .where('project_name', 'like', `${stationName}%`)
      .first()

    if (matched) {
      const cf = JSON.parse(matched.custom_fields || '{}')
      cf.planned_annual_output_mwh = op.planned_annual_output_mwh
      cf.planned_equivalent_hours = op.planned_equivalent_hours
      cf.planned_absorption_rate_pct = op.planned_absorption_rate_pct
      cf.planned_voltage_compliance_pct = op.planned_voltage_compliance_pct

      await knex('projects').where('id', matched.id).update({
        station_id: op.station_id,
        custom_fields: JSON.stringify(cf),
      })
    }
  }

  // 3. 重建 effectiveness_verifications 外键（指向 projects）
  await knex.schema.dropTableIfExists('effectiveness_verifications')

  await knex.schema.createTable('effectiveness_verifications', (t) => {
    t.text('id').primary()
    t.text('project_id').notNullable().references('id').inTable('projects')

    // 评估周期
    t.text('period_start').notNullable()
    t.text('period_end').notNullable()

    // 自动聚合值（从 pv_output_measurements 计算）
    t.float('auto_output_kwh')
    t.float('auto_equivalent_hours')
    t.float('auto_voltage_compliance_pct')
    t.float('auto_frequency_compliance_pct')
    t.float('auto_power_factor_rate')
    t.float('auto_completeness_pct')

    // 手动修正值
    t.float('final_output_kwh')
    t.float('final_equivalent_hours')
    t.float('final_voltage_compliance_pct')
    t.float('final_frequency_compliance_pct')
    t.float('final_power_factor_rate')
    t.float('final_completeness_pct')

    // 消纳率
    t.float('absorption_rate_pct')

    // 规划目标快照
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

  // 4. 废弃 operation_projects 表
  await knex.schema.dropTableIfExists('operation_projects')
}

export async function down(knex: Knex): Promise<void> {
  // 1. 恢复 operation_projects 表
  await knex.schema.createTable('operation_projects', (t) => {
    t.text('id').primary()
    t.text('project_code').unique().notNullable()
    t.text('project_name').notNullable()
    t.text('station_id').notNullable().references('id').inTable('solar_pv_stations')
    t.text('operation_start_date')
    t.float('planned_annual_output_mwh')
    t.float('planned_equivalent_hours')
    t.float('planned_absorption_rate_pct')
    t.float('planned_voltage_compliance_pct')
    t.text('status').defaultTo('active')
    t.text('remarks')
    t.text('created_at')
    t.text('updated_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_op_station ON operation_projects(station_id)')
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_op_status ON operation_projects(status)')

  // 2. 从 projects 恢复数据到 operation_projects
  const projects = await knex('projects')
    .whereNotNull('station_id')
    .select('*')
  const now = new Date().toISOString()
  for (const p of projects) {
    const cf = JSON.parse(p.custom_fields || '{}')
    await knex('operation_projects').insert({
      id: p.id,
      project_code: p.project_code?.replace('PV-GC-', 'OP-'),
      project_name: p.project_name,
      station_id: p.station_id,
      operation_start_date: p.actual_completion_date,
      planned_annual_output_mwh: cf.planned_annual_output_mwh ?? null,
      planned_equivalent_hours: cf.planned_equivalent_hours ?? null,
      planned_absorption_rate_pct: cf.planned_absorption_rate_pct ?? null,
      planned_voltage_compliance_pct: cf.planned_voltage_compliance_pct ?? null,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
  }

  // 3. 恢复 effectiveness_verifications FK
  await knex.schema.dropTableIfExists('effectiveness_verifications')
  await knex.schema.createTable('effectiveness_verifications', (t) => {
    t.text('id').primary()
    t.text('project_id').notNullable().references('id').inTable('operation_projects')
    t.text('period_start').notNullable()
    t.text('period_end').notNullable()
    t.float('auto_output_kwh')
    t.float('auto_equivalent_hours')
    t.float('auto_voltage_compliance_pct')
    t.float('auto_frequency_compliance_pct')
    t.float('auto_power_factor_rate')
    t.float('auto_completeness_pct')
    t.float('final_output_kwh')
    t.float('final_equivalent_hours')
    t.float('final_voltage_compliance_pct')
    t.float('final_frequency_compliance_pct')
    t.float('final_power_factor_rate')
    t.float('final_completeness_pct')
    t.float('absorption_rate_pct')
    t.float('planned_output_mwh')
    t.float('planned_equivalent_hours')
    t.float('planned_absorption_rate_pct')
    t.float('planned_voltage_compliance_pct')
    t.integer('manual_override').defaultTo(0)
    t.text('correction_note')
    t.integer('is_effective')
    t.text('remarks')
    t.text('verified_by').references('id').inTable('users')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_ev_project ON effectiveness_verifications(project_id)')

  // 4. 移除 projects 的 station_id 列
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('station_id')
  })
}
