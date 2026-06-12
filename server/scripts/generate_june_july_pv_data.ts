/**
 * 集中式光伏电站 6月~7月 5分钟间隔发电数据生成脚本
 *
 * 用法: cd server && npx tsx scripts/generate_june_july_pv_data.ts
 *
 * 为 9 个活跃光伏电站生成 2026-06-01 ~ 2026-07-31 的完整业务数据
 */
import { v4 as uuid } from 'uuid'
import knex from 'knex'
import BetterSqlite3 from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data.db')

const db = knex({
  client: 'better-sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true,
})

const rawDb = new BetterSqlite3(dbPath)

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function pad2(n: number) { return String(n).padStart(2, '0') }

async function main() {
  console.log('=== 6月~7月 光伏发电数据生成 ===\n')

  const stations = await db('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select(
      'solar_pv_stations.id',
      'solar_pv_stations.plant_id',
      'solar_pv_stations.station_name',
      'solar_pv_stations.installed_capacity_mw',
      'solar_pv_stations.grid_connection_voltage_kv',
    )
    .where('solar_pv_stations.status', 'active')

  if (stations.length === 0) {
    console.log('无活跃光伏电站，退出')
    rawDb.close()
    await db.destroy()
    return
  }
  console.log(`共 ${stations.length} 个活跃电站:\n`)
  for (const s of stations as any[]) {
    console.log(`  ${s.station_name}  ${s.installed_capacity_mw}MW  ${s.grid_connection_voltage_kv}kV`)
  }

  // 清空目标日期范围
  const rangeStart = '2026-06-01T00:00:00'
  const rangeEnd = '2026-08-01T00:00:00'
  const deleted = await db('pv_output_measurements')
    .where('time', '>=', rangeStart)
    .where('time', '<', rangeEnd)
    .delete()
  console.log(`\n已清空 ${rangeStart} ~ ${rangeEnd} 旧数据 (${deleted} 条)`)

  const startDate = new Date('2026-06-01T00:00:00')
  const endDate = new Date('2026-07-31T23:59:00')
  const intervalMin = 5
  const totalMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000)
  const totalRecordsPerStation = Math.floor(totalMin / intervalMin) + 1
  console.log(`\n每电站 ${totalRecordsPerStation} 条，共 ${stations.length} 站，总计 ~${(totalRecordsPerStation * stations.length).toLocaleString()} 条`)
  console.log('开始生成...\n')

  // 用 better-sqlite3 prepared statement 批量插入
  const insertStmt = rawDb.prepare(`
    INSERT INTO pv_output_measurements
      (id, time, plant_id, station_id, active_power_kw, reactive_power_kvar,
       voltage_v, current_a, frequency_hz, power_factor,
       temperature_c, irradiance_wm2, humidity_pct, inverter_efficiency,
       confidence_pct, expected_weather, actual_weather)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = rawDb.transaction((rows: any[]) => {
    for (const r of rows) {
      insertStmt.run(
        r.id, r.time, r.plant_id, r.station_id,
        r.active_power_kw, r.reactive_power_kvar,
        r.voltage_v, r.current_a, r.frequency_hz, r.power_factor,
        r.temperature_c, r.irradiance_wm2, r.humidity_pct, r.inverter_efficiency,
        r.confidence_pct, r.expected_weather, r.actual_weather,
      )
    }
  })

  const batchSize = 2000

  for (const station of stations) {
    const s = station as any
    const capacityKw = s.installed_capacity_mw * 1000
    const nominalKv = s.grid_connection_voltage_kv || 10
    const stationIdx = stations.indexOf(station)
    const records: any[] = []

    for (let m = 0; m <= totalMin; m += intervalMin) {
      const t = new Date(startDate.getTime() + m * 60000)
      const hour = t.getHours() + t.getMinutes() / 60
      const dayOffset = Math.floor(m / 1440)
      const minuteOfDay = t.getHours() * 60 + t.getMinutes()

      // 6-7月杭州日出约5:00，日落约19:00
      let solarRatio = 0
      if (hour >= 5.0 && hour <= 19.0) {
        solarRatio = Math.sin(((hour - 5.0) / 14.0) * Math.PI)
      }

      // 云量波动
      const cloudSlow = 0.75 + 0.25 * Math.sin(dayOffset * 2.3 * Math.PI + minuteOfDay / 120 * Math.PI)
      const cloudFast = 0.85 + 0.15 * Math.sin(minuteOfDay / 10 * Math.PI + stationIdx * 1.7 + dayOffset * 3.7)
      const cloudFactor = (cloudSlow + cloudFast) / 2

      const irradianceWm2 = Math.round(solarRatio * 1000 * cloudFactor)

      // 6-7月基础温25°C
      const dayTempOffset = (seededRandom(dayOffset * 777 + stationIdx * 17) - 0.5) * 5
      const tempC = +(25 + solarRatio * 12 + Math.sin((hour - 9) / 12 * Math.PI) * 3
        + (seededRandom(stationIdx * 1000 + minuteOfDay + dayOffset * 499) - 0.5) * 2
        + dayTempOffset).toFixed(1)

      const humidBaseShift = 0.6 * seededRandom(dayOffset * 813 + stationIdx * 97) - 0.3
      const humidRaw = 65 - solarRatio * 30 + (seededRandom(stationIdx * 19 + dayOffset * 24 + t.getHours()) - 0.5) * 10 + humidBaseShift * 15
      const humidityPct = Math.round(Math.max(20, Math.min(98, humidRaw)))

      const panelEff = 0.78 + seededRandom(stationIdx * 13 + minuteOfDay * 3 + dayOffset * 251) * 0.06
      const inverterEff = irradianceWm2 > 0
        ? +(0.88 + seededRandom(stationIdx * 79 + minuteOfDay + dayOffset * 317) * 0.11).toFixed(3)
        : null
      const tempDerating = Math.max(0.85, 1 - 0.0035 * Math.max(0, tempC - 25))
      const powerKw = irradianceWm2 > 0
        ? Math.round((irradianceWm2 / 1000) * capacityKw * panelEff * (inverterEff ?? 0.90) * tempDerating)
        : 0

      const loadTrend = -0.015 * solarRatio
      const pvFluctuation = solarRatio > 0
        ? (seededRandom(minuteOfDay * 7 + stationIdx + dayOffset * 131) - 0.5) * 0.03 : 0
      const dailyWave = 0.015 * Math.sin((hour - 6) / 24 * Math.PI * 2)
      const fastNoise = (seededRandom(stationIdx * 5000 + minuteOfDay * 3 + dayOffset * 211) - 0.5) * 0.02
      const voltageFactor = 1.0 + loadTrend + pvFluctuation + dailyWave + fastNoise
      const clampMin = nominalKv >= 110 ? 0.96 : 0.92
      const clampMax = nominalKv >= 110 ? 1.04 : 1.08
      const voltageV = +(nominalKv * 1000 * Math.max(clampMin, Math.min(clampMax, voltageFactor))).toFixed(1)

      const weatherLabel = irradianceWm2 > 600 ? '晴' : irradianceWm2 > 300 ? '多云' : irradianceWm2 > 100 ? '阴天' : '雨天'

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
        expected_weather: weatherLabel,
        actual_weather: weatherLabel,
      })

      if (records.length >= batchSize) {
        insertMany(records.splice(0, batchSize))
      }
    }

    if (records.length > 0) {
      insertMany(records)
    }

    const pct = Math.round((stations.indexOf(station) + 1) / stations.length * 100)
    console.log(`  [${pct}%] ✓ ${s.station_name}: ${totalRecordsPerStation} 条`)
  }

  // 验证
  const count = await db('pv_output_measurements')
    .where('time', '>=', rangeStart)
    .where('time', '<', rangeEnd)
    .count('* as cnt')
    .first()
  console.log(`\n=== 完成 ===`)
  console.log(`总计: ${(count as any)?.cnt?.toLocaleString() ?? '?'} 条`)

  const summary = await db('pv_output_measurements')
    .join('solar_pv_stations', 'solar_pv_stations.id', 'pv_output_measurements.station_id')
    .where('pv_output_measurements.time', '>=', rangeStart)
    .where('pv_output_measurements.time', '<', rangeEnd)
    .groupBy('pv_output_measurements.station_id')
    .select(
      'solar_pv_stations.station_name as name',
      db.raw('COUNT(*) as cnt'),
      db.raw('ROUND(SUM(active_power_kw)) as sum_kw'),
      db.raw('ROUND(AVG(active_power_kw), 1) as avg_kw'),
      db.raw('MAX(active_power_kw) as max_kw'),
    )
    .orderBy('sum_kw', 'desc')

  console.log('\n电站汇总:')
  for (const r of summary as any[]) {
    console.log(`  ${r.name}: ${r.cnt}条  总${Number(r.sum_kw).toLocaleString()}kW  均${r.avg_kw}kW  峰${Number(r.max_kw).toLocaleString()}kW`)
  }

  rawDb.close()
  await db.destroy()
}

main().catch((err) => {
  console.error('生成失败:', err)
  try { rawDb.close() } catch {}
  db.destroy()
  process.exit(1)
})
