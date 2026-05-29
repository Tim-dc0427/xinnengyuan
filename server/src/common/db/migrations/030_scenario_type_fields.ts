import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 新增场景条件字段（与 type 分类解耦）
  await knex.schema.alterTable('interactive_scenarios', (t) => {
    t.text('scenario_condition').nullable()
    t.integer('version_limit').defaultTo(10)
  })

  // 为现有数据设置默认值：将原 type 值迁移到 scenario_condition
  await knex.raw(`
    UPDATE interactive_scenarios
    SET scenario_condition = type,
        type = CASE
          WHEN type = 'peak_load' THEN 'industrial_park'
          WHEN type = 'maintenance' THEN 'industrial_park'
          WHEN type = 'extreme_weather' THEN 'residential'
          WHEN type = 'solar_high' THEN 'commercial'
          ELSE 'custom'
        END
    WHERE scenario_condition IS NULL
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('interactive_scenarios', (t) => {
    t.dropColumn('scenario_condition')
    t.dropColumn('version_limit')
  })
}
