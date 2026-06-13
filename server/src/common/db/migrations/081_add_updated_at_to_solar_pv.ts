import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.text('updated_at')
  })

  // 用 created_at 回填已有的 updated_at
  await knex.raw(`
    UPDATE solar_pv_stations SET updated_at = created_at WHERE updated_at IS NULL
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.dropColumn('updated_at')
  })
}
