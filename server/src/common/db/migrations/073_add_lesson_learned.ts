import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lesson_learned', (t) => {
    t.text('id').primary()
    t.text('project_id').notNullable().references('id').inTable('projects')
    t.text('verification_id').references('id').inTable('effectiveness_verifications')
    t.text('title').notNullable()
    t.text('type').notNullable()                     // 'success' | 'lesson'
    t.text('dimension').notNullable()                 // '并网性能' | '电网影响' | '经济效益' | '综合'
    t.text('indicator')                               // 关联指标名
    t.text('content').notNullable()                   // 详细内容
    t.text('cause')                                   // 原因分析
    t.text('suggestion')                              // 改进建议/可复用经验
    t.text('created_by').references('id').inTable('users')
    t.text('created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lesson_learned')
}