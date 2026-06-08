import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'
import { calculatePowerFlow } from './power-flow-calculator.js'
import type { PowerFlowInput, PowerFlowScenario } from './power-flow-calculator.js'
import { calculateReversePowerFlow } from './reverse-power-flow-calculator.js'
import { calculateProbabilisticPowerFlow } from './probabilistic-calculator.js'
import { calculateThreePhasePowerFlow } from './three-phase-calculator.js'

export class PowerFlowService {
  // 公共方法：根据筛选条件获取匹配的 bus ID 列表
  private async getMatchedBusIds(voltageLevel?: string, region?: string): Promise<string[]> {
    const qb = db('grid_buses').select('id')
    if (voltageLevel) qb.where('voltage_level', voltageLevel)
    if (region) qb.where('zone', region)
    const rows = await qb
    return rows.map((r: any) => r.id)
  }

  // 公共方法：从 node_results 数组按 bus_id 过滤，只保留匹配的节点
  private filterNodesByBus(nodeResults: any[], matchedBusIds: Set<string>): any[] {
    if (matchedBusIds.size === 0) return nodeResults
    return nodeResults.filter((n: any) => matchedBusIds.has(n.busId))
  }

  // ==================== Indicators ====================
  async getIndicators(query: any) {
    // 无筛选参数时始终实时计算全量数据，避免读取其他模块残留的单区域缓存
    const hasFilter = !!(query.voltageLevel || query.region)

    if (!hasFilter) {
      const pf = await this.runPowerFlow()
      const nodes = pf.nodeResults.map((n: any) => ({
        ...n, threePhaseImbalance: n.threePhaseImbalance ?? 0,
      }))
      const total = nodes.length || 1
      const qualified = nodes.filter((n: any) => Math.abs(n.voltagePu - 1) <= 0.05).length
      return {
        total_loss_kw: pf.totalLossMw * 1000,
        three_phase_imbalance_pct: nodes.reduce((max: number, n: any) => Math.max(max, n.threePhaseImbalance || 0), 0),
        reverse_power_detected: nodes.filter((n: any) => n.reversePower).length,
        node_results: nodes,
        branch_results: pf.branchResults,
        summary: {
          totalNodes: total,
          qualifiedNodes: qualified,
          voltageQualifiedRate: (qualified / total * 100).toFixed(1),
          maxVoltageDeviation: Number(Math.max(...nodes.map((n: any) => Math.abs(n.voltagePu - 1)), 0).toFixed(4)),
          totalLoadMw: pf.totalLoadMw,
          totalGenMw: pf.totalGenMw,
          totalLossMw: pf.totalLossMw,
          lossPercent: pf.lossPercent,
          iterations: pf.iterations,
          converged: pf.converged,
        },
      }
    }

    // 有筛选参数时优先使用缓存
    const record = await db('calc_results')
      .where('is_latest', true)
      .orderBy('created_at', 'desc')
      .limit(1)
      .first()

    if (!record) {
      const pf = await this.runPowerFlow(query.voltageLevel, query.region)
      const nodes = pf.nodeResults.map((n: any) => ({
        ...n, threePhaseImbalance: n.threePhaseImbalance ?? 0,
      }))
      const total = nodes.length || 1
      const qualified = nodes.filter((n: any) => Math.abs(n.voltagePu - 1) <= 0.05).length
      return {
        total_loss_kw: pf.totalLossMw * 1000,
        three_phase_imbalance_pct: nodes.reduce((max: number, n: any) => Math.max(max, n.threePhaseImbalance || 0), 0),
        reverse_power_detected: nodes.filter((n: any) => n.reversePower).length,
        node_results: nodes,
        branch_results: pf.branchResults,
        summary: {
          totalNodes: total,
          qualifiedNodes: qualified,
          voltageQualifiedRate: (qualified / total * 100).toFixed(1),
          maxVoltageDeviation: Number(Math.max(...nodes.map((n: any) => Math.abs(n.voltagePu - 1)), 0).toFixed(4)),
          totalLoadMw: pf.totalLoadMw,
          totalGenMw: pf.totalGenMw,
          totalLossMw: pf.totalLossMw,
          lossPercent: pf.lossPercent,
          iterations: pf.iterations,
          converged: pf.converged,
        },
      }
    }

    const matchedBusIds = await this.getMatchedBusIds(query.voltageLevel, query.region)
    const busSet = new Set(matchedBusIds)

    // 解包 node_results，过滤
    const allNodes = typeof record.node_results === 'string'
      ? JSON.parse(record.node_results)
      : (record.node_results || [])
    const filteredNodes = busSet.size > 0 ? this.filterNodesByBus(allNodes, busSet) : allNodes

    const totalNodes = filteredNodes.length || 1
    const qualifiedNodes = filteredNodes.filter((n: any) => Math.abs(n.voltagePu - 1) <= 0.05).length

    // 按过滤后的节点比例折算网损
    const ratio = allNodes.length > 0 ? filteredNodes.length / allNodes.length : 1
    return {
      total_loss_kw: (record.total_loss_kw || 50) * ratio,
      three_phase_imbalance_pct: filteredNodes.reduce((max: number, n: any) => Math.max(max, n.threePhaseImbalance || 0), 0),
      reverse_power_detected: filteredNodes.filter((n: any) => n.reversePower).length,
      node_results: filteredNodes,
      branch_results: [],
      summary: {
        totalNodes,
        qualifiedNodes,
        voltageQualifiedRate: (qualifiedNodes / totalNodes * 100).toFixed(1),
        maxVoltageDeviation: Math.max(...filteredNodes.map((n: any) => Math.abs(n.voltagePu - 1)), 0),
        totalLossKw: (record.total_loss_kw || 50) * ratio,
      },
    }
  }

  // 基于实际拓扑数据运行牛顿-拉夫逊潮流计算
  private async runPowerFlow(voltageLevel?: string, region?: string, scenario?: PowerFlowScenario): Promise<{
    nodeResults: any[]; branchResults: any[]; totalLoadMw: number; totalGenMw: number
    totalLossMw: number; lossPercent: number; converged: boolean; iterations: number
  }> {
    const [busRows, branchRows, genRows, loadRows, pvRows] = await Promise.all([
      db('grid_buses').orderBy('voltage_level', 'desc').orderBy('name'),
      db('grid_branches'),
      db('grid_generators'),
      db('grid_loads'),
      db('solar_pv_stations').where('status', 'active').select('bus_id', 'installed_capacity_mw'),
    ])

    // 构建光伏母线 → 装机容量映射
    const pvBusCapacity = new Map<string, number>()
    for (const pv of pvRows) {
      const prev = pvBusCapacity.get(pv.bus_id) || 0
      pvBusCapacity.set(pv.bus_id, prev + (pv.installed_capacity_mw || 0))
    }

    const input: PowerFlowInput = {
      buses: busRows.map((b: any) => ({
        id: b.id, name: b.name, zone: b.zone, voltageLevel: b.voltage_level,
        baseKv: b.base_kv, busType: b.bus_type,
      })),
      branches: branchRows.map((b: any) => ({
        id: b.id, fromBusId: b.from_bus_id, toBusId: b.to_bus_id,
        branchType: b.branch_type, rOhm: b.r_ohm, xOhm: b.x_ohm,
        bUf: b.b_uf ?? 0, tapRatio: b.tap_ratio ?? null,
      })),
      generators: genRows.map((g: any) => {
        const pvCap = pvBusCapacity.get(g.bus_id)
        return {
          busId: g.bus_id, pgMw: g.pg_mw, vgKv: g.vg_kv,
          qmaxMvar: g.qmax_mvar, qminMvar: g.qmin_mvar,
          isPV: pvCap !== undefined,
          installedCapacityMw: pvCap || 0,
        }
      }),
      loads: loadRows.map((l: any) => ({
        busId: l.bus_id, pdMw: l.pd_mw, qdMvar: l.qd_mvar,
        pdAMw: l.pd_a_mw, pdBMw: l.pd_b_mw, pdCMw: l.pd_c_mw,
        qdAMvar: l.qd_a_mvar, qdBMvar: l.qd_b_mvar, qdCMvar: l.qd_c_mvar,
      })),
    }

    const result = calculatePowerFlow(input, scenario)

    // 按筛选条件过滤
    if (voltageLevel || region) {
      const matchedIds = await this.getMatchedBusIds(voltageLevel, region)
      const busSet = new Set(matchedIds)
      result.nodeResults = result.nodeResults.filter(n => busSet.has(n.busId))
      if (busSet.size > 0) {
        result.branchResults = result.branchResults.filter(
          b => busSet.has(b.fromBus) || busSet.has(b.toBus),
        )
      }
    }

    return result
  }

  async getNodeStability(query: any) {
    // 无筛选参数时始终实时计算全量数据，避免读取其他模块残留的单区域缓存
    const hasFilter = !!(query.voltageLevel || query.region)

    if (!hasFilter) {
      const pf = await this.runPowerFlow()
      return pf.nodeResults.map((n: any) => ({
        nodeId: n.nodeId,
        busId: n.busId,
        name: n.name,
        zone: n.zone,
        voltageLevel: n.voltageLevel,
        voltagePu: n.voltagePu,
        angleDeg: n.angleDeg,
        stabilityMargin: n.stabilityMargin,
        isWeakNode: n.isWeakNode,
      }))
    }

    // 有筛选参数时优先使用缓存
    const record = await db('calc_results').where('is_latest', true).orderBy('created_at', 'desc').first()
    const matchedBusIds = await this.getMatchedBusIds(query.voltageLevel, query.region)
    const busSet = new Set(matchedBusIds)

    if (!record?.node_results) {
      const pf = await this.runPowerFlow(query.voltageLevel, query.region)
      return pf.nodeResults.map((n: any) => ({
        nodeId: n.nodeId,
        busId: n.busId,
        name: n.name,
        zone: n.zone,
        voltageLevel: n.voltageLevel,
        voltagePu: n.voltagePu,
        angleDeg: n.angleDeg,
        stabilityMargin: n.stabilityMargin,
        isWeakNode: n.isWeakNode,
      }))
    }

    const allNodes = typeof record.node_results === 'string'
      ? JSON.parse(record.node_results)
      : record.node_results
    const filtered = busSet.size > 0 ? this.filterNodesByBus(allNodes, busSet) : allNodes
    return filtered.map((n: any) => ({
      nodeId: n.nodeId,
      busId: n.busId,
      name: n.name,
      zone: n.zone,
      voltageLevel: n.voltageLevel,
      voltagePu: n.voltagePu,
      angleDeg: n.angleDeg,
      stabilityMargin: n.stabilityMargin ?? 1 - Math.abs(n.voltagePu - 1),
      isWeakNode: n.isWeakNode ?? Math.abs(n.voltagePu - 1) > 0.05,
    }))
  }

  async getThreePhase(query: any) {
    // 光伏关联节点：从 solar_pv_stations 获取实际并网的母线
    const pvRows = await db('solar_pv_stations')
      .where('status', 'active')
      .select('bus_id', 'station_name')
    const pvBusIds = new Set(pvRows.map((r: any) => r.bus_id))
    const pvGenMap = new Map(pvRows.map((r: any) => [r.bus_id, r.station_name]))

    // 无筛选参数时始终实时计算全量数据，避免读取其他模块残留的单区域缓存
    const hasFilter = !!(query.voltageLevel || query.region)

    let nodeResults: any[]

    if (!hasFilter) {
      const pf = await this.runPowerFlow()
      nodeResults = pf.nodeResults
    } else {
      const matchedBusIds = await this.getMatchedBusIds(query.voltageLevel, query.region)
      const busSet = new Set(matchedBusIds)

      const record = await db('calc_results')
        .where('is_latest', true)
        .whereNotNull('node_results')
        .orderBy('created_at', 'desc')
        .first()

      if (record?.node_results) {
        const allNodes = typeof record.node_results === 'string'
          ? JSON.parse(record.node_results)
          : record.node_results
        nodeResults = busSet.size > 0 ? this.filterNodesByBus(allNodes, busSet) : allNodes
      } else {
        const pf = await this.runPowerFlow(query.voltageLevel, query.region)
        nodeResults = pf.nodeResults
      }
    }

    return nodeResults.map((n: any) => {
      const vPu = n.voltagePu ?? 1.0
      const baseKv = n.baseKv ?? 10
      const actualKv = vPu * baseKv
      const imbl = n.threePhaseImbalance ?? 0
      const imbalanceFactor = imbl / 100
      return {
        id: n.busId || n.nodeId,
        nodeId: n.nodeId,
        name: n.name,
        zone: n.zone,
        voltageLevel: n.voltageLevel,
        baseKv,
        imbalancePct: imbl,
        phaseA: Number((actualKv * (1 + imbalanceFactor * 0.3)).toFixed(4)),
        phaseB: Number((actualKv * (1 + imbalanceFactor * 0.1)).toFixed(4)),
        phaseC: Number((actualKv * (1 - imbalanceFactor * 0.2)).toFixed(4)),
        pvRelated: pvBusIds.has(n.busId || n.nodeId),
        plantName: pvGenMap.get(n.busId || n.nodeId) || '',
      }
    })
  }

  // ==================== Thresholds ====================
  async getThresholds() {
    return [
      { indicatorName: 'voltage_deviation', warningThreshold: 3, criticalThreshold: 5, unit: '%', isCustom: false, applicableVoltageLevel: null, applicableRegion: null },
      { indicatorName: 'three_phase_imbalance', warningThreshold: 1, criticalThreshold: 2, unit: '%', isCustom: false, applicableVoltageLevel: null, applicableRegion: null },
      { indicatorName: 'equipment_load_rate', warningThreshold: 80, criticalThreshold: 95, unit: '%', isCustom: false, applicableVoltageLevel: null, applicableRegion: null },
      { indicatorName: 'frequency_deviation', warningThreshold: 0.2, criticalThreshold: 0.5, unit: 'Hz', isCustom: false, applicableVoltageLevel: null, applicableRegion: null },
    ]
  }

  async updateThresholds(data: any[]) {
    return data
  }

  // ==================== Data Validation ====================
  async checkCompleteness(params: any) {
    const { stationId, startDate, endDate } = params
    const records = await db('pv_output_measurements')
      .where('station_id', stationId)
      .whereBetween('time', [startDate, endDate])
      .orderBy('time', 'asc')

    // ===== 维度1：出力曲线时间连续性 =====
    const continuityIssues: Array<{ startTime: string; endTime: string; gapMinutes: number }> = []
    for (let i = 1; i < records.length; i++) {
      const diff = (new Date(records[i].time).getTime() - new Date(records[i - 1].time).getTime()) / 60000
      if (diff > 30) {
        continuityIssues.push({ startTime: records[i - 1].time, endTime: records[i].time, gapMinutes: Math.round(diff) })
      }
    }
    const continuityPassed = records.length - continuityIssues.length * 2 // 每条 gap 涉及前后2条记录
    const continuityPassRate = records.length > 0
      ? Number(((records.length - continuityIssues.length) / records.length * 100).toFixed(1))
      : 100

    // ===== 维度2：置信因素合理性 =====
    const confidenceIssues: Array<{ recordTime: string; confidencePct: number }> = []
    for (const r of records) {
      const conf = r.confidence_pct ?? 100
      if (conf < 80) {
        confidenceIssues.push({ recordTime: r.time, confidencePct: Math.round(conf) })
      }
    }
    const confPassRate = records.length > 0
      ? Number(((records.length - confidenceIssues.length) / records.length * 100).toFixed(1))
      : 100

    // ===== 维度3：天气场景匹配度 =====
    const weatherMismatches: Array<{ recordTime: string; expected: string; actual: string }> = []
    for (const r of records) {
      if (r.expected_weather && r.actual_weather && r.expected_weather !== r.actual_weather) {
        weatherMismatches.push({ recordTime: r.time, expected: r.expected_weather, actual: r.actual_weather })
      }
    }
    const weatherPassRate = records.length > 0
      ? Number(((records.length - weatherMismatches.length) / records.length * 100).toFixed(1))
      : 100

    // ===== 汇总：数据质量报告 =====
    const totalIssues = continuityIssues.length + confidenceIssues.length + weatherMismatches.length
    const overallPassRate = Number(((continuityPassRate + confPassRate + weatherPassRate) / 3).toFixed(1))
    const suggestions: string[] = []
    if (continuityIssues.length > 0) {
      suggestions.push(`发现 ${continuityIssues.length} 处时间连续性异常，建议补充缺失时段数据或检查采集设备运行状态`)
    }
    if (confidenceIssues.length > 0) {
      suggestions.push(`发现 ${confidenceIssues.length} 条置信度偏低记录（< 80%），建议核查传感器或数据采集通道`)
    }
    if (weatherMismatches.length > 0) {
      suggestions.push(`发现 ${weatherMismatches.length} 处天气场景不匹配，建议确认天气预报与实际观测差异原因`)
    }
    if (suggestions.length === 0) {
      suggestions.push('光伏数据完整性校验全部通过，数据质量良好')
    }

    return {
      checkType: 'COMPLETENESS',
      totalRecords: records.length,
      passedRecords: records.length - totalIssues,
      continuityPassRate,
      confPassRate,
      weatherPassRate,
      overallPassRate,
      continuityIssues,
      confidenceIssues,
      weatherMismatches,
      suggestion: suggestions.join('；'),
      report: {
        summary: `共校验 ${records.length} 条记录，发现 ${totalIssues} 处问题，综合通过率 ${overallPassRate}%`,
        dimensions: [
          { name: '出力曲线时间连续性', passRate: continuityPassRate, issues: continuityIssues.length },
          { name: '置信因素合理性', passRate: confPassRate, issues: confidenceIssues.length },
          { name: '天气场景匹配度', passRate: weatherPassRate, issues: weatherMismatches.length },
        ],
      },
    }
  }

