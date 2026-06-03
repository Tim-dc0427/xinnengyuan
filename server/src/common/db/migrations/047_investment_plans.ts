import type { Knex } from 'knex'
import { randomUUID } from 'crypto'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('investment_plans', (t) => {
    t.text('id').primary()
    t.text('plan_name').notNullable()
    t.text('tech_route').notNullable()
    t.float('capacity_kw').notNullable().defaultTo(50000)
    t.text('description')
    t.text('created_at')
    t.text('updated_at')
  })

  // 从旧 plans 表中迁移已有造价相关数据到 investment_plans
  const oldConfigs = await knex('investment_config')
    .distinct('plan_id')
    .whereNotNull('plan_id')

  for (const row of oldConfigs) {
    const planId = row.plan_id
    const plan = await knex('plans').where('id', planId).first()
    if (plan) {
      const existing = await knex('investment_plans').where('id', planId).first()
      if (!existing) {
        await knex('investment_plans').insert({
          id: planId,
          plan_name: plan.plan_name || '历史投资方案',
          tech_route: (plan as any).tech_route || 'centralized_pv',
          capacity_kw: 50000,
          description: plan.description || '',
          created_at: plan.created_at || new Date().toISOString(),
          updated_at: plan.updated_at || new Date().toISOString(),
        })
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('investment_plans')
}
