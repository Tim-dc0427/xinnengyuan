import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level')
  if (buses.length === 0) {
    console.log('No grid buses found, skipping load measurement seed.')
    return
  }

  // 为每条母线的每个15分钟间隔生成负荷数据（3天）
  const startDate = new Date('2026-05-15')
  const endDate = new Date('2026-05-17')
  const intervalMin = 15
  const batchSize = 100

  for (const bus of buses) {
    const busName = (bus as any).name || ''
    const voltageLevel = (bus as any).voltage_level || '10kV'

    // 根据电压等级设置基础负荷范围
    let baseLoadMw: number
    if (voltageLevel.includes('220')) baseLoadMw = 20 + Math.random() * 10
    else if (voltageLevel.includes('110')) baseLoadMw = 10 + Math.random() * 8
    else baseLoadMw = 3 + Math.random() * 5

    const records: any[] = []

    for (let t = new Date(startDate); t <= endDate; t = new Date(t.getTime() + intervalMin * 60000)) {
      const hour = t.getHours() + t.getMinutes() / 60
      const isWeekend = t.getDay() === 0 || t.getDay() === 6

      // 日负荷曲线形态：早高峰 + 午间平段 + 晚高峰
      let loadFactor: number
      if (isWeekend) {
        loadFactor = 0.6 + Math.sin((hour - 8) / 14 * Math.PI) * 0.25
      } else {
        if (hour >= 8 && hour <= 11) loadFactor = 0.75 + Math.sin((hour - 8) / 3 * Math.PI * 0.5) * 0.2
        else if (hour >= 18 && hour <= 21) loadFactor = 0.8 + Math.sin((hour - 18) / 3 * Math.PI * 0.5) * 0.2
        else if (hour >= 23 || hour <= 5) loadFactor = 0.3 + Math.random() * 0.1
        else loadFactor = 0.5 + Math.random() * 0.15
      }

      const powerMw = Number((baseLoadMw * loadFactor + (Math.random() - 0.5) * baseLoadMw * 0.05).toFixed(3))

      // 时间偏移：模拟 5-16 09:00~11:00 的时序错位（+15分钟偏移）
      let recordTime = t
      const isShifted = t.getDate() === 16 && hour >= 9 && hour <= 11
      if (isShifted) recordTime = new Date(t.getTime() + 15 * 60000)

      // 5-17 14:00~15:00 数据缺失（跳过）
      const isMissing = t.getDate() === 17 && hour >= 14 && hour < 15
      if (isMissing) continue

      records.push({
        id: uuid(),
        time: recordTime.toISOString(),
        bus_id: (bus as any).id,
        active_power_mw: powerMw,
        reactive_power_mvar: Number((powerMw * (0.3 + Math.random() * 0.1)).toFixed(3)),
        data_type: 'actual',
        temperature_c: Number((20 + Math.sin((hour - 6) / 14 * Math.PI) * 8 + (Math.random() - 0.5) * 2).toFixed(1)),
        humidity_pct: Math.round(45 + (1 - Math.sin((hour - 6) / 14 * Math.PI)) * 20 + (Math.random() - 0.5) * 5),
        remark: isShifted ? '时序偏移(+15min)' : null,
      })
    }

    for (let i = 0; i < records.length; i += batchSize) {
      await knex('load_measurements').insert(records.slice(i, i + batchSize))
    }

    console.log(`  ✓ ${busName}: ${records.length} load records inserted`)
  }
}
