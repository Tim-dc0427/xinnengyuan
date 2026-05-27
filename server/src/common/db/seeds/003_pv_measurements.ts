import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  const plants = await knex('power_plants').select('id', 'name', 'capacity_kw')
  const pvPlants = plants.filter((p: any) => p.name.includes('光伏'))
  if (pvPlants.length === 0) {
    console.log('No PV plants found, skipping PV measurement seed.')
    return
  }

  // 生成 3 天 15 分钟间隔的模拟出力数据
  const startDate = new Date('2026-05-15')
  const endDate = new Date('2026-05-17')
  const intervalMin = 15
  const batchSize = 100

  for (const plant of pvPlants) {
    const capacityKw = (plant as any).capacity_kw || 50000
    // 根据容量判断并网电压等级
    let gridKv: number
    if (capacityKw >= 200000) gridKv = 230        // 220kV 接入
    else if (capacityKw >= 40000) gridKv = 115     // 110kV 接入
    else gridKv = 10.5                              // 10kV 接入

    const records: any[] = []

    for (let t = new Date(startDate); t <= endDate; t = new Date(t.getTime() + intervalMin * 60000)) {
      const hour = t.getHours() + t.getMinutes() / 60
      const dateStr = t.toISOString().slice(0, 10)

      // 夜间跳过
      if (hour < 5.5 || hour > 18.5) continue

      // 基础辐照度：正弦曲线模拟日射
      const solarAngle = (hour - 5.5) / 13 * Math.PI
      const baseIrradiance = Math.sin(solarAngle) * 900

      // 模拟天气场景
      let weatherExpected: string, weatherActual: string
      let cloudFactor: number
      let confidenceBase: number

      if (dateStr === '2026-05-15') {
        weatherExpected = '晴'; weatherActual = '晴'
        cloudFactor = 0.9 + Math.random() * 0.1
        confidenceBase = 92
      } else if (dateStr === '2026-05-16') {
        if (hour < 12) {
          weatherExpected = '多云'; weatherActual = '多云'
          cloudFactor = 0.5 + Math.random() * 0.2
          confidenceBase = 75
        } else {
          weatherExpected = '阴天'; weatherActual = '阴天'
          cloudFactor = 0.2 + Math.random() * 0.15
          confidenceBase = 60
        }
      } else {
        weatherExpected = '晴'; weatherActual = hour < 14 ? '晴' : '多云'
        cloudFactor = hour < 14 ? 0.85 + Math.random() * 0.12 : 0.5 + Math.random() * 0.2
        confidenceBase = hour < 14 ? 90 : 70
      }

      const irradiance = baseIrradiance * cloudFactor + (Math.random() - 0.5) * 50
      const irradianceWm2 = Math.max(0, Math.round(irradiance))

      // 出力 = 辐照度 × 面积效率 × 容量
      const efficiency = 0.78 + Math.random() * 0.04
      const powerKw = Math.round(irradianceWm2 / 1000 * capacityKw * efficiency)
      const confidencePct = Math.min(100, Math.max(0, confidenceBase + Math.round((Math.random() - 0.5) * 20)))

      const isConfidenceAnomaly = dateStr === '2026-05-15' && hour >= 14 && hour < 15
      const isWeatherMismatch = dateStr === '2026-05-17' && hour >= 13 && hour < 14

      records.push({
        id: uuid(),
        time: t.toISOString(),
        plant_id: (plant as any).id,
        active_power_kw: powerKw,
        reactive_power_kvar: Math.round(powerKw * (0.08 + Math.random() * 0.04)),
        voltage_v: Number((gridKv * 1000 * (0.98 + Math.random() * 0.04)).toFixed(1)),
        current_a: Math.round(powerKw / gridKv * (0.9 + Math.random() * 0.2)),
        frequency_hz: Number((50 + Math.random() * 0.1 - 0.05).toFixed(3)),
        power_factor: Number((0.95 + Math.random() * 0.04).toFixed(3)),
        temperature_c: Number((18 + Math.sin(solarAngle) * 12 + (Math.random() - 0.5) * 3).toFixed(1)),
        irradiance_wm2: irradianceWm2,
        humidity_pct: Math.round(40 + (1 - Math.sin(solarAngle)) * 30 + (Math.random() - 0.5) * 10),
        inverter_efficiency: Number((0.965 + Math.random() * 0.025).toFixed(3)),
        confidence_pct: isConfidenceAnomaly ? Math.round(30 + Math.random() * 15) : confidencePct,
        expected_weather: isWeatherMismatch ? '晴' : weatherExpected,
        actual_weather: isWeatherMismatch ? '阴天' : weatherActual,
      })
    }

    for (let i = 0; i < records.length; i += batchSize) {
      await knex('pv_output_measurements').insert(records.slice(i, i + batchSize))
    }

    console.log(`  ✓ ${(plant as any).name}: ${records.length} records (${(capacityKw / 1000).toFixed(0)}MW, ${gridKv}kV)`)
  }
}
