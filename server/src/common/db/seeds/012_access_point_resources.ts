import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  await knex('access_point_resources').del()

  const now = new Date().toISOString()

  // 杭州13区县太阳能资源数据
  const zoneSolar: Record<string, { irr: number; hours: number; grade: string }> = {
    '钱塘区': { irr: 1620, hours: 1450, grade: 'A' },
    '萧山区': { irr: 1580, hours: 1400, grade: 'A' },
    '余杭区': { irr: 1550, hours: 1380, grade: 'B' },
    '临安区': { irr: 1500, hours: 1350, grade: 'B' },
    '富阳区': { irr: 1520, hours: 1360, grade: 'B' },
    '建德市': { irr: 1480, hours: 1320, grade: 'B' },
    '桐庐县': { irr: 1460, hours: 1300, grade: 'C' },
    '淳安县': { irr: 1440, hours: 1280, grade: 'C' },
    '西湖区': { irr: 1400, hours: 1250, grade: 'C' },
    '拱墅区': { irr: 1380, hours: 1220, grade: 'C' },
    '上城区': { irr: 1360, hours: 1200, grade: 'C' },
    '滨江区': { irr: 1420, hours: 1260, grade: 'C' },
    '临平区': { irr: 1450, hours: 1300, grade: 'C' },
  }

  // ==================== 从 grid_buses 同步 ====================
  const buses = await knex('grid_buses').select('id', 'name', 'zone', 'base_kv')
  const busRows = buses.map((b: any) => {
    const sol = zoneSolar[b.zone] || { irr: null, hours: null, grade: null }
    return {
      id: uuid(),
      source_type: 'grid_bus',
      source_id: b.id,
      name: b.name,
      zone: b.zone || null,
      annual_irradiance: sol.irr,
      sunshine_hours: sol.hours,
      solar_grade: sol.grade,
      voltage_kv: b.base_kv || null,
      short_circuit_capacity_mva: null,
      corridor_available: null,
      transmission_line_length_km: null,
      unit_cost: null,
      payback_years: null,
      irr_pct: null,
      land_type: null,
      env_sensitivity: null,
      geohazard_risk: null,
      created_at: now,
    }
  })
  if (busRows.length) await knex('access_point_resources').insert(busRows)

  // ==================== 从 candidate_points 同步 ====================
  const cpoints = await knex('candidate_points').select(
    'id', 'location_desc', 'latitude', 'longitude',
    'transmission_line_length_km', 'transmission_cost', 'land_cost'
  )
  const cpRows = cpoints.map((cp: any) => {
    // 根据经纬度归入区县
    const zone = guessZone(cp.latitude, cp.longitude)
    const sol = zoneSolar[zone] || { irr: null, hours: null, grade: null }
    return {
      id: uuid(),
      source_type: 'candidate_point',
      source_id: cp.id,
      name: cp.location_desc || '候选接入点',
      zone,
      annual_irradiance: sol.irr,
      sunshine_hours: sol.hours,
      solar_grade: sol.grade,
      voltage_kv: null,
      short_circuit_capacity_mva: null,
      corridor_available: null,
      transmission_line_length_km: cp.transmission_line_length_km || null,
      unit_cost: null,
      payback_years: null,
      irr_pct: null,
      land_type: null,
      env_sensitivity: null,
      geohazard_risk: null,
      created_at: now,
    }
  })
  if (cpRows.length) await knex('access_point_resources').insert(cpRows)
}

// 根据经纬度归入杭州区县
function guessZone(lat: number, lng: number): string {
  // 钱塘区: 30.29-30.35, 120.55-120.65
  if (lat >= 30.29 && lat <= 30.35 && lng >= 120.55 && lng <= 120.65) return '钱塘区'
  // 萧山区: 30.15-30.25, 120.20-120.55
  if (lat >= 30.15 && lat <= 30.25 && lng >= 120.20 && lng <= 120.55) return '萧山区'
  // 滨江区: 30.19-30.22, 120.18-120.22
  if (lat >= 30.19 && lat <= 30.22 && lng >= 120.18 && lng <= 120.22) return '滨江区'
  // 余杭区: 30.35-30.45, 119.80-120.30
  if (lat >= 30.35 && lat <= 30.45 && lng >= 119.80 && lng <= 120.30) return '余杭区'
  // 富阳区: 30.00-30.10, 119.80-120.10
  if (lat >= 30.00 && lat <= 30.10 && lng >= 119.80 && lng <= 120.10) return '富阳区'
  // 临安区: 30.15-30.35, 119.40-119.80
  if (lat >= 30.15 && lat <= 30.35 && lng >= 119.40 && lng <= 119.80) return '临安区'
  // 建德市: 29.45-29.65, 119.20-119.50
  if (lat >= 29.45 && lat <= 29.65 && lng >= 119.20 && lng <= 119.50) return '建德市'
  // 桐庐县: 29.75-29.95, 119.60-119.80
  if (lat >= 29.75 && lat <= 29.95 && lng >= 119.60 && lng <= 119.80) return '桐庐县'
  // 淳安县: 29.55-29.80, 118.80-119.20
  if (lat >= 29.55 && lat <= 29.80 && lng >= 118.80 && lng <= 119.20) return '淳安县'
  // 西湖区: 30.22-30.30, 120.05-120.18
  if (lat >= 30.22 && lat <= 30.30 && lng >= 120.05 && lng <= 120.18) return '西湖区'
  // 拱墅区: 30.30-30.36, 120.12-120.20
  if (lat >= 30.30 && lat <= 30.36 && lng >= 120.12 && lng <= 120.20) return '拱墅区'
  // 上城区: 30.22-30.28, 120.16-120.22
  if (lat >= 30.22 && lat <= 30.28 && lng >= 120.16 && lng <= 120.22) return '上城区'
  // 临平区: 30.38-30.46, 120.28-120.38
  if (lat >= 30.38 && lat <= 30.46 && lng >= 120.28 && lng <= 120.38) return '临平区'
  return '余杭区' // 默认
}
