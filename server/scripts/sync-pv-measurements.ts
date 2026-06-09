/**
 * 增量同步光伏出力测量数据——从最后一条记录日期到今天的 24h×电站数 数据
 * 用法：cd server && npx tsx scripts/sync-pv-measurements.ts
 */
import knexLib from 'knex'
import { v4 as uuid } from 'uuid'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db')

const db = knexLib({
  client: 'better-sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true,
  pool: { afterCreate: (conn: any, cb: Function) => { conn.pragma('journal_mode = WAL'); conn.pragma('foreign_keys = ON'); cb(null, conn) } },
})

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

async function main() {
  console.log('=== 增量同步光伏出力测量数据 ===\n')

  // 获取所有活跃电站
  const stations = await db('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('solar_pv_stations.id', 'solar_pv_stations.plant_id', 'solar_pv_stations.station_name', 'solar_pv_stations.installed_capacity_mw', 'solar_pv_stations.grid_connection_voltage_kv', 'solar_pv_stations.installed_date', 'grid_buses.zone')
    .where('solar_pv_stations.status', 'active')

  if (stations.length === 0) { console.log('无活跃电站'); await db.destroy(); return }

  // 找数据库中最后一条记录时间
  const lastRecord = await db('pv_output_measurements').max('time as maxTime').first() as any
  const lastDate = lastRecord?.maxTime ? new Date(lastRecord.maxTime.slice(0, 10)) : new Date('2025-03-01')
  console.log(`当前最新数据日期: ${lastDate.toISOString().slice(0, 10)}`)

  // 从最后日期的次日开始，到今天
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(lastDate)
  startDate.setDate(startDate.getDate() + 1)

  if (startDate > today) {
    console.log('数据已是最新，无需同步')
    await db.destroy()
    return
  }

  const totalDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1
  console.log(`需生成: ${startDate.toISOString().slice(0, 10)} ~ ${today.toISOString().slice(0, 10)} 共 ${totalDays} 天\n`)

  const zones = [...new Set(stations.map((s: any) => s.zone || 'unknown'))]
  const zoneIndexMap = new Map(zones.map((z, i) => [z, i]))
  const batchSize = 200
  let totalInserted = 0

  for (const station of stations) {
    const s = station as any
    const capacityKw = s.installed_capacity_mw * 1000
    const gridKv = s.grid_connection_voltage_kv || 110
    const stationIdx = stations.indexOf(station)
    const zoneIdx = zoneIndexMap.get(s.zone || 'unknown') ?? 0
    const records: any[] = []

    for (let d = 0; d < totalDays; d++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + d)
      const dateStr = date.toISOString().slice(0, 10)
      const stationDayOffset = d + stationIdx * 1000 + 50000 // +50000 避免与种子数据碰撞
      const weatherDayOffset = d + zoneIdx * 1000 + 50000

      // 每日天气
      const wr = seededRandom(weatherDayOffset * 137 + date.getFullYear())
      let weather: string, cloudFactor: number, tempBias: number, humidBias: number
      if (wr < 0.35) { weather = '晴'; cloudFactor = 0.85 + seededRandom(weatherDayOffset * 7) * 0.15; tempBias = 2; humidBias = -10 }
      else if (wr < 0.65) { weather = '多云'; cloudFactor = 0.5 + seededRandom(weatherDayOffset * 11) * 0.25; tempBias = 0; humidBias = 5 }
      else if (wr < 0.85) { weather = '阴天'; cloudFactor = 0.2 + seededRandom(weatherDayOffset * 13) * 0.2; tempBias = -2; humidBias = 15 }
      else { weather = '雨天'; cloudFactor = 0.05 + seededRandom(weatherDayOffset * 17) * 0.15; tempBias = -4; humidBias = 25 }

      const rawCloudVars: number[] = []
      for (let h = 0; h < 24; h++) {
        rawCloudVars.push(0.85 + seededRandom(stationDayOffset * 31 + h * 17) * 0.3)
      }
      const smoothCloudVars = rawCloudVars.map((v, h) => {
        if (h === 0) return (v + rawCloudVars[1]) / 2
        if (h === 23) return (rawCloudVars[22] + v) / 2
        return (rawCloudVars[h - 1] + v + rawCloudVars[h + 1]) / 3
      })

      for (let h = 0; h < 24; h++) {
        let solarRatio = 0
        if (h >= 5 && h <= 18) { solarRatio = Math.sin(((h - 5) / 13) * Math.PI) }
        else if (h === 4) { solarRatio = 0.01 }
        else if (h === 19) { solarRatio = 0.02 }

        const irradianceWm2 = Math.round(solarRatio * 1000 * cloudFactor * smoothCloudVars[h])
        const tempC = +(18 + solarRatio * 12 + tempBias + (seededRandom(stationDayOffset * 47 + h) - 0.5) * 1.5).toFixed(1)
        const humidityPct = Math.round(Math.max(15, Math.min(95, 55 - solarRatio * 25 + humidBias + (seededRandom(stationDayOffset * 19 + h) - 0.5) * 6)))
        const panelEff = 0.78 + seededRandom(stationIdx * 13 + h * 3 + 50000) * 0.06
        const inverterEff = irradianceWm2 > 0 ? +(0.88 + seededRandom(stationDayOffset * 79 + h) * 0.11).toFixed(3) : null
        const tempDerating = Math.max(0.87, Math.min(1.05, 1 - 0.005 * (tempC - 15)))
        const yearsSinceInstall = (date.getTime() - new Date(s.installed_date || '2024-01-01').getTime()) / (365.25 * 86400000)
        const ageDerating = yearsSinceInstall <= 0 ? 1 : yearsSinceInstall < 0.5 ? +(1 - 0.02 * (yearsSinceInstall / 0.5)).toFixed(4) : +(0.98 - 0.005 * (yearsSinceInstall - 0.5)).toFixed(4)
        const powerKw = irradianceWm2 > 0 ? Math.round((irradianceWm2 / 1000) * capacityKw * panelEff * inverterEff! * tempDerating * ageDerating) : 0

        const timeStr = `${dateStr}T${String(h).padStart(2, '0')}:${String(Math.floor(seededRandom(stationDayOffset * 67 + h) * 60)).padStart(2, '0')}:00`

        records.push({
          id: uuid(), time: timeStr, plant_id: s.plant_id || '', station_id: s.id,
          active_power_kw: powerKw,
          reactive_power_kvar: Math.round(powerKw * (0.06 + seededRandom(stationDayOffset * 41 + h) * 0.06)),
          voltage_v: Number((gridKv * 1000 * (0.98 + seededRandom(stationDayOffset * 53 + h) * 0.04)).toFixed(1)),
          current_a: Math.round((powerKw / gridKv) * (0.9 + seededRandom(stationDayOffset * 59 + h) * 0.2)),
          frequency_hz: +(50 + seededRandom(stationDayOffset * 61 + h) * 0.08 - 0.04).toFixed(3),
          power_factor: +(0.94 + seededRandom(stationDayOffset * 71 + h) * 0.05).toFixed(3),
          temperature_c: tempC, irradiance_wm2: irradianceWm2, humidity_pct: humidityPct,
          inverter_efficiency: inverterEff,
          confidence_pct: Math.round(70 + seededRandom(stationDayOffset * 83 + h) * 30),
          expected_weather: weather, actual_weather: weather,
        })
      }

      if (records.length >= batchSize) {
        await db('pv_output_measurements').insert(records.splice(0, batchSize))
      }
    }

    if (records.length > 0) {
      await db('pv_output_measurements').insert(records)
    }
    totalInserted += records.length + (batchSize > 0 ? Math.floor(records.length / batchSize) * batchSize : 0)
    // 重新计算实际插入量
  }

  const count = await db('pv_output_measurements').count('* as cnt').first()
  console.log(`✓ 同步完成，总计 ${(count as any)?.cnt || 0} 条记录`)
  await db.destroy()
}

main().catch(async (err) => { console.error(err); await db.destroy(); process.exit(1) })
