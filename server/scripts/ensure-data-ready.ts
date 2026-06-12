/**
 * 统一数据就绪检查 + 缺失数据生成
 *
 * 用法: cd server && npx tsx scripts/ensure-data-ready.ts
 *
 * 严格复刻种子文件的物理模型，覆盖 2025-08-01 ~ 2026-08-01。
 * 幂等：已有数据自动跳过，可重复安全运行。
 */
import { v4 as uuid } from 'uuid'
import knex from 'knex'
import BetterSqlite3 from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data.db')

const db = knex({ client: 'better-sqlite3', connection: { filename: dbPath }, useNullAsDefault: true })
const raw = new BetterSqlite3(dbPath)

// ==================== 工具函数 ====================
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
function pad2(n: number) { return String(n).padStart(2, '0') }
function pad3(n: number) { return String(n).padStart(3, '0') }

const TARGET_START = '2025-08-01'
const TARGET_END = '2026-08-01' // exclusive

// 数据契约
interface Contract { table: string; timeCol: string | null; granularity: string; sourceSeed: string; minRecords: number }
const CONTRACTS: Contract[] = [
  { table: 'pv_output_measurements', timeCol: 'time', granularity: '5min', sourceSeed: '003c', minRecords: 900_000 },
  { table: 'load_measurements', timeCol: 'time', granularity: '15min', sourceSeed: '004', minRecords: 300_000 },
  { table: 'voltage_measurements', timeCol: 'time', granularity: '1h', sourceSeed: 'none', minRecords: 100_000 },
  { table: 'equipment_temperature', timeCol: 'time', granularity: '6h', sourceSeed: '018', minRecords: 25_000 },
  { table: 'storage_entities', timeCol: null, granularity: 'static', sourceSeed: '007', minRecords: 10 },
  { table: 'load_entities', timeCol: null, granularity: 'static', sourceSeed: '007', minRecords: 5 },
]

function dateStr(d: Date) { return d.toISOString().slice(0, 19) }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

// ==================== Phase 1: Check ====================
async function checkAll(): Promise<Map<string, { count: number; minTime: string | null; maxTime: string | null; ok: boolean }>> {
  const results = new Map()
  for (const c of CONTRACTS) {
    if (c.timeCol) {
      const row = await db(c.table)
        .where(c.timeCol, '>=', TARGET_START)
        .where(c.timeCol, '<', TARGET_END)
        .select(db.raw('COUNT(*) as cnt, MIN(' + c.timeCol + ') as min_t, MAX(' + c.timeCol + ') as max_t'))
        .first() as any
      const count = row?.cnt || 0
      const ok = count >= c.minRecords
      results.set(c.table, { count, minTime: row?.min_t || null, maxTime: row?.max_t || null, ok })
      console.log(`  ${ok ? '✅' : '❌'} ${c.table}: ${count.toLocaleString()} 条 (需≥${c.minRecords.toLocaleString()})`)
    } else {
      const row = await db(c.table).count('* as cnt').first() as any
      const count = row?.cnt || 0
      const ok = count >= c.minRecords
      results.set(c.table, { count, minTime: null, maxTime: null, ok })
      console.log(`  ${ok ? '✅' : '❌'} ${c.table}: ${count} 条 (需≥${c.minRecords})`)
    }
  }
  return results
}

// ==================== Phase 2: Generate ====================

