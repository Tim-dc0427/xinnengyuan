import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function pad2(n: number) { return String(n).padStart(2, '0') }

export async function seed(knex: Knex): Promise<void> {
  const stations = await knex('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select(
      'solar_pv_stations.id',
      'solar_pv_stations.plant_id',
      'solar_pv_stations.station_name',
      'solar_pv_stations.installed_capacity_mw',
      'solar_pv_stations.grid_connection_voltage_kv',
      'solar_pv_stations.bus_id',
    )
  if (stations.length === 0) { console.log('  No solar PV stations, skip 5-min seed.'); return }

  // 动态日期：覆盖最近7天（到昨天），每次重跑自动刷新
  const now = new Date()
  const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 0)
  const sevenDaysAgo = new Date(yesterdayEnd.getTime() - 6 * 86400000)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const startStr = sevenDaysAgo.toISOString().slice(0, 19)
  const endStr = new Date(yesterdayEnd.getTime() + 60000).toISOString().slice(0, 19)

  await knex('pv_output_measurements')
    .where('time', '>=', startStr)
    .where('time', '<', endStr)
    .delete()
  console.log(`  ✓ 已清空 ${startStr.slice(0, 10)} ~ ${endStr.slice(0, 10)} 旧5分钟PV数据`)

  const startDate = sevenDaysAgo
  const endDate = yesterdayEnd
  const intervalMin = 5
  const batchSize = 500

  for (const station of stations) {
    const s = station as any
    const capacityKw = s.installed_capacity_mw * 1000
    const nominalKv = s.grid_connection_voltage_kv || 10
    const stationIdx = stations.indexOf(station)
    const records: any[] = []

    const totalMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000)

    for (let m = 0; m <= totalMin; m += intervalMin) {
        const t = new Date(startDate.getTime() + m * 60000)
        const hour = t.getHours() + t.getMinutes() / 60
        const dayOffset = Math.floor(m / 1440)
        const minuteOfDay = t.getHours() * 60 + t.getMinutes()

        let solarRatio = 0
        if (hour >= 5.08 && hour <= 18.92) {
          solarRatio = Math.sin(((hour - 5.08) / 13.84) * Math.PI)
        }
        const cloudSlow = 0.75 + 0.25 * Math.sin(dayOffset * 2.3 * Math.PI + minuteOfDay / 120 * Math.PI)
        const cloudFast = 0.85 + 0.15 * Math.sin(minuteOfDay / 10 * Math.PI + stationIdx * 1.7 + dayOffset * 3.7)
        const cloudFactor = (cloudSlow + cloudFast) / 2

        const irradianceWm2 = Math.round(solarRatio * 1000 * cloudFactor)
        const dayTempOffset = (seededRandom(dayOffset * 777 + stationIdx * 17) - 0.5) * 4
        const tempC = +(18 + solarRatio * 10 + Math.sin((hour - 9) / 12 * Math.PI) * 3 + (seededRandom(stationIdx * 1000 + minuteOfDay + dayOffset * 499) - 0.5) * 1.5 + dayTempOffset).toFixed(1)

        const panelEff = 0.78 + seededRandom(stationIdx * 13 + minuteOfDay * 3 + dayOffset * 251) * 0.06
        const inverterEff = irradianceWm2 > 0 ? +(0.88 + seededRandom(stationIdx * 79 + minuteOfDay + dayOffset * 317) * 0.11).toFixed(3) : null
        const tempDerating = Math.max(0.87, 1 - 0.0035 * Math.max(0, tempC - 25))
        const powerKw = irradianceWm2 > 0
          ? Math.round((irradianceWm2 / 1000) * capacityKw * panelEff * (inverterEff ?? 0.90) * tempDerating)
          : 0

        const loadTrend = -0.015 * solarRatio
        const pvFluctuation = solarRatio > 0 ? (seededRandom(minuteOfDay * 7 + stationIdx + dayOffset * 131) - 0.5) * 0.03 : 0
        const dailyWave = 0.015 * Math.sin((hour - 6) / 24 * Math.PI * 2)
        const fastNoise = (seededRandom(stationIdx * 5000 + minuteOfDay * 3 + dayOffset * 211) - 0.5) * 0.02
        const voltageFactor = 1.0 + loadTrend + pvFluctuation + dailyWave + fastNoise
        const clampMin = nominalKv >= 110 ? 0.96 : 0.92
        const clampMax = nominalKv >= 110 ? 1.04 : 1.08
        const voltageV = +(nominalKv * 1000 * Math.max(clampMin, Math.min(clampMax, voltageFactor))).toFixed(1)

        const humidityPct = Math.round(Math.max(15, Math.min(95, 55 - solarRatio * 25 + (seededRandom(stationIdx * 19 + dayOffset * 24 + t.getHours()) - 0.5) * 8)))

        records.push({
          id: uuid(),
          time: `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}T${pad2(t.getHours())}:${pad2(t.getMinutes())}:00`,
          plant_id: s.plant_id || '',
          station_id: s.id,
          active_power_kw: powerKw,
          reactive_power_kvar: Math.round(powerKw * (0.04 + seededRandom(stationIdx * 41 + minuteOfDay + dayOffset * 71) * 0.04)),
          voltage_v: voltageV,
          current_a: Math.round((powerKw / nominalKv) * (0.9 + seededRandom(stationIdx * 59 + minuteOfDay + dayOffset * 89) * 0.2)),
          frequency_hz: +(50 + seededRandom(stationIdx * 61 + minuteOfDay + dayOffset * 103) * 0.06 - 0.03).toFixed(3),
          power_factor: +(0.95 + seededRandom(stationIdx * 71 + minuteOfDay + dayOffset * 137) * 0.04).toFixed(3),
          temperature_c: tempC,
          irradiance_wm2: irradianceWm2,
          humidity_pct: humidityPct,
          inverter_efficiency: inverterEff,
          confidence_pct: Math.round(70 + seededRandom(stationIdx * 83 + minuteOfDay) * 30),
          expected_weather: irradianceWm2 > 600 ? '晴' : irradianceWm2 > 300 ? '多云' : irradianceWm2 > 100 ? '阴天' : '雨天',
          actual_weather: irradianceWm2 > 600 ? '晴' : irradianceWm2 > 300 ? '多云' : irradianceWm2 > 100 ? '阴天' : '雨天',
        })

        if (records.length >= batchSize) {
          await knex('pv_output_measurements').insert(records.splice(0, batchSize))
        }
      }

      if (records.length > 0) {
        await knex('pv_output_measurements').insert(records)
      }

      console.log(`  ✓ ${s.station_name}: ${Math.floor(totalMin / intervalMin) + 1} 条5分钟数据 (${startStr.slice(0, 10)} ~ ${endStr.slice(0, 10)})`)
    }

  // 同步确保负荷数据覆盖同期
  const loadCount = await knex('load_measurements')
    .where('time', '>=', startStr)
    .where('time', '<', endStr)
    .count('* as cnt')
    .first()
  console.log(`  ✓ 同期负荷数据: ${(loadCount as any)?.cnt || 0} 条`)
}
