import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 在各子表中加 station_id 列，通过 solar_pv_stations.plant_id 回填，保留 plant_id 兼容

  // 1. pv_output_measurements
  await knex.schema.alterTable('pv_output_measurements', (t) => {
    t.text('station_id')
  })
  await knex.raw(`
    UPDATE pv_output_measurements SET
      station_id = (SELECT spv.id FROM solar_pv_stations spv WHERE spv.plant_id = pv_output_measurements.plant_id)
    WHERE plant_id IS NOT NULL
  `)
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pvo_station_time ON pv_output_measurements(station_id, time)')

  // 2. equipment
  await knex.schema.alterTable('equipment', (t) => {
    t.text('station_id')
  })
  await knex.raw(`
    UPDATE equipment SET
      station_id = (SELECT spv.id FROM solar_pv_stations spv WHERE spv.plant_id = equipment.plant_id)
    WHERE equipment.plant_id IN (SELECT id FROM power_plants WHERE plant_type = 'PV')
  `)
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_equip_station ON equipment(station_id)')

  // 3. resource_models
  await knex.schema.alterTable('resource_models', (t) => {
    t.text('station_id')
  })
  await knex.raw(`
    UPDATE resource_models SET
      station_id = (SELECT spv.id FROM solar_pv_stations spv WHERE spv.plant_id = resource_models.plant_id)
    WHERE plant_id IS NOT NULL
  `)
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_rm_station ON resource_models(station_id)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pv_output_measurements', (t) => {
    t.dropColumn('station_id')
  })
  await knex.schema.alterTable('equipment', (t) => {
    t.dropColumn('station_id')
  })
  await knex.schema.alterTable('resource_models', (t) => {
    t.dropColumn('station_id')
  })
}
