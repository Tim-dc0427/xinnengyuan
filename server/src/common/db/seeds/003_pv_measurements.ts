import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export async function seed(knex: Knex): Promise<void> {
  // 确保 power_plants 和 plant_id
  const rawStations = await knex('solar_pv_stations').select('id', 'plant_id', 'station_name', 'installed_capacity_mw', 'grid_connection_voltage_kv', 'longitude', 'latitude', 'address', 'installed_date', 'status')
  let fixedCount = 0
  for (const s of rawStations as any[]) {
    if (!s.plant_id) {
      const existing = await knex('power_plants').where('id', s.id).first()
      if (!existing) {
        await knex('power_plants').insert({ id: s.id, name: s.station_name, plant_type: 'PV', capacity_kw: s.installed_capacity_mw * 1000, installed_date: s.installed_date || '2024-01-01', longitude: s.longitude, latitude: s.latitude, address: s.address, status: s.status || 'active', created_at: new Date().toISOString() })
      }
      await knex('solar_pv_stations').where('id', s.id).update({ plant_id: s.id })
      fixedCount++
    }
  }
  if (fixedCount > 0) console.log(`  ✓ 修复 ${fixedCount} 个电站的 plant_id 关联`)

  const stations = await knex('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('solar_pv_stations.id', 'solar_pv_stations.plant_id', 'solar_pv_stations.station_name', 'solar_pv_stations.installed_capacity_mw', 'solar_pv_stations.grid_connection_voltage_kv', 'solar_pv_stations.installed_date', 'grid_buses.zone')
  if (stations.length === 0) { console.log('No solar PV stations found, skipping PV measurement seed.'); return }

  const batchSize = 200

  // 构建 zone→zoneIndex 映射，同区域电站共享天气
  const zones = [...new Set(stations.map((s: any) => s.zone || 'unknown'))]
  const zoneIndexMap = new Map(zones.map((z, i) => [z, i]))

  async function generateForPeriod(year: number, monthStart: number, monthEnd: number) {
    const startDate = new Date(year, monthStart - 1, 1)
    const endDate = new Date(year, monthEnd, 0)
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1

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
        const stationDayOffset = d + stationIdx * 1000   // 电站级（微调用）
        const weatherDayOffset = d + zoneIdx * 1000       // 区域级（天气用）

        // 每日天气：晴/多云/阴/雨（按区域共享）
        const wr = seededRandom(weatherDayOffset * 137 + year)
        let weather: string, cloudFactor: number, tempBias: number, humidBias: number
        if (wr < 0.35) { weather = '晴'; cloudFactor = 0.85 + seededRandom(weatherDayOffset * 7) * 0.15; tempBias = 2; humidBias = -10 }
        else if (wr < 0.65) { weather = '多云'; cloudFactor = 0.5 + seededRandom(weatherDayOffset * 11) * 0.25; tempBias = 0; humidBias = 5 }
        else if (wr < 0.85) { weather = '阴天'; cloudFactor = 0.2 + seededRandom(weatherDayOffset * 13) * 0.2; tempBias = -2; humidBias = 15 }
        else { weather = '雨天'; cloudFactor = 0.05 + seededRandom(weatherDayOffset * 17) * 0.15; tempBias = -4; humidBias = 25 }

        // 先计算24小时的原始hourCloudVar，再3点滑动平均消除离群尖刺
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
          // 日射曲线：5:00日出→12:00峰值→18:00日落（5-18h正弦窗口）
          let solarRatio = 0
          if (h >= 5 && h <= 18) {
            solarRatio = Math.sin(((h - 5) / 13) * Math.PI)
          } else if (h === 4) {
            solarRatio = 0.01
          } else if (h === 19) {
            solarRatio = 0.02
          }

          const irradianceWm2 = Math.round(solarRatio * 1000 * cloudFactor * smoothCloudVars[h])

          // 温度：基础18°C + 日照升温（中午最高+12°C） + 天气偏差（电站级微调）
          const tempC = +(18 + solarRatio * 12 + tempBias + (seededRandom(stationDayOffset * 47 + h) - 0.5) * 1.5).toFixed(1)
          // 湿度：基础50% - 日照降湿（中午最低-25%）+ 天气偏差（电站级微调）
          const humidityPct = Math.round(Math.max(15, Math.min(95, 55 - solarRatio * 25 + humidBias + (seededRandom(stationDayOffset * 19 + h) - 0.5) * 6)))

          // 光伏效率：组件效率78-84% × 逆变器效率88-99% × 温度折减（-0.35%/°C，基准25°C）
          const panelEff = 0.78 + seededRandom(stationIdx * 13 + h * 3) * 0.06
          const inverterEff = irradianceWm2 > 0
            ? +(0.88 + seededRandom(stationDayOffset * 79 + h) * 0.11).toFixed(3)
            : null
          // 温度折减：-0.5%/°C（基准15°C），全温区生效，确保不同电站间方向一致
          const tempDerating = Math.max(0.87, Math.min(1.05, 1 - 0.005 * (tempC - 15)))
          // 设备年限衰减：LID初始衰减前0.5年约2% + 长期衰减0.5%/年
          const yearsSinceInstall = (date.getTime() - new Date(s.installed_date || '2024-01-01').getTime()) / (365.25 * 86400000)
          const ageDerating = yearsSinceInstall <= 0
            ? 1
            : yearsSinceInstall < 0.5
              ? +(1 - 0.02 * (yearsSinceInstall / 0.5)).toFixed(4)   // LID期：线性衰减2%
              : +(0.98 - 0.005 * (yearsSinceInstall - 0.5)).toFixed(4)  // 长期：0.5%/年
          const powerKw = irradianceWm2 > 0
            ? Math.round((irradianceWm2 / 1000) * capacityKw * panelEff * inverterEff! * tempDerating * ageDerating)
            : 0

          const timeStr = `${dateStr}T${String(h).padStart(2, '0')}:${String(Math.floor(seededRandom(stationDayOffset * 67 + h) * 60)).padStart(2, '0')}:00`

          records.push({
            id: uuid(), time: timeStr, plant_id: s.plant_id || '', station_id: s.id,
            active_power_kw: powerKw,
            reactive_power_kvar: Math.round(powerKw * (0.06 + seededRandom(stationDayOffset * 41 + h) * 0.06)),
            voltage_v: Number((() => {
              // 类正态分布电压：sum-of-3-uniforms 近似正态，按电压等级差异化范围
              // 10kV 国标允许±7%，110kV/220kV 国标允许±3%
              // normalHalf 略大于阈值，让尾部自然超出合规范围（约5-10%点越限）
              const threshold = gridKv >= 110 ? 0.03 : 0.07
              const normalHalf = threshold * 1.2
              let r = 0
              for (let k = 0; k < 3; k++) r += seededRandom(stationDayOffset * 53 + h * 7 + k)
              r = (r / 3 - 0.5) * 2 // 中心化到[-1, 1]，类正态
              const factor = 1.0 + r * normalHalf
              // 留自然尾部超出阈值，不硬钳位
              return (gridKv * 1000 * factor).toFixed(1)
            })()),
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
          await knex('pv_output_measurements').insert(records.splice(0, batchSize))
        }
      }

      if (records.length > 0) {
        await knex('pv_output_measurements').insert(records)
      }
    }
    console.log(`  ✓ ${year}/${monthStart}-${monthEnd}: 24h×${totalDays}天`)
  }

  // 清空旧数据，避免多次seed产生混合数据
  await knex('pv_output_measurements').whereBetween('time', ['2025-03-01T00:00:00', '2026-06-02T23:59:59']).delete()
  console.log('  ✓ 已清空旧PV测量数据')

  // 2026年3-6月（6月仅到2日）
  await generateForPeriod(2026, 3, 6)
  // 删除6月2日之后的未来数据
  await knex('pv_output_measurements').where('time', '>', '2026-06-02T23:59:59').delete()
  // 2025年3-5月（同比对比）
  await generateForPeriod(2025, 3, 5)

  // ==================== 历史月度稀疏数据（设备年限分析用） ====================
  const historicalStations = stations.filter((s: any) => {
    if (!s.installed_date) return false
    return new Date(s.installed_date) < new Date('2025-03-01')
  })
  if (historicalStations.length > 0) {
    const histRecords: any[] = []
    const avgEff = 0.81
    for (const hs of historicalStations) {
      const s = hs as any
      const stationIdx = stations.indexOf(hs)
      const capKw = s.installed_capacity_mw * 1000
      const installDate = new Date(s.installed_date || '2024-01-01')
      const endDate = new Date('2025-02-28')
      // 每月生成一条正午代表记录
      const cursor = new Date(installDate)
      cursor.setDate(1)
      while (cursor <= endDate) {
        const yearsSinceInstall = (cursor.getTime() - installDate.getTime()) / (365.25 * 86400000)
        const degradation = Math.max(0, 1 - 0.005 * yearsSinceInstall) // 年衰减0.5%
        // 典型正午出力：辐照度800W/m² × 容量 × 效率 × 衰减
        const irradiance = 800 + seededRandom(stationIdx * 100 + cursor.getFullYear() * 12 + cursor.getMonth()) * 200
        const powerKw = Math.round((irradiance / 1000) * capKw * avgEff * degradation)
        histRecords.push({
          id: uuid(),
          time: `${cursor.toISOString().slice(0, 7)}-15T12:00:00`,
          plant_id: s.plant_id || '',
          station_id: s.id,
          active_power_kw: powerKw,
          reactive_power_kvar: Math.round(powerKw * 0.07),
          voltage_v: Number(((s.grid_connection_voltage_kv || 10) * 1000 * 1.0).toFixed(1)),
          current_a: Math.round(powerKw / (s.grid_connection_voltage_kv || 10)),
          frequency_hz: 50.0,
          power_factor: 0.96,
          temperature_c: null,   // 历史稀疏数据不含环境因子，不参与4因子对齐分析
          irradiance_wm2: Math.round(irradiance),
          humidity_pct: null,
          inverter_efficiency: null,
          confidence_pct: 80,
          expected_weather: '晴',
          actual_weather: '晴',
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }
    await knex('pv_output_measurements').insert(histRecords)
    console.log(`  ✓ 历史月度数据: ${histRecords.length} 条 (${historicalStations.length} 个老电站)`)
  }

  // ==================== 告警样本：模拟真实电压波动事件 ====================
  // 场景：云层快速移动导致辐照度骤变，逆变器调节滞后，十几分钟内电压累积偏移 >5%
  const alertStations = (await knex('solar_pv_stations').select('id', 'grid_connection_voltage_kv', 'installed_capacity_mw').limit(4)) as any[]
  const alertEvents = [
    {
      station: alertStations[0], date: '2026-06-02',
      // 11:50 云层遮挡 → 电压开始下跌，12:05 云层移开 → 电压反弹。两个采样点落在同一15分钟窗口
      records: [
        { time: '2026-06-02T11:50:00', voltageRatio: 0.965, powerKw: 3200 },
        { time: '2026-06-02T12:05:00', voltageRatio: 1.030, powerKw: 4200 },
      ],
    },
    {
      station: alertStations[1], date: '2026-06-01',
      // 午后积云发展，辐照度反复波动
      records: [
        { time: '2026-06-01T13:55:00', voltageRatio: 1.028, powerKw: 3800 },
        { time: '2026-06-01T14:08:00', voltageRatio: 0.970, powerKw: 2100 },
      ],
    },
    {
      station: alertStations[2], date: '2026-05-15',
      // 阵雨过境，出力骤降后快速恢复
      records: [
        { time: '2026-05-15T10:52:00', voltageRatio: 0.962, powerKw: 1500 },
        { time: '2026-05-15T11:06:00', voltageRatio: 1.025, powerKw: 3500 },
      ],
    },
    {
      station: alertStations[3], date: '2026-05-16',
      // 傍晚云层突变
      records: [
        { time: '2026-05-16T15:50:00', voltageRatio: 1.026, powerKw: 2800 },
        { time: '2026-05-16T16:04:00', voltageRatio: 0.968, powerKw: 1200 },
      ],
    },
  ]
  for (const evt of alertEvents) {
    const nominalV = (evt.station.grid_connection_voltage_kv || 10) * 1000
    for (const r of evt.records) {
      // 删除该时段原有记录，插入定制记录
      await knex('pv_output_measurements')
        .where({ station_id: evt.station.id })
        .where('time', 'like', `${evt.date}T${r.time.slice(11, 13)}:%`)
        .delete()
      await knex('pv_output_measurements').insert({
        id: uuid(), time: r.time, plant_id: evt.station.id, station_id: evt.station.id,
        active_power_kw: r.powerKw,
        reactive_power_kvar: Math.round(r.powerKw * 0.07),
        voltage_v: +(nominalV * r.voltageRatio).toFixed(1),
        current_a: Math.round((r.powerKw / (evt.station.grid_connection_voltage_kv || 10)) * 1.0),
        frequency_hz: 50.01,
        power_factor: 0.96,
        temperature_c: 28,
        irradiance_wm2: Math.round(r.powerKw / (evt.station.installed_capacity_mw || 1) / 0.81),
        humidity_pct: 55,
        inverter_efficiency: 0.97,
        confidence_pct: 90,
        expected_weather: '多云',
        actual_weather: '多云',
      })
    }
  }
  console.log('  ✓ 告警样本：4 个电站 × 真实电压波动事件（15分钟窗口内波动 >5%）')

  // ==================== 告警记录入库：电压波动 + 实际可靠性率 ====================
  // 按实际业务频率：电压波动告警每月1~2条，可靠性率告警每季度1条
  const allStations = await knex('solar_pv_stations').select('id', 'station_name', 'grid_connection_voltage_kv', 'installed_capacity_mw').limit(8)
  const alertNow = '2026-06-10T10:00:00.000Z'
  const vuAlertRecords: any[] = []
  // 仅取波动最严重的一条入库（超过7%严重越限）
  if (alertEvents.length > 0) {
    const evt = alertEvents[0]
    const meta = {
      fluctuationPct: 7.15,
      activePowerKw: evt.records[1].powerKw,
      loadKw: Math.round(evt.records[1].powerKw * 0.78),
    }
    vuAlertRecords.push({
      id: uuid(),
      alert_level: 'CRITICAL',
      source_type: 'VOLTAGE_FLUCTUATION',
      source_id: evt.station.id,
      title: `${evt.station.station_name} 电压波动率 ${meta.fluctuationPct}%`,
      message: `并网点电压15分钟内波动 ${meta.fluctuationPct}%，超过7%严重越限阈值。光伏出力 ${meta.activePowerKw}kW，负荷 ${meta.loadKw}kW`,
      triggered_at: evt.records[0].time,
      metadata: JSON.stringify(meta),
    })
  }
  // 仅1条可靠性率告警（实际可靠率99.960%，低于三级阈值99.950%）
  const relAlertRecords: any[] = []
  if (allStations.length >= 5) {
    const st = allStations[4]
    const meta = {
      reliabilityPct: 99.948,
      saifi: 3.85,
      saidi: 4.56,
      theoreticalReliability: 99.999,
      deviationPct: 51,
    }
    relAlertRecords.push({
      id: uuid(),
      alert_level: 'CRITICAL',
      source_type: 'POWER_SUPPLY_RELIABILITY',
      source_id: st.id,
      title: `${st.station_name} 实际可靠率 ${meta.reliabilityPct}%（低于三级阈值）`,
      message: `SAIFI ${meta.saifi}次/户·年，SAIDI ${meta.saidi}h/户·年，实际可靠率低于99.950%三级严重阈值`,
      triggered_at: alertNow,
      metadata: JSON.stringify(meta),
    })
  }
  if (vuAlertRecords.length) await knex('alerts').insert(vuAlertRecords)
  if (relAlertRecords.length) await knex('alerts').insert(relAlertRecords)
  console.log(`  ✓ 告警入库：${vuAlertRecords.length} 条电压波动 + ${relAlertRecords.length} 条实际可靠性率`)

  // ==================== 电压越限样本：差异化注入，不同区域越限程度不同 ====================
  const violationStations = await knex('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('solar_pv_stations.id', 'solar_pv_stations.grid_connection_voltage_kv', 'grid_buses.zone')
  // 按区域分组，不同区域越限密度不同（钱塘区最多→3电站×越限，临安区2电站次之，其余1电站最少）
  const zoneViolationConfig: Record<string, { days: string[]; hours: string[] }> = {
    '钱塘区': { days: ['2026-03-15', '2026-03-16', '2026-04-12', '2026-04-13', '2026-05-15', '2026-05-16', '2026-06-02'], hours: ['12', '13', '14', '15'] },
    '临安区': { days: ['2026-03-20', '2026-04-15', '2026-04-16', '2026-05-15', '2026-06-01'], hours: ['13', '14'] },
    '余杭区': { days: ['2026-04-10'], hours: ['14'] },
    '萧山区': { days: ['2026-03-25', '2026-05-20', '2026-06-02'], hours: ['13'] },
    '建德市': { days: ['2026-03-15', '2026-05-15'], hours: ['13', '14', '15'] },
    '富阳区': { days: ['2026-04-28'], hours: ['14', '15'] },
  }
  for (const vs of violationStations as any[]) {
    const cfg = zoneViolationConfig[vs.zone] || { days: ['2026-06-01'], hours: ['14'] }
    const kv = vs.grid_connection_voltage_kv || 10
    const nominalV = kv * 1000
    for (const day of cfg.days) {
      for (const h of cfg.hours) {
        // 每次越限独立随机偏差，不再固定 4%/8%
        // 低压(10kV)：越限 7%~13%，高压(≥110kV)：越限 3%~7%
        const seed1 = vs.id.charCodeAt(0) + vs.id.charCodeAt(2) + parseInt(day.slice(-2)) * 31 + parseInt(h) * 7
        const seed2 = vs.id.charCodeAt(1) + vs.id.charCodeAt(3) + parseInt(day.slice(-2)) * 17 + parseInt(h) * 13
        const deviation = kv >= 110
          ? 0.03 + seededRandom(seed1) * 0.04
          : 0.07 + seededRandom(seed2) * 0.06
        // 随机选择偏高或偏低（~70%偏高）
        const direction = seededRandom(vs.id.charCodeAt(4) + parseInt(h) * 41 + parseInt(day.slice(-2)) * 53) < 0.7 ? 1 : -1
        const violationRatio = 1.0 + direction * deviation
        await knex('pv_output_measurements')
          .where({ station_id: vs.id }).where('time', 'like', `${day}T${h}:%`)
          .update({ voltage_v: +(nominalV * violationRatio).toFixed(1) })
      }
    }
  }
  console.log('  ✓ 电压越限样本：按区域差异化注入超标电压')

  const count = await knex('pv_output_measurements').count('* as cnt').first()
  console.log(`  ✓ 总计: ${(count as any)?.cnt || 0} 条出力测量记录`)

  // ==================== 碳排放月度数据 ====================
  const stationsForCarbon = await knex('solar_pv_stations').select('id', 'plant_id', 'installed_capacity_mw')
  const carbonRecords: any[] = []
  const co2PerKwh = 0.85; const coalPerKwh = 0.32; const so2PerKwh = 0.003; const noxPerKwh = 0.002

  // 浙江各月等效利用小时数（日均，h/day）：1月2.0 2月2.7 3月3.0 4月3.5 5月3.5 6月3.3
  const monthlyDailyHours = [0, 2.0, 2.7, 3.0, 3.5, 3.5, 3.3]
  for (const st of stationsForCarbon as any[]) {
    const capKw = st.installed_capacity_mw * 1000
    for (let m = 1; m <= 6; m++) {
      const monthDays = [31, 28, 31, 30, 31, 30][m - 1]
      const dailyHours = monthlyDailyHours[m] + seededRandom(m * 100 + stationsForCarbon.indexOf(st) * 7) * 0.5 - 0.25
      const monthlyOutputKwh = Math.round(capKw * dailyHours * monthDays)
      carbonRecords.push({
        id: uuid(), plant_id: st.plant_id || '', period_type: 'monthly',
        period_start: `2026-${String(m).padStart(2, '0')}-01`,
        total_output_kwh: monthlyOutputKwh,
        co2_reduction_kg: Math.round(monthlyOutputKwh * co2PerKwh),
        coal_saving_ton: +(monthlyOutputKwh * coalPerKwh / 1000).toFixed(2),
        so2_reduction_kg: Math.round(monthlyOutputKwh * so2PerKwh),
        nox_reduction_kg: Math.round(monthlyOutputKwh * noxPerKwh),
      })
    }
  }
  await knex('carbon_emissions').insert(carbonRecords)
  console.log(`  ✓ ${carbonRecords.length} 条碳排放月度记录`)
}
