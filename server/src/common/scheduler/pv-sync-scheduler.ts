/**
 * 光伏出力测量数据每日自动同步
 * 每天凌晨 2:00 运行一次，增量生成昨天之前缺失的小时级测量数据
 */
import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'
import { logger } from '../utils/logger.js'

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

async function syncOnce(): Promise<number> {
  const stations = await db('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('solar_pv_stations.id', 'solar_pv_stations.plant_id', 'solar_pv_stations.station_name', 'solar_pv_stations.installed_capacity_mw', 'solar_pv_stations.grid_connection_voltage_kv', 'solar_pv_stations.installed_date', 'grid_buses.zone')
    .where('solar_pv_stations.status', 'active')

  if (stations.length === 0) return 0

  const lastRecord = await db('pv_output_measurements').max('time as maxTime').first() as any
  const lastDateStr = lastRecord?.maxTime ? lastRecord.maxTime.slice(0, 10) : '2025-03-01'
  const lastDate = new Date(lastDateStr)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(lastDate)
  startDate.setDate(startDate.getDate() + 1)

  if (startDate > today) return 0

  const totalDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1
  const zones = [...new Set(stations.map((s: any) => s.zone || 'unknown'))]
  const zoneIndexMap = new Map(zones.map((z, i) => [z, i]))
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
      const stationDayOffset = d + stationIdx * 1000 + 50000
      const weatherDayOffset = d + zoneIdx * 1000 + 50000

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

        if (records.length >= 200) {
          await db('pv_output_measurements').insert(records.splice(0, 200))
        }
      }
    }

    if (records.length > 0) {
      await db('pv_output_measurements').insert(records)
    }
    totalInserted += totalDays * 24
  }

  return totalInserted
}

let timer: ReturnType<typeof setInterval> | null = null

/** 启动每日定时同步 */
export function startPvSyncScheduler(): void {
  // 启动时立即同步一次
  syncOnce()
    .then((count) => { if (count > 0) logger.info(`[PV同步] 启动时补充 ${count} 条测量记录`) })
    .catch((err) => logger.error('[PV同步] 启动同步失败', err))

  // 计算到下一个凌晨2:00的毫秒数
  const now = new Date()
  const next2am = new Date(now)
  next2am.setHours(2, 0, 0, 0)
  if (next2am <= now) {
    next2am.setDate(next2am.getDate() + 1)
  }
  const initialDelay = next2am.getTime() - now.getTime()
  logger.info(`[PV同步] 下次同步时间: ${next2am.toLocaleString('zh-CN')}（${Math.round(initialDelay / 3600000)}小时后）`)

  // 先等到凌晨2点，之后每24小时一次
  setTimeout(() => {
    const run = () => {
      syncOnce()
        .then((count) => { if (count > 0) logger.info(`[PV同步] 每日同步完成，新增 ${count} 条记录`) })
        .catch((err) => logger.error('[PV同步] 每日同步失败', err))
    }
    run()
    timer = setInterval(run, 86400000)
  }, initialDelay)
}

/** 停止定时同步 */
export function stopPvSyncScheduler(): void {
  if (timer) { clearInterval(timer); timer = null }
}