async function generatePVMeasurements() {
  console.log('\n--- 生成 pv_output_measurements (5min, 全量) ---')
  const stations = await db('solar_pv_stations')
    .where('status', 'active')
    .select('id', 'plant_id', 'station_name', 'installed_capacity_mw', 'grid_connection_voltage_kv')

  if (!stations.length) { console.log('  无活跃电站，跳过'); return }

  const startDate = new Date('2025-08-01T00:00:00')
  const endDate = new Date('2026-07-31T23:55:00')
  const totalMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000)
  const perStation = Math.floor(totalMin / 5) + 1
  console.log(`  共 ${stations.length} 站，每站 ${perStation.toLocaleString()} 条，总计 ~${(perStation * stations.length).toLocaleString()} 条`)

  // 清空目标范围
  const deleted = raw.prepare('DELETE FROM pv_output_measurements WHERE time >= ? AND time < ?').run(TARGET_START, TARGET_END)
  console.log(`  已清空 ${deleted.changes} 条旧数据`)

  const stmt = raw.prepare(`INSERT INTO pv_output_measurements
    (id, time, plant_id, station_id, active_power_kw, reactive_power_kvar, voltage_v, current_a, frequency_hz, power_factor,
     temperature_c, irradiance_wm2, humidity_pct, inverter_efficiency, confidence_pct, expected_weather, actual_weather)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)

  const batchSize = 2000
  const insertBatch = raw.transaction((rows: any[]) => { for (const r of rows) stmt.run(...r) })

  // 逐月生成（不同月份不同季节参数）
  const months: Array<[number, number]> = []
  for (let y = 2025; y <= 2026; y++) {
    const sm = y === 2025 ? 8 : 1; const em = y === 2026 ? 7 : 12
    for (let m = sm; m <= em; m++) months.push([y, m])
  }

  for (const [year, month] of months) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month - 1, daysInMonth, 23, 59)
    const monthMin = Math.round((monthEnd.getTime() - monthStart.getTime()) / 60000)
    // 季节参数
    const isSummer = month >= 6 && month <= 8   // 夏
    const isAutumn = month >= 9 && month <= 11  // 秋
    const isWinter = month === 12 || month <= 2 // 冬
    const isSpring = month >= 3 && month <= 5   // 春

    const sunrise = isSummer ? 5.0 : isAutumn ? 6.0 : isWinter ? 6.75 : 5.75
    const sunset = isSummer ? 19.0 : isAutumn ? 17.5 : isWinter ? 17.0 : 18.25
    const dayLen = sunset - sunrise
    const baseTemp = isSummer ? 25 : isAutumn ? 18 : isWinter ? 5 : 15
    const rainProb = isSummer ? 0.30 : isAutumn ? 0.15 : isWinter ? 0.10 : 0.20

    console.log(`  ${year}/${String(month).padStart(2,'0')} (日出${sunrise.toFixed(1)} 日落${sunset.toFixed(1)} 基础温${baseTemp}°C)`)
    const dayOffsetBase = Math.round((monthStart.getTime() - new Date('2025-01-01').getTime()) / 86400000)

    for (const station of stations) {
      const s = station as any
      const capacityKw = s.installed_capacity_mw * 1000
      const nominalKv = s.grid_connection_voltage_kv || 10
      const stIdx = stations.indexOf(station)
      const records: any[][] = []

      for (let m = 0; m <= monthMin; m += 5) {
        const t = new Date(monthStart.getTime() + m * 60000)
        const hour = t.getHours() + t.getMinutes() / 60
        const dayOffset = dayOffsetBase + Math.floor(m / 1440)
        const minuteOfDay = t.getHours() * 60 + t.getMinutes()

        let solarRatio = 0
        if (hour >= sunrise && hour <= sunset) {
          solarRatio = Math.sin(((hour - sunrise) / dayLen) * Math.PI)
        }
        // 雨天降低辐照
        const isRainy = seededRandom(dayOffset * 719 + stIdx * 31) < rainProb
        const cloudSlow = 0.75 + 0.25 * Math.sin(dayOffset * 2.3 * Math.PI + minuteOfDay / 120 * Math.PI)
        const cloudFast = 0.85 + 0.15 * Math.sin(minuteOfDay / 10 * Math.PI + stIdx * 1.7 + dayOffset * 3.7)
        let cloudFactor = (cloudSlow + cloudFast) / 2
        if (isRainy) cloudFactor *= 0.3

        const irradianceWm2 = Math.round(solarRatio * 1000 * cloudFactor)
        const dayTempOff = (seededRandom(dayOffset * 777 + stIdx * 17) - 0.5) * 5
        const tempC = +(baseTemp + solarRatio * 12 + Math.sin((hour - 9) / 12 * Math.PI) * 3
          + (seededRandom(stIdx * 1000 + minuteOfDay + dayOffset * 499) - 0.5) * 2 + dayTempOff).toFixed(1)

        const panelEff = 0.78 + seededRandom(stIdx * 13 + minuteOfDay * 3 + dayOffset * 251) * 0.06
        const inverterEff = irradianceWm2 > 0
          ? +(0.88 + seededRandom(stIdx * 79 + minuteOfDay + dayOffset * 317) * 0.11).toFixed(3) : null
        const tempDerating = Math.max(0.85, 1 - 0.0035 * Math.max(0, tempC - 25))
        const powerKw = irradianceWm2 > 0
          ? Math.round((irradianceWm2 / 1000) * capacityKw * panelEff * (inverterEff ?? 0.90) * tempDerating) : 0

        const loadTrend = -0.015 * solarRatio
        const pvFluct = solarRatio > 0 ? (seededRandom(minuteOfDay * 7 + stIdx + dayOffset * 131) - 0.5) * 0.03 : 0
        const dailyW = 0.015 * Math.sin((hour - 6) / 24 * Math.PI * 2)
        const fastN = (seededRandom(stIdx * 5000 + minuteOfDay * 3 + dayOffset * 211) - 0.5) * 0.02
        const vFactor = 1.0 + loadTrend + pvFluct + dailyW + fastN
        const cMin = nominalKv >= 110 ? 0.96 : 0.92; const cMax = nominalKv >= 110 ? 1.04 : 1.08
        const voltageV = +(nominalKv * 1000 * Math.max(cMin, Math.min(cMax, vFactor))).toFixed(1)

        const humidRaw = 65 - solarRatio * 30 + (seededRandom(stIdx * 19 + dayOffset * 24 + t.getHours()) - 0.5) * 10
        const humidityPct = Math.round(Math.max(15, Math.min(98, humidRaw)))
        const wl = irradianceWm2 > 600 ? '晴' : irradianceWm2 > 300 ? '多云' : irradianceWm2 > 100 ? '阴天' : '雨天'

        records.push([
          uuid(), dateStr(t), s.plant_id || '', s.id,
          powerKw, Math.round(powerKw * (0.04 + seededRandom(stIdx * 41 + minuteOfDay + dayOffset * 71) * 0.04)),
          voltageV, Math.round((powerKw / nominalKv) * (0.9 + seededRandom(stIdx * 59 + minuteOfDay + dayOffset * 89) * 0.2)),
          +(50 + seededRandom(stIdx * 61 + minuteOfDay + dayOffset * 103) * 0.06 - 0.03).toFixed(3),
          +(0.95 + seededRandom(stIdx * 71 + minuteOfDay + dayOffset * 137) * 0.04).toFixed(3),
          tempC, irradianceWm2, humidityPct, inverterEff,
          Math.round(70 + seededRandom(stIdx * 83 + minuteOfDay) * 30), wl, wl,
        ])

        if (records.length >= batchSize) {
          insertBatch(records.splice(0, batchSize))
        }
      }
      if (records.length) insertBatch(records)
    }
  }
  const cnt = raw.prepare('SELECT COUNT(*) as c FROM pv_output_measurements WHERE time >= ? AND time < ?').get(TARGET_START, TARGET_END) as any
  console.log(`  ✅ pv_output_measurements: ${cnt.c.toLocaleString()} 条`)
}

async function generateLoadMeasurements() {
  console.log('\n--- 生成 load_measurements (15min, 9个PV bus) ---')

  const stationBuses = await db('solar_pv_stations')
    .where('status', 'active')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('grid_buses.id as busId', 'grid_buses.name as busName', 'grid_buses.voltage_level as voltageLevel')

  if (!stationBuses.length) { console.log('  无关联母线，跳过'); return }

  const deleted = raw.prepare('DELETE FROM load_measurements WHERE time >= ? AND time < ?').run(TARGET_START, TARGET_END)
  console.log(`  已清空 ${deleted.changes} 条旧数据`)

  const stmt = raw.prepare(`INSERT INTO load_measurements (id, time, bus_id, active_power_mw, reactive_power_mvar, data_type, temperature_c, humidity_pct)
    VALUES (?,?,?,?,?,?,?,?)`)

  const batchSize = 2000
  const insertBatch = raw.transaction((rows: any[]) => { for (const r of rows) stmt.run(...r) })
  const intervalMin = 15

  const startDate = new Date('2025-08-01T00:00:00')
  const endDate = new Date('2026-07-31T23:45:00')
  const totalMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000)

  for (const bus of stationBuses) {
    const b = bus as any
    const voltageLevel = b.voltageLevel || '10kV'
    const busIdx = stationBuses.indexOf(bus)
    // 种子 004 公式：baseLoadMw 按电压等级
    let baseLoadMw: number
    if (voltageLevel.includes('220')) baseLoadMw = 20 + (busIdx % 10)
    else if (voltageLevel.includes('110')) baseLoadMw = 10 + (busIdx % 8)
    else baseLoadMw = 3 + (busIdx % 5)

    const records: any[][] = []
    for (let m = 0; m <= totalMin; m += intervalMin) {
      const t = new Date(startDate.getTime() + m * 60000)
      const hour = t.getHours() + t.getMinutes() / 60
      const isWeekend = t.getDay() === 0 || t.getDay() === 6
      const monthIdx = t.getMonth()
      const dayOfYear = Math.floor((t.getTime() - new Date(t.getFullYear(), 0, 0).getTime()) / 86400000)

      // 种子 004 负荷因子公式（精确复刻）
      let loadFactor: number
      if (isWeekend) {
        loadFactor = 0.6 + Math.sin((hour - 8) / 14 * Math.PI) * 0.25
      } else {
        if (hour >= 8 && hour <= 11) loadFactor = 0.75 + Math.sin((hour - 8) / 3 * Math.PI * 0.5) * 0.2
        else if (hour >= 18 && hour <= 21) loadFactor = 0.8 + Math.sin((hour - 18) / 3 * Math.PI * 0.5) * 0.2
        else if (hour >= 23 || hour <= 5) loadFactor = 0.3 + seededRandom(busIdx * 10000 + dayOfYear + hour) * 0.1
        else loadFactor = 0.5 + seededRandom(busIdx * 20000 + dayOfYear + hour) * 0.15
      }
      // 季节性调整：8月=1.17（线性外推种子公式 0.85+(month-2)*0.08, 但种子以3月为起点）
      const seasonalFactor = 0.85 + (monthIdx - 2) * 0.08
      const noiseMw = (seededRandom(busIdx * 30000 + dayOfYear * 24 + t.getHours()) - 0.5) * baseLoadMw * 0.05
      const powerMw = +(baseLoadMw * loadFactor * seasonalFactor + noiseMw).toFixed(3)
      const reactive = +(powerMw * (0.3 + seededRandom(busIdx * 40000 + dayOfYear + hour) * 0.1)).toFixed(3)
      const tempC = +(20 + Math.sin((hour - 6) / 14 * Math.PI) * 8 + (seededRandom(busIdx * 50000 + dayOfYear) - 0.5) * 2).toFixed(1)
      const humid = Math.round(45 + (1 - Math.sin((hour - 6) / 14 * Math.PI)) * 20 + (seededRandom(busIdx * 60000 + dayOfYear) - 0.5) * 5)

      records.push([uuid(), dateStr(t), b.busId, powerMw, reactive, 'actual', tempC, humid])
      if (records.length >= batchSize) insertBatch(records.splice(0, batchSize))
    }
    if (records.length) insertBatch(records)
    console.log(`  ✓ ${b.busName}: ${Math.floor(totalMin / intervalMin) + 1} 条`)
  }
  const cnt = raw.prepare('SELECT COUNT(*) as c FROM load_measurements WHERE time >= ? AND time < ?').get(TARGET_START, TARGET_END) as any
  console.log(`  ✅ load_measurements: ${cnt.c.toLocaleString()} 条`)
}

async function generateVoltageMeasurements() {
  console.log('\n--- 生成 voltage_measurements (1h, 从PV数据派生) ---')
  const transformers = await db('equipment')
    .join('solar_pv_stations', 'solar_pv_stations.id', 'equipment.station_id')
    .where('equipment.equipment_type', 'TRANSFORMER')
    .where('solar_pv_stations.status', 'active')
    .select('equipment.id as eqId', 'equipment.station_id as stId', 'solar_pv_stations.grid_connection_voltage_kv as kv')
  if (!transformers.length) { console.log('  无变压器设备，跳过'); return }

  const deleted = raw.prepare('DELETE FROM voltage_measurements WHERE time >= ? AND time < ?').run(TARGET_START, TARGET_END)
  console.log(`  已清空 ${deleted.changes} 条旧数据，${transformers.length} 台变压器`)

  const stmt = raw.prepare(`INSERT INTO voltage_measurements (id, time, equipment_id, phase_a_v, phase_b_v, phase_c_v, voltage_deviation_pct)
    VALUES (?,?,?,?,?,?,?)`)
  const batchSize = 2000

  for (const tr of transformers as any[]) {
    const pvRows = raw.prepare(`SELECT time, voltage_v FROM pv_output_measurements WHERE station_id = ? AND time >= ? AND time < ? ORDER BY time`).all(tr.stId, TARGET_START, TARGET_END) as any[]
    if (!pvRows.length) continue

    const nominalV = tr.kv * 1000
    const records: any[][] = []
    let lastHour = ''
    for (const row of pvRows) {
      const hour = row.time.slice(0, 13) // 'YYYY-MM-DDTHH'
      if (hour === lastHour) continue
      lastHour = hour
      const t = hour + ':00:00'
      const lineV = row.voltage_v
      const phaseV = lineV / Math.sqrt(3)
      // 1-3% 三相不平衡
      const wobA = 1 + (seededRandom(tr.eqId.charCodeAt(0) + new Date(t).getTime() / 3600000) - 0.5) * 0.04
      const wobB = 1 + (seededRandom(tr.eqId.charCodeAt(1) + new Date(t).getTime() / 3600000 + 1) - 0.5) * 0.04
      const wobC = 1 + (seededRandom(tr.eqId.charCodeAt(2) + new Date(t).getTime() / 3600000 + 2) - 0.5) * 0.04
      const devPct = nominalV > 0 ? +(((lineV - nominalV) / nominalV) * 100).toFixed(2) : 0
      records.push([
        uuid(), t, tr.eqId,
        +(phaseV * wobA).toFixed(1), +(phaseV * wobB).toFixed(1), +(phaseV * wobC).toFixed(1), devPct,
      ])
      if (records.length >= batchSize) {
        raw.transaction((rows: any[]) => { for (const r of rows) stmt.run(...r) })(records.splice(0, batchSize))
      }
    }
    if (records.length) {
      raw.transaction((rows: any[]) => { for (const r of rows) stmt.run(...r) })(records)
    }
    console.log(`  ✓ ${tr.eqId.slice(0, 8)}: ${pvRows.length} PV行 → ${Math.ceil(pvRows.length / 12)} 电压行`)
  }
  const cnt = raw.prepare('SELECT COUNT(*) as c FROM voltage_measurements WHERE time >= ? AND time < ?').get(TARGET_START, TARGET_END) as any
  console.log(`  ✅ voltage_measurements: ${cnt.c.toLocaleString()} 条`)
}

async function generateEquipmentTemperature() {
  console.log('\n--- 生成 equipment_temperature (6h, 种子018公式) ---')
  const equipments = await db('equipment')
    .leftJoin('solar_pv_stations', 'solar_pv_stations.id', 'equipment.station_id')
    .where('solar_pv_stations.status', 'active')
    .select('equipment.id as eqId', 'equipment.equipment_type', 'equipment.station_id',
      'equipment.rated_temp_rise_c', 'solar_pv_stations.grid_connection_voltage_kv')
  if (!equipments.length) { console.log('  无设备，跳过'); return }

  const deleted = raw.prepare('DELETE FROM equipment_temperature WHERE time >= ? AND time < ?').run(TARGET_START, TARGET_END)
  console.log(`  已清空 ${deleted.changes} 条旧数据，${equipments.length} 设备`)

  const baseTemp: Record<string, number> = { TRANSFORMER: 45, INVERTER: 38, BREAKER: 32, CABLE: 28, SWITCH: 30, BATTERY: 35 }

  function hashId(id: string): number { let h = 0; for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i) | 0; return Math.abs(h) }

  const stmt = raw.prepare('INSERT INTO equipment_temperature (id, equipment_id, station_id, time, temp_c, voltage_status, voltage_deviation_pct) VALUES (?,?,?,?,?,?,?)')
  const records: any[][] = []

  const dates: Date[] = []
  for (let t = new Date('2025-08-01'); t < new Date('2026-08-01'); t = new Date(t.getTime() + 6 * 3600000)) dates.push(new Date(t))

  for (const eq of equipments as any[]) {
    const base = baseTemp[eq.equipment_type] || 30
    const ratedRise = eq.rated_temp_rise_c || 5
    const h = hashId(eq.eqId)
    const isWeak = (h % 100) < 12

    for (const dt of dates) {
      const dev = (Math.random() - 0.5) * 10
      let status = 'normal'
      let tempC = base + (Math.random() - 0.5) * 4

      if (isWeak && dev > 3) { status = 'surge'; tempC = base + ratedRise * (1.05 + Math.random() * 0.45) }
      else if (isWeak && dev < -3) { status = 'sag'; tempC = base + ratedRise * (0.95 + Math.random() * 0.40) }
      else if (!isWeak && dev > 3) { status = 'surge'; tempC = base + ratedRise * (0.30 + Math.random() * 0.60) }
      else if (!isWeak && dev < -3) { status = 'sag'; tempC = base + ratedRise * (0.20 + Math.random() * 0.50) }

      records.push([uuid(), eq.eqId, eq.station_id || '', dt.toISOString(), +tempC.toFixed(1), status, +dev.toFixed(2)])
      if (records.length >= 2000) {
        raw.transaction((r: any[][]) => { for (const x of r) stmt.run(...x) })(records.splice(0, 2000))
      }
    }
  }
  if (records.length) {
    raw.transaction((r: any[][]) => { for (const x of r) stmt.run(...x) })(records)
  }
  const cnt = raw.prepare('SELECT COUNT(*) as c FROM equipment_temperature WHERE time >= ? AND time < ?').get(TARGET_START, TARGET_END) as any
  console.log(`  ✅ equipment_temperature: ${cnt.c.toLocaleString()} 条`)
}

async function runStorageSeed() {
  console.log('\n--- 运行种子 007：storage_entities + load_entities ---')
  const buses = await db('grid_buses').select('id', 'name', 'voltage_level', 'zone', 'longitude', 'latitude')
  const busMap: Record<string, any> = {}
  for (const b of buses) { const bus = b as any; busMap[bus.name] = bus }

  const now = new Date().toISOString()

  // 负荷实体定义（来自种子 007）
  const loadDefs = [
    { name: '钱塘区临江工业园负荷', loadType: 'INDUSTRIAL', busName: '义蓬变', peakLoadKw: 80000, annualConsumptionMwh: 350000, zone: '钱塘区', voltageLevel: '220kV', longitude: 120.57, latitude: 30.28, address: '杭州市钱塘区临江街道' },
    { name: '钱塘区临江高科园东区负荷', loadType: 'INDUSTRIAL', busName: '临江变', peakLoadKw: 120000, annualConsumptionMwh: 520000, zone: '钱塘区', voltageLevel: '220kV', longitude: 120.65, latitude: 30.26, address: '杭州市钱塘区临江高科园东区' },
    { name: '钱塘区临江高科园西区负荷', loadType: 'INDUSTRIAL', busName: '新湾变', peakLoadKw: 160000, annualConsumptionMwh: 700000, zone: '钱塘区', voltageLevel: '220kV', longitude: 120.62, latitude: 30.29, address: '杭州市钱塘区临江高科园西区' },
    { name: '余杭区未来科技城负荷', loadType: 'COMMERCIAL', busName: '仓前变', peakLoadKw: 45000, annualConsumptionMwh: 180000, zone: '余杭区', voltageLevel: '220kV', longitude: 120.02, latitude: 30.28, address: '杭州市余杭区未来科技城' },
    { name: '萧山区居民负荷聚合', loadType: 'RESIDENTIAL', busName: '花木变', peakLoadKw: 30000, annualConsumptionMwh: 120000, zone: '萧山区', voltageLevel: '220kV', longitude: 120.26, latitude: 30.18, address: '杭州市萧山区' },
    { name: '临安区农业灌溉负荷', loadType: 'AGRICULTURAL', busName: '锦城变', peakLoadKw: 5000, annualConsumptionMwh: 8000, zone: '临安区', voltageLevel: '110kV', longitude: 119.72, latitude: 30.23, address: '杭州市临安区' },
    { name: '滨江区市政照明负荷', loadType: 'MUNICIPAL', busName: '滨江变', peakLoadKw: 8000, annualConsumptionMwh: 15000, zone: '滨江区', voltageLevel: '220kV', longitude: 120.20, latitude: 30.21, address: '杭州市滨江区' },
  ]

  const insertedLoads: any[] = []
  for (const def of loadDefs) {
    const busObj = busMap[def.busName]
    if (!busObj) { console.log(`  ⚠ Bus "${def.busName}" 不存在，跳过 ${def.name}`); continue }
    insertedLoads.push({ id: uuid(), name: def.name, load_type: def.loadType, bus_id: busObj.id, voltage_level: def.voltageLevel, peak_load_kw: def.peakLoadKw, annual_consumption_mwh: def.annualConsumptionMwh, zone: def.zone, address: def.address, longitude: def.longitude, latitude: def.latitude, status: 'active', created_at: now })
  }

  // 储能实体定义（来自种子 007）
  const storageDefs = [
    { name: '钱塘储能站一期', storageType: 'BATTERY', busName: '义蓬变', ratedPowerKw: 50000, ratedCapacityKwh: 200000, efficiencyPct: 92, chargeMode: 'PEAK_SHAVING', zone: '钱塘区', voltageLevel: '220kV', longitude: 120.56, latitude: 30.27 },
    { name: '钱塘储能站二期', storageType: 'BATTERY', busName: '临江变', ratedPowerKw: 40000, ratedCapacityKwh: 80000, efficiencyPct: 93, chargeMode: 'PEAK_SHAVING', zone: '钱塘区', voltageLevel: '220kV', longitude: 120.66, latitude: 30.25 },
    { name: '钱塘储能站三期', storageType: 'BATTERY', busName: '新湾变', ratedPowerKw: 55000, ratedCapacityKwh: 110000, efficiencyPct: 93, chargeMode: 'PEAK_SHAVING', zone: '钱塘区', voltageLevel: '220kV', longitude: 120.63, latitude: 30.30 },
    { name: '余杭储能站', storageType: 'BATTERY', busName: '仓前变', ratedPowerKw: 30000, ratedCapacityKwh: 100000, efficiencyPct: 90, chargeMode: 'FREQ_REGULATION', zone: '余杭区', voltageLevel: '220kV', longitude: 120.03, latitude: 30.29 },
    { name: '临安抽水蓄能站', storageType: 'PUMPED_HYDRO', busName: '锦城变', ratedPowerKw: 100000, ratedCapacityKwh: 800000, efficiencyPct: 78, chargeMode: 'ARBITRAGE', zone: '临安区', voltageLevel: '110kV', longitude: 119.70, latitude: 30.24 },
    { name: '建德储能站', storageType: 'BATTERY', busName: '寿昌变', ratedPowerKw: 15000, ratedCapacityKwh: 30000, efficiencyPct: 91, chargeMode: 'PEAK_SHAVING', zone: '建德市', voltageLevel: '110kV', longitude: 119.28, latitude: 29.48 },
    { name: '临安东储能站', storageType: 'BATTERY', busName: '科创变', ratedPowerKw: 4000, ratedCapacityKwh: 8000, efficiencyPct: 90, chargeMode: 'PEAK_SHAVING', zone: '临安区', voltageLevel: '110kV', longitude: 119.56, latitude: 30.33 },
    { name: '萧山南阳储能站', storageType: 'BATTERY', busName: '建设四路开闭所', ratedPowerKw: 5000, ratedCapacityKwh: 10000, efficiencyPct: 90, chargeMode: 'PEAK_SHAVING', zone: '萧山区', voltageLevel: '10kV', longitude: 120.44, latitude: 30.24 },
    { name: '余杭径山储能站', storageType: 'BATTERY', busName: '文一西路开闭所', ratedPowerKw: 1000, ratedCapacityKwh: 2000, efficiencyPct: 89, chargeMode: 'PEAK_SHAVING', zone: '余杭区', voltageLevel: '10kV', longitude: 119.86, latitude: 30.36 },
    { name: '富阳渔山储能站', storageType: 'BATTERY', busName: '富春路开闭所', ratedPowerKw: 3000, ratedCapacityKwh: 6000, efficiencyPct: 90, chargeMode: 'PEAK_SHAVING', zone: '富阳区', voltageLevel: '10kV', longitude: 120.04, latitude: 30.04 },
  ]

  const insertedStorages: any[] = []
  for (const def of storageDefs) {
    const busObj = busMap[def.busName]
    if (!busObj) { console.log(`  ⚠ Bus "${def.busName}" 不存在，跳过 ${def.name}`); continue }
    insertedStorages.push({ id: uuid(), name: def.name, storage_type: def.storageType, bus_id: busObj.id, rated_power_kw: def.ratedPowerKw, rated_capacity_kwh: def.ratedCapacityKwh, efficiency_pct: def.efficiencyPct, charge_mode: def.chargeMode, voltage_level: def.voltageLevel, zone: def.zone, longitude: def.longitude, latitude: def.latitude, status: 'active', created_at: now })
  }

  // UPSERT：不存在则插入
  const existingLoadNames = new Set((await db('load_entities').select('name')).map((r: any) => r.name))
  const existingStorageNames = new Set((await db('storage_entities').select('name')).map((r: any) => r.name))

  const newLoads = insertedLoads.filter(l => !existingLoadNames.has(l.name))
  const newStorages = insertedStorages.filter(s => !existingStorageNames.has(s.name))

  if (newLoads.length) { await db('load_entities').insert(newLoads); console.log(`  ✓ ${newLoads.length} 负荷实体`) }
  if (newStorages.length) { await db('storage_entities').insert(newStorages); console.log(`  ✓ ${newStorages.length} 储能实体`) }

  // resource_connection_attrs
  const connAttrs: any[] = []
  for (const l of newLoads) { connAttrs.push({ id: uuid(), source_node_type: 'LOAD', source_node_id: l.id, target_node_type: 'GRID', target_node_id: l.bus_id, flow_direction: 'REVERSE', max_capacity_kw: l.peak_load_kw, control_logic: JSON.stringify({ mode: 'demand_response', description: `${l.name} 接入控制` }), status: 'active', created_at: now }) }
  for (const s of newStorages) { connAttrs.push({ id: uuid(), source_node_type: 'STORAGE', source_node_id: s.id, target_node_type: 'GRID', target_node_id: s.bus_id, flow_direction: 'BIDIRECTIONAL', max_capacity_kw: s.rated_power_kw, control_logic: JSON.stringify({ mode: s.charge_mode?.toLowerCase() || 'peak_shaving', description: `${s.name} 充放电控制` }), status: 'active', created_at: now }) }
  if (connAttrs.length) {
    await db('resource_connection_attrs').insert(connAttrs)
    console.log(`  ✓ ${connAttrs.length} 接入关系`)
  }
  console.log('  ✅ 种子 007 数据就绪')
}

// ==================== Phase 3: Validate ====================
async function validate(initial: Map<string, any>) {
  console.log('\n========== 最终验证 ==========')
  const final = await checkAll()
  let allOk = true
  for (const [table, info] of final) {
    if (!info.ok) { allOk = false }
  }
  console.log(allOk ? '\n🎉 全部通过！' : '\n⚠ 仍有缺口，请检查')
  return allOk
}

// ==================== Main ====================
async function main() {
  console.log('========== Phase 1: 数据检查 ==========')
  const initial = await checkAll()

  const needsGeneration = [...initial.entries()].filter(([, v]) => !v.ok)
  if (needsGeneration.length === 0) {
    console.log('\n✅ 所有表数据充足，无需生成。')
    raw.close(); await db.destroy(); return
  }

  console.log(`\n========== Phase 2: 生成缺失数据 (${needsGeneration.length} 表) ==========`)
  const needsPv = initial.get('pv_output_measurements')?.ok === false
  const needsLoad = initial.get('load_measurements')?.ok === false
  const needsVoltage = initial.get('voltage_measurements')?.ok === false
  const needsTemp = initial.get('equipment_temperature')?.ok === false
  const needsStorage = initial.get('storage_entities')?.ok === false || initial.get('load_entities')?.ok === false

  if (needsPv) await generatePVMeasurements()
  if (needsLoad) await generateLoadMeasurements()
  // voltage 依赖 PV 数据，必须在 PV 之后
  if (needsVoltage) await generateVoltageMeasurements()
  if (needsTemp) await generateEquipmentTemperature()
  if (needsStorage) await runStorageSeed()

  console.log('\n========== Phase 3: 验证 ==========')
  await validate(initial)

  raw.close()
  await db.destroy()
}

main().catch((err) => {
  console.error('失败:', err)
  try { raw.close() } catch { }
  db.destroy()
  process.exit(1)
})
