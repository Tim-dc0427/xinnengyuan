/**
 * 供电质量告警自动生成调度器
 * - 电压波动率告警：扫描 pv_output_measurements，滑动窗口检测 >5% 波动
 * - 实际可靠性率告警：基于 outage_events 统计 SAIFI/SAIDI
 * - 启动时立即扫描一次，之后每 6 小时运行一次
 * - 自动去重：同 station + 同类型 + 同日期不重复插入
 */
import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'
import { logger } from '../utils/logger.js'

const WINDOW_MINUTES = 15
const FLUCTUATION_WARN_PCT = 5
const FLUCTUATION_CRITICAL_PCT = 7
const RELIABILITY_CRITICAL_PCT = 99.950
const RELIABILITY_WARN_PCT = 99.990

async function generateVoltageFluctuationAlerts(): Promise<number> {
  const stations = await db('solar_pv_stations')
    .select('id', 'station_name', 'grid_connection_voltage_kv', 'bus_id')
    .where('status', 'active')

  let inserted = 0

  for (const station of stations) {
    const s = station as any
    const nominalKv = s.grid_connection_voltage_kv || 10

    // 查询该电站最近一次电压波动告警的时间
    const lastAlert = await db('alerts')
      .where({ source_type: 'VOLTAGE_FLUCTUATION', source_id: s.id })
      .orderBy('triggered_at', 'desc')
      .first()

    const sinceTime = lastAlert?.triggered_at || '2025-01-01T00:00:00'

    const measurements = await db('pv_output_measurements')
      .where('station_id', s.id)
      .where('time', '>', sinceTime)
      .select('time', 'voltage_v', 'active_power_kw')
      .orderBy('time', 'asc')

    if (measurements.length < 2) continue

    // 获取对应母线负荷
    const loadData = await db('load_measurements')
      .where('bus_id', s.bus_id)
      .whereBetween('time', [measurements[0].time, measurements[measurements.length - 1].time])
      .select('time', 'active_power_mw')
      .orderBy('time', 'asc')

    // 双指针负荷匹配
    let loadPtr = 0
    const timeSeries: Array<{ time: string; voltageKv: number; powerKw: number; loadKw: number }> = []
    for (const d of measurements) {
      const pvMs = new Date(d.time).getTime()
      while (
        loadPtr + 1 < loadData.length &&
        Math.abs(new Date(loadData[loadPtr + 1].time).getTime() - pvMs) <=
        Math.abs(new Date(loadData[loadPtr].time).getTime() - pvMs)
      ) {
        loadPtr++
      }
      timeSeries.push({
        time: d.time,
        voltageKv: +(d.voltage_v / 1000).toFixed(2),
        powerKw: d.active_power_kw,
        loadKw: loadData.length > 0 ? Math.round(loadData[loadPtr].active_power_mw * 1000) : 0,
      })
    }

    // 滑动窗口扫描
    const firstGap = new Date(timeSeries[1].time).getTime() - new Date(timeSeries[0].time).getTime()
    const windowPoints = Math.max(2, Math.round(WINDOW_MINUTES * 60000 / firstGap))
    const step = Math.max(1, Math.round(windowPoints / 3))
    const alerts: Array<{ time: string; level: string; title: string; message: string; fluctuationPct: number; powerKw: number; loadKw: number }> = []

    for (let i = 0; i + windowPoints <= timeSeries.length; i += step) {
      const slice = timeSeries.slice(i, i + windowPoints)
      const vals = slice.map(d => d.voltageKv)
      const maxV = Math.max(...vals)
      const minV = Math.min(...vals)
      const pct = +(((maxV - minV) / nominalKv) * 100).toFixed(2)
      if (pct > FLUCTUATION_WARN_PCT) {
        const mid = slice[Math.floor(slice.length / 2)]
        const level = pct > FLUCTUATION_CRITICAL_PCT ? 'CRITICAL' : 'WARN'
        alerts.push({
          time: slice[0].time,
          level,
          title: `${s.station_name} 电压波动率 ${pct}%`,
          message: `并网点电压${WINDOW_MINUTES}分钟内波动 ${pct}%，${level === 'CRITICAL' ? '超过' : '达到'}${level === 'CRITICAL' ? FLUCTUATION_CRITICAL_PCT : FLUCTUATION_WARN_PCT}%${level === 'CRITICAL' ? '严重' : '警告'}越限阈值。光伏出力 ${mid.powerKw}kW，负荷 ${mid.loadKw}kW`,
          fluctuationPct: pct,
          powerKw: mid.powerKw,
          loadKw: mid.loadKw,
        })
      }
    }

    // 去重：合并相邻重叠窗口
    const merged: typeof alerts = []
    for (const a of alerts) {
      const last = merged[merged.length - 1]
      if (last && new Date(a.time).getTime() - new Date(last.time).getTime() < WINDOW_MINUTES * 60000) {
        if (a.fluctuationPct > last.fluctuationPct) merged[merged.length - 1] = a
      } else {
        merged.push(a)
      }
    }

    // 写入数据库
    for (const a of merged) {
      await db('alerts').insert({
        id: uuid(),
        alert_level: a.level,
        source_type: 'VOLTAGE_FLUCTUATION',
        source_id: s.id,
        title: a.title,
        message: a.message,
        triggered_at: a.time,
        metadata: JSON.stringify({
          fluctuationPct: a.fluctuationPct,
          activePowerKw: a.powerKw,
          loadKw: a.loadKw,
        }),
      })
      inserted++
    }
  }

  return inserted
}

