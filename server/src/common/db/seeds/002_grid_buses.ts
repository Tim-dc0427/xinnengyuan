import type { Knex } from 'knex'

interface BusDef { id: string; name: string; zone: string; voltage_level: string; base_kv: number; bus_type: string; physical_role: string; longitude?: number; latitude?: number; remark: string }
interface GenDef { id: string; bus_id: string; pg_mw: number; vg_kv: number; qmax_mvar: number; qmin_mvar: number; pg_a_mw: number; pg_b_mw: number; pg_c_mw: number; remark: string }
interface LoadDef { id: string; bus_id: string; pd_mw: number; qd_mvar: number; pd_a_mw: number; pd_b_mw: number; pd_c_mw: number; qd_a_mvar: number; qd_b_mvar: number; qd_c_mvar: number; remark: string }
interface BranchDef { id: string; from_bus_id: string; to_bus_id: string; zone: string; voltage_level: string; branch_type: string; r_ohm: number; x_ohm: number; b_uf: number; r0_ohm?: number; x0_ohm?: number; b0_uf?: number; tap_ratio?: number; ampacity_mva?: number; remark: string }

export async function seed(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF')
  // 仅清空电网拓扑自身管理的表（不越界触碰其他模块数据）
  await knex('batch_anomaly_items').del()
  await knex('batch_group_items').del()
  await knex('calc_checkpoints').del()
  await knex('calc_results').del()
  await knex('calc_tasks').del()
  await knex('batch_calc_groups').del()
  await knex('grid_loads').del()
  await knex('grid_generators').del()
  await knex('grid_branches').del()
  await knex('grid_buses').del()

  const buses: BusDef[] = []
  const gens: GenDef[] = []
  const loads: LoadDef[] = []
  const branches: BranchDef[] = []

  // 基于稳定 seed 的三相分相分配辅助函数（负荷侧，偏差较大）
  function phaseWeights(seed: string, baseA: number, baseB: number): [number, number, number] {
    const hash = seed.split('').reduce((s: number, c: string) => s + c.charCodeAt(0), 0)
    const wobble = (hash % 5 - 2) / 100  // -0.02 ~ +0.02
    const a = baseA + wobble
    const b = baseB
    const c = 1.0 - a - b
    return [a, b, c]
  }

  // 发电机/逆变器三相出力分相权重（微小不对称，模拟实际设备差异）
  function genPhaseWeights(seed: string): [number, number, number] {
    const hash = seed.split('').reduce((s: number, c: string) => s + c.charCodeAt(0), 0)
    // A 相偏差 -2%~+3%，B 相偏差 -1.5%~+2%，C 相补足
    const devA = ((hash % 51) - 20) / 1000  // -0.020 ~ +0.030
    const devB = ((hash % 36) - 15) / 1000  // -0.015 ~ +0.020
    const a = 1 / 3 + devA
    const b = 1 / 3 + devB
    const c = 1.0 - a - b
    return [Number(a.toFixed(4)), Number(b.toFixed(4)), Number(c.toFixed(4))]
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
    { name: '钱塘', zone: '钱塘区', load220Mw: 180, load110Mw: 260, load10Mw: 300, n220: 3, n110: 2, n10: 2, ampTx220to110: 360, ampTx110to10: 180, ampLine220: 520, ampLine110: 200, ampLine10: 160 },
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

  // 杭州实际站点命名（各电压等级独立地名，无跨级重名）
  const stationNames: Record<string, { '220kV': string[]; '110kV': string[]; '10kV': string[] }> = {
    '余杭': { '220kV': ['仓前变', '良渚变', '云栖变'],    '110kV': ['勾庄变', '闲林变', '彭公变'],     '10kV': ['文一西路开闭所', '古墩路开闭所', '良睦路开闭所'] },
    '萧山': { '220kV': ['花木变', '凤凰变', '涌潮变'],    '110kV': ['光明变', '航坞变', '市北变'],     '10kV': ['建设四路开闭所', '市心路开闭所'] },
    '滨江': { '220kV': ['滨江变', '江虹变'],              '110kV': ['白马变', '滨和变'],               '10kV': ['江南大道开闭所', '江陵路开闭所'] },
    '西湖': { '220kV': ['浮山变', '上泗变'],              '110kV': ['蒋村变', '西科变'],               '10kV': ['枫华西路开闭所', '留下开闭所'] },
    '拱墅': { '220kV': ['康桥变', '半山变'],              '110kV': ['北秀变', '东新变'],               '10kV': ['石祥路开闭所', '湖墅路开闭所'] },
    '上城': { '220kV': ['望江变'],                       '110kV': ['庆春变', '景芳变'],               '10kV': ['钱江路开闭所', '秋涛路开闭所'] },
    '钱塘': { '220kV': ['义蓬变', '临江变', '新湾变'],     '110kV': ['丰乐变', '灯塔变'],               '10kV': ['临江大道开闭所', '江东一路开闭所'] },
    '临平': { '220kV': ['大井变'],                        '110kV': ['北庄变', '高地变'],               '10kV': ['临平大道开闭所'] },
    '富阳': { '220kV': ['亭山变'],                        '110kV': ['清泉变', '后周变'],               '10kV': ['富春路开闭所', '桂花路开闭所'] },
    '临安': { '220kV': ['方圆变', '青云变'],               '110kV': ['锦城变', '科创变'],               '10kV': ['青山湖开闭所', '锦城大道开闭所'] },
    '桐庐': { '220kV': ['桐庐变'],                        '110kV': ['横村变'],                         '10kV': ['迎春南路开闭所'] },
    '建德': { '220kV': ['新安江变'],                      '110kV': ['寿昌变'],                         '10kV': ['新安路开闭所'] },
    '淳安': { '220kV': ['千岛湖变'],                      '110kV': ['文昌变'],                         '10kV': ['千岛湖大道开闭所'] },
  }
  function busRole(kv: string): string {
    if (kv === '220kV') return 'GENERATION'
    if (kv === '110kV') return 'SUBSTATION'
    return 'DISTRIBUTION'
  }
  function busName(dist: string, kv: '220kV' | '110kV' | '10kV', i: number): string {
    return stationNames[dist]?.[kv]?.[i] ?? `${dist}${kv}${i}`
  }

  let isFirst220 = true
  for (const dist of districts) {
    // 220kV（最高电压等级，无 500kV 上层电源）
    const d220: string[] = []
    // 该区总负荷决定 220kV 等值电源容量
    const totalDistLoad = dist.load220Mw + dist.load110Mw + dist.load10Mw
    const genPgMw = Number((totalDistLoad / dist.n220 * 1.15).toFixed(2))
    for (let i = 0; i < dist.n220; i++) {
      const id = genId()
      d220.push(id); kv220Ids.push(id)
      const busType = isFirst220 ? 'slack' : 'pv'
      isFirst220 = false
      buses.push({ id, name: busName(dist.name, '220kV', i), zone: dist.zone, voltage_level: '220kV', base_kv: 230, bus_type: busType, physical_role: busRole('220kV'), remark: busType === 'slack' ? '220kV平衡节点' : `${dist.zone}220kV` })
      const [gpA, gpB, gpC] = genPhaseWeights(dist.name + 'gen' + i)
      gens.push({ id: 'GEN' + id, bus_id: id, pg_mw: genPgMw, vg_kv: busType === 'slack' ? 230 : 232, qmax_mvar: Number((genPgMw * 0.5).toFixed(2)), qmin_mvar: Number((-genPgMw * 0.3).toFixed(2)), pg_a_mw: Number((genPgMw * gpA).toFixed(4)), pg_b_mw: Number((genPgMw * gpB).toFixed(4)), pg_c_mw: Number((genPgMw * gpC).toFixed(4)), remark: `${dist.name}等值电源` })
      // 220kV 不挂负荷 — 220kV母线为纯电源节点，负荷由下级110kV承担
    }
    kv220ByDistrict[dist.name] = d220

    // 110kV
    const d110: string[] = []
    for (let i = 0; i < dist.n110; i++) {
      const id = genId()
      d110.push(id); kv110Ids.push(id)
      buses.push({ id, name: busName(dist.name, '110kV', i), zone: dist.zone, voltage_level: '110kV', base_kv: 115, bus_type: 'pq', physical_role: busRole('110kV'), remark: `${dist.zone}110kV` })
      // 220kV 不挂负荷，原220kV工业负荷下放到110kV
      const ldMw = Number(((dist.load110Mw + dist.load220Mw) / dist.n110).toFixed(2))
      const ldQ = Number((ldMw * 0.45).toFixed(2))
      const [pA, pB, pC] = phaseWeights(dist.name + '110' + i, 0.36, 0.33)
      loads.push({ id: 'LOAD' + id, bus_id: id, pd_mw: ldMw, qd_mvar: ldQ, pd_a_mw: Number((ldMw * pA).toFixed(4)), pd_b_mw: Number((ldMw * pB).toFixed(4)), pd_c_mw: Number((ldMw * pC).toFixed(4)), qd_a_mvar: Number((ldQ * pA).toFixed(4)), qd_b_mvar: Number((ldQ * pB).toFixed(4)), qd_c_mvar: Number((ldQ * pC).toFixed(4)), remark: `${dist.name}110kV负荷` })
    }
    kv110ByDistrict[dist.name] = d110

    // 10kV
    const d10: string[] = []
    for (let i = 0; i < dist.n10; i++) {
      const id = genId()
      d10.push(id); kv10Ids.push(id)
      buses.push({ id, name: busName(dist.name, '10kV', i), zone: dist.zone, voltage_level: '10kV', base_kv: 10.5, bus_type: 'pq', physical_role: busRole('10kV'), remark: `${dist.zone}配网` })
      const ldMw = Number((dist.load10Mw / dist.n10).toFixed(2))
      const ldQ = Number((ldMw * 0.48).toFixed(2))
      const [pA, pB, pC] = phaseWeights(dist.name + '10' + i, 0.38, 0.34)
      loads.push({ id: 'LOAD' + id, bus_id: id, pd_mw: ldMw, qd_mvar: ldQ, pd_a_mw: Number((ldMw * pA).toFixed(4)), pd_b_mw: Number((ldMw * pB).toFixed(4)), pd_c_mw: Number((ldMw * pC).toFixed(4)), qd_a_mvar: Number((ldQ * pA).toFixed(4)), qd_b_mvar: Number((ldQ * pB).toFixed(4)), qd_c_mvar: Number((ldQ * pC).toFixed(4)), remark: `${dist.name}商住` })
    }
    kv10ByDistrict[dist.name] = d10
  }

  let brSeq = 0

  // ============================================================
  // 光伏并网母线（独立PV节点，与主母线物理分离）
  // ============================================================
  interface PvDef { name: string; zone: string; kv: string; baseKv: number; hostDist: string; hostKv: '220kV' | '110kV' | '10kV'; hostIdx: number; capacityMw: number }
  const pvDefs: PvDef[] = [
    { name: '义蓬光伏并网', zone: '钱塘区', kv: '220kV', baseKv: 230, hostDist: '钱塘', hostKv: '220kV', hostIdx: 0, capacityMw: 100 },
    { name: '临江光伏并网', zone: '钱塘区', kv: '220kV', baseKv: 230, hostDist: '钱塘', hostKv: '220kV', hostIdx: 1, capacityMw: 400 },
    { name: '新湾光伏并网', zone: '钱塘区', kv: '220kV', baseKv: 230, hostDist: '钱塘', hostKv: '220kV', hostIdx: 2, capacityMw: 550 },
    { name: '华洋光伏并网', zone: '建德市', kv: '110kV', baseKv: 115, hostDist: '建德', hostKv: '110kV', hostIdx: 0, capacityMw: 155 },
    { name: '青山光伏并网', zone: '临安区', kv: '110kV', baseKv: 115, hostDist: '临安', hostKv: '110kV', hostIdx: 0, capacityMw: 60 },
    { name: '太湖源光伏并网', zone: '临安区', kv: '110kV', baseKv: 115, hostDist: '临安', hostKv: '110kV', hostIdx: 1, capacityMw: 40 },
    { name: '径山光伏并网', zone: '余杭区', kv: '10kV', baseKv: 10.5, hostDist: '余杭', hostKv: '10kV', hostIdx: 0, capacityMw: 5.44 },
    { name: '南阳光伏并网', zone: '萧山区', kv: '10kV', baseKv: 10.5, hostDist: '萧山', hostKv: '10kV', hostIdx: 0, capacityMw: 50 },
    { name: '渔山光伏并网', zone: '富阳区', kv: '10kV', baseKv: 10.5, hostDist: '富阳', hostKv: '10kV', hostIdx: 0, capacityMw: 30 },
  ]
  const pvBusNameToId: Record<string, string> = {}
  for (const pv of pvDefs) {
    const id = genId()
    pvBusNameToId[pv.name] = id
    const hostIds = pv.hostKv === '220kV' ? kv220ByDistrict[pv.hostDist] : pv.hostKv === '110kV' ? kv110ByDistrict[pv.hostDist] : kv10ByDistrict[pv.hostDist]
    const hostId = hostIds[pv.hostIdx]
    buses.push({ id, name: pv.name, zone: pv.zone, voltage_level: pv.kv, base_kv: pv.baseKv, bus_type: 'pq', physical_role: 'PV', remark: `${pv.name} 光伏并网母线` })
    // 光伏出力作为发电机挂载
    const [gpA, gpB, gpC] = genPhaseWeights(pv.name)
    gens.push({ id: 'GEN' + id, bus_id: id, pg_mw: pv.capacityMw, vg_kv: pv.baseKv, qmax_mvar: Number((pv.capacityMw * 0.3).toFixed(2)), qmin_mvar: Number((-pv.capacityMw * 0.1).toFixed(2)), pg_a_mw: Number((pv.capacityMw * gpA).toFixed(4)), pg_b_mw: Number((pv.capacityMw * gpB).toFixed(4)), pg_c_mw: Number((pv.capacityMw * gpC).toFixed(4)), remark: pv.name })
    // 光伏母线 → 主母线 连接线
    brSeq++
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: id, to_bus_id: hostId, zone: pv.zone, voltage_level: pv.kv, branch_type: 'LINE', r_ohm: 0.01, x_ohm: 0.05, b_uf: 0, ampacity_mva: Math.round(pv.capacityMw * 1.2), remark: `${pv.name}线` })
  }

  // ============================================================
  // 220kV 区内环网
  // ============================================================
  for (const dist of districts) {
    const ids = kv220ByDistrict[dist.name]
    for (let i = 0; i < ids.length - 1; i++) {
      brSeq++
      const len = 8 + Math.random() * 5
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: ids[i], to_bus_id: ids[i + 1], zone: dist.zone, voltage_level: '220kV', branch_type: 'LINE', r_ohm: Number((len * 0.08).toFixed(2)), x_ohm: Number((len * 0.35).toFixed(2)), b_uf: Math.round(len * 15), ampacity_mva: dist.ampLine220, remark: `220kV${dist.name}送出线` })
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
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: aIds[0], to_bus_id: bIds[0], zone: `${a}—${b}`, voltage_level: '220kV', branch_type: 'LINE', r_ohm: Number((len * 0.08).toFixed(2)), x_ohm: Number((len * 0.35).toFixed(2)), b_uf: Math.round(len * 15), ampacity_mva: amp220Cross, remark: `${a}—${b}线` })
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
      branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: ids[i], to_bus_id: ids[i + 1], zone: dist.zone, voltage_level: '110kV', branch_type: 'LINE', r_ohm: Number((len * 0.12).toFixed(2)), x_ohm: Number((len * 0.4).toFixed(2)), b_uf: Math.round(len * 8), ampacity_mva: dist.ampLine110, remark: `110kV${dist.name}线` })
    }
  }

  // 跨区 110kV 联络
  for (const [a, b] of cross220) {
    const aIds = kv110ByDistrict[a]; const bIds = kv110ByDistrict[b]
    if (!aIds || !bIds || aIds.length === 0 || bIds.length === 0) continue
    brSeq++
    const len = 10 + Math.random() * 8
    const amp110Cross = Math.round(((districtMap.get(a)?.ampLine110 ?? 150) + (districtMap.get(b)?.ampLine110 ?? 150)) / 2)
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: aIds[aIds.length - 1], to_bus_id: bIds[0], zone: `${a}—${b}`, voltage_level: '110kV', branch_type: 'LINE', r_ohm: Number((len * 0.12).toFixed(2)), x_ohm: Number((len * 0.4).toFixed(2)), b_uf: Math.round(len * 8), ampacity_mva: amp110Cross, remark: `${a}—${b}线` })
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
    branches.push({ id: 'BRN' + String(brSeq).padStart(3, '0'), from_bus_id: aIds[0], to_bus_id: bIds[0], zone: `${a}—${b}`, voltage_level: '10kV', branch_type: 'LINE', r_ohm: Number((len * 0.25).toFixed(2)), x_ohm: Number((len * 0.35).toFixed(2)), b_uf: 0, ampacity_mva: amp10Cross, remark: `${a}—${b}线` })
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
  await knex.raw('PRAGMA foreign_keys = ON')
}
