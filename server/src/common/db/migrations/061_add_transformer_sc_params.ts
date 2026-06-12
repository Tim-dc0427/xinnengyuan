import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    // 短路阻抗百分比 Uk%（变压器铭牌参数，用于计算短路电流）
    table.float('short_circuit_impedance_pct')
    // 额定热稳定电流 (kA) — 变压器在规定时间内能承受的短路电流有效值
    table.float('rated_thermal_withstand_current_ka')
    // 额定热稳定持续时间 (s) — 通常为 2s 或 3s
    table.float('rated_thermal_duration_s')
    // 额定峰值耐受电流 (kA) — 变压器能承受的短路冲击电流峰值
    table.float('rated_peak_withstand_current_ka')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('equipment', (table) => {
    table.dropColumn('short_circuit_impedance_pct')
    table.dropColumn('rated_thermal_withstand_current_ka')
    table.dropColumn('rated_thermal_duration_s')
    table.dropColumn('rated_peak_withstand_current_ka')
  })
}