async function generateReliabilityAlerts(): Promise<number> {
  // 统计最近一年的停电事件计算 SAIFI/SAIDI
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const cutoff = oneYearAgo.toISOString().slice(0, 10)

  // 获取有停电事件的电站
  const outageStations = await db('outage_events')
    .join('solar_pv_stations', 'solar_pv_stations.id', 'outage_events.station_id')
    .where('outage_events.start_time', '>=', cutoff + 'T00:00:00')
    .select(
      'solar_pv_stations.id as station_id',
      'solar_pv_stations.station_name',
    )
    .groupBy('solar_pv_stations.id')

  // 获取总电站数（用于 SAIFI 分母）
  const totalStations = await db('solar_pv_stations').where('status', 'active').count('id as cnt').first() as any
  const totalCount = totalStations?.cnt || 1

  let inserted = 0

  for (const st of outageStations) {
    const s = st as any
    const outages = await db('outage_events')
      .where('station_id', s.station_id)
      .where('start_time', '>=', cutoff + 'T00:00:00')
      .select('duration_minutes', 'duration_seconds')

    if (outages.length === 0) continue

    // 计算该站停电总时长（小时）和总次数
    let totalDurationHours = 0
    for (const o of outages) {
      const oa = o as any
      if (oa.duration_seconds) {
        totalDurationHours += oa.duration_seconds / 3600
      } else if (oa.duration_minutes) {
        totalDurationHours += oa.duration_minutes / 60
      }
    }
    const outageCount = outages.length

    // SAIDI = 总停电时长 / 总用户数（简化：该站停电小时数）
    // SAIFI = 总停电次数 / 总用户数
    const saidi = +totalDurationHours.toFixed(2)
    const saifi = +(outageCount / totalCount).toFixed(2)

    // 实际可靠率 = (8760 - SAIDI) / 8760 * 100
    const actualReliability = +(((8760 - totalDurationHours) / 8760) * 100).toFixed(3)

    // 低于阈值生成告警
    if (actualReliability >= RELIABILITY_WARN_PCT) continue

    const level = actualReliability < RELIABILITY_CRITICAL_PCT ? 'CRITICAL' : 'WARN'
    const meta = {
      reliabilityPct: actualReliability,
      saifi,
      saidi,
      theoreticalReliability: 99.999,
      deviationPct: +((99.999 - actualReliability) / 99.999 * 100).toFixed(1),
    }

    // 去重：检查该站最近一天内是否已有同类型告警
    const today = new Date().toISOString().slice(0, 10)
    const existing = await db('alerts')
      .where({ source_type: 'POWER_SUPPLY_RELIABILITY', source_id: s.station_id })
      .where('triggered_at', '>=', today + 'T00:00:00')
      .first()

    if (existing) continue

    await db('alerts').insert({
      id: uuid(),
      alert_level: level,
      source_type: 'POWER_SUPPLY_RELIABILITY',
      source_id: s.station_id,
      title: `${s.station_name} 实际可靠率 ${actualReliability}%（低于${level === 'CRITICAL' ? RELIABILITY_CRITICAL_PCT : RELIABILITY_WARN_PCT}%阈值）`,
      message: `SAIFI ${saifi}次/户·年，SAIDI ${saidi}h/户·年，实际可靠率低于${level === 'CRITICAL' ? RELIABILITY_CRITICAL_PCT : RELIABILITY_WARN_PCT}%${level === 'CRITICAL' ? '三级严重' : '二级警告'}阈值`,
      triggered_at: new Date().toISOString(),
      metadata: JSON.stringify(meta),
    })
    inserted++
  }

  return inserted
}

async function generateAlerts(): Promise<{ voltage: number; reliability: number }> {
  const vCount = await generateVoltageFluctuationAlerts()
  const rCount = await generateReliabilityAlerts()
  return { voltage: vCount, reliability: rCount }
}

let timer: ReturnType<typeof setInterval> | null = null

/** 启动告警生成定时调度 */
export function startAlertGenerationScheduler(): void {
  // 启动时立即扫描一次
  generateAlerts()
    .then(({ voltage, reliability }) => {
      if (voltage > 0 || reliability > 0) {
        logger.info(`[告警生成] 启动扫描完成：${voltage} 条电压波动 + ${reliability} 条可靠性率`)
      }
    })
    .catch((err) => logger.error('[告警生成] 启动扫描失败', err))

  // 每 6 小时运行一次
  timer = setInterval(() => {
    generateAlerts()
      .then(({ voltage, reliability }) => {
        if (voltage > 0 || reliability > 0) {
          logger.info(`[告警生成] 定时扫描完成：${voltage} 条电压波动 + ${reliability} 条可靠性率`)
        }
      })
      .catch((err) => logger.error('[告警生成] 定时扫描失败', err))
  }, 6 * 3600 * 1000)

  logger.info('[告警生成] 调度器已启动（每 6 小时扫描一次）')
}

/** 停止告警生成定时调度 */
export function stopAlertGenerationScheduler(): void {
  if (timer) { clearInterval(timer); timer = null }
}
