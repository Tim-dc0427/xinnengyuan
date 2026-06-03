import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('complaint_stats').del()

  // 计算各区域电压波动率，投诉数与波动率正相关
  const zoneRows = await knex('pv_output_measurements')
    .join('solar_pv_stations', 'solar_pv_stations.id', 'pv_output_measurements.station_id')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select(
      'grid_buses.zone',
      knex.raw('AVG(voltage_v) as avg_v'),
      knex.raw('MAX(voltage_v) as max_v'),
      knex.raw('MIN(voltage_v) as min_v'),
      'solar_pv_stations.grid_connection_voltage_kv',
    )
    .groupBy('grid_buses.zone')

  // 按区域计算波动率
  const zoneFluctuation = new Map<string, number>()
  for (const zr of zoneRows as any[]) {
    const kv = zr.grid_connection_voltage_kv || 10
    const nomV = kv * 1000
    const dev = Math.max(Math.abs(zr.max_v - nomV), Math.abs(zr.min_v - nomV)) / nomV * 100
    zoneFluctuation.set(zr.zone, +dev.toFixed(1))
  }

  const stations = await knex('solar_pv_stations')
    .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
    .select('solar_pv_stations.id', 'solar_pv_stations.station_name', 'grid_buses.zone')

  const industries = [
    { name: '制造业', base: 8, issue: '电压骤降导致设备停机', lossPerCase: 8 },
    { name: '商业', base: 5, issue: '电压波动影响精密仪器', lossPerCase: 3 },
    { name: '居民', base: 12, issue: '电压不稳导致电器损坏', lossPerCase: 0.5 },
    { name: '农业', base: 3, issue: '电压偏低影响灌溉设备', lossPerCase: 2 },
  ]

  const records: any[] = []
  for (const st of stations as any[]) {
    const fluc = zoneFluctuation.get(st.zone) || 3
    // 投诉数 = 行业基础值 × 波动率系数（波动率越高投诉越多）
    const flucFactor = fluc / 3 // 以3%为基准
    for (const ind of industries) {
      const c = Math.max(1, Math.round(ind.base * flucFactor * (0.8 + Math.random() * 0.4)))
      records.push({
        id: uuid(),
        station_id: st.id,
        industry: ind.name,
        complaints: c,
        loss_estimate_wan: +(c * ind.lossPerCase).toFixed(1),
        main_issue: ind.issue,
        period: '2026H1',
        created_at: new Date().toISOString(),
      })
    }
  }

  await knex('complaint_stats').insert(records)
  console.log(`  ✓ ${records.length} 条投诉统计（按区域波动率加权）`)
}
