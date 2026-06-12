import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // effectiveness_verifications 新增电网影响维度指标列
  await knex.raw('ALTER TABLE effectiveness_verifications ADD COLUMN auto_voltage_violation_rate_pct FLOAT')
  await knex.raw('ALTER TABLE effectiveness_verifications ADD COLUMN final_voltage_violation_rate_pct FLOAT')
  await knex.raw('ALTER TABLE effectiveness_verifications ADD COLUMN auto_reactive_reverse_rate_pct FLOAT')
  await knex.raw('ALTER TABLE effectiveness_verifications ADD COLUMN final_reactive_reverse_rate_pct FLOAT')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE effectiveness_verifications DROP COLUMN auto_voltage_violation_rate_pct')
  await knex.raw('ALTER TABLE effectiveness_verifications DROP COLUMN final_voltage_violation_rate_pct')
  await knex.raw('ALTER TABLE effectiveness_verifications DROP COLUMN auto_reactive_reverse_rate_pct')
  await knex.raw('ALTER TABLE effectiveness_verifications DROP COLUMN final_reactive_reverse_rate_pct')
}
