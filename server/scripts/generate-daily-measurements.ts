/**
 * 每日光伏测量数据生成脚本
 *
 * 用法：
 *   cd server && npx tsx scripts/generate-daily-measurements.ts              # 生成今天数据
 *   cd server && npx tsx scripts/generate-daily-measurements.ts 2026-06-03    # 生成指定日期
 *
 * 定时任务（Windows 任务计划程序 / Linux cron）：
 *   每天凌晨 1:00 执行，确保前一天数据完整，同时生成当天预测数据
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

async function generateDaily(dateStr?: string) {
  const targetDate = dateStr || new Date().toISOString().slice(0, 10)
  console.log(`\n[${new Date().toISOString().slice(0, 19)}] 开始生成 ${targetDate} 光伏测量数据...`)

  // 检查是否已有当天数据
  const existingCount = await db('pv_output_measurements')
    .where('time', 'like', `${targetDate}%`)
    .count('* as cnt')
    .first()
  if ((existingCount as any)?.cnt > 0) {
    console.log(`  ⊘ ${targetDate} 已有 ${(existingCount as any).cnt} 条数据，跳过`)
    await db.destroy()
    return
  }

  // 读取所有集中式光伏电站
  const stations = await db('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select(
      'solar_pv_stations.id',
      'solar_pv_stations.plant_id',
      'solar_pv_stations.station_name',
      'solar_pv_stations.installed_capacity_mw',
      'solar_pv_stations.grid_connection_voltage_kv',
      'grid_buses.zone',
    )
  if (stations.length === 0) {
    console.log('  ⊘ 无光伏电站，跳过')
    await db.destroy()
    return
  }

  // 构建区域 → 区域索引映射（同区域电站共享天气）
  const zones = [...new Set(stations.map((s: any) => s.zone || 'unknown'))]
  const zoneIndexMap = new Map(zones.map((z, i) => [z, i]))

  // 当天天气（按区域共享）
  const date = new Date(targetDate)
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  const weatherByZone = new Map<number, { weather: string; cloudFactor: number; tempBias: number; humidBias: number }>()
  for (let zi = 0; zi < zones.length; zi++) {
    const wr = seededRandom(dayOfYear * 137 + zi * 1000 + date.getFullYear())
    let weather: string, cloudFactor: number, tempBias: number, humidBias: number
    if (wr < 0.35) { weather = '晴'; cloudFactor = 0.85 + seededRandom(dayOfYear * 7 + zi) * 0.15; tempBias = 2; humidBias = -10 }
    else if (wr < 0.65) { weather = '多云'; cloudFactor = 0.5 + seededRandom(dayOfYear * 11 + zi) * 0.25; tempBias = 0; humidBias = 5 }
    else if (wr < 0.85) { weather = '阴天'; cloudFactor = 0.2 + seededRandom(dayOfYear * 13 + zi) * 0.2; tempBias = -2; humidBias = 15 }
    else { weather = '雨天'; cloudFactor = 0.05 + seededRandom(dayOfYear * 17 + zi) * 0.15; tempBias = -4; humidBias = 25 }
    weatherByZone.set(zi, { weather, cloudFactor, tempBias, humidBias })
  }

  let totalRecords = 0
  const batchSize = 200

  for (let si = 0; si < stations.length; si++) {
    const s = stations[si] as any
    const capacityKw = s.installed_capacity_mw * 1000
    const gridKv = s.grid_connection_voltage_kv || 110
    const zoneIdx = zoneIndexMap.get(s.zone || 'unknown') ?? 0
    const wInfo = weatherByZone.get(zoneIdx)!

    // 确保 power_plants 关联存在
    if (!s.plant_id) {
      const existing = await db('power_plants').where('id', s.id).first()
      if (!existing) {
        await db('power_plants').insert({
          id: s.id,
          name: s.station_name,
          plant_type: 'PV',
          capacity_kw: capacityKw,
          installed_date: '2024-01-01',
          status: 'active',
          created_at: new Date().toISOString(),
        })
      }
      await db('solar_pv_stations').where('id', s.id).update({ plant_id: s.id })
      s.plant_id = s.id
    }

    const records: any[] = []
    for (let h = 0; h < 24; h++) {
      // 日射曲线
      let solarRatio = 0
      if (h >= 6 && h <= 18) solarRatio = Math.sin(((h - 6) / 12) * Math.PI)
      else if (h === 5) solarRatio = 0.05
      else if (h === 19) solarRatio = 0.03

      const hourCloudVar = 0.85 + seededRandom(dayOfYear * 31 + h * 17 + si * 100) * 0.3
      const irradianceWm2 = Math.round(solarRatio * 1000 * wInfo.cloudFactor * hourCloudVar)

      const panelEff = 0.78 + seededRandom(si * 13 + h * 3) * 0.06
      const powerKw = Math.round((irradianceWm2 / 1000) * capacityKw * panelEff)

      const tempC = +(18 + solarRatio * 12 + wInfo.tempBias + (seededRandom(dayOfYear * 47 + h + si * 100) - 0.5) * 1.5).toFixed(1)
      const humidityPct = Math.round(Math.max(15, Math.min(95, 55 - solarRatio * 25 + wInfo.humidBias + (seededRandom(dayOfYear * 19 + h + si * 100) - 0.5) * 6)))

      const timeStr = `${targetDate}T${String(h).padStart(2, '0')}:${String(Math.floor(seededRandom(dayOfYear * 67 + h + si * 100) * 60)).padStart(2, '0')}:00`

      records.push({
        id: uuid(),
        time: timeStr,
        plant_id: s.plant_id || '',
        station_id: s.id,
        active_power_kw: powerKw,
        reactive_power_kvar: Math.round(powerKw * (0.06 + seededRandom(dayOfYear * 41 + h + si * 100) * 0.06)),
        voltage_v: Number((gridKv * 1000 * (0.98 + seededRandom(dayOfYear * 53 + h + si * 100) * 0.04)).toFixed(1)),
        current_a: Math.round((powerKw / gridKv) * (0.9 + seededRandom(dayOfYear * 59 + h + si * 100) * 0.2)),
        frequency_hz: +(50 + seededRandom(dayOfYear * 61 + h + si * 100) * 0.08 - 0.04).toFixed(3),
        power_factor: +(0.94 + seededRandom(dayOfYear * 71 + h + si * 100) * 0.05).toFixed(3),
        temperature_c: tempC,
        irradiance_wm2: irradianceWm2,
        humidity_pct: humidityPct,
        inverter_efficiency: +(0.965 + seededRandom(dayOfYear * 79 + h + si * 100) * 0.025).toFixed(3),
        confidence_pct: Math.round(70 + seededRandom(dayOfYear * 83 + h + si * 100) * 30),
        expected_weather: wInfo.weather,
        actual_weather: wInfo.weather,
      })

      if (records.length >= batchSize) {
        await db('pv_output_measurements').insert(records.splice(0, batchSize))
      }
    }
    if (records.length > 0) {
      await db('pv_output_measurements').insert(records)
    }
    totalRecords += 24
  }

  console.log(`  ✓ ${stations.length} 个电站 × 24小时 = ${totalRecords} 条记录`)

  // 告警检测：电压波动 + 频率偏差 + 功率因数
  let alertCount = 0
  for (const s of stations) {
    const sAny = s as any
    const sData = await db('pv_output_measurements')
      .where('station_id', sAny.id).where('time', 'like', `${targetDate}%`)
      .select('time', 'voltage_v', 'frequency_hz', 'power_factor').orderBy('time', 'asc')
    const kv = sAny.grid_connection_voltage_kv || 10
    const nominalV = kv * 1000
    for (let i = 0; i < sData.length; i++) {
      const d = sData[i], ct = new Date(d.time).getTime()
      // 电压波动
      const vVals: number[] = []
      for (let j = i; j >= 0; j--) {
        if (new Date(sData[j].time).getTime() >= ct - 15 * 60 * 1000) vVals.push(sData[j].voltage_v)
        else break
      }
      if (vVals.length >= 2) {
        const fluc = +(((Math.max(...vVals) - Math.min(...vVals)) / nominalV) * 100).toFixed(2)
        if (fluc > 5) {
          await insertAlert('VOLTAGE_FLUCTUATION', sAny.id, d.time, fluc > 7 ? 'CRITICAL' : 'WARN', `电压波动${fluc}%`, `${sAny.station_name}电压波动${fluc}%`, { fluctuationPct: fluc, nominalVoltageKv: kv })
          alertCount++
        }
      }
      // 频率偏差（国标 ±0.5Hz）
      const freqDev = Math.abs((d.frequency_hz || 50) - 50)
      if (freqDev > 0.5) {
        await insertAlert('FREQUENCY_DEVIATION', sAny.id, d.time, freqDev > 1 ? 'CRITICAL' : 'WARN', `频率偏差${freqDev.toFixed(2)}Hz`, `${sAny.station_name}频率${d.frequency_hz}Hz偏离50Hz`, { freqDeviationHz: +freqDev.toFixed(2) })
        alertCount++
      }
      // 功率因数（低于0.85告警）
      const pf = d.power_factor || 1
      if (pf < 0.85) {
        await insertAlert('POWER_FACTOR', sAny.id, d.time, pf < 0.8 ? 'CRITICAL' : 'WARN', `功率因数${pf.toFixed(2)}`, `${sAny.station_name}功率因数${pf.toFixed(2)}低于0.85`, { powerFactor: +pf.toFixed(2) })
        alertCount++
      }
    }
  }
  if (alertCount > 0) console.log(`  ⚠ 供电质量告警：${alertCount} 条`)

  async function insertAlert(type: string, sourceId: string, time: string, level: string, title: string, msg: string, meta: any) {
    const exists = await db('alerts').where({ source_type: type, source_id: sourceId, triggered_at: time }).first()
    if (exists) return
    await db('alerts').insert({ id: uuid(), alert_level: level, source_type: type, source_id: sourceId, title, message: msg, triggered_at: time, metadata: JSON.stringify(meta) })
  }

  // 碳排放：每月1号补上月数据
  const today = new Date(targetDate)
  if (today.getDate() === 1) {
    await generateMonthlyCarbon(today.getFullYear(), today.getMonth())
  }

  await db.destroy()
  console.log('  完成')
}

async function generateMonthlyCarbon(year: number, month: number) {
  const monthDays = new Date(year, month + 1, 0).getDate()
  const periodStart = `${year}-${String(month + 1).padStart(2, '0')}-01`

  const existing = await db('carbon_emissions').where('period_start', periodStart).count('* as cnt').first()
  if ((existing as any)?.cnt > 0) {
    console.log(`  ⊘ 碳排放 ${periodStart} 已存在，跳过`)
    return
  }

  const stations = await db('solar_pv_stations').select('id', 'plant_id', 'installed_capacity_mw')
  const co2PerKwh = 0.85; const coalPerKwh = 0.32; const so2PerKwh = 0.003; const noxPerKwh = 0.002
  const records: any[] = []

  for (const st of stations as any[]) {
    const capKw = st.installed_capacity_mw * 1000
    const dailyHours = 2.5 + (month + 1) * 0.8
    const monthlyOutputKwh = Math.round(capKw * dailyHours * monthDays)
    records.push({
      id: uuid(),
      plant_id: st.plant_id || '',
      period_type: 'monthly',
      period_start: periodStart,
      total_output_kwh: monthlyOutputKwh,
      co2_reduction_kg: Math.round(monthlyOutputKwh * co2PerKwh),
      coal_saving_ton: +(monthlyOutputKwh * coalPerKwh / 1000).toFixed(2),
      so2_reduction_kg: Math.round(monthlyOutputKwh * so2PerKwh),
      nox_reduction_kg: Math.round(monthlyOutputKwh * noxPerKwh),
    })
  }

  await db('carbon_emissions').insert(records)
  console.log(`  ✓ 碳排放 ${periodStart}: ${records.length} 条记录`)
}

// 解析命令行参数，默认今天
const args = process.argv.slice(2)
const dateArg = args[0] || undefined

generateDaily(dateArg).catch((err) => {
  console.error('生成失败:', err)
  db.destroy()
  process.exit(1)
})