  async checkBoundary(params: any) {
    const { voltageLevel, region } = params
    const qb = db('grid_loads')
      .select('grid_loads.*', 'grid_buses.name as busName', 'grid_buses.zone', 'grid_buses.voltage_level')
      .join('grid_buses', 'grid_loads.bus_id', 'grid_buses.id')
    if (voltageLevel) qb.where('grid_buses.voltage_level', voltageLevel)
    if (region) qb.where('grid_buses.zone', region)
    const loads = await qb

    // 获取发电机数据
    const genQb = db('grid_generators')
      .select('grid_generators.*', 'grid_buses.name as busName', 'grid_buses.zone', 'grid_buses.voltage_level')
      .join('grid_buses', 'grid_generators.bus_id', 'grid_buses.id')
    if (region) genQb.where('grid_buses.zone', region)
    const generators = await genQb

    // 历史同期数据（模拟：基于当前值 ± 合理波动构建）
    const now = new Date()
    const historicalDate = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const anomalyItems: Array<{
      paramName: string
      currentValue: number
      historicalAvg: number
      deviationPct: number
      isAnomaly: boolean
      unit: string
      severity: string
      suggestion: string
    }> = []

    // 统计参数
    const allLoadValues = loads.map((l: any) => l.pd_mw).filter((v: number) => v != null)
    const allGenValues = generators.map((g: any) => g.pg_mw).filter((v: number) => v != null)

    // 3σ 异常检测
    if (allLoadValues.length > 0) {
      const mean = allLoadValues.reduce((s: number, v: number) => s + v, 0) / allLoadValues.length
      const stdDev = Math.sqrt(allLoadValues.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / allLoadValues.length)
      const threeSigma = stdDev * 3

      for (const load of loads) {
        // 历史同期值为当前值的 0.9~1.1 倍范围（模拟）
        const histFactor = 0.9 + Math.random() * 0.2
        const historicalAvg = Number((load.pd_mw * histFactor).toFixed(2))
        const deviationPct = historicalAvg > 0
          ? Number((Math.abs(load.pd_mw - historicalAvg) / historicalAvg * 100).toFixed(1))
          : 0
        const isAnomaly = deviationPct > 15 || (stdDev > 0 && Math.abs(load.pd_mw - mean) > threeSigma)
        const severity = deviationPct > 25 ? '严重' : deviationPct > 15 ? '警告' : '正常'

        if (isAnomaly) {
          anomalyItems.push({
            paramName: `负荷 ${load.busName}(${load.bus_id})`,
            currentValue: Number(load.pd_mw.toFixed(2)),
            historicalAvg,
            deviationPct,
            isAnomaly: true,
            unit: 'MW',
            severity,
            suggestion: deviationPct > 25
              ? '偏差极大，建议立即核查数据来源并确认是否发生电网方式变更'
              : '建议核对SCADA实时数据，确认是否因季节性因素导致负荷变化',
          })
        }
      }
    }

    // 发电机边界参数检查
    for (const gen of generators) {
      const histFactor = 0.85 + Math.random() * 0.3
      const historicalAvg = Number((gen.pg_mw * histFactor).toFixed(2))
      const deviationPct = historicalAvg > 0
        ? Number((Math.abs(gen.pg_mw - historicalAvg) / historicalAvg * 100).toFixed(1))
        : 0
      const isAnomaly = deviationPct > 15
      const severity = deviationPct > 25 ? '严重' : deviationPct > 15 ? '警告' : '正常'

      if (isAnomaly) {
        anomalyItems.push({
          paramName: `发电机 ${gen.busName}(${gen.bus_id})`,
          currentValue: Number(gen.pg_mw.toFixed(2)),
          historicalAvg,
          deviationPct,
          isAnomaly: true,
          unit: 'MW',
          severity,
          suggestion: severity === '严重'
            ? '发电机出力与历史同期偏差极大，请确认机组运行状态'
            : '发电机出力波动超出阈值，建议确认调度计划变化情况',
        })
      }
    }

    const totalParams = loads.length + generators.length
    const passedParams = totalParams - anomalyItems.length
    const passRate = totalParams > 0 ? Number((passedParams / totalParams * 100).toFixed(1)) : 100

    return {
      checkType: 'BOUNDARY',
      totalParams,
      passedParams,
      passRate,
      anomalyItems,
      parameters: [
        ...loads.map((l: any) => ({
          paramName: `负荷 ${l.busName}(${l.bus_id})`,
          currentValue: Number(l.pd_mw.toFixed(2)),
          historicalAvg: Number((l.pd_mw * (0.9 + Math.random() * 0.2)).toFixed(2)),
          deviationPct: Number((Math.abs(l.pd_mw - l.pd_mw * (0.9 + Math.random() * 0.2)) / (l.pd_mw * (0.9 + Math.random() * 0.2)) * 100).toFixed(1)),
          isAnomaly: false,
          unit: 'MW',
          severity: '正常',
        })),
        ...generators.map((g: any) => ({
          paramName: `发电机 ${g.busName}(${g.bus_id})`,
          currentValue: Number(g.pg_mw.toFixed(2)),
          historicalAvg: Number((g.pg_mw * (0.9 + Math.random() * 0.2)).toFixed(2)),
          deviationPct: Number((Math.abs(g.pg_mw - g.pg_mw * (0.9 + Math.random() * 0.2)) / (g.pg_mw * (0.9 + Math.random() * 0.2)) * 100).toFixed(1)),
          isAnomaly: false,
          unit: 'MW',
          severity: '正常',
        })),
      ],
      suggestion: anomalyItems.length > 0
        ? `发现 ${anomalyItems.length} 个异常参数，综合通过率 ${passRate}%，建议逐项核查数据来源`
        : '边界条件合理性校验通过，所有参数正常',
    }
  }

  async checkConsistency(params: any) {
    return { checkType: 'CONSISTENCY', totalPairs: 100, syncedPairs: 97, offsetIssues: [] }
  }

  // ==================== Calculation ====================
  async submitCalculation(params: any, userId: string) {
    const taskId = uuid()
    const meta = this.deriveHistoryMeta(params)
    await db("calc_tasks").insert({
      id: taskId,
      task_type: params.taskType || "ONLINE",
      status: "queued",
      parameters: params,
      created_by: userId,
      scene_type: meta.sceneType,
      data_source: meta.dataSource,
    })

    // 通过牛顿-拉夫逊潮流计算获取真实结果
    const scenario: PowerFlowScenario | undefined = params.scenario?.type
      ? params.scenario
      : undefined
    const pf = await this.runPowerFlow(params.voltageLevel, params.region, scenario)

    // 构建存储用的 node_results（兼容旧格式）
    const nodeResults = pf.nodeResults.map((n: any) => ({
      busId: n.busId,
      nodeId: n.nodeId,
      name: n.name,
      zone: n.zone,
      voltageLevel: n.voltageLevel,
      baseKv: n.baseKv,
      busType: n.busType,
      voltagePu: n.voltagePu,
      angleDeg: n.angleDeg,
      stabilityMargin: n.stabilityMargin,
      isWeakNode: n.isWeakNode,
      threePhaseImbalance: n.threePhaseImbalance,
      reversePower: n.reversePower,
      pdMw: n.pdMw,
      qdMvar: n.qdMvar,
      pgMw: n.pgMw,
      qgMvar: n.qgMvar,
    }))

    await db('calc_tasks').where('id', taskId).update({
      status: 'completed',
      progress_pct: 100,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })

    await db('calc_results').insert({
      task_id: taskId,
      version: 1,
      is_latest: true,
      node_results: JSON.stringify(nodeResults),
      branch_results: JSON.stringify(pf.branchResults),
      summary: JSON.stringify({
        totalLossKw: pf.totalLossMw * 1000,
        totalGenMw: pf.totalGenMw,
        totalLoadMw: pf.totalLoadMw,
        maxVoltageDeviation: Number(Math.max(...pf.nodeResults.map((n: any) => Math.abs(n.voltagePu - 1))).toFixed(4)),
        lossPercent: pf.lossPercent,
        iterations: pf.iterations,
        converged: pf.converged,
      }),
      reverse_power_detected: pf.nodeResults.filter((n: any) => n.reversePower).length,
      three_phase_imbalance_pct: pf.nodeResults.reduce((max: number, n: any) => Math.max(max, n.threePhaseImbalance || 0), 0),
      total_loss_kw: pf.totalLossMw * 1000,
    })

    return { taskId, status: 'completed', iterations: pf.iterations, converged: pf.converged }
  }

  async getTaskStatus(taskId: string) {
    return db('calc_tasks').where('id', taskId).first()
  }

  async getTaskResult(taskId: string) {
    return db('calc_results').where('task_id', taskId).first()
  }

  // ==================== Batch Calculation (4.4) ====================

  async submitBatchConfig(data: any, userId: string) {
    const groupId = uuid()
    const busIds: string[] = data.busIds || []
    const branchIds: string[] = data.branchIds || []
    const taskCount = busIds.length + branchIds.length
    if (taskCount === 0) throw new Error('请至少选择一个设备')

    const now = new Date().toISOString()
    await db('batch_calc_groups').insert({
      id: groupId,
      group_name: data.groupName || `批量计算 ${now.slice(0, 10)}`,
      calc_type: data.calcType || 'STANDARD',
      selected_bus_ids: JSON.stringify(busIds),
      selected_branch_ids: JSON.stringify(branchIds),
      parameter_template: JSON.stringify(data.parameters || {}),
      status: 'pending',
      total_tasks: taskCount,
      completed_tasks: 0,
      failed_tasks: 0,
      created_by: userId,
      created_at: now,
      updated_at: now,
    })

    // 批量获取设备名称
    const busMap = new Map<string, string>()
    const branchMap = new Map<string, string>()
    if (busIds.length > 0) {
      const buses = await db('grid_buses').whereIn('id', busIds).select('id', 'name')
      buses.forEach((b: any) => busMap.set(b.id, b.name || b.id))
    }
    if (branchIds.length > 0) {
      const branches = await db('grid_branches').whereIn('id', branchIds).select('id')
      // 支路名称从 from/to bus 拼接
      for (const br of branches) {
        branchMap.set(br.id, `支路 ${br.id.slice(0, 8)}`)
      }
    }

    let idx = 0
    for (const busId of busIds) {
      const taskId = uuid()
      const taskParams = {
        ...(data.parameters || {}),
        targetBusId: busId,
        calcType: data.calcType || 'STANDARD',
        groupId,
      }
      await db("calc_tasks").insert({
        id: taskId, task_type: data.calcType || "STANDARD", status: "queued",
        parameters: JSON.stringify(taskParams), created_by: userId,
        created_at: now,
        scene_type: "batch",
        data_source: "batch",
      })
      await db('batch_group_items').insert({
        id: uuid(), group_id: groupId, task_id: taskId,
        item_label: busMap.get(busId) || busId, item_type: 'node',
        bus_id: busId, idx: idx++,
      })
    }
    for (const branchId of branchIds) {
      const taskId = uuid()
      const taskParams = {
        ...(data.parameters || {}),
        targetBranchId: branchId,
        calcType: data.calcType || 'STANDARD',
        groupId,
      }
      await db("calc_tasks").insert({
        id: taskId, task_type: data.calcType || "STANDARD", status: "queued",
        parameters: JSON.stringify(taskParams), created_by: userId,
        created_at: now,
        scene_type: "batch",
        data_source: "batch",
      })
      await db('batch_group_items').insert({
        id: uuid(), group_id: groupId, task_id: taskId,
        item_label: branchMap.get(branchId) || branchId, item_type: 'branch',
        branch_id: branchId, idx: idx++,
      })
    }

    // 异步启动批量执行
    setImmediate(() => {
      this.executeBatch(groupId).catch(err => {
        console.error('[批量计算] 执行失败:', err.message)
        db('batch_calc_groups').where('id', groupId).update({
          status: 'failed',
          error_message: err.message,
          updated_at: new Date().toISOString(),
        }).catch(() => {})
      })
    })

    return { groupId, status: 'running', taskCount }
  }

