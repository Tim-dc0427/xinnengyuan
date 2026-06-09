/**
 * 每日光伏+负荷测量数据生成脚本
 *
 * 用法：
 *   cd server && npx tsx scripts/generate-daily-measurements.ts              # 生成昨天数据
 *   cd server && npx tsx scripts/generate-daily-measurements.ts 2026-06-09    # 生成指定日期
 *
 * 定时任务（Windows 任务计划程序 / Linux cron）：
 *   每天凌晨 1:00 执行，生成前一天的完整数据
 *   cron: 0 1 * * * cd /path/to/server && npx tsx scripts/generate-daily-measurements.ts
 */

import knex from 'knex'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { v4 as uuid } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db')

const db = knex({
  client: 'better-sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn: any, cb: Function) => {
      conn.pragma('journal_mode = WAL')
      conn.pragma('foreign_keys = ON')
      cb(null, conn)
    },
  },
})

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function pad2(n: number) { return String(n).padStart(2, '0') }
function pad3(n: number) { return String(n).padStart(3, '0') }

async function generateDaily(dateStr?: string) {
  // 默认昨天（今天数据可能不完整）
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const targetDate = dateStr || yesterday.toISOString().slice(0, 10)

  const [year, month, day] = targetDate.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  const dayOfYear = Math.floor((dateObj.getTime() - new Date(year, 0, 0).getTime()) / 86400000)

  console.log(`\n[${new Date().toISOString().slice(0, 19)}] 开始生成 ${targetDate} 数据...`)

  // 检查是否已有当天PV数据
  const existingPv = await db('pv_output_measurements')
    .where('time', 'like', `${targetDate}%`)
    .count('* as cnt').first()
  const existingLoad = await db('load_measurements')
    .where('time', 'like', `${targetDate}%`)
    .count('* as cnt').first()

  if ((existingPv as any)?.cnt > 0 && (existingLoad as any)?.cnt > 0) {
    console.log(`  ⊘ ${targetDate} 已有 PV:${(existingPv as any).cnt} 负荷:${(existingLoad as any).cnt} 条，跳过`)
    await db.destroy()
    return
  }

  // ==================== 光伏出力生成 ====================
  await generatePvData(targetDate, dayOfYear, dateObj)
  // ==================== 负荷数据生成 ====================
  await generateLoadData(targetDate, dayOfYear, dateObj)
  // ==================== 告警检测 ====================
  await detectAlerts(targetDate)

  await db.destroy()
  console.log('  完成')
}

