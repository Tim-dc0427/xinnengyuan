import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.text('installed_date')
  })

  // 从 power_plants 回填 installed_date
  await knex.raw(`
    UPDATE solar_pv_stations SET
      installed_date = (SELECT installed_date FROM power_plants WHERE power_plants.id = solar_pv_stations.plant_id)
    WHERE plant_id IS NOT NULL
  `)

  // 从 pv_stations 回填（如果 power_plants 没有的话）
  await knex.raw(`
    UPDATE solar_pv_stations SET
      installed_date = (SELECT installed_date FROM pv_stations WHERE pv_stations.id = solar_pv_stations.plant_id)
    WHERE installed_date IS NULL AND plant_id IS NOT NULL
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('solar_pv_stations', (t) => {
    t.dropColumn('installed_date')
  })
}
