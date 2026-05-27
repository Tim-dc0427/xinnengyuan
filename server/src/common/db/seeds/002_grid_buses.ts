import type { Knex } from 'knex'

interface BusDef { id: string; name: string; zone: string; voltage_level: string; base_kv: number; bus_type: string; longitude?: number; latitude?: number; remark: string }
interface GenDef { id: string; bus_id: string; pg_mw: number; vg_kv: number; qmax_mvar: number; qmin_mvar: number; pg_a_mw: number; pg_b_mw: number; pg_c_mw: number; remark: string }
interface LoadDef { id: string; bus_id: string; pd_mw: number; qd_mvar: number; pd_a_mw: number; pd_b_mw: number; pd_c_mw: number; qd_a_mvar: number; qd_b_mvar: number; qd_c_mvar: number; remark: string }
interface BranchDef { id: string; from_bus_id: string; to_bus_id: string; zone: string; voltage_level: string; branch_type: string; r_ohm: number; x_ohm: number; b_uf: number; r0_ohm?: number; x0_ohm?: number; b0_uf?: number; tap_ratio?: number; ampacity_mva?: number; remark: string }

export async function seed(knex: Knex): Promise<void> {
  // 清空依赖表（按外键依赖反向顺序）
  await knex('batch_anomaly_items').del()
  await knex('batch_group_items').del()
  await knex('calc_checkpoints').del()
  await knex('calc_results').del()
  await knex('calc_tasks').del()
  await knex('batch_calc_groups').del()
  await knex('load_measurements').del()
  await knex('feeder_buses').del()
  await knex('solar_pv_stations').del()
  await knex('load_entities').del()
  await knex('storage_entities').del()
  await knex('grid_loads').del()
  await knex('grid_generators').del()
  await knex('grid_branches').del()
  await knex('grid_buses').del()

  const buses: BusDef[] = []
  const gens: GenDef[] = []
  const loads: LoadDef[] = []
  const branches: BranchDef[] = []

  // 基于稳定 seed 的三相分相分配辅助函数
  function phaseWeights(seed: string, baseA: number, baseB: number): [number, number, number] {
    const hash = seed.split('').reduce((s: number, c: string) => s + c.charCodeAt(0), 0)
    const wobble = (hash % 5 - 2) / 100  // -0.02 ~ +0.02
    const a = baseA + wobble
    const b = baseB
    const c = 1.0 - a - b
    return [a, b, c]
  }

  // 支路零序/正序比值（基于电压等级）
  function zeroSeqRatio(kv: number): [number, number] {
    // r0/r1, x0/x1
    if (kv >= 220) return [1.5 + Math.random() * 0.5, 2.0 + Math.random() * 1.0]
    if (kv >= 110) return [2.0 + Math.random() * 1.0, 2.5 + Math.random() * 1.0]
    return [3.0 + Math.random() * 2.0, 3.0 + Math.random() * 2.0]
  }

  // ============================================================
  // 杭州 13 区县市
  // ============================================================
  interface District {
    name: string; zone: string
    load220Mw: number; load110Mw: number; load10Mw: number
    n220: number; n110: number; n10: number
    ampTx220to110: number  // 220→110kV 变压器容量(MVA)
    ampTx110to10: number   // 110→10kV 变压器容量(MVA)
    ampLine220: number     // 220kV 区内线路容量(MVA)
    ampLine110: number     // 110kV 区内线路容量(MVA)
    ampLine10: number      // 10kV 联络线容量(MVA)
  }
  const districts: District[] = [
    { name: '余杭', zone: '余杭区', load220Mw: 150, load110Mw: 250, load10Mw: 350, n220: 3, n110: 3, n10: 3, ampTx220to110: 300, ampTx110to10: 150, ampLine220: 520, ampLine110: 200, ampLine10: 160 },
    { name: '萧山', zone: '萧山区', load220Mw: 160, load110Mw: 260, load10Mw: 320, n220: 3, n110: 3, n10: 2, ampTx220to110: 350, ampTx110to10: 200, ampLine220: 520, ampLine110: 200, ampLine10: 160 },
    { name: '滨江', zone: '滨江区', load220Mw: 100, load110Mw: 180, load10Mw: 220, n220: 2, n110: 2, n10: 2, ampTx220to110: 300, ampTx110to10: 150, ampLine220: 480, ampLine110: 180, ampLine10: 140 },
    { name: '西湖', zone: '西湖区', load220Mw: 80, load110Mw: 150, load10Mw: 200, n220: 2, n110: 2, n10: 2, ampTx220to110: 280, ampTx110to10: 130, ampLine220: 480, ampLine110: 180, ampLine10: 120 },
    { name: '拱墅', zone: '拱墅区', load220Mw: 70, load110Mw: 140, load10Mw: 190, n220: 2, n110: 2, n10: 2, ampTx220to110: 280, ampTx110to10: 130, ampLine220: 480, ampLine110: 180, ampLine10: 120 },
    { name: '上城', zone: '上城区', load220Mw: 60, load110Mw: 130, load10Mw: 180, n220: 1, n110: 2, n10: 2, ampTx220to110: 260, ampTx110to10: 100, ampLine220: 440, ampLine110: 160, ampLine10: 100 },
    { name: '钱塘', zone: '钱塘区', load220Mw: 100, load110Mw: 160, load10Mw: 200, n220: 2, n110: 2, n10: 2, ampTx220to110: 300, ampTx110to10: 130, ampLine220: 480, ampLine110: 180, ampLine10: 140 },
    { name: '临平', zone: '临平区', load220Mw: 70, load110Mw: 120, load10Mw: 150, n220: 1, n110: 2, n10: 1, ampTx220to110: 300, ampTx110to10: 200, ampLine220: 440, ampLine110: 180, ampLine10: 140 },
    { name: '富阳', zone: '富阳区', load220Mw: 60, load110Mw: 100, load10Mw: 120, n220: 1, n110: 2, n10: 2, ampTx220to110: 220, ampTx110to10: 80, ampLine220: 400, ampLine110: 140, ampLine10: 100 },
    { name: '临安', zone: '临安区', load220Mw: 50, load110Mw: 80, load10Mw: 100, n220: 2, n110: 2, n10: 2, ampTx220to110: 200, ampTx110to10: 65, ampLine220: 440, ampLine110: 120, ampLine10: 100 },
    { name: '桐庐', zone: '桐庐县', load220Mw: 30, load110Mw: 50, load10Mw: 60, n220: 1, n110: 1, n10: 1, ampTx220to110: 200, ampTx110to10: 90, ampLine220: 380, ampLine110: 120, ampLine10: 80 },
    { name: '建德', zone: '建德市', load220Mw: 30, load110Mw: 45, load10Mw: 55, n220: 1, n110: 1, n10: 1, ampTx220to110: 200, ampTx110to10: 80, ampLine220: 360, ampLine110: 100, ampLine10: 80 },
    { name: '淳安', zone: '淳安县', load220Mw: 15, load110Mw: 25, load10Mw: 30, n220: 1, n110: 1, n10: 1, ampTx220to110: 200, ampTx110to10: 70, ampLine220: 360, ampLine110: 100, ampLine10: 80 },
  ]
  const districtMap = new Map(districts.map(d => [d.name, d]))

  // 固定 ID 范围：BUS001-029(220kV) BUS030-059(110kV) BUS060-079(10kV)
  let busSeq = 0
  const genId = (): string => { busSeq++; return 'BUS' + String(busSeq).padStart(3, '0') }

  // ============================================================
  // 220kV / 110kV / 10kV 层（按区生成，220kV 为最高电压等级）
  // ============================================================
  const kv220Ids: string[] = []
  const kv110Ids: string[] = []
  const kv10Ids: string[] = []
  const kv220ByDistrict: Record<string, string[]> = {}
  const kv110ByDistrict: Record<string, string[]> = {}
  const kv10ByDistrict: Record<string, string[]> = {}

  const kv220Name = (d: string, i: number) => i === 0 ? `${d}变220kV` : `${d}${['东', '西', '南', '北'][i - 1] || i}变220kV`
  const kv110Name = (d: string, i: number) => i === 0 ? `${d}变110kV` : `${d}${['东', '西', '南', '北'][i - 1] || i}变110kV`
  const kv10Name = (d: string, i: number) => i === 0 ? `${d}10kV` : `${d}${['东', '西', '南', '北'][i - 1] || i}10kV`

  let isFirst220 = true
  for (const dist of districts) {
    // 220kV（最高电压等级，无 500kV 上层电源）
    const d220: string[] = []
    // 该区总负荷决定 220kV 等值电源容量
    const totalDistLoad = dist.load220Mw + dist.load110Mw + dist.load10Mw
    const genPgMw = Math.round(totalDistLoad / dist.n220 * 1.1)
    for (let i = 0; i < dist.n220; i++) {
      const id = genId()
      d220.push(id); kv220Ids.push(id)
      const busType = isFirst220 ? 'slack' : 'pv'
      isFirst220 = false
      buses.push({ id, name: kv220Name(dist.name, i), zone: dist.zone, voltage_level: '220kV', base_kv: 230, bus_type: busType, remark: busType === 'slack' ? '220kV平衡节点' : `${dist.zone}220kV` })
      gens.push({ id: 'GEN' + id, bus_id: id, pg_mw: genPgMw, vg_kv: busType === 'slack' ? 230 : 232, qmax_mvar: Math.round(genPgMw * 0.5), qmin_mvar: -Math.round(genPgMw * 0.3), pg_a_mw: Number((genPgMw / 3).toFixed(2)), pg_b_mw: Number((genPgMw / 3).toFixed(2)), pg_c_mw: Number((genPgMw / 3).toFixed(2)), remark: `${dist.name}等值电源` })
      // 220kV 侧负荷（直供工业，三相基本平衡）
      const ldMw = Number((dist.load220Mw / dist.n220).toFixed(1))
      const ldQ = Number((ldMw * 0.45).toFixed(1))
      const [pA, pB, pC] = phaseWeights(dist.name + '220' + i, 0.34, 0.33)
      loads.push({ id: 'LOAD' + id, bus_id: id, pd_mw: ldMw, qd_mvar: ldQ, pd_a_mw: Number((ldMw * pA).toFixed(2)), pd_b_mw: Number((ldMw * pB).toFixed(2)), pd_c_mw: Number((ldMw * pC).toFixed(2)), qd_a_mvar: Number((ldQ * pA).toFixed(2)), qd_b_mvar: Number((ldQ * pB).toFixed(2)), qd_c_mvar: Number((ldQ * pC).toFixed(2)), remark: `${dist.name}220kV工业` })
    }
    kv220ByDistrict[dist.name] = d220

    // 110kV
    const d110: string[] = []
    for (let i = 0; i < dist.n110; i++) {
      const id = genId()
      d110.push(id); kv110Ids.push(id)
      buses.push({ id, name: kv110Name(dist.name, i), zone: dist.zone, voltage_level: '110kV', base_kv: 115, bus_type: 'pq', remark: `${dist.zone}110kV` })
      const ldMw = Number((dist.load110Mw / dist.n110).toFixed(1))
      const ldQ = Number((ldMw * 0.45).toFixed(1))
      const [pA, pB, pC] = phaseWeights(dist.name + '110' + i, 0.36, 0.33)
      loads.push({ id: 'LOAD' + id, bus_id: id, pd_mw: ldMw, qd_mvar: ldQ, pd_a_mw: Number((ldMw * pA).toFixed(2)), pd_b_mw: Number((ldMw * pB).toFixed(2)), pd_c_mw: Number((ldMw * pC).toFixed(2)), qd_a_mvar: Number((ldQ * pA).toFixed(2)), qd_b_mvar: Number((ldQ * pB).toFixed(2)), qd_c_mvar: Number((ldQ * pC).toFixed(2)), remark: `${dist.name}110kV负荷` })
    }
    kv110ByDistrict[dist.name] = d110

    // 10kV
    const d10: string[] = []
    for (let i = 0; i < dist.n10; i++) {
      const id = genId()
      d10.push(id); kv10Ids.push(id)
      buses.push({ id, name: kv10Name(dist.name, i), zone: dist.zone, voltage_level: '10kV', base_kv: 10.5, bus_type: 'pq', remark: `${dist.zone}配网` })
      const ldMw = Number((dist.load10Mw / dist.n10).toFixed(1))
      const ldQ = Number((ldMw * 0.48).toFixed(1))
      const [pA, pB, pC] = phaseWeights(dist.name + '10' + i, 0.38, 0.34)
      loads.push({ id: 'LOAD' + id, bus_id: id, pd_mw: ldMw, qd_mvar: ldQ, pd_a_mw: Number((ldMw * pA).toFixed(2)), pd_b_mw: Number((ldMw * pB).toFixed(2)), pd_c_mw: Number((ldMw * pC).toFixed(2)), qd_a_mvar: Number((ldQ * pA).toFixed(2)), qd_b_mvar: Number((ldQ * pB).toFixed(2)), qd_c_mvar: Number((ldQ * pC).toFixed(2)), remark: `${dist.name}商住` })
    }
    kv10ByDistrict[dist.name] = d10
  }

  let brSeq = 0

  // ============================================================
  // 220kV 区内环网
  // ============================================================
  for (const dist of districts) {
    const ids = kv220ByDistrict[dist.name]
    for (let i = 0; i < ids.length - 1; i++) {
      brSeq++
      const len = 8 + Math.random() * 5
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: ids[i], to_bus_id: ids[i + 1], zone: dist.zone, voltage_level: '220kV', branch_type: 'LINE', r_ohm: Number((len * 0.08).toFixed(2)), x_ohm: Number((len * 0.35).toFixed(2)), b_uf: Math.round(len * 15), ampacity_mva: dist.ampLine220, remark: `${dist.name}220kV联络` })
    }
  }

  // 跨区 220kV 联络线（相邻区之间）
  const cross220: [string, string][] = [
    ['余杭', '临安'], ['余杭', '拱墅'], ['余杭', '临平'],
    ['拱墅', '上城'], ['拱墅', '西湖'], ['西湖', '滨江'], ['西湖', '上城'],
    ['上城', '滨江'], ['滨江', '萧山'], ['萧山', '钱塘'], ['钱塘', '临平'],
    ['萧山', '富阳'], ['富阳', '临安'], ['富阳', '桐庐'],
    ['桐庐', '建德'], ['建德', '淳安'], ['桐庐', '淳安'],
  ]
  for (const [a, b] of cross220) {
    const aIds = kv220ByDistrict[a]; const bIds = kv220ByDistrict[b]
    if (!aIds || !bIds || aIds.length === 0 || bIds.length === 0) continue
    brSeq++
    const len = 15 + Math.random() * 10
    const amp220Cross = Math.round(((districtMap.get(a)?.ampLine220 ?? 400) + (districtMap.get(b)?.ampLine220 ?? 400)) / 2)
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: aIds[0], to_bus_id: bIds[0], zone: `${a}—${b}`, voltage_level: '220kV', branch_type: 'LINE', r_ohm: Number((len * 0.08).toFixed(2)), x_ohm: Number((len * 0.35).toFixed(2)), b_uf: Math.round(len * 15), ampacity_mva: amp220Cross, remark: `${a}—${b}联络` })
  }

  // ============================================================
  // 变压器：220→110（每 220kV 站带 1-2 个 110kV 站）
  // ============================================================
  for (const dist of districts) {
    const d220 = kv220ByDistrict[dist.name]
    const d110 = kv110ByDistrict[dist.name]
    for (let i = 0; i < d110.length; i++) {
      brSeq++
      const src = d220[Math.min(i, d220.length - 1)]
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: src, to_bus_id: d110[i], zone: dist.zone, voltage_level: '220kV', branch_type: 'TRANSFORMER', r_ohm: 0.4, x_ohm: 6.5, b_uf: 0, tap_ratio: 230 / 115, ampacity_mva: dist.ampTx220to110, remark: `${dist.name}220/110主变` })
    }
  }

  // ============================================================
  // 110kV 区内链式连接
  // ============================================================
  for (const dist of districts) {
    const ids = kv110ByDistrict[dist.name]
    for (let i = 0; i < ids.length - 1; i++) {
      brSeq++
      const len = 5 + Math.random() * 3
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: ids[i], to_bus_id: ids[i + 1], zone: dist.zone, voltage_level: '110kV', branch_type: 'LINE', r_ohm: Number((len * 0.12).toFixed(2)), x_ohm: Number((len * 0.4).toFixed(2)), b_uf: Math.round(len * 8), ampacity_mva: dist.ampLine110, remark: `${dist.name}110kV联络` })
    }
  }

  // 跨区 110kV 联络
  for (const [a, b] of cross220) {
    const aIds = kv110ByDistrict[a]; const bIds = kv110ByDistrict[b]
    if (!aIds || !bIds || aIds.length === 0 || bIds.length === 0) continue
    brSeq++
    const len = 10 + Math.random() * 8
    const amp110Cross = Math.round(((districtMap.get(a)?.ampLine110 ?? 150) + (districtMap.get(b)?.ampLine110 ?? 150)) / 2)
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: aIds[aIds.length - 1], to_bus_id: bIds[0], zone: `${a}—${b}`, voltage_level: '110kV', branch_type: 'LINE', r_ohm: Number((len * 0.12).toFixed(2)), x_ohm: Number((len * 0.4).toFixed(2)), b_uf: Math.round(len * 8), ampacity_mva: amp110Cross, remark: `${a}—${b}110kV联络` })
  }

  // ============================================================
  // 变压器：110→10（每 110kV 站带 1 个 10kV 站）
  // ============================================================
  for (const dist of districts) {
    const d110 = kv110ByDistrict[dist.name]
    const d10 = kv10ByDistrict[dist.name]
    for (let i = 0; i < Math.min(d110.length, d10.length); i++) {
      brSeq++
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: d110[i], to_bus_id: d10[i], zone: dist.zone, voltage_level: '110kV', branch_type: 'TRANSFORMER', r_ohm: 0.2, x_ohm: 3.2, b_uf: 0, tap_ratio: 115 / 10.5, ampacity_mva: dist.ampTx110to10, remark: `${dist.name}110/10配电变` })
    }
    // extra 10kV fed from last 110kV
    for (let i = d110.length; i < d10.length; i++) {
      brSeq++
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: d110[d110.length - 1], to_bus_id: d10[i], zone: dist.zone, voltage_level: '110kV', branch_type: 'TRANSFORMER', r_ohm: 0.2, x_ohm: 3.2, b_uf: 0, tap_ratio: 115 / 10.5, ampacity_mva: dist.ampTx110to10, remark: `${dist.name}110/10配电变` })
    }
  }

  // ============================================================
  // 10kV 联络（备用线路，提高可靠性）
  // ============================================================
  for (const [a, b] of cross220.slice(0, 10)) {
    const aIds = kv10ByDistrict[a]; const bIds = kv10ByDistrict[b]
    if (!aIds || !bIds || aIds.length === 0 || bIds.length === 0) continue
    brSeq++
    const len = 3 + Math.random() * 4
    const amp10Cross = Math.round(((districtMap.get(a)?.ampLine10 ?? 50) + (districtMap.get(b)?.ampLine10 ?? 50)) / 2)
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: aIds[0], to_bus_id: bIds[0], zone: `${a}—${b}`, voltage_level: '10kV', branch_type: 'LINE', r_ohm: Number((len * 0.25).toFixed(2)), x_ohm: Number((len * 0.35).toFixed(2)), b_uf: 0, ampacity_mva: amp10Cross, remark: `${a}—${b}10kV联络` })
  }

  // ============================================================
  // 支路零序参数补充
  // ============================================================
  for (const br of branches) {
    const kv = br.voltage_level === '220kV' ? 220 : br.voltage_level === '110kV' ? 110 : 10
    const [r0r1, x0x1] = zeroSeqRatio(kv)
    const isTransformer = br.branch_type === 'TRANSFORMER'
    br.r0_ohm = Number((br.r_ohm * r0r1).toFixed(4))
    br.x0_ohm = Number((br.x_ohm * x0x1).toFixed(4))
    br.b0_uf = isTransformer ? 0 : (br.b_uf > 0 ? Math.round(br.b_uf * (0.5 + Math.random() * 0.3)) : 0)
  }

  // ============================================================
  // 为每个节点分配坐标（杭州13区县实际经纬度 + 基于 bus ID 的稳定偏移）
  // 坐标数据统一通过种子数据管理，不在查询层动态生成
  // ============================================================
  const districtCoords: Record<string, [number, number]> = {
    '余杭区': [120.30, 30.42], '萧山区': [120.26, 30.16], '滨江区': [120.20, 30.20],
    '西湖区': [120.13, 30.26], '拱墅区': [120.14, 30.32], '上城区': [120.17, 30.25],
    '钱塘区': [120.40, 30.28], '临平区': [120.30, 30.38], '富阳区': [119.96, 30.05],
    '临安区': [119.72, 30.23], '桐庐县': [119.69, 29.79], '建德市': [119.28, 29.48],
    '淳安县': [119.04, 29.61],
  }

  for (const bus of buses) {
    const [baseLon, baseLat] = districtCoords[bus.zone] ?? [120.18, 30.25]
    const spread = bus.base_kv >= 500 ? 0.04 : bus.base_kv >= 220 ? 0.06 : bus.base_kv >= 110 ? 0.09 : 0.12
    const seed = bus.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    bus.longitude = Number((baseLon + ((seed * 16807 + 1 * 48271) % 1000) / 1000 * spread - spread / 2).toFixed(6))
    bus.latitude = Number((baseLat + ((seed * 48271 + 2 * 16807) % 1000) / 1000 * spread * 0.8 - spread * 0.4).toFixed(6))
  }

  // ============================================================
  // 写入数据库
  // ============================================================
  await knex('grid_buses').insert(buses)
  await knex('grid_generators').insert(gens)
  await knex('grid_loads').insert(loads)
  await knex('grid_branches').insert(branches)
}