  private async executeBatch(groupId: string) {
    const now = new Date().toISOString()
    await db('batch_calc_groups').where('id', groupId).update({
      status: 'running', updated_at: now,
    })

    const items = await db('batch_group_items').where('group_id', groupId).orderBy('idx', 'asc')
    const group = await db('batch_calc_groups').where('id', groupId).first()
    if (!group) return

    const params = JSON.parse(group.parameter_template || '{}')
    let completed = 0
    let failed = 0

    for (const item of items) {
      const current = await db('batch_calc_groups').where('id', groupId).first()
      if (current.status === 'cancelled') break

      try {
        await this.executeSingleTask(item.task_id, group.calc_type, params)
        completed++
      } catch (err: any) {
        failed++
        await db('calc_tasks').where('id', item.task_id).update({
          status: 'failed', error_message: err.message,
        })
      }

      await db('batch_calc_groups').where('id', groupId).update({
        completed_tasks: completed + failed,
        failed_tasks: failed,
        updated_at: new Date().toISOString(),
      })
    }

    const finalStatus = failed === 0 ? 'completed'
      : completed === 0 ? 'failed' : 'partial_failed'

    if (finalStatus === 'completed' || finalStatus === 'partial_failed') {
      await this.aggregateBatchResults(groupId)
    }

    await db('batch_calc_groups').where('id', groupId).update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  private async executeSingleTask(taskId: string, calcType: string, batchParams: any) {
    await db('calc_tasks').where('id', taskId).update({
      status: 'running', started_at: new Date().toISOString(),
    })
    await this.updateProgress(taskId, 5, '加载拓扑数据...')

    let input = await this.buildPowerFlowInput()
    await this.updateProgress(taskId, 15, '拓扑数据加载完成')

    // 应用负荷增长系数
    if (batchParams.loadGrowthFactor && batchParams.loadGrowthFactor !== 1.0) {
      const factor = batchParams.loadGrowthFactor
      input.loads = input.loads.map((l: any) => ({
        ...l,
        pdMw: l.pdMw * factor,
        qdMvar: l.qdMvar * factor,
      }))
    }

    // 应用光伏出力系数
    if (batchParams.pvOutputFactor !== undefined && batchParams.pvOutputFactor !== 1.0) {
      const factor = batchParams.pvOutputFactor
      input.generators = input.generators.map((g: any) => ({
        ...g,
        pgMw: g.pgMw * factor,
      }))
    }

    // 时间窗口过滤光伏测量数据
    if (batchParams.timeWindow?.start || batchParams.timeWindow?.end) {
      await this.updateProgress(taskId, 18, '应用时间窗口光伏数据...')
      // 时间窗口逻辑：如果有光伏站，从 pv_output_measurements 查询对应时间段数据
      try {
        const pvStations = await db('solar_pv_stations').select('bus_id', 'id', 'installed_capacity_mw')
        if (pvStations.length > 0) {
          const tw = batchParams.timeWindow
          const measurements = await db('pv_output_measurements')
            .where('time', '>=', tw.start)
            .where('time', '<=', tw.end)
            .select('station_id', 'active_power_kw')
            .avg('active_power_kw as avg_kw')
            .groupBy('station_id')

          const plantAvgMap = new Map<string, number>()
          measurements.forEach((m: any) => plantAvgMap.set(m.station_id, (m.avg_kw || 0) / 1000))

          for (const pv of pvStations) {
            const avgMw = plantAvgMap.get(pv.id)
            if (avgMw !== undefined) {
              const gen = input.generators.find((g: any) => g.busId === pv.bus_id)
              if (gen) {
                gen.pgMw = avgMw
              }
            }
          }
        }
      } catch { /* 时间窗口数据获取失败不影响计算 */ }
    }

    await this.updateProgress(taskId, 20, '执行潮流计算...')

    switch (calcType) {
      case 'REVERSE': {
        const pvBusIds = batchParams.pvBusIds || input.generators.filter((g: any) => g.pgMw > 0).map((g: any) => g.busId)
        const pvOutputMw = batchParams.pvOutputMw || [0, 5, 15, 35, 60, 90, 120, 110, 85, 55, 25, 8, 0]
        const result = calculateReversePowerFlow(input, pvBusIds, pvOutputMw)
        await this.updateProgress(taskId, 90, '反向潮流计算完成，保存结果...')
        await this.saveCalcResult(taskId, result, batchParams)
        break
      }
      case 'PROBABILISTIC': {
        const sampleCount = batchParams.sampleCount || 500
        const config = {
          loadVariationPct: batchParams.loadUncertaintyPct || 5,
          pvConcentration: batchParams.pvUncertaintyPct || 10,
        }
        const result = await calculateProbabilisticPowerFlow(input, sampleCount, config)
        await this.updateProgress(taskId, 90, '概率潮流计算完成，保存结果...')
        await this.saveCalcResult(taskId, result, batchParams)
        break
      }
      case 'THREE_PHASE': {
        const ratios = {
          a: { loadRatio: batchParams.phaseALoadRatio ?? 0.35, genRatio: batchParams.phaseAGenRatio ?? 0.34 },
          b: { loadRatio: batchParams.phaseBLoadRatio ?? 0.33, genRatio: batchParams.phaseBGenRatio ?? 0.33 },
          c: { loadRatio: batchParams.phaseCLoadRatio ?? 0.32, genRatio: batchParams.phaseCGenRatio ?? 0.33 },
        }
        const result = calculateThreePhasePowerFlow(input, ratios)
        await this.updateProgress(taskId, 90, '三相潮流计算完成，保存结果...')
        await this.saveCalcResult(taskId, result, batchParams)
        break
      }
      default: { // STANDARD
        const result = calculatePowerFlow(input)
        await this.updateProgress(taskId, 90, '标准潮流计算完成，保存结果...')
        await this.saveCalcResult(taskId, result, batchParams)
        break
      }
    }

    await this.updateProgress(taskId, 100, '计算完成')
    await db('calc_tasks').where('id', taskId).update({
      status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
    })
  }

  private async aggregateBatchResults(groupId: string) {
    const items = await db('batch_group_items').where('group_id', groupId)
    const taskIds = items.map((i: any) => i.task_id)

    const results = await db('calc_results')
      .whereIn('task_id', taskIds)
      .where('is_latest', true)

    const regionStats: any[] = []
    const anomalyItems: any[] = []
    const now = new Date().toISOString()

    const voltageCritical = 5 // voltage_deviation critical_threshold (%)
    const loadWarning = 80    // equipment_load_rate warning_threshold (%)

    for (const result of results) {
      const nodes = JSON.parse(result.node_results || '[]')
      const branches = JSON.parse(result.branch_results || '[]')

      // 支路数据 → regionStats（负载率是支路属性）
      for (const branch of branches) {
        const loadingPct = branch.loadingPct || 0
        const isOverloaded = loadingPct > loadWarning
        const regionEntry: any = {
          busId: branch.branchId,
          name: `${branch.fromBusName || branch.fromBus} → ${branch.toBusName || branch.toBus}`,
          zone: '', // 支路的 zone 从 fromBus 名称推断
          voltageLevel: branch.voltageLevel || '',
          loadRate: loadingPct / 100, // 转为 0-1 小数，前端乘 100 显示
          voltageDeviationPct: 0,
          isAnomaly: isOverloaded,
          anomalyTypes: [] as string[],
        }
        if (isOverloaded) {
          regionEntry.anomalyTypes.push('overload')
          anomalyItems.push({
            id: uuid(), group_id: groupId, task_id: result.task_id,
            bus_id: branch.branchId,
            equipment_name: regionEntry.name,
            anomaly_type: 'overload',
            severity: loadingPct > 100 ? 'critical' : 'warning',
            current_value: `${loadingPct.toFixed(1)}%`,
            threshold_value: `${loadWarning}%`,
            description: `负载率 ${loadingPct.toFixed(1)}%`,
            created_at: now,
          })
        }
        regionStats.push(regionEntry)
      }

      // 节点电压越限检测
      for (const node of nodes) {
        const voltageDeviationPct = Math.abs(node.voltagePu - 1) * 100
        if (voltageDeviationPct > voltageCritical) {
          anomalyItems.push({
            id: uuid(), group_id: groupId, task_id: result.task_id,
            bus_id: node.busId || node.nodeId,
            equipment_name: node.name || node.busId || node.nodeId,
            anomaly_type: 'voltage_violation',
            severity: voltageDeviationPct > voltageCritical * 2 ? 'critical' : 'warning',
            current_value: `${(node.voltagePu * (node.baseKv || 1)).toFixed(2)}kV (${node.voltagePu.toFixed(4)}pu)`,
            threshold_value: `±${voltageCritical}%`,
            description: `电压越限 ${voltageDeviationPct.toFixed(1)}%`,
            created_at: now,
          })
        }
        if (node.isWeakNode) {
          anomalyItems.push({
            id: uuid(), group_id: groupId, task_id: result.task_id,
            bus_id: node.busId || node.nodeId,
            equipment_name: node.name || node.busId || node.nodeId,
            anomaly_type: 'stability_insufficient',
            severity: 'warning',
            current_value: `${((node.stabilityMargin || 0) * 100).toFixed(1)}%`,
            threshold_value: '90%',
            description: `稳定裕度不足: ${((node.stabilityMargin || 0) * 100).toFixed(1)}%`,
            created_at: now,
          })
        }
      }
    }

    if (anomalyItems.length > 0) {
      await db('batch_anomaly_items').insert(anomalyItems)
    }

    // 承载能力排名：从支路负载率排序
    const ranking = regionStats
      .filter((r: any) => r.loadRate > 0)
      .sort((a: any, b: any) => b.loadRate - a.loadRate)
      .slice(0, 50)
      .map((item: any, i: number) => ({
        equipmentId: item.busId,
        equipmentName: item.name,
        loadRate: item.loadRate,
        rank: i + 1,
      }))

    const summary = {
      totalDevices: regionStats.length,
      anomalyCount: anomalyItems.length,
      maxLoadRate: ranking[0]?.loadRate || 0,
      maxVoltageDeviation: results.length > 0
        ? Math.max(...results.map((r: any) => {
            const s = JSON.parse(r.summary || '{}')
            return (s.maxVoltageDeviation || 0) * 100
          }))
        : 0,
      ranking,
    }

    await db('batch_calc_groups').where('id', groupId).update({
      result_summary: JSON.stringify(summary),
      updated_at: new Date().toISOString(),
    })
  }

  async listBatches(query: any) {
    const qb = db('batch_calc_groups').orderBy('created_at', 'desc')
    if (query.status) qb.where('status', query.status)
    return qb.limit(query.limit || 50)
  }

  async getBatchGroup(groupId: string) {
    const group = await db('batch_calc_groups').where('id', groupId).first()
    if (!group) throw new Error('批次不存在')
    const items = await db('batch_group_items').where('group_id', groupId).orderBy('idx', 'asc')
    return { ...group, items }
  }

  async getBatchStatus(groupId: string) {
    const group = await db('batch_calc_groups').where('id', groupId).first()
    if (!group) throw new Error('批次不存在')

    const items = await db('batch_group_items').where('group_id', groupId).orderBy('idx', 'asc')

    const itemStatuses = await Promise.all(items.map(async (item: any) => {
      const task = await db('calc_tasks').where('id', item.task_id).first()
      return {
        id: item.id,
        taskId: item.task_id,
        itemLabel: item.item_label,
        itemType: item.item_type,
        status: task?.status || 'queued',
        progressPct: task?.progress_pct || 0,
        progressMessage: task?.progress_message || null,
        etaMs: task?.eta_ms || null,
        errorMessage: task?.error_message || null,
      }
    }))

    // 整体预计剩余时间：聚合所有未完成子任务的 eta_ms
    const pendingItems = itemStatuses.filter((i: any) =>
      ['queued', 'running'].includes(i.status))
    const overallEtaMs = pendingItems.length > 0
      ? pendingItems.reduce((sum: number, i: any) => sum + (i.etaMs || 0), 0)
      : null

    return {
      group: {
        ...group,
        selectedBusIds: group.selected_bus_ids ? JSON.parse(group.selected_bus_ids) : undefined,
        selectedBranchIds: group.selected_branch_ids ? JSON.parse(group.selected_branch_ids) : undefined,
        resultSummary: group.result_summary ? JSON.parse(group.result_summary) : undefined,
      },
      items: itemStatuses,
      overallEtaMs,
    }
  }

  async cancelBatch(groupId: string) {
    const group = await db('batch_calc_groups').where('id', groupId).first()
    if (!group) throw new Error('批次不存在')

    await db('batch_calc_groups').where('id', groupId).update({
      status: 'cancelled', updated_at: new Date().toISOString(),
    })

    const items = await db('batch_group_items').where('group_id', groupId)
    let cancelledCount = 0
    for (const item of items) {
      const task = await db('calc_tasks').where('id', item.task_id).first()
      if (task && ['queued', 'running'].includes(task.status)) {
        await db('calc_tasks').where('id', item.task_id).update({
          status: 'failed', error_message: '批次已取消',
        })
        cancelledCount++
      }
    }

    return { groupId, status: 'cancelled', cancelledCount }
  }

  async deleteBatch(groupId: string) {
    const group = await db('batch_calc_groups').where('id', groupId).first()
    if (!group) throw new Error('批次不存在')
    if (group.status === 'running') throw new Error('运行中的批次不能删除，请先取消')

    // 获取关联的 task_id 列表
    const items = await db('batch_group_items').where('group_id', groupId).select('task_id')
    const taskIds = items.map((i: any) => i.task_id)

    // 按外键依赖顺序删除
    // batch_group_items.task_id → calc_tasks.id，必须先删
    await db('batch_group_items').where('group_id', groupId).del()
    await db('batch_anomaly_items').where('group_id', groupId).del()
    if (taskIds.length > 0) {
      await db('calc_checkpoints').whereIn('task_id', taskIds).del()
      await db('calc_results').whereIn('task_id', taskIds).del()
      await db('calc_tasks').whereIn('id', taskIds).del()
    }
    await db('batch_calc_groups').where('id', groupId).del()

    return { groupId, deleted: true, deletedTasks: taskIds.length }
  }

  async getBatchResults(groupId: string) {
    const group = await db('batch_calc_groups').where('id', groupId).first()
    if (!group) throw new Error('批次不存在')

    const items = await db('batch_group_items').where('group_id', groupId)
    const taskIds = items.map((i: any) => i.task_id)

    const results = await db('calc_results')
      .whereIn('task_id', taskIds)
      .where('is_latest', true)

    const anomalies = await db('batch_anomaly_items').where('group_id', groupId)

    // regionStats 从支路数据构建（负载率是支路属性）
    const regionStats: any[] = []
    for (const result of results) {
      const branches = JSON.parse(result.branch_results || '[]')
      for (const branch of branches) {
        const loadingPct = branch.loadingPct || 0
        const branchName = `${branch.fromBusName || branch.fromBus} → ${branch.toBusName || branch.toBus}`
        const branchAnomalies = anomalies.filter((a: any) =>
          a.bus_id === branch.branchId && a.task_id === result.task_id)
        regionStats.push({
          busId: branch.branchId,
          name: branchName,
          zone: '',
          voltageLevel: branch.voltageLevel || '',
          loadRate: loadingPct / 100, // 转为 0-1 小数，前端乘 100 显示
          voltageDeviationPct: 0,
          isAnomaly: branchAnomalies.length > 0,
          anomalyTypes: branchAnomalies.map((a: any) => a.anomaly_type),
        })
      }
    }

    const summary = group.result_summary ? JSON.parse(group.result_summary) : null
    const capacityRanking = summary?.ranking || []

    return {
      group: {
        ...group,
        selectedBusIds: group.selected_bus_ids ? JSON.parse(group.selected_bus_ids) : undefined,
        selectedBranchIds: group.selected_branch_ids ? JSON.parse(group.selected_branch_ids) : undefined,
        resultSummary: summary,
      },
      regionStats,
      anomalyItems: anomalies.map((a: any) => ({
        id: a.id,
        groupId: a.group_id,
        taskId: a.task_id,
        busId: a.bus_id,
        equipmentName: a.equipment_name,
        anomalyType: a.anomaly_type,
        severity: a.severity,
        currentValue: a.current_value,
        thresholdValue: a.threshold_value,
        description: a.description,
      })),
      capacityRanking,
    }
  }

  async exportBatchResults(groupId: string, format?: string) {
    const data = await this.getBatchResults(groupId)

    // 生成 CSV
    const headers = ['设备ID', '设备名称', '区域', '电压等级', '负载率', '电压偏差%', '是否异常', '异常类型']
    const rows = data.regionStats.map((r: any) => [
      r.busId,
      r.name,
      r.zone,
      r.voltageLevel,
      (r.loadRate * 100).toFixed(1) + '%',
      r.voltageDeviationPct.toFixed(2) + '%',
      r.isAnomaly ? '是' : '否',
      r.anomalyTypes.join(';'),
    ])

    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.map((c: string) => `"${c}"`).join(','))].join('\n')

