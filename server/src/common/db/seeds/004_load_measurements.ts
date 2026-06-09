import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export async function seed(knex: Knex): Promise<void> {
  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level')
  if (buses.length === 0) {
    console.log('No grid buses found, skipping load measurement seed.')
    return
  }

  // 清空旧负荷数据
  await knex('load_measurements').delete()
  console.log('  ✓ 已清空旧负荷测量数据')

  const intervalMin = 15
  const batchSize = 500

  function pad2(n: number) { return String(n).padStart(2, '0') }
  function pad3(n: number) { return String(n).padStart(3, '0') }

  // 覆盖与PV数据匹配的时间范围：2026年3-6月 + 2025年3-5月（同比）
  const periods: Array<[number, number, number, number]> = [
    [2026, 3, 2026, 6],   // 2026年3月1日 ~ 6月30日
    [2025, 3, 2025, 5],   // 2025年3月1日 ~ 5月31日（同比对比）
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

    for (const [startYear, startMonth, endYear, endMonth] of periods) {
      const startDate = new Date(startYear, startMonth - 1, 1)
      const endDate = new Date(endYear, endMonth, 0) // 当月最后一天
      const totalMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / 60000) + 24 * 60 - intervalMin

      for (let m = 0; m <= totalMinutes; m += intervalMin) {
        const t = new Date(startDate.getTime() + m * 60000)
        if (t > endDate) break

        const hour = t.getHours() + t.getMinutes() / 60
        const isWeekend = t.getDay() === 0 || t.getDay() === 6
        const monthIdx = t.getMonth() // 0-11
        const dayOfYear = Math.floor((t.getTime() - new Date(t.getFullYear(), 0, 0).getTime()) / 86400000)

        let loadFactor: number
        if (isWeekend) {
          loadFactor = 0.6 + Math.sin((hour - 8) / 14 * Math.PI) * 0.25
        } else {
          if (hour >= 8 && hour <= 11) loadFactor = 0.75 + Math.sin((hour - 8) / 3 * Math.PI * 0.5) * 0.2
          else if (hour >= 18 && hour <= 21) loadFactor = 0.8 + Math.sin((hour - 18) / 3 * Math.PI * 0.5) * 0.2
          else if (hour >= 23 || hour <= 5) loadFactor = 0.3 + seededRandom(busIdx * 10000 + dayOfYear + hour) * 0.1
          else loadFactor = 0.5 + seededRandom(busIdx * 20000 + dayOfYear + hour) * 0.15
        }

        // 季节性调整：3月偏低(0.85)、6月偏高(1.09)
        const seasonalFactor = 0.85 + (monthIdx - 2) * 0.08
        const noiseMw = (seededRandom(busIdx * 30000 + dayOfYear * 24 + t.getHours()) - 0.5) * baseLoadMw * 0.05
        const powerMw = Number((baseLoadMw * loadFactor * seasonalFactor + noiseMw).toFixed(3))

        allRecords.push({
          id: uuid(),
          time: `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}T${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}.${pad3(t.getMilliseconds())}`,
          bus_id: (bus as any).id,
          active_power_mw: powerMw,
          reactive_power_mvar: Number((powerMw * (0.3 + seededRandom(busIdx * 40000 + dayOfYear + hour) * 0.1)).toFixed(3)),
          data_type: 'actual',
          temperature_c: Number((20 + Math.sin((hour - 6) / 14 * Math.PI) * 8 + (seededRandom(busIdx * 50000 + dayOfYear) - 0.5) * 2).toFixed(1)),
          humidity_pct: Math.round(45 + (1 - Math.sin((hour - 6) / 14 * Math.PI)) * 20 + (seededRandom(busIdx * 60000 + dayOfYear) - 0.5) * 5),
        })
      }
    }

    for (let i = 0; i < allRecords.length; i += batchSize) {
      await knex('load_measurements').insert(allRecords.slice(i, i + batchSize))
    }

    console.log(`  ✓ ${busName}: ${allRecords.length} load records`)
  }
}
