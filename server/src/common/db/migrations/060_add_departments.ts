import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('departments', (t) => {
    t.text('id').primary()
    t.text('name').notNullable()
    t.text('parent_id').references('id').inTable('departments')
    t.integer('sort_order').defaultTo(0)
    t.text('created_at')
  })

  // 用原生 SQL 而非 Knex alterTable：Knex 在 SQLite 上会重建整张表（DROP→CREATE），
  // 而 users 表被大量外键引用，DROP 触发 FOREIGN KEY constraint failed
  await knex.raw('ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users DROP COLUMN department_id')
  await knex.schema.dropTableIfExists('departments')
}
