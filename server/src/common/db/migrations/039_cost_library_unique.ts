import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 清掉旧的多条目数据，每个模型只保留第一条
  const kept: string[] = []
  const types = await knex('pv_cost_library').distinct('model_type_id').whereNotNull('model_type_id')
  for (const t of types) {
    const row = await knex('pv_cost_library').where('model_type_id', t.model_type_id).first()
    if (row) kept.push(row.id)
  }
  await knex('pv_cost_library').whereNotNull('model_type_id').whereNotIn('id', kept).del()

  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_library_model_type ON pv_cost_library(model_type_id) WHERE model_type_id IS NOT NULL')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_cost_library_model_type')
}
