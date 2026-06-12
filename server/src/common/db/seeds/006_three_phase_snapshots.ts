import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('three_phase_snapshots').del()

  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level', 'zone', 'physical_role')
  if (!buses.length) {
    console.log('⚠ 无母线数据，跳过三相快照种子')
    return
  }

  const pvRows = await knex('solar_pv_stations').where('status', 'active').select('bus_id', 'station_name')
  const pvBusIds = new Set(pvRows.map((r: any) => r.bus_id))
  const pvNameMap = new Map(pvRows.map((r: any) => [r.bus_id, r.station_name]))

  const genPhaseRows = await knex('grid_generators').select('bus_id', 'pg_a_mw', 'pg_b_mw', 'pg_c_mw', 'qmax_mvar', 'qmin_mvar')
  const genPhaseMap = new Map(genPhaseRows.map((g: any) => [g.bus_id, g]))
  const loadPhaseRows = await knex('grid_loads').select('bus_id', 'pd_a_mw', 'pd_b_mw', 'pd_c_mw', 'qd_a_mvar', 'qd_b_mvar', 'qd_c_mvar')
  const loadPhaseMap = new Map(loadPhaseRows.map((l: any) => [l.bus_id, l]))

  const DAYS = 30
  const now = new Date()
  const rows: any[] = []

  // 确定性伪随机（输出 0~1）
  function nodeRng(busId: string, dayOffset: number, salt: number = 0): number {
    let h = salt
    for (let i = 0; i < busId.length; i++) h = ((h << 5) - h) + busId.charCodeAt(i) + dayOffset * 131
    return ((h & 0x7fffffff) / 0x7fffffff)
  }

  // 正态分布近似（Box-Muller 简化版，输出均值附近的值）
  function gaussRng(busId: string, day: number, salt: number, mean: number, std: number): number {
    const u = nodeRng(busId, day, salt)
    const v = nodeRng(busId, day, salt + 1000)
    const z = Math.sqrt(-2 * Math.log(u + 0.001)) * Math.cos(2 * Math.PI * v)
    return Number((mean + z * std).toFixed(4))
  }

  // 获取星期几（0=周日, 6=周六）
  function dayOfWeek(dayOffset: number): number {
    const d = new Date(now)
    d.setDate(d.getDate() - (DAYS - 1 - dayOffset))
    return d.getDay()
  }

  for (const bus of buses) {
    const b = bus as any
    const busId = b.id
    const baseKv = parseFloat(b.voltage_level) || 10
    const role: string = b.physical_role || 'SUBSTATION'
    const pvRelated = pvBusIds.has(busId) ? 1 : 0
    const plantName = pvNameMap.get(busId) || ''

    // 每个节点的"个性"参数（确定性，不同节点完全不同）
    const persona = {
      // 基础不平衡度均值
      baseImbl: role === 'GENERATION' ? 0.2 + nodeRng(busId, 0, 1) * 0.3
        : role === 'PV' ? 0.5 + nodeRng(busId, 0, 2) * 2.5
        : role === 'DISTRIBUTION' ? 3 + nodeRng(busId, 0, 3) * 12
        : 1.5 + nodeRng(busId, 0, 4) * 6, // SUBSTATION
      // 日波动幅度
      dailyVolatility: role === 'GENERATION' ? 0.02
        : role === 'PV' ? 0.8 + nodeRng(busId, 0, 5) * 2.0
        : role === 'DISTRIBUTION' ? 1.5 + nodeRng(busId, 0, 6) * 4.0
        : 0.3 + nodeRng(busId, 0, 7) * 1.5,
      // 长期趋势斜率（%/天）
      trendSlope: (nodeRng(busId, 0, 8) - 0.5) * (role === 'GENERATION' ? 0.003 : role === 'PV' ? 0.02 : 0.01),
      // 工作日影响强度（0=不受影响, 1=强影响）
      weekdaySensitivity: role === 'GENERATION' ? 0.05
        : role === 'PV' ? 0.03
        : role === 'DISTRIBUTION' ? 0.3 + nodeRng(busId, 0, 9) * 0.5
        : 0.15 + nodeRng(busId, 0, 10) * 0.3,
      // 早晚高峰影响（仅配电/变电）
      hasPeakEffect: role === 'DISTRIBUTION' || (role === 'SUBSTATION' && nodeRng(busId, 0, 11) > 0.5),
      // 是否有突变事件（偶发异常跳变）
      anomalyDays: new Set<number>(),
    }

    // 随机生成 0~2 个异常日
    const anomalyCount = Math.floor(nodeRng(busId, 0, 12) * 3)
    for (let i = 0; i < anomalyCount; i++) {
      const anomalyDay = Math.floor(nodeRng(busId, 0, 13 + i) * DAYS)
      persona.anomalyDays.add(anomalyDay)
    }

    for (let day = 0; day < DAYS; day++) {
      const dayDate = new Date(now)
      dayDate.setDate(dayDate.getDate() - (DAYS - 1 - day))
      dayDate.setHours(8, 0, 0, 0)
      const recordedAt = dayDate.toISOString().replace('T', ' ').substring(0, 19)

      const dow = dayOfWeek(day)
      const isWeekend = dow === 0 || dow === 6

      // 基础趋势值
      const trendVal = persona.baseImbl + persona.trendSlope * day

      // 工作日效应：工作日偏高达 peak，周末偏低
      const weekdayBump = isWeekend
        ? -persona.weekdaySensitivity * persona.baseImbl * 0.6
        : persona.weekdaySensitivity * persona.baseImbl * 0.3

      // 早晚高峰日内波动（配电/变电更明显）
      // 用正弦模拟早8点-晚8点之间的波动
      const peakBoost = persona.hasPeakEffect
        ? Math.sin((day % 1 + 0.3) * Math.PI * 2) * persona.dailyVolatility * 0.4
        : 0

      // 每日随机扰动（每节点独立）
      const dailyNoise = gaussRng(busId, day, 100, 0, persona.dailyVolatility)

      // 异常跳变
      const anomalyBoost = persona.anomalyDays.has(day)
        ? (nodeRng(busId, day, 200) > 0.5 ? 1 : -1) * persona.baseImbl * (0.5 + nodeRng(busId, day, 201) * 1.5)
        : 0

      const imblPct = Number(Math.max(0.01,
        (trendVal + weekdayBump + peakBoost + dailyNoise + anomalyBoost)
      ).toFixed(2))

      // 三相电压幅值
      const vPu = 0.96 + nodeRng(busId, day + 1000, 300) * 0.08
      const actualKv = vPu * baseKv
      const ibFactor = imblPct / 100
      // 不同节点类型用略微不同的相分布模式
      let aRatio: number, bRatio: number, cRatio: number
      if (role === 'PV') {
        // 光伏节点：单相出力差异可能较大
        const pvSkew = (nodeRng(busId, day, 400) - 0.5) * ibFactor * 2
        aRatio = 1 + ibFactor * 0.3 + pvSkew
        bRatio = 1 + ibFactor * 0.1 - pvSkew * 0.6
        cRatio = 1 - ibFactor * 0.2 - pvSkew * 0.4
      } else if (role === 'DISTRIBUTION') {
        // 配电节点：A相通常偏重
        aRatio = 1 + ibFactor * 0.5
        bRatio = 1 + ibFactor * 0.1
        cRatio = 1 - ibFactor * 0.2
      } else {
        aRatio = 1 + ibFactor * 0.3
        bRatio = 1 + ibFactor * 0.1
        cRatio = 1 - ibFactor * 0.2
      }
      const va = Number((actualKv * aRatio).toFixed(4))
      const vb = Number((actualKv * bRatio).toFixed(4))
      const vc = Number((actualKv * cRatio).toFixed(4))

      // VUF ≈ 不平衡度 × 节点类型系数 × 随机因子
      const vufCoeff = role === 'GENERATION' ? 0.6 : role === 'PV' ? 1.2 : role === 'DISTRIBUTION' ? 0.7 : 0.8
      const vuf = Number(Math.max(0.01,
        imblPct * vufCoeff * (0.85 + nodeRng(busId, day, 500) * 0.3)
      ).toFixed(2))

      // 分相电流
      const genP = genPhaseMap.get(busId) as any
      const loadP = loadPhaseMap.get(busId) as any
      const pgA = genP?.pg_a_mw ?? 0; const pgB = genP?.pg_b_mw ?? 0; const pgC = genP?.pg_c_mw ?? 0
      const pdA = loadP?.pd_a_mw ?? 0; const pdB = loadP?.pd_b_mw ?? 0; const pdC = loadP?.pd_c_mw ?? 0
      const pgTotal = (pgA + pgB + pgC) || 1
      const pdTotal = (pdA + pdB + pdC) || 1
      const qgTotal = genP ? (genP.qmax_mvar ?? 0) * 0.6 : 0
      const qdTotal = loadP ? ((loadP.qd_a_mvar ?? 0) + (loadP.qd_b_mvar ?? 0) + (loadP.qd_c_mvar ?? 0)) : 0
      const qgA = pgA / pgTotal * qgTotal; const qgB = pgB / pgTotal * qgTotal; const qgC = pgC / pgTotal * qgTotal
      const qdA = loadP?.qd_a_mvar ?? 0; const qdB = loadP?.qd_b_mvar ?? 0; const qdC = loadP?.qd_c_mvar ?? 0
      const pNetA = pgA - pdA; const pNetB = pgB - pdB; const pNetC = pgC - pdC
      const qNetA = qgA - qdA; const qNetB = qgB - qdB; const qNetC = qgC - qdC
      const ia = Number((Math.sqrt(pNetA * pNetA + qNetA * qNetA) * 1000 / Math.max(va * 1000, 0.1) * 1000).toFixed(2))
      const ib = Number((Math.sqrt(pNetB * pNetB + qNetB * qNetB) * 1000 / Math.max(vb * 1000, 0.1) * 1000).toFixed(2))
      const ic = Number((Math.sqrt(pNetC * pNetC + qNetC * qNetC) * 1000 / Math.max(vc * 1000, 0.1) * 1000).toFixed(2))

      // CUF ≈ 不平衡度 × 负载类型系数 × 随机因子
      const cufCoeff = role === 'GENERATION' ? 0.5 : role === 'DISTRIBUTION' ? 1.8 : role === 'PV' ? 1.0 : 1.3
      const cuf = Number(Math.max(0.01,
        imblPct * cufCoeff * (0.8 + nodeRng(busId, day, 600) * 0.4)
      ).toFixed(2))

      rows.push({
        id: uuid(),
        bus_id: busId,
        recorded_at: recordedAt,
        imbalance_pct: imblPct,
        vuf,
        cuf,
        phase_a_kv: va,
        phase_b_kv: vb,
        phase_c_kv: vc,
        phase_a_current: ia,
        phase_b_current: ib,
        phase_c_current: ic,
        zone: b.zone || '',
        voltage_level: b.voltage_level || '',
        physical_role: role,
        pv_related: pvRelated,
        plant_name: plantName,
      })
    }
  }

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    await knex('three_phase_snapshots').insert(rows.slice(i, i + BATCH))
  }

  console.log(`✓ 三相快照种子完成：${rows.length} 条 (${buses.length} 节点 × ${DAYS} 天)`)
}
