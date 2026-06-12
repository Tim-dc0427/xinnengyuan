import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

// 简单字符串哈希，用于确定性扰动
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
// 在 base 的 ±pct 范围内扰动，seed 确定性
function jitter(base: number, pct: number, seed: number, decimals = 1): number {
  const r = (seed % 1000) / 1000 // 0..0.999
  const delta = base * pct * (r * 2 - 1) // -pct..+pct
  return +(base + delta).toFixed(decimals)
}

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
    const busKv = b.base_kv || 10  // 母线电压，用于推算短路容量/造价等
    const grade = sol.grade || 'C'
    const seed = hashStr(b.name)
    // 接入并网电压比母线低1-2级（光伏不直接接高压母线）
    const accessKv = busKv >= 220 ? (seed % 2 === 0 ? 110 : 35)
      : busKv >= 110 ? (seed % 2 === 0 ? 35 : 10)
      : busKv >= 35 ? 10
      : seed % 3 === 0 ? 0.38 : 10
    // 按母线电压等级取基础值，再施加确定性扰动
    const baseScc = busKv >= 220 ? 800 : busKv >= 110 ? 400 : busKv >= 35 ? 200 : 100
    const baseDist = busKv >= 220 ? 5 : busKv >= 110 ? 4 : busKv >= 35 ? 3 : 2
    const baseCost = busKv >= 220 ? 3.2 : busKv >= 110 ? 3.8 : busKv >= 35 ? 4.2 : 4.5
    const basePayback = grade === 'A' ? 7 : grade === 'B' ? 8 : 9
    const baseIrr = grade === 'A' ? 12 : grade === 'B' ? 10 : 8
    // 非数值字段按 hash 取不同值（含不良值）
    const landOpts = ['建设用地', '建设用地', '未利用地', '草地', '农用地', '林地']
    const envOpts = ['不敏感', '不敏感', '一般', '一般', '敏感']
    const corrOpts = ['可用', '可用', '可用', '受限', '不可用']
    const geoOpts = ['低', '低', '低', '中', '高']
    return {
      id: uuid(),
      source_type: 'grid_bus',
      source_id: b.id,
      name: b.name,
      zone: b.zone || null,
      annual_irradiance: sol.irr ? jitter(sol.irr, 0.05, seed + 10, 0) : null,
      sunshine_hours: sol.hours ? jitter(sol.hours, 0.05, seed + 11, 0) : null,
      solar_grade: sol.grade,
      voltage_kv: accessKv,
      short_circuit_capacity_mva: jitter(baseScc, 0.2, seed + 2, 0),
      corridor_available: corrOpts[seed % corrOpts.length],
      transmission_line_length_km: jitter(baseDist, 0.4, seed + 3, 1),
      unit_cost: jitter(baseCost, 0.15, seed + 4, 2),
      payback_years: jitter(basePayback, 0.2, seed + 5, 1),
      irr_pct: jitter(baseIrr, 0.15, seed + 6, 1),
      land_type: landOpts[seed % landOpts.length],
      env_sensitivity: envOpts[(seed + 1) % envOpts.length],
      geohazard_risk: geoOpts[(seed + 2) % geoOpts.length],
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
    const zone = guessZone(cp.latitude, cp.longitude)
    const sol = zoneSolar[zone] || { irr: null, hours: null, grade: null }
    const grade = sol.grade || 'C'
    const dist = cp.transmission_line_length_km || 5
    const seed = hashStr(cp.location_desc || cp.id)
    const landOpts2 = ['建设用地', '建设用地', '未利用地', '草地', '农用地', '林地']
    const envOpts2 = ['不敏感', '不敏感', '一般', '一般', '敏感']
    const geoOpts2 = ['低', '低', '低', '中', '高']
    return {
      id: uuid(),
      source_type: 'candidate_point',
      source_id: cp.id,
      name: cp.location_desc || '候选接入点',
      zone,
      annual_irradiance: sol.irr ? jitter(sol.irr, 0.05, seed, 0) : null,
      sunshine_hours: sol.hours ? jitter(sol.hours, 0.05, seed + 1, 0) : null,
      solar_grade: sol.grade,
      voltage_kv: seed % 3 === 0 ? 35 : 10,
      short_circuit_capacity_mva: jitter(seed % 3 === 0 ? 200 : 100, 0.2, seed + 2, 0),
      corridor_available: '可用',
      transmission_line_length_km: jitter(dist, 0.4, seed + 3, 1),
      unit_cost: jitter(dist <= 3 ? 3.5 : dist <= 8 ? 4.0 : 4.5, 0.15, seed + 4, 2),
      payback_years: jitter(grade === 'A' ? 7 : grade === 'B' ? 8 : 9, 0.2, seed + 5, 1),
      irr_pct: jitter(grade === 'A' ? 12 : grade === 'B' ? 10 : 8, 0.15, seed + 6, 1),
      land_type: landOpts2[seed % landOpts2.length],
      env_sensitivity: envOpts2[(seed + 1) % envOpts2.length],
      geohazard_risk: geoOpts2[(seed + 2) % geoOpts2.length],
      created_at: now,
    }
  })
  if (cpRows.length) await knex('access_point_resources').insert(cpRows)
}

// 根据经纬度归入杭州区县
function guessZone(lat: number, lng: number): string {
  if (lat >= 30.29 && lat <= 30.35 && lng >= 120.55 && lng <= 120.65) return '钱塘区'
  if (lat >= 30.15 && lat <= 30.25 && lng >= 120.20 && lng <= 120.55) return '萧山区'
  if (lat >= 30.19 && lat <= 30.22 && lng >= 120.18 && lng <= 120.22) return '滨江区'
  if (lat >= 30.35 && lat <= 30.45 && lng >= 119.80 && lng <= 120.30) return '余杭区'
  if (lat >= 30.00 && lat <= 30.10 && lng >= 119.80 && lng <= 120.10) return '富阳区'
  if (lat >= 30.15 && lat <= 30.35 && lng >= 119.40 && lng <= 119.80) return '临安区'
  if (lat >= 29.45 && lat <= 29.65 && lng >= 119.20 && lng <= 119.50) return '建德市'
  if (lat >= 29.75 && lat <= 29.95 && lng >= 119.60 && lng <= 119.80) return '桐庐县'
  if (lat >= 29.55 && lat <= 29.80 && lng >= 118.80 && lng <= 119.20) return '淳安县'
  if (lat >= 30.22 && lat <= 30.30 && lng >= 120.05 && lng <= 120.18) return '西湖区'
  if (lat >= 30.30 && lat <= 30.36 && lng >= 120.12 && lng <= 120.20) return '拱墅区'
  if (lat >= 30.22 && lat <= 30.28 && lng >= 120.16 && lng <= 120.22) return '上城区'
  if (lat >= 30.38 && lat <= 30.46 && lng >= 120.28 && lng <= 120.38) return '临平区'
  return '余杭区'
}
