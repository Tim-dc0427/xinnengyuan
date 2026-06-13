import type Knex from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('system_config', (t) => {
    t.text('key').primary()
    t.text('value').notNullable()
    t.text('updated_at')
  })

  // 默认值
  await knex('system_config').insert({ key: 'history_retention_days', value: '30', updated_at: new Date().toISOString() })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_config')
}
