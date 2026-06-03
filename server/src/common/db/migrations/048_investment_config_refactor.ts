import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 重命名旧列
  await knex.schema.alterTable('investment_config', (t) => {
    t.renameColumn('plan_id', 'old_plan_id')
  })

  // 2. 新增 investment_plan_id 列
  await knex.schema.alterTable('investment_config', (t) => {
    t.text('investment_plan_id').references('id').inTable('investment_plans')
  })

  // 3. 迁移数据：将 old_plan_id 指向的 plans 数据关联到 investment_plans
  const rows = await knex('investment_config')
    .select('id', 'old_plan_id')
    .whereNotNull('old_plan_id')

  for (const row of rows) {
    if (row.old_plan_id) {
      // 检查 investment_plans 中是否有对应记录（由 047 迁移创建）
      const ip = await knex('investment_plans').where('id', row.old_plan_id).first()
      if (ip) {
        await knex('investment_config')
          .where('id', row.id)
          .update({ investment_plan_id: row.old_plan_id })
      }
    }
  }

  // 4. 删除旧列
  await knex.schema.alterTable('investment_config', (t) => {
    t.dropColumn('old_plan_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('investment_config', (t) => {
    t.renameColumn('investment_plan_id', 'old_plan_id')
  })

  await knex.schema.alterTable('investment_config', (t) => {
    t.text('plan_id').references('id').inTable('plans')
  })

  // 无法完美恢复外键引用，仅恢复列
  await knex.schema.alterTable('investment_config', (t) => {
    t.dropColumn('old_plan_id')
  })
}
