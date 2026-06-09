import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 关闭外键检查，避免 ALTER TABLE 时因引用约束失败（SQLite 重建表场景）
  await knex.raw('PRAGMA foreign_keys = OFF')

  await knex.schema.createTable('departments', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('parent_id').references('id').inTable('departments')
    t.integer('sort_order').defaultTo(0)
    t.text('created_at')
  })

  await knex.schema.alterTable('users', (t) => {
    t.text('department_id').references('id').inTable('departments')
  })

  await knex.raw('PRAGMA foreign_keys = ON')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF')

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('department_id')
  })
  await knex.schema.dropTableIfExists('departments')

  await knex.raw('PRAGMA foreign_keys = ON')
}
