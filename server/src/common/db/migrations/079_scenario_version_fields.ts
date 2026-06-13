import type Knex from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 版本表：保存完整场景快照
  await knex.schema.alterTable('scenario_versions', (t) => {
    t.text('name')
    t.text('type')
    t.text('tags')
    t.text('description')
    t.text('status')
  })

  // 主表：记录最后操作人
  await knex.schema.alterTable('interactive_scenarios', (t) => {
    t.text('updated_by')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scenario_versions', (t) => {
    t.dropColumn('name')
    t.dropColumn('type')
    t.dropColumn('tags')
    t.dropColumn('description')
    t.dropColumn('status')
  })
  await knex.schema.alterTable('interactive_scenarios', (t) => {
    t.dropColumn('updated_by')
  })
}