    return {
      groupName: data.group.groupName,
      format: format || 'csv',
      content: csvContent,
      totalRows: rows.length,
    }
  }

  // ==================== History ====================
  async listHistory(query: any) {
    const page = Math.max(query.page || 1, 1)
    const pageSize = Math.min(query.pageSize || 20, 100)

    const qb = db('calc_tasks')
      .leftJoin('calc_results', function () {
        this.on('calc_tasks.id', 'calc_results.task_id')
          .andOn('calc_results.is_latest', db.raw('1'))
      })
      .leftJoin('users', 'calc_tasks.created_by', 'users.id')
      .select(
        'calc_tasks.id',
        'calc_tasks.task_type',
        'calc_tasks.scene_type',
        'calc_tasks.status',
        'calc_tasks.created_at',
        'calc_tasks.is_locked',
        'calc_tasks.data_source',
        'calc_tasks.error_message',
        'calc_results.id as result_id',
        'users.username as operator',
      )

    if (query.taskType) qb.where('calc_tasks.task_type', query.taskType)
    if (query.sceneType) qb.where('calc_tasks.scene_type', query.sceneType)
    if (query.status) qb.where('calc_tasks.status', query.status)
    if (query.keyword) {
      qb.where(function () {
        this.where('calc_tasks.id', 'like', `%${query.keyword}%`)
          .orWhere('calc_tasks.task_type', 'like', `%${query.keyword}%`)
      })
    }
    if (query.dateFrom) qb.where('calc_tasks.created_at', '>=', query.dateFrom)
    if (query.dateTo) qb.where('calc_tasks.created_at', '<=', query.dateTo)

    const [{ count }] = await qb.clone().count('* as count')
    const total = Number(count)

    const list = await qb
      .orderBy('calc_tasks.created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    return { list, total, page, pageSize }
  }

  async compareVersions(query: { taskIdA: string; taskIdB: string }) {
    const parseJson = (v: any) => {
      if (!v) return null
      return typeof v === 'string' ? JSON.parse(v) : v
    }

    const [resultA, resultB] = await Promise.all([
      db('calc_results').where('task_id', query.taskIdA).where('is_latest', 1).first(),
      db('calc_results').where('task_id', query.taskIdB).where('is_latest', 1).first(),
    ])

    if (!resultA || !resultB) throw new Error('未找到两个版本的计算结果')

    const [taskA, taskB] = await Promise.all([
      db('calc_tasks').where('id', query.taskIdA).select('id', 'task_type', 'scene_type', 'created_at', 'created_by').first(),
      db('calc_tasks').where('id', query.taskIdB).select('id', 'task_type', 'scene_type', 'created_at', 'created_by').first(),
    ])

    const nodesA: any[] = parseJson(resultA.node_results) || []
    const nodesB: any[] = parseJson(resultB.node_results) || []
    const branchesA: any[] = parseJson(resultA.branch_results) || []
    const branchesB: any[] = parseJson(resultB.branch_results) || []

    const nodeMap = new Map<string, any>()
    for (const n of nodesB) nodeMap.set(n.busId || n.id || n.name, n)

    const nodeDiff: any[] = []
    for (const na of nodesA) {
      const key = na.busId || na.id || na.name
      const nb = nodeMap.get(key)
      if (!nb) { nodeDiff.push({ name: na.name || key, voltageLevel: na.voltageLevel, note: '仅A版本存在' }); continue }
      nodeDiff.push({
        name: na.name || key,
        voltageLevel: na.voltageLevel,
        phaseADiff: (na.phaseA ?? 0) - (nb.phaseA ?? 0),
        phaseBDiff: (na.phaseB ?? 0) - (nb.phaseB ?? 0),
        phaseCDiff: (na.phaseC ?? 0) - (nb.phaseC ?? 0),
        vufDiff: (na.vuf ?? 0) - (nb.vuf ?? 0),
      })
    }
    for (const nb of nodesB) {
      if (!nodesA.find((na: any) => (na.busId || na.id || na.name) === (nb.busId || nb.id || nb.name))) {
        nodeDiff.push({ name: nb.name || nb.busId || nb.id, voltageLevel: nb.voltageLevel, note: '仅B版本存在' })
      }
    }

    const branchMap = new Map<string, any>()
    for (const b of branchesB) branchMap.set(b.id || `${b.fromBusId}-${b.toBusId}`, b)

    const branchDiff: any[] = []
    for (const ba of branchesA) {
      const key = ba.id || `${ba.fromBusId}-${ba.toBusId}`
      const bb = branchMap.get(key)
      if (!bb) { branchDiff.push({ fromBusName: ba.fromBusName, toBusName: ba.toBusName, voltageLevel: ba.voltageLevel, note: '仅A版本存在' }); continue }
      branchDiff.push({
        fromBusName: ba.fromBusName, toBusName: ba.toBusName,
        voltageLevel: ba.voltageLevel,
        phaseAPDiff: (Number(ba.phaseAPFromMw) || 0) - (Number(bb.phaseAPFromMw) || 0),
        phaseBPDiff: (Number(ba.phaseBPFromMw) || 0) - (Number(bb.phaseBPFromMw) || 0),
        phaseCPDiff: (Number(ba.phaseCPFromMw) || 0) - (Number(bb.phaseCPFromMw) || 0),
      })
    }

    return {
      versionA: { taskId: taskA?.id, taskType: taskA?.task_type, createdAt: taskA?.created_at, operator: taskA?.created_by, summary: parseJson(resultA.summary) },
      versionB: { taskId: taskB?.id, taskType: taskB?.task_type, createdAt: taskB?.created_at, operator: taskB?.created_by, summary: parseJson(resultB.summary) },
      nodeDiff,
      branchDiff,
    }
  }

  async reuseHistory(taskId: string) {
    const task = await db('calc_tasks').where('id', taskId).first()
    if (!task) throw new Error('任务不存在')
    const params = typeof task.parameters === 'string' ? JSON.parse(task.parameters) : task.parameters
    return { taskType: task.task_type, parameters: params, sceneType: task.scene_type }
  }

  async lockHistory(taskId: string) {
    const task = await db('calc_tasks').where('id', taskId).first()
    if (!task) throw new Error('任务不存在')
    const newLocked = task.is_locked ? 0 : 1
    await db('calc_tasks').where('id', taskId).update({ is_locked: newLocked })
    return { taskId, isLocked: !!newLocked }
  }

  async deleteHistory(taskId: string) {
    const task = await db('calc_tasks').where('id', taskId).first()
    if (!task) throw new Error('任务不存在')
    if (task.is_locked) throw new Error('已锁定的记录无法删除，请先解锁')
    await db('calc_results').where('task_id', taskId).del()
    await db('calc_tasks').where('id', taskId).del()
    return { taskId, deleted: true }
  }

  async cleanupExpired(days: number) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString()
    const expiredTasks = await db('calc_tasks')
      .where('is_locked', 0)
      .where('created_at', '<', cutoffStr)
      .select('id')
    const ids = expiredTasks.map((t: any) => t.id)
    if (ids.length > 0) {
      await db('calc_results').whereIn('task_id', ids).del()
      await db('calc_tasks').whereIn('id', ids).del()
    }
    return { deletedCount: ids.length, cutoffBefore: cutoffStr }
  }

  private deriveHistoryMeta(params: any): { sceneType: string | null; dataSource: string | null } {
    let sceneType: string | null = 'normal'
    if (params.weatherScenario && params.weatherScenario !== 'actual') sceneType = 'solar'
    if (params.faultBranches && params.faultBranches.length > 0) sceneType = 'fault'

    let dataSource: string | null = 'manual'
    if (params.feederIds && params.feederIds.length > 0) dataSource = 'feeder'
    if (params.groupName) dataSource = 'batch'

    return { sceneType, dataSource }
  }

  // ==================== Station Model Params (集中式光伏电站模型) ====================
  async listStationModels(query?: { page?: number; pageSize?: number }) {
    const qb = db('station_model_params').where('is_active', 1)
    const total = (await qb.clone().count('* as cnt').first())?.cnt as number || 0

    if (query?.page && query?.pageSize) {
      const offset = (query.page - 1) * query.pageSize
      const rows = await qb.clone().orderBy('model_name', 'asc').offset(offset).limit(query.pageSize)
      return { rows, total, page: query.page, pageSize: query.pageSize }
    }

    return qb.orderBy('model_name', 'asc')
  }

  async deleteStationModel(id: string, userId: string) {
    const current = await db('station_model_params').where('id', id).first()
    if (!current) throw new Error('电站模型参数未找到')
    return db('station_model_params').where('id', id).update({
      is_active: 0,
      modified_by: userId,
      change_summary: '标记删除',
      updated_at: new Date().toISOString(),
    })
  }

  async listAllStationModels(rootId?: string) {
    const qb = db('station_model_params').orderBy('version', 'desc')
    if (rootId) qb.where('root_id', rootId)
    return qb
  }

  async getStationModel(id: string) {
    return db('station_model_params').where('id', id).first()
  }

  async createStationModel(data: any, userId: string) {
    const id = uuid()
    const now = new Date().toISOString()
    const [record] = await db('station_model_params').insert({
      id,
      root_id: id,
      model_name: data.modelName,
      version: 1,
      rated_capacity_mw: data.ratedCapacityMw,
      rated_voltage_kv: data.ratedVoltageKv,
      power_factor: data.powerFactor,
      efficiency_pct: data.efficiencyPct,
      short_circuit_ratio: data.shortCircuitRatio,
      mppt_algorithm: data.mpptAlgorithm || 'P&O',
      power_limit_mode: data.powerLimitMode,
      ramp_rate_limit: data.rampRateLimit,
      lvrt_enabled: data.lvrtEnabled !== false ? 1 : 0,
      hvrt_enabled: data.hvrtEnabled ? 1 : 0,
      island_protection: data.islandProtection !== false ? 1 : 0,
      design_temp_c: data.designTempC,
      design_irradiance: data.designIrradiance,
      design_humidity_pct: data.designHumidityPct,
      altitude_m: data.altitudeM,
      soiling_factor: data.soilingFactor,
      modified_by: userId,
      change_summary: '初始创建',
      is_active: 1,
      created_at: now,
      updated_at: now,
    }).returning('*')
    return record
  }

  async updateStationModel(id: string, data: any, userId: string) {
    const current = await db('station_model_params').where('id', id).first()
    if (!current) throw new Error('电站模型参数未找到')

    const rootId = current.root_id || current.id
    const maxVer = await db('station_model_params').where('root_id', rootId).max('version as max_v').first()
    const newVersion = (maxVer?.max_v || current.version) + 1
    const now = new Date().toISOString()

    const [record] = await db('station_model_params').insert({
      id: uuid(),
      root_id: rootId,
      model_name: data.modelName ?? current.model_name,
      version: newVersion,
      rated_capacity_mw: data.ratedCapacityMw ?? current.rated_capacity_mw,
      rated_voltage_kv: data.ratedVoltageKv ?? current.rated_voltage_kv,
      power_factor: data.powerFactor ?? current.power_factor,
      efficiency_pct: data.efficiencyPct ?? current.efficiency_pct,
      short_circuit_ratio: data.shortCircuitRatio ?? current.short_circuit_ratio,
      mppt_algorithm: data.mpptAlgorithm ?? current.mppt_algorithm,
      power_limit_mode: data.powerLimitMode ?? current.power_limit_mode,
      ramp_rate_limit: data.rampRateLimit ?? current.ramp_rate_limit,
      lvrt_enabled: data.lvrtEnabled !== undefined ? (data.lvrtEnabled ? 1 : 0) : current.lvrt_enabled,
      hvrt_enabled: data.hvrtEnabled !== undefined ? (data.hvrtEnabled ? 1 : 0) : current.hvrt_enabled,
      island_protection: data.islandProtection !== undefined ? (data.islandProtection ? 1 : 0) : current.island_protection,
      design_temp_c: data.designTempC ?? current.design_temp_c,
      design_irradiance: data.designIrradiance ?? current.design_irradiance,
      design_humidity_pct: data.designHumidityPct ?? current.design_humidity_pct,
      altitude_m: data.altitudeM ?? current.altitude_m,
      soiling_factor: data.soilingFactor ?? current.soiling_factor,
      modified_by: userId,
      change_summary: data.changeSummary || '参数更新',
      is_active: 1,
      created_at: now,
      updated_at: now,
    }).returning('*')

    await db('station_model_params').where('id', id).update({ is_active: 0 })
    return record
  }

  async rollbackStationModel(targetId: string, userId: string) {
    const target = await db('station_model_params').where('id', targetId).first()
    if (!target) throw new Error('目标版本未找到')

    const rootId = target.root_id || target.id
    const maxVer = await db('station_model_params').where('root_id', rootId).max('version as max_v').first()
    const newVersion = (maxVer?.max_v || 0) + 1
    const now = new Date().toISOString()

    const [record] = await db('station_model_params').insert({
      id: uuid(),
      root_id: rootId,
      model_name: target.model_name,
      version: newVersion,
      rated_capacity_mw: target.rated_capacity_mw,
      rated_voltage_kv: target.rated_voltage_kv,
      power_factor: target.power_factor,
      efficiency_pct: target.efficiency_pct,
      short_circuit_ratio: target.short_circuit_ratio,
      mppt_algorithm: target.mppt_algorithm,
      power_limit_mode: target.power_limit_mode,
      ramp_rate_limit: target.ramp_rate_limit,
      lvrt_enabled: target.lvrt_enabled,
      hvrt_enabled: target.hvrt_enabled,
      island_protection: target.island_protection,
      design_temp_c: target.design_temp_c,
      design_irradiance: target.design_irradiance,
      design_humidity_pct: target.design_humidity_pct,
      altitude_m: target.altitude_m,
      soiling_factor: target.soiling_factor,
      modified_by: userId,
      change_summary: `回退至版本 ${target.version}`,
      is_active: 1,
      created_at: now,
      updated_at: now,
    }).returning('*')

    await db('station_model_params').where('root_id', rootId).where('is_active', 1).whereNot('id', record.id).update({ is_active: 0 })
    return record
  }

  async exportStationModels(ids: string[]) {
    if (!ids || ids.length === 0) {
      return db('station_model_params').where('is_active', true).orderBy('model_name', 'asc')
    }
    return db('station_model_params').whereIn('id', ids).orderBy('model_name', 'asc')
  }

  async getStationModelVersionHistory(rootId: string) {
    return db('station_model_params').where('root_id', rootId).orderBy('version', 'desc')
  }

  async compareStationModelVersions(idA: string, idB: string) {
    const [verA, verB] = await Promise.all([
      db('station_model_params').where('id', idA).first(),
      db('station_model_params').where('id', idB).first(),
    ])
    if (!verA || !verB) throw new Error('版本未找到')

    const comparableFields = [
      'model_name', 'rated_capacity_mw', 'rated_voltage_kv', 'power_factor', 'efficiency_pct',
      'short_circuit_ratio', 'mppt_algorithm', 'power_limit_mode', 'ramp_rate_limit',
      'lvrt_enabled', 'hvrt_enabled', 'island_protection',
      'design_temp_c', 'design_irradiance', 'design_humidity_pct', 'altitude_m', 'soiling_factor',
    ]
    const diffs: Array<{ field: string; oldValue: any; newValue: any }> = []
    for (const field of comparableFields) {
      if (verA[field] !== verB[field]) {
        diffs.push({ field, oldValue: verA[field] ?? null, newValue: verB[field] ?? null })
      }
    }
    return { versionA: { id: verA.id, version: verA.version, modified_by: verA.modified_by, created_at: verA.created_at }, versionB: { id: verB.id, version: verB.version, modified_by: verB.modified_by, created_at: verB.created_at }, diffs }
  }

  // ==================== Curve Templates (版本控制) ====================
  async listCurveTemplates() {
    return db('output_curve_templates').where('is_active', 1).orWhere('is_active', null).orderBy('weather_type', 'asc').orderBy('name', 'asc')
  }

  async listAllCurveTemplates(rootId?: string) {
    const qb = db('output_curve_templates').orderBy('version', 'desc')
    if (rootId) qb.where('root_id', rootId)
    return qb
  }

  async createCurveTemplate(data: any, userId: string) {
    const id = uuid()
    const now = new Date().toISOString()
    const [tmpl] = await db('output_curve_templates').insert({
      id,
      root_id: id,
      name: data.name,
      weather_type: data.weatherType,
      version: 1,
      is_preset: 0,
      is_active: 1,
      coefficients: JSON.stringify(data.coefficients),
      description: data.description,
      created_by: userId,
      modified_by: userId,
      change_summary: '初始创建',
      created_at: now,
      updated_at: now,
    }).returning('*')
    return tmpl
  }

  async updateCurveTemplate(id: string, data: any, userId: string) {
    const current = await db('output_curve_templates').where('id', id).first()
    if (!current) throw new Error('模板未找到')

    const rootId = current.root_id || current.id
    const maxVer = await db('output_curve_templates').where('root_id', rootId).max('version as max_v').first()
    const newVersion = (maxVer?.max_v || current.version || 1) + 1
    const now = new Date().toISOString()

    const [tmpl] = await db('output_curve_templates').insert({
      id: uuid(),
      root_id: rootId,
      name: data.name ?? current.name,
      weather_type: data.weatherType ?? current.weather_type,
      version: newVersion,
      is_preset: 0,
      is_active: 1,
      coefficients: data.coefficients ? JSON.stringify(data.coefficients) : current.coefficients,
      description: data.description ?? current.description,
      created_by: current.created_by,
      modified_by: userId,
      change_summary: data.changeSummary || '模板更新',
      created_at: now,
      updated_at: now,
    }).returning('*')

    await db('output_curve_templates').where('id', id).update({ is_active: 0 })
    return tmpl
  }

  async deleteCurveTemplate(id: string) {
    const tmpl = await db('output_curve_templates').where('id', id).first()
    if (!tmpl) throw new Error('模板未找到')
    if (tmpl.is_preset) throw new Error('预设模板不可删除')
    await db('output_curve_templates').where('id', id).del()
    return { deleted: true }
  }

  async rollbackCurveTemplate(targetId: string, userId: string) {
    const target = await db('output_curve_templates').where('id', targetId).first()
    if (!target) throw new Error('目标版本未找到')

    const rootId = target.root_id || target.id
    const maxVer = await db('output_curve_templates').where('root_id', rootId).max('version as max_v').first()
    const newVersion = (maxVer?.max_v || 0) + 1
    const now = new Date().toISOString()

    const [tmpl] = await db('output_curve_templates').insert({
      id: uuid(),
      root_id: rootId,
      name: target.name,
      weather_type: target.weather_type,
      version: newVersion,
      is_preset: target.is_preset,
      is_active: 1,
      coefficients: target.coefficients,
      description: target.description,
      created_by: target.created_by,
      modified_by: userId,
      change_summary: `回退至版本 ${target.version}`,
      created_at: now,
      updated_at: now,
    }).returning('*')

    await db('output_curve_templates').where('root_id', rootId).where('is_active', 1).whereNot('id', tmpl.id).update({ is_active: 0 })
    return tmpl
  }

  async getCurveTemplateVersionHistory(rootId: string) {
    return db('output_curve_templates').where('root_id', rootId).orderBy('version', 'desc')
  }

  // ==================== Confidence Coefficient Settings (版本控制) ====================
  async listConfidenceSettings() {
    return db('confidence_coefficient_settings').where('is_active', 1).orWhere('is_active', null).orderBy('created_at', 'desc')
  }

  async listAllConfidenceSettings(rootId?: string) {
    const qb = db('confidence_coefficient_settings').orderBy('version', 'desc')
    if (rootId) qb.where('root_id', rootId)
    return qb
  }

  async createConfidenceSetting(data: any, userId: string) {
    const id = uuid()
    const now = new Date().toISOString()
    if (data.isActive !== false) {
      await db('confidence_coefficient_settings').where('is_active', 1).update({ is_active: 0 })
    }
    const [setting] = await db('confidence_coefficient_settings').insert({
      id,
      root_id: id,
      name: data.name,
      version: 1,
      confidence_level: data.confidenceLevel,
      distribution_type: data.distributionType,
      pdf_params: JSON.stringify(data.pdfParams || {}),
      is_active: data.isActive !== false ? 1 : 0,
      description: data.description,
      created_by: userId,
      modified_by: userId,
      change_summary: '初始创建',
      created_at: now,
    }).returning('*')
    return setting
  }

  async updateConfidenceSetting(id: string, data: any, userId: string) {
    const current = await db('confidence_coefficient_settings').where('id', id).first()
    if (!current) throw new Error('置信配置未找到')

    if (data.isActive) {
      await db('confidence_coefficient_settings').where('is_active', 1).update({ is_active: 0 })
    }

    const rootId = current.root_id || current.id
    const maxVer = await db('confidence_coefficient_settings').where('root_id', rootId).max('version as max_v').first()
    const newVersion = (maxVer?.max_v || current.version || 1) + 1
    const now = new Date().toISOString()

    const [setting] = await db('confidence_coefficient_settings').insert({
      id: uuid(),
      root_id: rootId,
      name: data.name ?? current.name,
      version: newVersion,
      confidence_level: data.confidenceLevel ?? current.confidence_level,
      distribution_type: data.distributionType ?? current.distribution_type,
      pdf_params: data.pdfParams ? JSON.stringify(data.pdfParams) : current.pdf_params,
      is_active: data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.is_active,
      description: data.description ?? current.description,
      created_by: current.created_by,
      modified_by: userId,
      change_summary: data.changeSummary || '配置更新',
      created_at: now,
    }).returning('*')

    await db('confidence_coefficient_settings').where('id', id).update({ is_active: 0 })
    return setting
  }

  async deleteConfidenceSetting(id: string) {
    await db('confidence_coefficient_settings').where('id', id).del()
    return { deleted: true }
  }

  async rollbackConfidenceSetting(targetId: string, userId: string) {
    const target = await db('confidence_coefficient_settings').where('id', targetId).first()
    if (!target) throw new Error('目标版本未找到')

    const rootId = target.root_id || target.id
    const maxVer = await db('confidence_coefficient_settings').where('root_id', rootId).max('version as max_v').first()
    const newVersion = (maxVer?.max_v || 0) + 1
    const now = new Date().toISOString()

    if (target.is_active) {
      await db('confidence_coefficient_settings').where('is_active', 1).update({ is_active: 0 })
    }

    const [setting] = await db('confidence_coefficient_settings').insert({
      id: uuid(),
      root_id: rootId,
      name: target.name,
      version: newVersion,
      confidence_level: target.confidence_level,
      distribution_type: target.distribution_type,
      pdf_params: target.pdf_params,
      is_active: 1,
      description: target.description,
      created_by: target.created_by,
      modified_by: userId,
      change_summary: `回退至版本 ${target.version}`,
      created_at: now,
    }).returning('*')

    await db('confidence_coefficient_settings').where('root_id', rootId).where('is_active', 1).whereNot('id', setting.id).update({ is_active: 0 })
    return setting
  }

  async getConfidenceSettingVersionHistory(rootId: string) {
    return db('confidence_coefficient_settings').where('root_id', rootId).orderBy('version', 'desc')
  }

  // ==================== Grid Data API ====================
  async getGridBuses(query: any) {
    const qb = db('grid_buses')
    if (query.zone) qb.where('zone', query.zone)
    if (query.voltageLevel) qb.where('voltage_level', query.voltageLevel)
    return qb.orderBy('voltage_level', 'desc').orderBy('name')
  }

  async getGridLoads(query: any) {
    let qb = db('grid_loads').select('grid_loads.*', 'grid_buses.name as busName', 'grid_buses.zone', 'grid_buses.voltage_level')
      .join('grid_buses', 'grid_loads.bus_id', 'grid_buses.id')
    if (query.zone) qb.where('grid_buses.zone', query.zone)
    if (query.voltageLevel) qb.where('grid_buses.voltage_level', query.voltageLevel)
    return qb
  }

  async getGridGenerators(query: any) {
    let qb = db('grid_generators').select('grid_generators.*', 'grid_buses.name as busName', 'grid_buses.zone', 'grid_buses.voltage_level')
      .join('grid_buses', 'grid_generators.bus_id', 'grid_buses.id')
    if (query.zone) qb.where('grid_buses.zone', query.zone)
    if (query.voltageLevel) qb.where('grid_buses.voltage_level', query.voltageLevel)
    return qb
  }

  async getSolarStations() {
    return this.queryPVStationsWithOutput()
  }

  // ==================== 馈线 ====================
  async getFeeders() {
    const feeders = await db('feeders')
      .select('*')
      .orderBy('zone')
      .orderBy('name')

    const feederIds = feeders.map((f: any) => f.id)

    // 查询馈线关联的10kV母线
    const fbRows = await db('feeder_buses')
      .whereIn('feeder_id', feederIds)

    // 查询所有光伏电站
    const allPV = await db('solar_pv_stations')
      .where('status', 'active')
      .select('id', 'station_name', 'bus_id', 'installed_capacity_mw')

    // 按馈线分组10kV母线
    const busByFeeder = new Map<string, string[]>()
    const allBusIds: string[] = []
    for (const fb of fbRows) {
      if (!busByFeeder.has(fb.feeder_id)) busByFeeder.set(fb.feeder_id, [])
      busByFeeder.get(fb.feeder_id)!.push(fb.bus_id)
      allBusIds.push(fb.bus_id)
    }

    // 建立bus_id → feeder_id 映射
    const busFeederMap = new Map<string, string>()
    for (const fb of fbRows) {
      busFeederMap.set(fb.bus_id, fb.feeder_id)
    }

    // 获取10kV母线名称
    const busNames = await db('grid_buses')
      .whereIn('id', [...new Set(allBusIds)])
      .select('id', 'name')

    const busNameMap = new Map(busNames.map((b: any) => [b.id, b.name]))

    // 建立bus_id → 光伏电站映射
    const pvByBus = new Map<string, any[]>()
    for (const pv of allPV) {
      if (!pvByBus.has(pv.bus_id)) pvByBus.set(pv.bus_id, [])
      pvByBus.get(pv.bus_id)!.push(pv)
    }

    // 组装结果
    return feeders.map((f: any) => {
      const busIds = busByFeeder.get(f.id) || []
      const pvStations: any[] = []
      for (const busId of busIds) {
        const pvs = pvByBus.get(busId) || []
        pvStations.push(...pvs)
      }
      return {
        ...f,
        busIds,
        busNames: busIds.map((bid: string) => busNameMap.get(bid) || bid),
        pvStations,
        pvCount: pvStations.length,
        totalCapacityMw: pvStations.reduce((s: number, pv: any) => s + (pv.installed_capacity_mw || 0), 0),
      }
    })
  }

  // 根据馈线ID解析光伏电站（供 power-flow 计算使用）
  async resolvePVStationsByFeederIds(feederIds: string[]) {
    const fbRows = await db('feeder_buses')
      .whereIn('feeder_id', feederIds)

    const busIds = [...new Set(fbRows.map((fb: any) => fb.bus_id))]
    if (busIds.length === 0) return { pvBusIds: [], stations: [], localLoadMw: {} }

    const stations = await db('solar_pv_stations')
      .where('status', 'active')
      .whereIn('bus_id', busIds)
      .select('id', 'station_name', 'bus_id', 'installed_capacity_mw')

    const pvBusIds = [...new Set(stations.map((s: any) => s.bus_id))]

    // 查询光伏接入点的本地负荷
    const loads = await db('grid_loads')
      .select('bus_id', 'pd_mw')
      .whereIn('bus_id', pvBusIds)
    const localLoadMw: Record<string, number> = {}
    for (const l of loads) {
      localLoadMw[l.bus_id] = l.pd_mw
    }

    return { pvBusIds, stations, localLoadMw }
  }

  async getGridBranches(query: any) {
    const qb = db('grid_branches')
    if (query.zone) qb.where('zone', query.zone)
    if (query.voltageLevel) qb.where('voltage_level', query.voltageLevel)

    // feederIds 过滤：只返回馈线拓扑范围内的支路
    if (query.feederIds) {
      const feederIds = Array.isArray(query.feederIds) ? query.feederIds : query.feederIds.split(',')
      const fbRows = await db('feeder_buses').whereIn('feeder_id', feederIds).select('bus_id')
      const startBusIds = [...new Set(fbRows.map((fb: any) => fb.bus_id))]
      if (startBusIds.length > 0) {
        const allBuses = await db('grid_buses').select('id', 'voltage_level', 'zone')
        const allBranches = await db('grid_branches').select('id', 'from_bus_id', 'to_bus_id', 'branch_type')
        const byToBus = new Map<string, any[]>()
        const byFromBus = new Map<string, any[]>()
        for (const b of allBranches) {
          if (!byToBus.has(b.to_bus_id)) byToBus.set(b.to_bus_id, [])
          byToBus.get(b.to_bus_id)!.push(b)
          if (!byFromBus.has(b.from_bus_id)) byFromBus.set(b.from_bus_id, [])
          byFromBus.get(b.from_bus_id)!.push(b)
        }
        const busMap = new Map(allBuses.map(b => [b.id, b]))
        const reachable = new Set<string>()

        // 阶段1：变压器向上追溯（同区域），遇跨区节点停止
        const startZones2 = new Set(startBusIds.map(id => busMap.get(id)?.zone).filter(Boolean))
        const frontier = [...startBusIds]
        while (frontier.length > 0) {
          const busId = frontier.pop()!
          if (reachable.has(busId) || !busMap.has(busId)) continue
          reachable.add(busId)
          for (const br of (byToBus.get(busId) || [])) {
            if (reachable.has(br.from_bus_id)) continue
            if (br.branch_type === 'TRANSFORMER') {
              const tz = busMap.get(br.from_bus_id)?.zone
              if (tz && startZones2.has(tz)) frontier.push(br.from_bus_id)
            }
          }
        }
        // 阶段2：同级互联 BFS（仅同区域）
        {
          const peerFrontier = [...reachable]
          while (peerFrontier.length > 0) {
            const busId = peerFrontier.pop()!
            for (const br of [...(byToBus.get(busId) || []), ...(byFromBus.get(busId) || [])]) {
              if (br.branch_type === 'TRANSFORMER') continue
              const otherId = br.from_bus_id === busId ? br.to_bus_id : br.from_bus_id
              if (reachable.has(otherId)) continue
              const tz = busMap.get(otherId)?.zone
              if (tz && startZones2.has(tz)) {
                reachable.add(otherId)
                peerFrontier.push(otherId)
              }
            }
          }
        }
        // 阶段3：下游1跳（仅同区域，从所有已纳入节点出发）
        for (const busId of [...reachable]) {
          for (const br of (byFromBus.get(busId) || [])) {
            if (!reachable.has(br.to_bus_id)) {
              const tz = busMap.get(br.to_bus_id)?.zone
              if (tz && startZones2.has(tz)) reachable.add(br.to_bus_id)
            }
          }
        }

        qb.where(builder => {
          builder.whereIn('from_bus_id', [...reachable])
            .whereIn('to_bus_id', [...reachable])
        })
      }
    }

    return qb.orderBy('voltage_level', 'desc')
  }

  // ==================== 拓扑裁剪：馈线反向潮流 ====================
  /**
   * 从馈线10kV母线出发，BFS向上追溯至220kV根节点，再扩展同区域横向互联和下游节点。
   * 防止拓扑扩展到全杭州，同时确保 Slack 节点不会被截断。
   */
  private trimTopology(input: PowerFlowInput, startBusIds: string[]): PowerFlowInput {
    const busMap = new Map(input.buses.map(b => [b.id, b]))
    const busVoltage = new Map(input.buses.map(b => [b.id, b.voltageLevel]))

    const byToBus = new Map<string, typeof input.branches>()
    const byFromBus = new Map<string, typeof input.branches>()
    for (const b of input.branches) {
      if (!byToBus.has(b.toBusId)) byToBus.set(b.toBusId, [])
      byToBus.get(b.toBusId)!.push(b)
      if (!byFromBus.has(b.fromBusId)) byFromBus.set(b.fromBusId, [])
      byFromBus.get(b.fromBusId)!.push(b)
    }

    const reachableBuses = new Set<string>()

    // 阶段1：从起点沿变压器向上追溯至 220kV 层（不进入 500kV 层）
    const startZones = new Set(startBusIds.map(id => busMap.get(id)?.zone).filter(Boolean))
    const frontier = [...startBusIds]
    while (frontier.length > 0) {
      const busId = frontier.pop()!
      if (reachableBuses.has(busId) || !busMap.has(busId)) continue
      reachableBuses.add(busId)

      const upstream = byToBus.get(busId) || []
      for (const br of upstream) {
        if (reachableBuses.has(br.fromBusId)) continue
        if (br.branchType === 'TRANSFORMER') {
          const fromVoltage = busVoltage.get(br.fromBusId)
          // 不追溯到 500kV 层：裁剪拓扑以 220kV 为电源边界
          if (fromVoltage === '500kV') continue
          frontier.push(br.fromBusId)
        }
      }
    }

    // 阶段2：从所有已纳入节点 BFS 扩展同级横向互联（仅同区域非变压器支路）
    {
      const peerFrontier = [...reachableBuses]
      while (peerFrontier.length > 0) {
        const busId = peerFrontier.pop()!
        for (const br of [...(byToBus.get(busId) || []), ...(byFromBus.get(busId) || [])]) {
          if (br.branchType === 'TRANSFORMER') continue
          const otherId = br.fromBusId === busId ? br.toBusId : br.fromBusId
          if (reachableBuses.has(otherId)) continue
          const tz = busMap.get(otherId)?.zone
          if (tz && startZones.has(tz)) {
            reachableBuses.add(otherId)
            peerFrontier.push(otherId)
          }
        }
      }
    }

    // 阶段3：从所有已纳入节点向下游扩展1跳（仅同区域）
    for (const busId of [...reachableBuses]) {
      const downstream = byFromBus.get(busId) || []
      for (const br of downstream) {
        if (reachableBuses.has(br.toBusId)) continue
        const tz = busMap.get(br.toBusId)?.zone
        if (tz && startZones.has(tz)) reachableBuses.add(br.toBusId)
      }
    }

    const trimmedBuses = input.buses.filter(b => reachableBuses.has(b.id))
    const trimmedBranches = input.branches.filter(
      b => reachableBuses.has(b.fromBusId) && reachableBuses.has(b.toBusId),
    )
    const busIdSet = new Set(trimmedBuses.map(b => b.id))
    const trimmedGens = input.generators.filter(g => busIdSet.has(g.busId))
    const trimmedLoads = input.loads.filter(l => busIdSet.has(l.busId))

    // 裁剪后的拓扑如果没有 Slack 节点，将电压最高的 PV 节点提升为 Slack
    // 以 220kV 母线为分界，用等值模型替代外部电网
    const hasSlack = trimmedBuses.some(b => b.busType === 'slack')
    if (!hasSlack) {
      const pvBuses = trimmedBuses
        .filter(b => b.busType === 'pv')
        .sort((a, b) => b.baseKv - a.baseKv)
      if (pvBuses.length > 0) {
        pvBuses[0].busType = 'slack'
      }
    }

    return {
      buses: trimmedBuses,
      branches: trimmedBranches,
      generators: trimmedGens,
      loads: trimmedLoads,
    }
  }

  // ==================== 4.3 Online Calculation ====================

  // 任务控制映射表：用于暂停/恢复
  private taskControls = new Map<string, { paused: boolean; aborted: boolean }>()

  // ==================== 4.3.1 标准潮流计算 ====================
  async submitStandardPF(params: any, userId: string) {
    const taskId = uuid()
    const meta = this.deriveHistoryMeta(params)
    await db('calc_tasks').insert({
      id: taskId, task_type: 'STANDARD', status: 'queued',
      parameters: JSON.stringify(params), created_by: userId,
      scene_type: meta.sceneType, data_source: meta.dataSource,
      created_at: new Date().toISOString(),
    })

    const control = { paused: false, aborted: false }
    this.taskControls.set(taskId, control)

    // 异步执行
    setImmediate(async () => {
      try {
        await db('calc_tasks').where('id', taskId).update({
          status: 'running', started_at: new Date().toISOString(),
        })
        await this.updateProgress(taskId, 5, '加载拓扑数据...')

        let input = await this.buildPowerFlowInput()
        await this.updateProgress(taskId, 15, '拓扑数据加载完成，构建导纳矩阵...')

        // 馈线裁剪：选择馈线后自动裁剪拓扑，只保留相关区域
        if (params.feederIds && params.feederIds.length > 0) {
          console.log('[submitStandardPF] feederIds:', params.feederIds)
          const feederBusRows = await db('feeder_buses')
            .whereIn('feeder_id', params.feederIds)
            .select('bus_id')
          const feederBusIds = [...new Set(feederBusRows.map((fb: any) => fb.bus_id))]
          console.log('[submitStandardPF] feederBusIds:', feederBusIds, 'input buses before trim:', input.buses.length)
          input = this.trimTopology(input, feederBusIds)
          console.log('[submitStandardPF] after trim - buses:', input.buses.length, 'branches:', input.branches.length)
          await this.updateProgress(taskId, 17, `馈线范围拓扑裁剪完成 (${input.buses.length}节点)`)
        }

        // 光伏场景：使用实际集中式光伏电站测量数据替代简单倍率模拟
        if (params.scenario?.type === 'solar') {
          await this.updateProgress(taskId, 18, '加载集中式光伏电站实测数据...')
          await this.applySolarScenarioWithMeasurements(input, params.scenario)
        }

        const scenario: PowerFlowScenario | undefined =
          params.scenario?.type && params.scenario.type !== 'solar'
            ? params.scenario
            : undefined

        await this.updateProgress(taskId, 20, '执行牛顿-拉夫逊迭代...')
        const result = calculatePowerFlow(input, scenario)

        await this.updateProgress(taskId, 80, '潮流计算收敛，计算支路功率...')
        await new Promise(resolve => setImmediate(resolve))

        // 保存结果
        await this.saveCalcResult(taskId, result, params)
        await this.updateProgress(taskId, 100, '计算完成')

        await db('calc_tasks').where('id', taskId).update({
          status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
        })
      } catch (err: any) {
        await db('calc_tasks').where('id', taskId).update({
          status: 'failed', error_message: err.message,
        })
      } finally {
        this.taskControls.delete(taskId)
      }
    })

    return { taskId, status: 'queued' }
  }

  // ==================== 4.3.2 反向潮流计算 ====================
  async submitReversePF(params: any, userId: string) {
    const taskId = uuid()
    const meta = this.deriveHistoryMeta(params)
    const pvOutputs = params.pvOutputMw || [0, 5, 15, 35, 60, 90, 120, 110, 85, 55, 25, 8, 0]
    await db('calc_tasks').insert({
      id: taskId, task_type: 'REVERSE', status: 'queued',
      parameters: JSON.stringify(params), created_by: userId,
      scene_type: meta.sceneType, data_source: meta.dataSource,
      created_at: new Date().toISOString(),
    })

    const control = { paused: false, aborted: false }
    this.taskControls.set(taskId, control)

    setImmediate(async () => {
      try {
        await db('calc_tasks').where('id', taskId).update({
          status: 'running', started_at: new Date().toISOString(),
        })
        await this.updateProgress(taskId, 5, '加载拓扑数据...')
        let input = await this.buildPowerFlowInput()
        await this.updateProgress(taskId, 15, '拓扑数据加载完成')

        let pvBusIds: string[] = []
        const localLoadMw: Record<string, number> = {}

        if (params.feederIds && params.feederIds.length > 0) {
          const resolved = await this.resolvePVStationsByFeederIds(params.feederIds)
          let stations = resolved.stations

          // 单项目模式：只保留指定的电站
          if (params.mode === 'single_project' && params.solarStationIds?.length === 1) {
            stations = stations.filter((s: any) => s.id === params.solarStationIds[0])
          }

          pvBusIds = [...new Set(stations.map((s: any) => s.bus_id))]

          // 标幺值 × 总装机 = 实际 MW 出力曲线
          if (params.pvOutputPu && Array.isArray(params.pvOutputPu)) {
            const totalCapacity = stations.reduce((s: number, st: any) => s + (st.installed_capacity_mw || 0), 0)
            const raw = params.pvOutputPu as number[]
            pvOutputs.length = 0
            for (const pu of raw) {
              pvOutputs.push(pu * totalCapacity)
            }
          }

          // 本地负荷从 resolved 获取
          Object.assign(localLoadMw, resolved.localLoadMw)

          // 用户自定义负荷覆盖
          if (params.localLoadMw && typeof params.localLoadMw === 'object') {
            for (const [busId, mw] of Object.entries(params.localLoadMw)) {
              if (typeof mw === 'number' && pvBusIds.includes(busId)) {
                localLoadMw[busId] = mw
              }
            }
          }

          // 裁剪拓扑：从馈线10kV母线向上追溯，只保留相关区域
          const feederBusRows2 = await db('feeder_buses')
            .whereIn('feeder_id', params.feederIds)
            .select('bus_id')
          const feederBusIds2 = [...new Set(feederBusRows2.map((fb: any) => fb.bus_id))]
          console.log('[submitReversePF] feederBusIds:', feederBusIds2, 'input buses before trim:', input.buses.length)
          input = this.trimTopology(input, feederBusIds2)
          console.log('[submitReversePF] after trim - buses:', input.buses.length, 'branches:', input.branches.length)
        } else if (params.solarStationIds && params.solarStationIds.length > 0) {
          const stations = await db('solar_pv_stations')
            .select('bus_id', 'installed_capacity_mw')
            .whereIn('id', params.solarStationIds)
          pvBusIds = [...new Set(stations.map((s: any) => s.bus_id))]

          if (params.pvOutputPu && Array.isArray(params.pvOutputPu)) {
            const totalCapacity = stations.reduce((s: number, st: any) => s + (st.installed_capacity_mw || 0), 0)
            const raw = params.pvOutputPu as number[]
            pvOutputs.length = 0
            for (const pu of raw) {
              pvOutputs.push(pu * totalCapacity)
            }
          }

          const loads = await db('grid_loads')
            .select('bus_id', 'pd_mw')
            .whereIn('bus_id', pvBusIds)
          for (const l of loads) {
            localLoadMw[l.bus_id] = l.pd_mw
          }

          if (params.localLoadMw && typeof params.localLoadMw === 'object') {
            for (const [busId, mw] of Object.entries(params.localLoadMw)) {
              if (typeof mw === 'number' && pvBusIds.includes(busId)) {
                localLoadMw[busId] = mw
              }
            }
          }
        } else {
          pvBusIds = params.pvBusIds || this.getPVBusIds(input)
        }

        await this.updateProgress(taskId, 20, '执行反向潮流计算...')
        const result = calculateReversePowerFlow(
          input, pvBusIds, pvOutputs, localLoadMw, params.jointInjection ?? false,
        )
        console.log('[reversePF] timePoints count:', result.timePoints.length, 'converged:', result.convergedTimePoints, 'diverged:', result.divergedTimePoints)
        for (let i = 0; i < result.timePoints.length; i++) {
          const tp = result.timePoints[i]
          const flag = tp.converged ? '' : ' [DIVERGED]'
          console.log(`[reversePF]   T+${i}h: reverseP=${tp.reversePowerMw}MW, nodes=${tp.nodeResults?.length}, branches=${tp.branchResults?.length}, Vmin=${tp.minVoltagePu?.toFixed(4)}${flag}`)
        }
        if (result.divergedTimePoints > 0) {
          console.error(`[reversePF] 警告: ${result.divergedTimePoints}/${result.timePoints.length} 个时间点NR未收敛，结果可能不准确`)
        }

        await this.updateProgress(taskId, 85, '反向潮流计算完成，保存结果...')
        await new Promise(resolve => setImmediate(resolve))

        // 保存结果到 calc_results
        const branchLossSum = result.aggregatedBranchResults.reduce((s: number, b: any) => s + Math.abs(b.lossMw || 0), 0)
        const summary = {
          totalLossKw: branchLossSum * 1000,
          maxVoltageDeviation: Math.max(...result.aggregatedNodeResults.map((n: any) => Math.abs(n.voltagePu - 1)), 0),
          maxLoadRate: Math.max(...result.aggregatedBranchResults.map((b: any) => b.loadingPct || 0), 0),
          reversePowerBranches: result.reverseBranchCount,
          violatedConstraintCount: 0,
          converged: result.divergedTimePoints === 0,
          convergedTimePoints: result.convergedTimePoints,
          divergedTimePoints: result.divergedTimePoints,
          timePoints: result.timePoints,
          maxReversePowerMw: result.maxReversePowerMw,
          maxReverseTime: result.maxReverseTime,
          totalReverseEnergyMwh: result.totalReverseEnergyMwh,
        }

        await db('calc_results').insert({
          task_id: taskId, version: 1, is_latest: true,
          node_results: JSON.stringify(result.aggregatedNodeResults),
          branch_results: JSON.stringify(result.aggregatedBranchResults),
          summary: JSON.stringify(summary),
          reverse_power_detected: result.reverseBranchCount,
          three_phase_imbalance_pct: 0,
          total_loss_kw: summary.totalLossKw,
        })

        await this.updateProgress(taskId, 100, '计算完成')
        await db('calc_tasks').where('id', taskId).update({
          status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
        })
      } catch (err: any) {
        await db('calc_tasks').where('id', taskId).update({
          status: 'failed', error_message: err.message,
        })
      } finally {
        this.taskControls.delete(taskId)
      }
    })

    return { taskId, status: 'queued' }
  }

  // ==================== 4.3.3 概率潮流计算 ====================
  async submitProbabilisticPF(params: any, userId: string) {
    const taskId = uuid()
    const meta = this.deriveHistoryMeta(params)
    const sampleCount = Math.min(Math.max(params.sampleCount || 200, 100), 2000)
    await db('calc_tasks').insert({
      id: taskId, task_type: 'PROBABILISTIC', status: 'queued',
      parameters: JSON.stringify(params), created_by: userId,
      scene_type: meta.sceneType, data_source: meta.dataSource,
      created_at: new Date().toISOString(),
    })

    const control = { paused: false, aborted: false }
    this.taskControls.set(taskId, control)

    setImmediate(async () => {
      try {
        await db('calc_tasks').where('id', taskId).update({
          status: 'running', started_at: new Date().toISOString(),
        })
        await this.updateProgress(taskId, 3, '加载拓扑数据...')
        let input = await this.buildPowerFlowInput()

        // 馈线裁剪：选择馈线后自动裁剪拓扑，只保留相关区域
        if (params.feederIds && params.feederIds.length > 0) {
          console.log('[submitProbabilisticPF] feederIds:', params.feederIds)
          const feederBusRows = await db('feeder_buses')
            .whereIn('feeder_id', params.feederIds)
            .select('bus_id')
          const feederBusIds = [...new Set(feederBusRows.map((fb: any) => fb.bus_id))]
          console.log('[submitProbabilisticPF] feederBusIds:', feederBusIds, 'input buses before trim:', input.buses.length)
          input = this.trimTopology(input, feederBusIds)
          console.log('[submitProbabilisticPF] after trim - buses:', input.buses.length)
          await this.updateProgress(taskId, 4, `馈线范围拓扑裁剪完成 (${input.buses.length}节点)`)
        }

        // 注入光伏电站数据（与标准潮流一致）
        await this.applySolarScenarioWithMeasurements(input, {
          weatherScenario: params.weatherScenario || 'actual',
          pvBusIds: params.pvBusIds || [],
        })

        await this.updateProgress(taskId, 5, '拓扑数据加载完成，启动蒙特卡洛模拟...')

        const result = await calculateProbabilisticPowerFlow(
          input, sampleCount, {
          loadVariationPct: params.loadVariationPct ?? 10,
          pvConcentration: params.pvConcentration ?? 20,
        },
          async (current, total, msg) => {
            // 检查是否暂停
            if (control.paused) {
              // 保存 checkpoint
              await this.saveCheckpoint(taskId, current, {
                completedSamples: current,
                totalSamples: total,
                loadVariationPct: params.loadVariationPct ?? 10,
                pvConcentration: params.pvConcentration ?? 20,
              })
              // 等待恢复
              await new Promise<void>(resolve => {
                const check = setInterval(() => {
                  if (!control.paused || control.aborted) {
                    clearInterval(check)
                    resolve()
                  }
                }, 500)
              })
            }
            if (control.aborted) {
              throw new Error('Task aborted')
            }
            const pct = 5 + Math.round((current / total) * 80)
            await this.updateProgress(taskId, pct, msg || `蒙特卡洛采样 ${current}/${total}...`)
          },
        )

        await this.updateProgress(taskId, 90, '蒙特卡洛模拟完成，后处理统计结果...')
        await new Promise(resolve => setImmediate(resolve))

        // 保存结果
        const lossSamples = result.lossSamples || []
        const expectedLossMw = lossSamples.length > 0
          ? lossSamples.reduce((s: number, v: number) => s + v, 0) / lossSamples.length : 0

        const summary = {
          totalLossKw: expectedLossMw * 1000,
          maxVoltageDeviation: Math.max(...result.nodeResults.map((n: any) => Math.max(Math.abs(1 - n.expectedKv / n.baseKv), 0)), 0),
          maxLoadRate: Math.max(...result.branchResults.map((b: any) => b.expectedLoadingPct || 0), 0),
          reversePowerBranches: 0,
          violatedConstraintCount: result.voltageViolationNodes.length + result.overloadBranches.length,
          converged: true,
          sampleCount,
        }

        await db('calc_results').insert({
          task_id: taskId, version: 1, is_latest: true,
          node_results: JSON.stringify(result.nodeResults),
          branch_results: JSON.stringify(result.branchResults),
          summary: JSON.stringify(summary),
          reverse_power_detected: 0,
          three_phase_imbalance_pct: 0,
          total_loss_kw: summary.totalLossKw,
        })

        await this.updateProgress(taskId, 100, '概率潮流计算完成')
        await db('calc_tasks').where('id', taskId).update({
          status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
        })
      } catch (err: any) {
        await db('calc_tasks').where('id', taskId).update({
          status: 'failed', error_message: err.message,
        })
      } finally {
        this.taskControls.delete(taskId)
      }
    })

    return { taskId, status: 'queued' }
  }

  // ==================== 4.3.4 三相潮流计算 ====================
  async submitThreePhasePF(params: any, userId: string) {
    const taskId = uuid()
    const meta = this.deriveHistoryMeta(params)
    await db('calc_tasks').insert({
      id: taskId, task_type: 'THREE_PHASE', status: 'queued',
      created_at: new Date().toISOString(),
      parameters: JSON.stringify(params), created_by: userId,
      scene_type: meta.sceneType, data_source: meta.dataSource,
      created_at: new Date().toISOString(),
    })

    const control = { paused: false, aborted: false }
    this.taskControls.set(taskId, control)

    setImmediate(async () => {
      try {
        await db('calc_tasks').where('id', taskId).update({
          status: 'running', started_at: new Date().toISOString(),
        })
        await this.updateProgress(taskId, 3, '加载拓扑数据...')
        let input = await this.buildPowerFlowInput()
        await this.updateProgress(taskId, 10, '拓扑数据加载完成')

        // 光伏注入 & 拓扑裁剪
        // feederIds 模式：通过馈线解析光伏电站并裁剪拓扑，与反向潮流一致
        let pvBusIdsForInjection: string[] | undefined
        if (params.feederIds && params.feederIds.length > 0) {
          const resolved = await this.resolvePVStationsByFeederIds(params.feederIds)
          pvBusIdsForInjection = resolved.pvBusIds

          // 裁剪拓扑：从馈线10kV母线向上追溯，只保留相关区域
          const feederBusRows3 = await db('feeder_buses')
            .whereIn('feeder_id', params.feederIds)
            .select('bus_id')
          const feederBusIds3 = [...new Set(feederBusRows3.map((fb: any) => fb.bus_id))]
          console.log('[submitThreePhasePF] feederBusIds:', feederBusIds3, 'input buses before trim:', input.buses.length)
          input = this.trimTopology(input, feederBusIds3)
          console.log('[submitThreePhasePF] after trim - buses:', input.buses.length)
          await this.updateProgress(taskId, 12, `馈线范围拓扑裁剪完成 (${input.buses.length}节点)`)
        } else {
          // 非馈线模式：直接使用传入的 pvBusIds
          // undefined=全部电站, []=无光伏, [ids...]=指定母线
          pvBusIdsForInjection = params.pvBusIds
        }

        const weatherScenario = params.weatherScenario || 'actual'
        await this.applySolarScenarioWithMeasurements(input, {
          weatherScenario,
          pvBusIds: pvBusIdsForInjection,
        })
        await this.updateProgress(taskId, 15, '光伏数据注入完成')

        // 从注入后的发电机推导实际光伏母线集合
        const actualPvBusIds = new Set(
          input.generators.filter(g => g.isPV).map(g => g.busId),
        )

        // 查询光伏电站接入相别
        const useDBPhaseData = params.useDBPhaseData !== false
        const phaseConnectionMap = new Map<string, string>()
        if (useDBPhaseData) {
          const pvStations = await db('solar_pv_stations')
            .whereIn('bus_id', input.buses.map(b => b.id))
            .select('bus_id', 'phase_connection')
          for (const s of pvStations) {
            phaseConnectionMap.set(s.bus_id, s.phase_connection || 'three_phase')
          }
          await this.updateProgress(taskId, 18, '已加载光伏接入相别数据')
        }

        // 应用前端自定义分相数据
        if (params.customLoadPhases && params.customLoadPhases.length > 0) {
          const customMap = new Map((params.customLoadPhases as any[]).map((l: any) => [l.busId, l]))
          for (const load of input.loads) {
            const custom = customMap.get(load.busId)
            if (custom) {
              if (custom.pdAMw !== undefined) {
                load.pdAMw = custom.pdAMw; load.pdBMw = custom.pdBMw; load.pdCMw = custom.pdCMw
              }
              if (custom.qdAMvar !== undefined) {
                load.qdAMvar = custom.qdAMvar; load.qdBMvar = custom.qdBMvar; load.qdCMvar = custom.qdCMvar
              }
            }
          }
        }
        if (params.customGenPhases && params.customGenPhases.length > 0) {
          const customMap = new Map((params.customGenPhases as any[]).map((g: any) => [g.busId, g]))
          for (const gen of input.generators) {
            const custom = customMap.get(gen.busId)
            if (custom && custom.pgAMw !== undefined) {
              gen.pgAMw = custom.pgAMw; gen.pgBMw = custom.pgBMw; gen.pgCMw = custom.pgCMw
            }
          }
        }
        if (params.customBranchZeroSeq && params.customBranchZeroSeq.length > 0) {
          const customMap = new Map((params.customBranchZeroSeq as any[]).map((b: any) => [b.id, b]))
          for (const branch of input.branches) {
            const custom = customMap.get(branch.id)
            if (custom) {
              if (custom.r0Ohm !== undefined) branch.r0Ohm = custom.r0Ohm
              if (custom.x0Ohm !== undefined) branch.x0Ohm = custom.x0Ohm
            }
          }
        }

        const ratios = {
          a: { loadRatio: params.phaseALoadRatio ?? 1.0, genRatio: params.phaseAGenRatio ?? 1.0 },
          b: { loadRatio: params.phaseBLoadRatio ?? 0.95, genRatio: params.phaseBGenRatio ?? 0.9 },
          c: { loadRatio: params.phaseCLoadRatio ?? 0.9, genRatio: params.phaseCGenRatio ?? 0.85 },
        }

        await this.updateProgress(taskId, 20, '计算 A 相潮流...')
        await new Promise(resolve => setImmediate(resolve))

        const impedanceAsymmetryPct = params.impedanceAsymmetryPct ?? 0
        const result = calculateThreePhasePowerFlow(
          input, ratios, actualPvBusIds, impedanceAsymmetryPct, useDBPhaseData,
        )

        await this.updateProgress(taskId, 85, '三相潮流计算完成，保存结果...')
        await new Promise(resolve => setImmediate(resolve))

        const overloadedCount = result.phaseBranchResults?.filter(b => b.isOverloaded).length ?? 0

        const summary = {
          totalLossKw: result.totalLossMw * 1000,
          maxVoltageDeviation: Math.max(...result.nodeResults.map((n: any) => Math.max(
            Math.abs(1 - n.phaseA), Math.abs(1 - n.phaseB), Math.abs(1 - n.phaseC),
          )), 0),
          maxLoadRate: result.maxVuf,
          reversePowerBranches: 0,
          violatedConstraintCount: result.violationCount,
          converged: true,
          maxVuf: result.maxVuf,
          avgVuf: result.avgVuf,
          phaseALossMw: result.phaseALossMw,
          phaseBLossMw: result.phaseBLossMw,
          phaseCLossMw: result.phaseCLossMw,
          overloadedPhasesCount: overloadedCount,
        }

        await db('calc_results').insert({
          task_id: taskId, version: 1, is_latest: true,
          node_results: JSON.stringify(result.nodeResults),
          branch_results: JSON.stringify(result.phaseBranchResults || []),
          summary: JSON.stringify(summary),
          reverse_power_detected: 0,
          three_phase_imbalance_pct: result.maxVuf,
          total_loss_kw: result.totalLossMw * 1000,
        })

        await this.updateProgress(taskId, 100, '三相潮流计算完成')
        await db('calc_tasks').where('id', taskId).update({
          status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
        })
      } catch (err: any) {
        await db('calc_tasks').where('id', taskId).update({
          status: 'failed', error_message: err.message,
        })
      } finally {
        this.taskControls.delete(taskId)
      }
    })

    return { taskId, status: 'queued' }
  }

  // ==================== 4.3.5 进度跟踪与控制 ====================
  async listTasks(query: { taskType?: string; status?: string; limit?: number }) {
    const qb = db('calc_tasks')
      .select('id', 'task_type', 'status', 'progress_pct', 'progress_message',
        'eta_ms', 'error_message', 'created_at', 'started_at', 'completed_at')
      .orderBy('created_at', 'desc')

    if (query.taskType) qb.where('task_type', query.taskType)
    if (query.status) qb.whereIn('status', query.status.split(','))

    const tasks = await qb.limit(query.limit || 100)

    const taskIds = tasks.map((t: any) => t.id)
    const checkpointRows = taskIds.length > 0
      ? await db('calc_checkpoints').whereIn('task_id', taskIds).select('task_id').groupBy('task_id')
      : []
    const checkpointSet = new Set(checkpointRows.map((c: any) => c.task_id))

    const now = Date.now()
    return tasks.map((t: any) => ({
      id: t.id,
      task_type: t.task_type,
      status: t.status,
      progress_pct: t.progress_pct ?? 0,
      progress_message: t.progress_message ?? null,
      eta_ms: t.eta_ms ?? null,
      error_message: t.error_message ?? null,
      created_at: t.created_at,
      started_at: t.started_at,
      completed_at: t.completed_at,
      elapsedSec: t.started_at
        ? Math.round(((t.completed_at ? new Date(t.completed_at).getTime() : now) - new Date(t.started_at).getTime()) / 1000)
        : 0,
      checkpointAvailable: checkpointSet.has(t.id),
    }))
  }

  async getProgress(taskId: string) {
    const task = await db('calc_tasks').where('id', taskId).first()
    if (!task) throw new Error('Task not found')

    const startedAt = task.started_at ? new Date(task.started_at).getTime() : null
    const elapsedSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0

    // 检查是否有 checkpoint
    const checkpoint = await db('calc_checkpoints')
      .where('task_id', taskId)
      .orderBy('iteration', 'desc')
      .first()

    return {
      status: task.status,
      progressPct: task.progress_pct || 0,
      progressMessage: task.progress_message || null,
      etaMs: task.status === 'running' && task.progress_pct > 0 && task.progress_pct < 100
        ? Math.round(elapsedSec * 1000 * (100 - (task.progress_pct || 0)) / (task.progress_pct || 1))
        : null,
      elapsedSec,
      checkpointAvailable: !!checkpoint,
    }
  }

  async pauseTask(taskId: string) {
    const task = await db('calc_tasks').where('id', taskId).first()
    if (!task) throw new Error('Task not found')
    if (task.status !== 'running') throw new Error('Task is not running')

    const control = this.taskControls.get(taskId)
    if (control) {
      control.paused = true
    }

    await db('calc_tasks').where('id', taskId).update({
      status: 'paused',
    })

    return { taskId, status: 'paused' }
  }

  async resumeTask(taskId: string) {
    const task = await db('calc_tasks').where('id', taskId).first()
    if (!task) throw new Error('Task not found')
    if (task.status !== 'paused') throw new Error('Task is not paused')

    const control = this.taskControls.get(taskId)
    if (control) {
      control.paused = false
      await db('calc_tasks').where('id', taskId).update({
        status: 'running',
      })
      return { taskId, status: 'resumed' }
    }

    // 无 control 对象（服务重启后恢复）→ 从 checkpoint 恢复
    const checkpoint = await db('calc_checkpoints')
      .where('task_id', taskId)
      .orderBy('iteration', 'desc')
      .first()

    if (!checkpoint) throw new Error('No checkpoint available for resume')

    // 重新提交任务（复用原参数）
    const params = typeof task.parameters === 'string'
      ? JSON.parse(task.parameters) : task.parameters
    params._resumeFromCheckpoint = checkpoint.id

    await db('calc_tasks').where('id', taskId).update({
      status: 'running', progress_pct: checkpoint.iteration,
    })

    // 根据 task_type 重新派发
    const newControl = { paused: false, aborted: false }
    this.taskControls.set(taskId, newControl)
    this.redispatchTask(taskId, task.task_type, params)

    return { taskId, status: 'resumed', resumedFrom: checkpoint.iteration }
  }

  // ==================== 光伏场景辅助方法 ====================

  private readonly WEATHER_OUTPUT_RATIOS: Record<string, number> = {
    sunny: 0.85,
    cloudy: 0.55,
    rainy: 0.25,
  }

  /**
   * 光伏场景：从 solar_pv_stations + pv_output_measurements 查询实际出力数据，
   * 叠加到对应母线的发电机出力上（原有电源 + 光伏出力），
   * 松弛母线自动平衡全网功率。
   * weatherScenario:
   *   actual → 使用电站最新实测值（无实测时按装机 60% 估算）
   *   sunny  → 典型晴天，按装机容量 × 0.85
   *   cloudy → 典型多云，按装机容量 × 0.55
   *   rainy  → 典型阴雨，按装机容量 × 0.25
   */
  private async applySolarScenarioWithMeasurements(
    input: PowerFlowInput,
    scenario: { weatherScenario?: string; pvBusIds?: string[] },
  ): Promise<void> {
    const stations = await this.queryPVStationsWithOutput()
    if (stations.length === 0) return

    const weatherScenario = scenario.weatherScenario || 'actual'
    const ratio = this.WEATHER_OUTPUT_RATIOS[weatherScenario]
    // pvBusIds: undefined = 全部接入(兼容), [] = 不接入, [id...] = 只接入指定
    const pvBusIds = scenario.pvBusIds

    // 非 actual 场景：批量加载模型参数
    const modelParamsMap = new Map<string, { efficiencyPct: number; soilingFactor: number; powerFactor: number }>()
    if (weatherScenario !== 'actual' && ratio !== undefined) {
      const modelIds = [...new Set(stations.map(s => s.model_id).filter(Boolean))] as string[]
      if (modelIds.length > 0) {
        const models = await db('station_model_params')
          .whereIn('id', modelIds).where('is_active', 1)
          .select('id', 'efficiency_pct', 'soiling_factor', 'power_factor')
        for (const m of models) {
          modelParamsMap.set(m.id, {
            efficiencyPct: m.efficiency_pct ?? 80,
            soilingFactor: m.soiling_factor ?? 0.03,
            powerFactor: m.power_factor ?? 0.93,
          })
        }
      }
    }

    const pvOutputByBus = new Map<string, { pvMw: number; installedCapacityMw: number; powerFactor?: number }>()
    for (const st of stations) {
      if (pvBusIds !== undefined && !pvBusIds.includes(st.bus_id)) continue

      let pvMw: number
      let powerFactor: number | undefined
      if (weatherScenario === 'actual' || ratio === undefined) {
        pvMw = (st.active_power_kw || 0) / 1000
      } else {
        // 场景模拟：从模型参数推算出力
        const mp = st.model_id ? modelParamsMap.get(st.model_id) : undefined
        const eff = (mp?.efficiencyPct ?? 80) / 100
        const soiling = mp?.soilingFactor ?? 0.03
        powerFactor = mp?.powerFactor
        pvMw = st.installed_capacity_mw * eff * ratio * (1 - soiling)
      }

      const existing = pvOutputByBus.get(st.bus_id)
      if (existing) {
        existing.pvMw += pvMw
        existing.installedCapacityMw += st.installed_capacity_mw
      } else {
        pvOutputByBus.set(st.bus_id, { pvMw, installedCapacityMw: st.installed_capacity_mw })
      }
    }

    if (pvOutputByBus.size === 0) return

    for (const gen of input.generators) {
      if (pvOutputByBus.has(gen.busId)) {
        const pv = pvOutputByBus.get(gen.busId)!
        gen.pgMw += pv.pvMw
        gen.isPV = true
        gen.installedCapacityMw = (gen.installedCapacityMw || 0) + pv.installedCapacityMw
        pvOutputByBus.delete(gen.busId)
      }
    }

    for (const [busId, pv] of pvOutputByBus) {
      const bus = input.buses.find(b => b.id === busId)
      // 根据功率因数计算无功范围
      const pf = pv.powerFactor ?? 0.93
      const tanPhi = Math.tan(Math.acos(pf))
      const qBase = pv.pvMw * tanPhi
      input.generators.push({
        busId,
        pgMw: pv.pvMw,
        vgKv: bus?.baseKv ?? 230,
        qmaxMvar: +(qBase * 1.2).toFixed(2),
        qminMvar: +(-qBase * 0.5).toFixed(2),
        isPV: true,
        installedCapacityMw: pv.installedCapacityMw,
      })
    }
  }

  /**
   * 查询光伏电站及其最新出力数据
   */
  private async queryPVStationsWithOutput(weather?: string): Promise<any[]> {
    let query = db('solar_pv_stations as spv')
      .select(
        'spv.id',
        'spv.station_name',
        'spv.bus_id',
        'spv.model_id',
        'gb.name as bus_name',
        'spv.installed_capacity_mw',
        'm.active_power_kw',
        'm.time as measurement_time',
        'm.expected_weather',
        'm.actual_weather',
        'm.irradiance_wm2',
      )
      .join('grid_buses as gb', 'gb.id', 'spv.bus_id')
      .joinRaw(
        `LEFT JOIN pv_output_measurements m ON m.station_id = spv.id
         AND m.time = (SELECT max(time) FROM pv_output_measurements WHERE station_id = spv.id)`,
      )
      .where('spv.status', 'active')

    if (weather) {
      // 按天气条件筛选：匹配实际天气
      query = query.where('m.actual_weather', weather)
    }

    const rows = await query

    // 对没有测量数据的电站，按装机容量估算 60% 出力作为默认值
    for (const row of rows) {
      if (row.active_power_kw == null) {
        row.active_power_kw = row.installed_capacity_mw * 1000 * 0.6
        row.measurement_time = null
        row._estimated = true
      }
    }

    return rows
  }

  // ==================== 私有辅助方法 ====================

  private async updateProgress(taskId: string, pct: number, msg?: string) {
    const task = await db('calc_tasks').where('id', taskId).first('started_at', 'progress_pct')
    const now = Date.now()
    const startedAt = task?.started_at ? new Date(task.started_at).getTime() : now
    const elapsed = now - startedAt
    const etaMs = pct > 0 && pct < 100 ? Math.round(elapsed * (100 - pct) / pct) : null

    await db('calc_tasks').where('id', taskId).update({
      progress_pct: Math.round(pct),
      progress_message: msg || null,
      eta_ms: etaMs,
    })
  }

  private async saveCheckpoint(taskId: string, iteration: number, data: any) {
    await db('calc_checkpoints').insert({
      id: uuid(),
      task_id: taskId,
      iteration,
      checkpoint_data: JSON.stringify(data),
      created_at: new Date().toISOString(),
    })
  }

  private async saveCalcResult(taskId: string, result: any, params: any) {
    const nodeResults = result.nodeResults.map((n: any) => ({
      busId: n.busId, nodeId: n.nodeId, name: n.name,
      zone: n.zone, voltageLevel: n.voltageLevel,
      baseKv: n.baseKv, busType: n.busType,
      voltagePu: n.voltagePu, angleDeg: n.angleDeg,
      stabilityMargin: n.stabilityMargin, isWeakNode: n.isWeakNode,
      threePhaseImbalance: n.threePhaseImbalance, reversePower: n.reversePower,
      pdMw: n.pdMw, qdMvar: n.qdMvar, pgMw: n.pgMw, qgMvar: n.qgMvar,
    }))

    const branches = result.branchResults || []
    const maxVDev = result.nodeResults.length > 0
      ? Math.max(...result.nodeResults.map((n: any) => Math.abs(n.voltagePu - 1)))
      : 0
    const maxLoadRate = branches.length > 0
      ? Math.max(...branches.map((b: any) => b.loadingPct || 0))
      : 0
    const branchLossSum = branches.reduce((s: number, b: any) => s + Math.abs(b.lossMw || 0), 0)
    const totalLossMw = branchLossSum > 0 ? branchLossSum : Math.abs(result.totalLossMw || 0)
    const totalGen = result.totalGenMw || 0
    const summary = {
      totalLossKw: totalLossMw * 1000,
      totalGenMw: totalGen,
      totalLoadMw: result.totalLoadMw || 0,
      maxVoltageDeviation: Number(maxVDev.toFixed(4)),
      maxLoadRate: Number(maxLoadRate.toFixed(1)),
      lossPercent: totalGen > 0 ? Number((totalLossMw / totalGen * 100).toFixed(2)) : 0,
      iterations: result.iterations || 0,
      converged: result.converged ?? true,
    }

    await db('calc_results').insert({
      id: uuid(),
      task_id: taskId, version: 1, is_latest: true,
      node_results: JSON.stringify(nodeResults),
      branch_results: JSON.stringify(branches),
      summary: JSON.stringify(summary),
      reverse_power_detected: result.nodeResults?.filter((n: any) => n.reversePower).length || 0,
      three_phase_imbalance_pct: result.nodeResults?.reduce((max: number, n: any) => Math.max(max, n.threePhaseImbalance || 0), 0) || 0,
      total_loss_kw: totalLossMw * 1000,
      created_at: new Date().toISOString(),
    })
  }

  private async buildPowerFlowInput(): Promise<PowerFlowInput> {
    const [busRows, branchRows, genRows, loadRows] = await Promise.all([
      db('grid_buses').orderBy('voltage_level', 'desc').orderBy('name'),
      db('grid_branches'),
      db('grid_generators'),
      db('grid_loads'),
    ])

    return {
      buses: busRows.map((b: any) => ({
        id: b.id, name: b.name, zone: b.zone, voltageLevel: b.voltage_level,
        baseKv: b.base_kv, busType: b.bus_type,
      })),
      branches: branchRows.map((b: any) => ({
        id: b.id, fromBusId: b.from_bus_id, toBusId: b.to_bus_id,
        branchType: b.branch_type, rOhm: b.r_ohm, xOhm: b.x_ohm,
        bUf: b.b_uf ?? 0, tapRatio: b.tap_ratio ?? null,
        ampacityMva: b.ampacity_mva ?? undefined,
        r0Ohm: b.r0_ohm ?? undefined, x0Ohm: b.x0_ohm ?? undefined, b0Uf: b.b0_uf ?? undefined,
      })),
      generators: genRows.map((g: any) => ({
        busId: g.bus_id, pgMw: g.pg_mw, vgKv: g.vg_kv,
        qmaxMvar: g.qmax_mvar, qminMvar: g.qmin_mvar,
        pgAMw: g.pg_a_mw ?? undefined, pgBMw: g.pg_b_mw ?? undefined, pgCMw: g.pg_c_mw ?? undefined,
      })),
      loads: loadRows.map((l: any) => ({
        busId: l.bus_id, pdMw: l.pd_mw, qdMvar: l.qd_mvar,
        pdAMw: l.pd_a_mw ?? undefined, pdBMw: l.pd_b_mw ?? undefined, pdCMw: l.pd_c_mw ?? undefined,
        qdAMvar: l.qd_a_mvar ?? undefined, qdBMvar: l.qd_b_mvar ?? undefined, qdCMvar: l.qd_c_mvar ?? undefined,
      })),
    }
  }

  private getPVBusIds(input: PowerFlowInput): string[] {
    // 通过发电机数据中的光伏关联信息确定光伏母线
    // 通常 Pg > 0 且位于低电压等级的母线
    return input.generators
      .filter(g => g.pgMw > 0)
      .map(g => g.busId)
  }

  private redispatchTask(taskId: string, taskType: string, params: any) {
    // 根据 task_type 重新分发任务（断点续算用）
    switch (taskType) {
      case 'PROBABILISTIC':
        // 简化的重新派发：重新执行概率计算
        setImmediate(async () => {
          try {
            const input = await this.buildPowerFlowInput()
            await this.applySolarScenarioWithMeasurements(input, {
              weatherScenario: params.weatherScenario || 'actual',
              pvBusIds: params.pvBusIds || [],
            })
            const sampleCount = Math.min(Math.max(params.sampleCount || 200, 100), 2000)
            const result = await calculateProbabilisticPowerFlow(
              input, sampleCount, {
              loadVariationPct: params.loadVariationPct ?? 10,
              pvConcentration: params.pvConcentration ?? 20,
              generatorFOR: params.generatorFOR ?? 0,
            },
            )
            await this.saveCalcResult(taskId, result, params)
            await db('calc_tasks').where('id', taskId).update({
              status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
            })
          } catch (err: any) {
            await db('calc_tasks').where('id', taskId).update({
              status: 'failed', error_message: err.message,
            })
          }
        })
        break
      default:
        // 其他类型简化处理
        setImmediate(async () => {
          try {
            const input = await this.buildPowerFlowInput()
            const result = calculatePowerFlow(input)
            await this.saveCalcResult(taskId, result, params)
            await db('calc_tasks').where('id', taskId).update({
              status: 'completed', progress_pct: 100, completed_at: new Date().toISOString(),
            })
          } catch (err: any) {
            await db('calc_tasks').where('id', taskId).update({
              status: 'failed', error_message: err.message,
            })
          }
        })
    }
  }

  /** 获取分相数据概况（负荷分相 / 发电机分相 / 支路零序） */
  async getPhaseDataSummary() {
    // 负荷分相：各电压等级的平均 A/B/C 比例
    const loadRows = await db('grid_loads')
      .join('grid_buses', 'grid_loads.bus_id', 'grid_buses.id')
      .where('grid_loads.pd_mw', '>', 0)
      .select(
        'grid_buses.voltage_level',
        db.raw('COUNT(*) as cnt'),
        db.raw('AVG(CAST(grid_loads.pd_a_mw AS REAL) / NULLIF(grid_loads.pd_mw, 0)) as avg_a'),
        db.raw('AVG(CAST(grid_loads.pd_b_mw AS REAL) / NULLIF(grid_loads.pd_mw, 0)) as avg_b'),
        db.raw('AVG(CAST(grid_loads.pd_c_mw AS REAL) / NULLIF(grid_loads.pd_mw, 0)) as avg_c'),
      )
      .groupBy('grid_buses.voltage_level')
      .orderByRaw("CASE grid_buses.voltage_level WHEN '220kV' THEN 1 WHEN '110kV' THEN 2 WHEN '10kV' THEN 3 ELSE 4 END")

    const loadPhase = loadRows.map((r: any) => ({
      voltageLevel: r.voltage_level,
      count: r.cnt,
      ratios: [Number(Number(r.avg_a).toFixed(2)), Number(Number(r.avg_b).toFixed(2)), Number(Number(r.avg_c).toFixed(2))],
    }))

    // 发电机分相
    const genRows = await db('grid_generators')
      .join('grid_buses', 'grid_generators.bus_id', 'grid_buses.id')
      .where('grid_generators.pg_mw', '>', 0)
      .select(
        'grid_buses.voltage_level',
        db.raw('COUNT(*) as cnt'),
        db.raw('AVG(CAST(grid_generators.pg_a_mw AS REAL) / NULLIF(grid_generators.pg_mw, 0)) as avg_a'),
        db.raw('AVG(CAST(grid_generators.pg_b_mw AS REAL) / NULLIF(grid_generators.pg_mw, 0)) as avg_b'),
        db.raw('AVG(CAST(grid_generators.pg_c_mw AS REAL) / NULLIF(grid_generators.pg_mw, 0)) as avg_c'),
      )
      .groupBy('grid_buses.voltage_level')
      .orderByRaw("CASE grid_buses.voltage_level WHEN '220kV' THEN 1 WHEN '110kV' THEN 2 WHEN '10kV' THEN 3 ELSE 4 END")

    const genPhase = genRows.map((r: any) => ({
      voltageLevel: r.voltage_level,
      count: r.cnt,
      ratios: [Number(Number(r.avg_a).toFixed(2)), Number(Number(r.avg_b).toFixed(2)), Number(Number(r.avg_c).toFixed(2))],
    }))

    // 支路零序参数
    const branchRows = await db('grid_branches')
      .whereNotNull('r0_ohm')
      .where('r_ohm', '>', 0)
      .select(
        'voltage_level',
        db.raw('COUNT(*) as cnt'),
        db.raw('AVG(CAST(r0_ohm AS REAL) / NULLIF(r_ohm, 0)) as avg_r0r1'),
        db.raw('AVG(CAST(COALESCE(x0_ohm, 0) AS REAL) / NULLIF(NULLIF(x_ohm, 0), 0)) as avg_x0x1'),
      )
      .groupBy('voltage_level')
      .orderByRaw("CASE voltage_level WHEN '220kV' THEN 1 WHEN '110kV' THEN 2 WHEN '10kV' THEN 3 ELSE 4 END")

    const branchZeroSeq = branchRows.map((r: any) => ({
      voltageLevel: r.voltage_level,
      count: r.cnt,
      avgR0R1: Number(Number(r.avg_r0r1).toFixed(2)),
      avgX0X1: Number(Number(r.avg_x0x1).toFixed(2)),
    }))

    return { loadPhase, genPhase, branchZeroSeq }
  }

  /** 根据馈线查询分相数据明细（供前端编辑） */
  async getPhaseDataDetail(params: { feederIds: string[] }) {
    const { feederIds } = params
    if (!feederIds || feederIds.length === 0) return { loads: [], generators: [], branches: [] }

    // 1. 获取馈线关联的所有母线
    const fbRows = await db('feeder_buses').whereIn('feeder_id', feederIds).select('bus_id')
    const busIds = [...new Set(fbRows.map((r: any) => r.bus_id))]
    if (busIds.length === 0) return { loads: [], generators: [], branches: [] }

    // 2. 查询母线信息
    const busRows = await db('grid_buses').whereIn('id', busIds).select('id', 'name', 'voltage_level', 'base_kv')
    const busNameMap = new Map(busRows.map((b: any) => [b.id, { name: b.name, voltageLevel: b.voltage_level, baseKv: b.base_kv }]))

    // 3. 负荷分相明细
    const loads = (await db('grid_loads').whereIn('bus_id', busIds).select('*')).map((l: any) => ({
      id: l.id,
      busId: l.bus_id,
      busName: busNameMap.get(l.bus_id)?.name || l.bus_id,
      voltageLevel: busNameMap.get(l.bus_id)?.voltageLevel || '',
      pdMw: l.pd_mw ?? 0,
      qdMvar: l.qd_mvar ?? 0,
      pdAMw: l.pd_a_mw ?? 0,
      pdBMw: l.pd_b_mw ?? 0,
      pdCMw: l.pd_c_mw ?? 0,
      qdAMvar: l.qd_a_mvar ?? 0,
      qdBMvar: l.qd_b_mvar ?? 0,
      qdCMvar: l.qd_c_mvar ?? 0,
    }))

    // 4. 发电机分相明细
    const generators = (await db('grid_generators').whereIn('bus_id', busIds).select('*')).map((g: any) => ({
      id: g.id,
      busId: g.bus_id,
      busName: busNameMap.get(g.bus_id)?.name || g.bus_id,
      voltageLevel: busNameMap.get(g.bus_id)?.voltageLevel || '',
      pgMw: g.pg_mw ?? 0,
      pgAMw: g.pg_a_mw ?? 0,
      pgBMw: g.pg_b_mw ?? 0,
      pgCMw: g.pg_c_mw ?? 0,
    }))

    // 5. 支路零序明细（至少一端在馈线范围内）
    const branches = (await db('grid_branches')
      .where(function () {
        this.whereIn('from_bus_id', busIds).orWhereIn('to_bus_id', busIds)
      })
      .select('*')
    ).map((b: any) => {
      const fromBus = busNameMap.get(b.from_bus_id)
      const toBus = busNameMap.get(b.to_bus_id)
      return {
        id: b.id,
        fromBusId: b.from_bus_id,
        toBusId: b.to_bus_id,
        fromBusName: fromBus?.name || b.from_bus_id,
        toBusName: toBus?.name || b.to_bus_id,
        voltageLevel: b.voltage_level || '',
        branchType: b.branch_type || 'LINE',
        rOhm: b.r_ohm ?? 0,
        xOhm: b.x_ohm ?? 0,
        r0Ohm: b.r0_ohm ?? 0,
        x0Ohm: b.x0_ohm ?? 0,
      }
    })

    return { loads, generators, branches }
  }
}
