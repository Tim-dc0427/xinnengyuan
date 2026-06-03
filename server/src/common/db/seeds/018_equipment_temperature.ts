import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('equipment_temperature').del()

  // LEFT JOIN 确保所有设备都覆盖，station_id 为空的也包含
  const equipments = await knex('equipment')
    .leftJoin('solar_pv_stations', 'solar_pv_stations.id', 'equipment.station_id')
    .select('equipment.id as equipment_id', 'equipment.equipment_type', 'equipment.station_id', 'solar_pv_stations.grid_connection_voltage_kv')

  const baseTemp: Record<string, number> = { TRANSFORMER: 45, INVERTER: 38, BREAKER: 32, CABLE: 28, SWITCH: 30, BATTERY: 35 }
  const records: any[] = []

  // 固定时间范围，每6小时一条
  const start = new Date('2026-05-01')
  const end = new Date('2026-06-02')
  const dates: Date[] = []
  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 6 * 3600000)) dates.push(new Date(t))

  for (const eq of equipments as any[]) {
    const base = baseTemp[eq.equipment_type] || 30
    const kv = eq.grid_connection_voltage_kv || 10
    const nomV = kv * 1000

    for (const dt of dates) {
      const hour = dt.getHours()
      // 电压偏差：均匀随机分布，确保 surge 和 sag 都有
      const dev = (Math.random() - 0.5) * 10 // -5 ~ +5
      let status = 'normal'
      let tempC = base + (Math.random() - 0.5) * 4
      if (dev > 3) { status = 'surge'; tempC = base + 5 + Math.random() * 8 }
      else if (dev < -3) { status = 'sag'; tempC = base + 3 + Math.random() * 6 }

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
