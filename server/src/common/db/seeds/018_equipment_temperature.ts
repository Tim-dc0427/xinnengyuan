import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

/**
 * 设备温升数据生成
 * 原则：基于设备额定温升阈值(rated_temp_rise_c)生成实际温升，
 * 约 15% 设备为薄弱设备（温升超阈值），其余为正常设备（温升在阈值内）。
 * 使用 equipment_id 哈希值决定薄弱与否，保证多次运行一致。
 */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i) | 0
  return Math.abs(h)
}

export async function seed(knex: Knex): Promise<void> {
  await knex('equipment_temperature').del()

  const equipments = await knex('equipment')
    .leftJoin('solar_pv_stations', 'solar_pv_stations.id', 'equipment.station_id')
    .select(
      'equipment.id as equipment_id',
      'equipment.equipment_type',
      'equipment.station_id',
      'equipment.rated_temp_rise_c',
      'solar_pv_stations.grid_connection_voltage_kv',
    )

  // 基准温度（设备正常运行温度）
  const baseTemp: Record<string, number> = { TRANSFORMER: 45, INVERTER: 38, BREAKER: 32, CABLE: 28, SWITCH: 30, BATTERY: 35 }
  const records: any[] = []

  const start = new Date('2026-05-01')
  const end = new Date('2026-06-02')
  const dates: Date[] = []
  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 6 * 3600000)) dates.push(new Date(t))

  for (const eq of equipments as any[]) {
    const base = baseTemp[eq.equipment_type] || 30
    const kv = eq.grid_connection_voltage_kv || 10
    const ratedRise = eq.rated_temp_rise_c || 5
    // 基于 equipment_id 哈希值决定是否为薄弱设备（~12%薄弱）
    const h = hashId(eq.equipment_id)
    const isWeak = (h % 100) < 12

    for (const dt of dates) {
      const hour = dt.getHours()
      const dev = (Math.random() - 0.5) * 10 // -5 ~ +5
      let status = 'normal'
      let tempC = base + (Math.random() - 0.5) * 4 // 正常波动 ±2°C

      if (isWeak && dev > 3) {
        // 薄弱设备 surge：温升超额定值 105%~150%
        status = 'surge'
        tempC = base + ratedRise * (1.05 + Math.random() * 0.45)
      } else if (isWeak && dev < -3) {
        // 薄弱设备 sag：温升接近或略超额定值
        status = 'sag'
        tempC = base + ratedRise * (0.95 + Math.random() * 0.40)
      } else if (!isWeak && dev > 3) {
        // 正常设备 surge：温升在额定值 30%~90% 内
        status = 'surge'
        tempC = base + ratedRise * (0.30 + Math.random() * 0.60)
      } else if (!isWeak && dev < -3) {
        // 正常设备 sag：温升在额定值 20%~70% 内
        status = 'sag'
        tempC = base + ratedRise * (0.20 + Math.random() * 0.50)
      }

      records.push({
        id: uuid(), equipment_id: eq.equipment_id, station_id: eq.station_id || '',
        time: dt.toISOString(), temp_c: +tempC.toFixed(1), voltage_status: status,
        voltage_deviation_pct: +dev.toFixed(2),
      })
      if (records.length >= 300) await knex('equipment_temperature').insert(records.splice(0, 300))
    }
  }
  if (records.length > 0) await knex('equipment_temperature').insert(records)
  console.log(`  ✓ 设备温度数据已生成（${equipments.length}设备 × ${dates.length}时间点）`)
}

