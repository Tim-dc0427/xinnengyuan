import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('power_plant_versions', (t) => {
    t.text('id').primary()
    t.text('plant_id').notNullable().references('id').inTable('power_plants')
    t.integer('version').notNullable()
    t.text('name')
    t.text('plant_type')
    t.float('capacity_kw')
    t.text('installed_date')
    t.float('longitude')
    t.float('latitude')
    t.text('address')
    t.text('status')
    t.text('created_at')
  })
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_plant_version ON power_plant_versions(plant_id, version)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('power_plant_versions')
}
