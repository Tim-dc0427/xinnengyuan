import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level')
  if (buses.length === 0) {
    console.log('No grid buses found, skipping load measurement seed.')
    return
  }

  const intervalMin = 15
  const batchSize = 200

  // 按月份生成每月的代表性负荷数据（每月15-17日），覆盖与光伏数据匹配的时间范围
  const monthlyPeriods: Array<[string, string]> = [
    ['2026-03-15', '2026-03-17'],
    ['2026-04-15', '2026-04-17'],
    ['2026-05-15', '2026-05-17'],
    ['2026-06-01', '2026-06-02'],
  ]

  for (const bus of buses) {
    const busName = (bus as any).name || ''
    const voltageLevel = (bus as any).voltage_level || '10kV'
    const busIdx = buses.indexOf(bus)

    let baseLoadMw: number
    if (voltageLevel.includes('220')) baseLoadMw = 20 + (busIdx % 10)
    else if (voltageLevel.includes('110')) baseLoadMw = 10 + (busIdx % 8)
    else baseLoadMw = 3 + (busIdx % 5)

    const allRecords: any[] = []

    for (const [startStr, endStr] of monthlyPeriods) {
      const startDate = new Date(startStr)
      const endDate = new Date(endStr)
      const monthIdx = new Date(startStr).getMonth() // 月份差异调整负荷水平

      for (let t = new Date(startDate); t <= endDate; t = new Date(t.getTime() + intervalMin * 60000)) {
        const hour = t.getHours() + t.getMinutes() / 60
        const isWeekend = t.getDay() === 0 || t.getDay() === 6

        let loadFactor: number
        if (isWeekend) {
          loadFactor = 0.6 + Math.sin((hour - 8) / 14 * Math.PI) * 0.25
        } else {
          if (hour >= 8 && hour <= 11) loadFactor = 0.75 + Math.sin((hour - 8) / 3 * Math.PI * 0.5) * 0.2
          else if (hour >= 18 && hour <= 21) loadFactor = 0.8 + Math.sin((hour - 18) / 3 * Math.PI * 0.5) * 0.2
          else if (hour >= 23 || hour <= 5) loadFactor = 0.3 + Math.random() * 0.1
          else loadFactor = 0.5 + Math.random() * 0.15
        }

        // 季节性调整：3月偏低、6月偏高
        const seasonalFactor = 0.85 + (monthIdx - 2) * 0.08
        const powerMw = Number((baseLoadMw * loadFactor * seasonalFactor + (Math.random() - 0.5) * baseLoadMw * 0.05).toFixed(3))

        allRecords.push({
          id: uuid(),
          time: t.toISOString(),
          bus_id: (bus as any).id,
          active_power_mw: powerMw,
          reactive_power_mvar: Number((powerMw * (0.3 + Math.random() * 0.1)).toFixed(3)),
          data_type: 'actual',
          temperature_c: Number((20 + Math.sin((hour - 6) / 14 * Math.PI) * 8 + (Math.random() - 0.5) * 2).toFixed(1)),
          humidity_pct: Math.round(45 + (1 - Math.sin((hour - 6) / 14 * Math.PI)) * 20 + (Math.random() - 0.5) * 5),
        })
      }
    }

    for (let i = 0; i < allRecords.length; i += batchSize) {
      await knex('load_measurements').insert(allRecords.slice(i, i + batchSize))
    }

    console.log(`  ✓ ${busName}: ${allRecords.length} load records`)
  }
}
