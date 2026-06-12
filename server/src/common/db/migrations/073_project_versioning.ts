import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 项目版本快照表
  await knex.schema.createTable('project_versions', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.integer('version_number').notNullable()
    t.text('stage').notNullable().defaultTo('other')
    t.text('snapshot').notNullable()
    t.text('changed_fields')
    t.text('changelog')
    t.text('created_by')
    t.text('created_at').notNullable()
  })
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pv_project ON project_versions(project_id)')
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pv_project_version ON project_versions(project_id, version_number)')

  // 2. 合规检查清单配置表
  await knex.schema.createTable('compliance_checklist', (t) => {
    t.text('id').primary()
    t.text('code').notNullable().unique()
    t.text('name').notNullable()
    t.text('category').notNullable().defaultTo('通用')
    t.text('description')
    t.text('check_rule').notNullable()
    t.text('rule_config').notNullable()
    t.integer('is_enabled').defaultTo(1)
    t.integer('sort_order').defaultTo(0)
    t.text('created_at')
  })

  // 3. 项目合规检查结果表
  await knex.schema.createTable('project_compliance_results', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.text('checklist_item_id').references('id').inTable('compliance_checklist').notNullable()
    t.text('check_status').notNullable().defaultTo('pending')
    t.text('actual_value')
    t.text('detail')
    t.text('checked_by')
    t.text('checked_at')
    t.text('updated_at')
  })
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pcr_project ON project_compliance_results(project_id)')

  // 4. 规划调整记录表
  await knex.schema.createTable('plan_adjustments', (t) => {
    t.text('id').primary()
    t.text('project_id').references('id').inTable('projects').notNullable()
    t.text('adjustment_type').notNullable()
    t.text('field_path')
    t.text('old_value')
    t.text('new_value')
    t.text('reason').notNullable()
    t.text('approval_status').defaultTo('pending')
    t.text('approved_by')
    t.text('approved_at')
    t.text('created_by')
    t.text('created_at').notNullable()
  })
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pa_project ON plan_adjustments(project_id)')

  // 5. 扩展 project_audit 表
  const hasChangedFields = await knex.schema.hasColumn('project_audit', 'changed_fields')
  if (!hasChangedFields) {
    await knex.schema.alterTable('project_audit', (t) => {
      t.text('changed_fields')
      t.text('version_id')
      t.text('stage')
      t.text('snapshot')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('plan_adjustments')
  await knex.schema.dropTableIfExists('project_compliance_results')
  await knex.schema.dropTableIfExists('compliance_checklist')
  await knex.schema.dropTableIfExists('project_versions')
  // project_audit 的 ALTER 列不回滚（不影响功能）
}