// ==================== PV 出力 ====================
async function generatePvData(targetDate: string, dayOfYear: number, dateObj: Date) {
  const existing = await db('pv_output_measurements').where('time', 'like', `${targetDate}%`).count('* as cnt').first()
  if ((existing as any)?.cnt > 0) {
    console.log(`  ⊘ PV 已有 ${(existing as any).cnt} 条，跳过`)
    return
  }

  const stations = await db('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('solar_pv_stations.id', 'solar_pv_stations.plant_id', 'solar_pv_stations.station_name', 'solar_pv_stations.installed_capacity_mw', 'solar_pv_stations.grid_connection_voltage_kv', 'solar_pv_stations.installed_date', 'grid_buses.zone')
  if (stations.length === 0) { console.log('  ⊘ 无光伏电站'); return }

  const zones = [...new Set(stations.map((s: any) => s.zone || 'unknown'))]
  const zoneIndexMap = new Map(zones.map((z, i) => [z, i]))

  // 天气（区域共享）
  const weatherByZone = new Map<number, { weather: string; cloudFactor: number; tempBias: number; humidBias: number }>()
  for (let zi = 0; zi < zones.length; zi++) {
    const wr = seededRandom(dayOfYear * 137 + zi * 1000 + dateObj.getFullYear())
    let weather: string, cf: number, tb: number, hb: number
    if (wr < 0.35) { weather = '晴'; cf = 0.85 + seededRandom(dayOfYear * 7 + zi) * 0.15; tb = 2; hb = -10 }
    else if (wr < 0.65) { weather = '多云'; cf = 0.5 + seededRandom(dayOfYear * 11 + zi) * 0.25; tb = 0; hb = 5 }
    else if (wr < 0.85) { weather = '阴天'; cf = 0.2 + seededRandom(dayOfYear * 13 + zi) * 0.2; tb = -2; hb = 15 }
    else { weather = '雨天'; cf = 0.05 + seededRandom(dayOfYear * 17 + zi) * 0.15; tb = -4; hb = 25 }
    weatherByZone.set(zi, { weather, cloudFactor: cf, tempBias: tb, humidBias: hb })
  }

  let totalRecords = 0
  const batchSize = 200

  for (let si = 0; si < stations.length; si++) {
    const s = stations[si] as any
    const capacityKw = s.installed_capacity_mw * 1000
    const gridKv = s.grid_connection_voltage_kv || 110
    const zoneIdx = zoneIndexMap.get(s.zone || 'unknown') ?? 0
    const wInfo = weatherByZone.get(zoneIdx)!

    // 确保 plant_id
    if (!s.plant_id) {
      const existing = await db('power_plants').where('id', s.id).first()
      if (!existing) {
        await db('power_plants').insert({ id: s.id, name: s.station_name, plant_type: 'PV', capacity_kw: capacityKw, installed_date: s.installed_date || '2024-01-01', status: 'active', created_at: new Date().toISOString() })
      }
      await db('solar_pv_stations').where('id', s.id).update({ plant_id: s.id })
      s.plant_id = s.id
    }

    // 与种子保持一致的3点滑动平均平滑
    const rawCloudVars: number[] = []
    for (let h = 0; h < 24; h++) {
      rawCloudVars.push(0.85 + seededRandom(dayOfYear * 31 + h * 17 + si * 100) * 0.3)
    }
    const smoothCloudVars = rawCloudVars.map((v, h) => {
      if (h === 0) return (v + rawCloudVars[1]) / 2
      if (h === 23) return (rawCloudVars[22] + v) / 2
      return (rawCloudVars[h - 1] + v + rawCloudVars[h + 1]) / 3
    })

    const yearsSinceInstall = (dateObj.getTime() - new Date(s.installed_date || '2024-01-01').getTime()) / (365.25 * 86400000)
    const records: any[] = []

    for (let h = 0; h < 24; h++) {
      let solarRatio = 0
      if (h >= 5 && h <= 18) solarRatio = Math.sin(((h - 5) / 13) * Math.PI)
      else if (h === 4) solarRatio = 0.01
      else if (h === 19) solarRatio = 0.02

      const irradianceWm2 = Math.round(solarRatio * 1000 * wInfo.cloudFactor * smoothCloudVars[h])
      const panelEff = 0.78 + seededRandom(si * 13 + h * 3) * 0.06
      const inverterEff = irradianceWm2 > 0 ? +(0.88 + seededRandom(dayOfYear * 79 + h + si * 100) * 0.11).toFixed(3) : null
      const tempC = +(18 + solarRatio * 12 + wInfo.tempBias + (seededRandom(dayOfYear * 47 + h + si * 100) - 0.5) * 1.5).toFixed(1)
      const tempDerating = Math.max(0.87, Math.min(1.05, 1 - 0.005 * (tempC - 15)))
      const ageDerating = yearsSinceInstall <= 0 ? 1 : yearsSinceInstall < 0.5 ? +(1 - 0.02 * (yearsSinceInstall / 0.5)).toFixed(4) : +(0.98 - 0.005 * (yearsSinceInstall - 0.5)).toFixed(4)

      const powerKw = irradianceWm2 > 0
        ? Math.round((irradianceWm2 / 1000) * capacityKw * panelEff * inverterEff! * tempDerating * ageDerating)
        : 0

      const timeStr = `${targetDate}T${pad2(h)}:${pad2(Math.floor(seededRandom(dayOfYear * 67 + h + si * 100) * 60))}:00`

      records.push({
        id: uuid(), time: timeStr, plant_id: s.plant_id || '', station_id: s.id,
        active_power_kw: powerKw,
        reactive_power_kvar: Math.round(powerKw * (0.06 + seededRandom(dayOfYear * 41 + h + si * 100) * 0.06)),
        voltage_v: Number((gridKv * 1000 * (0.98 + seededRandom(dayOfYear * 53 + h + si * 100) * 0.04)).toFixed(1)),
        current_a: Math.round((powerKw / gridKv) * (0.9 + seededRandom(dayOfYear * 59 + h + si * 100) * 0.2)),
        frequency_hz: +(50 + seededRandom(dayOfYear * 61 + h + si * 100) * 0.08 - 0.04).toFixed(3),
        power_factor: +(0.94 + seededRandom(dayOfYear * 71 + h + si * 100) * 0.05).toFixed(3),
        temperature_c: tempC, irradiance_wm2: irradianceWm2,
        humidity_pct: Math.round(Math.max(15, Math.min(95, 55 - solarRatio * 25 + wInfo.humidBias + (seededRandom(dayOfYear * 19 + h + si * 100) - 0.5) * 6))),
        inverter_efficiency: inverterEff,
        confidence_pct: Math.round(70 + seededRandom(dayOfYear * 83 + h + si * 100) * 30),
        expected_weather: wInfo.weather, actual_weather: wInfo.weather,
      })
    }

    for (let i = 0; i < records.length; i += batchSize) {
      await db('pv_output_measurements').insert(records.slice(i, i + batchSize))
    }
    totalRecords += 24
  }
  console.log(`  ✓ PV: ${stations.length} 电站 × 24h = ${totalRecords} 条`)
}

// ==================== 负荷数据 ====================
async function generateLoadData(targetDate: string, dayOfYear: number, dateObj: Date) {
  const existing = await db('load_measurements').where('time', 'like', `${targetDate}%`).count('* as cnt').first()
  if ((existing as any)?.cnt > 0) {
    console.log(`  ⊘ 负荷已有 ${(existing as any).cnt} 条，跳过`)
    return
  }

  const buses = await db('grid_buses').select('id', 'name', 'voltage_level')
  if (buses.length === 0) { console.log('  ⊘ 无母线'); return }

  const intervalMin = 15
  const batchSize = 200
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
  const monthIdx = dateObj.getMonth()

  let totalRecords = 0
  for (let bi = 0; bi < buses.length; bi++) {
    const bus = buses[bi] as any
    const voltageLevel = bus.voltage_level || '10kV'

    let baseLoadMw: number
    if (voltageLevel.includes('220')) baseLoadMw = 20 + (bi % 10)
    else if (voltageLevel.includes('110')) baseLoadMw = 10 + (bi % 8)
    else baseLoadMw = 3 + (bi % 5)

    const allRecords: any[] = []
    for (let m = 0; m < 24 * 60; m += intervalMin) {
      const hour = Math.floor(m / 60) + (m % 60) / 60

      let loadFactor: number
      if (isWeekend) {
        loadFactor = 0.6 + Math.sin((hour - 8) / 14 * Math.PI) * 0.25
      } else {
        if (hour >= 8 && hour <= 11) loadFactor = 0.75 + Math.sin((hour - 8) / 3 * Math.PI * 0.5) * 0.2
        else if (hour >= 18 && hour <= 21) loadFactor = 0.8 + Math.sin((hour - 18) / 3 * Math.PI * 0.5) * 0.2
        else if (hour >= 23 || hour <= 5) loadFactor = 0.3 + seededRandom(bi * 10000 + dayOfYear + hour) * 0.1
        else loadFactor = 0.5 + seededRandom(bi * 20000 + dayOfYear + hour) * 0.15
      }

      const seasonalFactor = 0.85 + (monthIdx - 2) * 0.08
      const noiseMw = (seededRandom(bi * 30000 + dayOfYear * 24 + Math.floor(hour)) - 0.5) * baseLoadMw * 0.05
      const powerMw = Number((baseLoadMw * loadFactor * seasonalFactor + noiseMw).toFixed(3))

      allRecords.push({
        id: uuid(),
        time: `${targetDate}T${pad2(Math.floor(hour))}:${pad2(m % 60)}:00.000`,
        bus_id: bus.id,
        active_power_mw: powerMw,
        reactive_power_mvar: Number((powerMw * (0.3 + seededRandom(bi * 40000 + dayOfYear + hour) * 0.1)).toFixed(3)),
        data_type: 'actual',
        temperature_c: Number((20 + Math.sin((hour - 6) / 14 * Math.PI) * 8 + (seededRandom(bi * 50000 + dayOfYear) - 0.5) * 2).toFixed(1)),
        humidity_pct: Math.round(45 + (1 - Math.sin((hour - 6) / 14 * Math.PI)) * 20 + (seededRandom(bi * 60000 + dayOfYear) - 0.5) * 5),
      })
    }

    for (let i = 0; i < allRecords.length; i += batchSize) {
      await db('load_measurements').insert(allRecords.slice(i, i + batchSize))
    }
    totalRecords += allRecords.length
  }
  console.log(`  ✓ 负荷: ${buses.length} 母线 × 96条 = ${totalRecords} 条`)
}

// ==================== 告警检测 ====================
async function detectAlerts(targetDate: string) {
  const stations = await db('solar_pv_stations').select('id', 'station_name', 'grid_connection_voltage_kv')
  let alertCount = 0

  for (const s of stations as any[]) {
    const sData = await db('pv_output_measurements')
      .where('station_id', s.id).where('time', 'like', `${targetDate}%`)
      .select('time', 'voltage_v', 'frequency_hz', 'power_factor').orderBy('time', 'asc')
    const kv = s.grid_connection_voltage_kv || 10
    const nominalV = kv * 1000

    for (let i = 0; i < sData.length; i++) {
      const d = sData[i], ct = new Date(d.time).getTime()
      const vVals: number[] = []
      for (let j = i; j >= 0; j--) {
        if (new Date(sData[j].time).getTime() >= ct - 15 * 60 * 1000) vVals.push(sData[j].voltage_v)
        else break
      }
      if (vVals.length >= 2) {
        const fluc = +(((Math.max(...vVals) - Math.min(...vVals)) / nominalV) * 100).toFixed(2)
        if (fluc > 5) {
          await insertAlert('VOLTAGE_FLUCTUATION', s.id, d.time, fluc > 7 ? 'CRITICAL' : 'WARN', `电压波动${fluc}%`, `${s.station_name}电压波动${fluc}%`, { fluctuationPct: fluc, nominalVoltageKv: kv })
          alertCount++
        }
      }
      const freqDev = Math.abs((d.frequency_hz || 50) - 50)
      if (freqDev > 0.5) {
        await insertAlert('FREQUENCY_DEVIATION', s.id, d.time, freqDev > 1 ? 'CRITICAL' : 'WARN', `频率偏差${freqDev.toFixed(2)}Hz`, `${s.station_name}频率${d.frequency_hz}Hz偏离50Hz`, { freqDeviationHz: +freqDev.toFixed(2) })
        alertCount++
      }
      const pf = d.power_factor || 1
      if (pf < 0.85) {
        await insertAlert('POWER_FACTOR', s.id, d.time, pf < 0.8 ? 'CRITICAL' : 'WARN', `功率因数${pf.toFixed(2)}`, `${s.station_name}功率因数${pf.toFixed(2)}低于0.85`, { powerFactor: +pf.toFixed(2) })
        alertCount++
      }
    }
  }
  if (alertCount > 0) console.log(`  ⚠ 供电质量告警: ${alertCount} 条`)
}

async function insertAlert(type: string, sourceId: string, time: string, level: string, title: string, msg: string, meta: any) {
  const exists = await db('alerts').where({ source_type: type, source_id: sourceId, triggered_at: time }).first()
  if (exists) return
  await db('alerts').insert({ id: uuid(), alert_level: level, source_type: type, source_id: sourceId, title, message: msg, triggered_at: time, metadata: JSON.stringify(meta) })
}

// 解析命令行参数
const args = process.argv.slice(2)
const dateArg = args[0] || undefined

generateDaily(dateArg).catch((err) => {
  console.error('生成失败:', err)
  db.destroy()
  process.exit(1)
})
