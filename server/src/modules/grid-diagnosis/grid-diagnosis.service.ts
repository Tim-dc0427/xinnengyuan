import { db } from '../../config/database.js'
import { v4 as uuidv4 } from 'uuid'
import type {
  PvOutputStatsQuery,
  ExtremeScenarioType,
  ExtremeScenarioResult,
  TimePointAnalysis,
  BackupConfigSegment,
  HighTempParams,
  RainstormParams,
  ScenarioReport,
  ScenarioStationInfo,
  ScenarioStrategyAnalysis,
  ScenarioConclusion,
  ScenarioDataAnalysis,
} from '@new-energy/shared'

export class GridDiagnosisService {
  // ==================== 电站列表 ====================
  async getStations() {
    return db('solar_pv_stations')
      .join('grid_buses', 'solar_pv_stations.bus_id', 'grid_buses.id')
      .select(
        'solar_pv_stations.id',
        'solar_pv_stations.station_name as stationName',
        'solar_pv_stations.installed_capacity_mw as installedCapacityMw',
        'solar_pv_stations.grid_connection_voltage_kv as gridConnectionVoltageKv',
        'solar_pv_stations.longitude',
        'solar_pv_stations.latitude',
        'grid_buses.zone',
        'grid_buses.voltage_level as voltageLevel',
      )
      .where('solar_pv_stations.status', 'active')
  }

  async getStationsSnapshot() {
    // 每个电站取最近一条非零功率记录（白天有效数据），若无则取最新记录
    const rows = await db.raw(`
      SELECT
        s.id AS stationId,
        s.station_name AS stationName,
        s.installed_capacity_mw AS installedCapacityMw,
        s.grid_connection_voltage_kv AS gridConnectionVoltageKv,
        s.longitude,
        s.latitude,
        b.zone,
        b.voltage_level AS voltageLevel,
        m.time,
        m.active_power_kw AS activePowerKw,
        m.reactive_power_kvar AS reactivePowerKvar
      FROM solar_pv_stations s
      JOIN grid_buses b ON s.bus_id = b.id
      JOIN (
        SELECT station_id, time
        FROM (
          SELECT station_id, time,
            ROW_NUMBER() OVER (
              PARTITION BY station_id
              ORDER BY CASE WHEN active_power_kw != 0 THEN 0 ELSE 1 END, time DESC
            ) AS rn
          FROM pv_output_measurements
          WHERE station_id IS NOT NULL
        ) ranked WHERE rn = 1
      ) latest ON s.id = latest.station_id
      JOIN pv_output_measurements m ON m.station_id = latest.station_id AND m.time = latest.time
      WHERE s.status = 'active'
    `)
    return (rows as any[]).map((r) => {
      const p = r.activePowerKw ?? 0
      const q = r.reactivePowerKvar ?? 0
      const s = Math.sqrt(p * p + q * q)
      return {
        stationId: r.stationId,
        stationName: r.stationName,
        installedCapacityMw: r.installedCapacityMw,
        gridConnectionVoltageKv: r.gridConnectionVoltageKv,
        longitude: r.longitude,
        latitude: r.latitude,
        zone: r.zone,
        voltageLevel: r.voltageLevel,
        time: r.time,
        activePowerKw: p,
        reactivePowerKvar: q,
        apparentPowerKva: +s.toFixed(2),
        direction: p < 0 ? 'reverse' as const : 'forward' as const,
        isBackfeed: p < 0,
      }
    })
  }

  async getStorageList() {
    return db('storage_entities')
      .join('grid_buses', 'storage_entities.bus_id', 'grid_buses.id')
      .select(
        'storage_entities.id',
        'storage_entities.name',
        'storage_entities.rated_power_kw as ratedPowerKw',
        'storage_entities.rated_capacity_kwh as ratedCapacityKwh',
        'storage_entities.storage_type as storageType',
        'grid_buses.zone',
      )
      .where('storage_entities.status', 'active')
  }

  // ==================== PV Output Stats ====================
  async getPvOutputStats(query: PvOutputStatsQuery & { groupBy?: string }) {
    const { startDate, endDate, groupBy = 'station', compareMode } = query

    // 子查询：先按 station_id 聚合，避免 JOIN 导致的 SUM(installed_capacity_mw) 重复累加
    const stationAgg = db('pv_output_measurements as pvo')
      .join('solar_pv_stations as spv', 'spv.id', 'pvo.station_id')
      .join('grid_buses as gb', 'gb.id', 'spv.bus_id')
      .whereBetween('pvo.time', [startDate, endDate])
      .select(
        'spv.id as stationId',
        'spv.station_name as stationName',
        'spv.installed_capacity_mw as installedCapacityMw',
        'spv.actual_runtime_hours as actualRuntimeHours',
        'spv.prev_actual_runtime_hours as prevActualRuntimeHours',
        'gb.zone',
        'gb.voltage_level as voltageLevel',
        db.raw('SUM(pvo.active_power_kw * 1) as totalOutputKwh'),
        db.raw('AVG(pvo.active_power_kw) as avgOutputKw'),
        db.raw('MAX(pvo.active_power_kw) as maxOutputKw'),
      )
      .groupBy('spv.id')

    const stationRows = await stationAgg.orderBy('totalOutputKwh', 'desc')

    // 查询天数，用于年化实际运行小时数按比例缩放
    const queryDays = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    const dayRatio = queryDays / 365

    // 构建 current 数组
    let current: any[]
    if (groupBy === 'station') {
      current = stationRows.map((r: any) => ({
        groupKey: r.stationId,
        groupType: 'station' as const,
        stationName: r.stationName,
        zone: r.zone,
        voltageLevel: r.voltageLevel,
        installedCapacityMw: r.installedCapacityMw,
        generationHours: +((r.actualRuntimeHours || 0) * dayRatio).toFixed(1),
        prevActualRuntimeHours: r.prevActualRuntimeHours || 0,
        totalOutputKwh: r.totalOutputKwh,
        avgOutputKw: r.avgOutputKw,
        maxOutputKw: r.maxOutputKw,
        stationCount: 1,
      }))
    } else {
      const groupField = groupBy === 'zone' ? 'zone' : 'voltageLevel'
      const isVoltageLevel = groupBy === 'voltage_level'
      const grouped = new Map<string, any>()
      for (const r of stationRows as any[]) {
        const key = r[groupField] || 'unknown'
        if (!grouped.has(key)) {
          grouped.set(key, {
            groupKey: key,
            groupType: groupBy as string,
            installedCapacityMw: 0,
            runtimeHoursWeighted: 0,
            prevRuntimeHoursWeighted: 0,
            totalOutputKwh: 0,
            avgOutputKw: 0,
            maxOutputKw: 0,
            stationCount: 0,
          })
        }
        const g = grouped.get(key)!
        g.installedCapacityMw += r.installedCapacityMw
        g.runtimeHoursWeighted += (r.installedCapacityMw || 0) * (r.actualRuntimeHours || 0)
        g.prevRuntimeHoursWeighted += (r.installedCapacityMw || 0) * (r.prevActualRuntimeHours || 0)
        g.totalOutputKwh += r.totalOutputKwh
        g.avgOutputKw += r.avgOutputKw
        g.maxOutputKw = Math.max(g.maxOutputKw, r.maxOutputKw)
        g.stationCount += 1
      }
      current = Array.from(grouped.values())
      for (const row of current) {
        if (isVoltageLevel) {
          // 电压等级：等效利用小时 = 发电量/装机容量
          const capKw = (row.installedCapacityMw || 0) * 1000
          row.generationHours = capKw > 0 ? +((row.totalOutputKwh || 0) / capKw).toFixed(1) : 0
        } else {
          // 区域：实际发电小时，加权平均后按时间段缩放
          row.generationHours = row.installedCapacityMw > 0
            ? +((row.runtimeHoursWeighted / row.installedCapacityMw) * dayRatio).toFixed(1)
            : 0
          // 对比期实际发电小时（同比环比用）
          row.prevGenerationHours = row.installedCapacityMw > 0
            ? +((row.prevRuntimeHoursWeighted / row.installedCapacityMw) * dayRatio).toFixed(1)
            : 0
        }
        delete row.runtimeHoursWeighted
        delete row.prevRuntimeHoursWeighted
        row.avgOutputKw = +(row.avgOutputKw / row.stationCount).toFixed(2)
      }
      current.sort((a, b) => b.totalOutputKwh - a.totalOutputKwh)
    }

    // 同比/环比计算（所有分组模式均支持）
    if (compareMode && (compareMode === 'yoy' || compareMode === 'mom')) {
      const prevStart = new Date(startDate)
      const prevEnd = new Date(endDate)
      if (compareMode === 'yoy') {
        prevStart.setFullYear(prevStart.getFullYear() - 1)
        prevEnd.setFullYear(prevEnd.getFullYear() - 1)
      } else {
        prevStart.setMonth(prevStart.getMonth() - 1)
        prevEnd.setMonth(prevEnd.getMonth() - 1)
      }
      const prevStr = prevStart.toISOString().slice(0, 10)
      const prevEndStr = prevEnd.toISOString().slice(0, 10)

      const prevData = await db('pv_output_measurements as pvo')
        .join('solar_pv_stations as spv', 'spv.id', 'pvo.station_id')
        .join('grid_buses as gb', 'gb.id', 'spv.bus_id')
        .whereBetween('pvo.time', [prevStr, prevEndStr])
        .select(
          ...(groupBy === 'zone' ? ['gb.zone as groupKey'] :
              groupBy === 'voltage_level' ? ['gb.voltage_level as groupKey'] :
              ['spv.id as groupKey']),
          db.raw('SUM(pvo.active_power_kw * 1) as totalOutputKwh'),
        )
        .groupBy(groupBy === 'zone' ? 'gb.zone' : groupBy === 'voltage_level' ? 'gb.voltage_level' : 'spv.id')

      const prevMap = new Map(prevData.map((r: any) => [r.groupKey, r.totalOutputKwh]))

      const isVoltageLevel = groupBy === 'voltage_level'

      for (const row of current as any[]) {
        const prev = prevMap.get(row.groupKey) || 0

        row.prevTotalOutputKwh = prev
        row.changePct = prev > 0 ? +(((row.totalOutputKwh - prev) / prev) * 100).toFixed(1) : null

        if (isVoltageLevel) {
          // 等效利用小时 = prev发电量/装机容量
          const capKw = (row.installedCapacityMw || 0) * 1000
          const prevHours = capKw > 0 ? +(prev / capKw).toFixed(1) : 0
          row.prevGenerationHours = prevHours
          row.generationHoursChangePct = prevHours > 0 ? +(((row.generationHours - prevHours) / prevHours) * 100).toFixed(1) : null
        } else {
          // 实际发电小时：prev 已在聚合时从 prevActualRuntimeHours 独立算好
          row.generationHoursChangePct = row.prevGenerationHours > 0
            ? +(((row.generationHours - row.prevGenerationHours) / row.prevGenerationHours) * 100).toFixed(1)
            : null
        }
      }
    }

    return current
  }

  // ==================== Influencing Factors ====================
  async getFactors(query: { stationId: string; startDate?: string; endDate?: string }) {
    const { stationId } = query

    const data = await db('pv_output_measurements')
      .where('station_id', stationId)
      .select('active_power_kw', 'temperature_c', 'irradiance_wm2', 'humidity_pct', 'inverter_efficiency')
      .orderBy('time', 'asc')

    const factors: Array<{ key: string; label: string; field: string }> = [
      { key: 'irradiance', label: '光照', field: 'irradiance_wm2' },
      { key: 'temperature', label: '温度', field: 'temperature_c' },
      { key: 'humidity', label: '湿度', field: 'humidity_pct' },
      { key: 'inverter_efficiency', label: '逆变器效率', field: 'inverter_efficiency' },
    ]

    const factorUnitMap: Record<string, string> = {
      irradiance: 'W/m²',
      temperature: '°C',
      humidity: '%',
      inverter_efficiency: '',
    }

    // 构建全因子对齐数据集（排除出力为0的数据——逆变器停机时效率值无分析意义）
    const aligned: Array<Record<string, number>> = []
    for (const d of data as any[]) {
      const row: Record<string, number> = {}
      let valid = d.active_power_kw != null && d.active_power_kw > 0
      for (const f of factors) {
        if (d[f.field] == null) { valid = false; break }
        row[f.key] = d[f.field]
      }
      if (valid) {
        row['output'] = d.active_power_kw
        aligned.push(row)
      }
    }

    // 因子字段名列表
    const factorKeys = factors.map(f => f.key)

    // 基准光照：取中位数，用于将出力标准化到同一光照水平
    const irradVals = aligned.map(r => r['irradiance']).filter(v => v > 0).sort((a, b) => a - b)
    const baseIrradiance = irradVals.length > 0 ? irradVals[Math.floor(irradVals.length / 2)] : 500

    const results = factors.map((f) => {
      const xVals = aligned.map(r => r[f.key])
      const yVals = aligned.map(r => r.output)
      const pearsonR = this.pearsonCorrelation(xVals, yVals)

      // 偏相关分析（对数空间，控制其他因子，解耦乘法模型）
      const controlKeys = factorKeys.filter(k => k !== f.key)
      const controlVars = controlKeys.map(k => aligned.map(r => r[k]))

      const logAligned = aligned.filter(
        r => r[f.key] > 0 && r.output > 0 && controlKeys.every(k => r[k] > 0),
      )
      let partialR = 0
      if (logAligned.length >= 10) {
        const logX = logAligned.map(r => Math.log(r[f.key]))
        const logY = logAligned.map(r => Math.log(r.output))
        const logControls = controlKeys.map(k => logAligned.map(r => Math.log(r[k])))
        partialR = this.partialCorrelation(logX, logY, logControls)
      }

      // 控制变量描述性统计
      const controlDetails = controlKeys.map((ck, i) => {
        const cFactor = factors.find(fc => fc.key === ck)!
        const vals = controlVars[i]
        const n = vals.length
        const mean = vals.reduce((a, b) => a + b, 0) / n
        const stdDev = this.stdDev(vals)
        return {
          factorKey: ck,
          factorLabel: cFactor.label,
          unit: factorUnitMap[cFactor.key] || '',
          mean: +mean.toFixed(2),
          stdDev: +stdDev.toFixed(2),
          min: +Math.min(...vals).toFixed(2),
          max: +Math.max(...vals).toFixed(2),
        }
      })

      const controlledText = controlDetails.map(c => c.factorLabel).join('、')

      const trendDir = (r: number) => r > 0 ? '正相关' : '负相关'
      const trendStr = (r: number) => {
        const abs = Math.abs(r)
        return `${trendDir(r)}（${abs > 0.7 ? '强' : abs > 0.3 ? '中等' : '弱'}）`
      }

      const isIrradiance = f.key === 'irradiance'
      const yLabel = isIrradiance ? '出力' : '等效出力（已剔除光照影响）'
      const impactDescription = `${f.label}与${yLabel}：`
        + `简单${trendStr(pearsonR)}，`
        + `独立${trendStr(partialR)}`

      return {
        stationId,
        factorType: f.key,
        factorLabel: f.label,
        correlationCoefficient: +pearsonR.toFixed(4),
        partialCorrelationCoefficient: +partialR.toFixed(4),
        controlledVariables: controlledText,
        controlDetails,
        impactDescription,
        chartData: aligned.map(r => ({ x: r[f.key], y: r.output })).slice(0, 500),
        baseIrradiance,
        normalizedChartData: aligned
          .map(r => ({
            x: r[f.key],
            y: r['irradiance'] > 0 ? +(r.output / r['irradiance'] * baseIrradiance).toFixed(1) : 0,
          }))
          .filter(d => d.y > 0)
          .slice(0, 500),
      }
    })

    // 设备年限因子 — 全量历史数据，按周聚合，光照修正后分析衰减趋势
    const equipment = await db('equipment')
      .where('station_id', stationId)
      .where('equipment_type', 'INVERTER')
      .orderBy('installation_date', 'asc')
      .first()

    if (equipment) {
      const installDate = new Date(equipment.installation_date)
      const nowDate = new Date()
      const ageYears = +((nowDate.getTime() - installDate.getTime()) / (365.25 * 86400000)).toFixed(2)

      // 全量数据按周聚合（含温度、逆变器效率以做偏相关控制）
      const allData = await db('pv_output_measurements')
        .where('station_id', stationId)
        .where('active_power_kw', '>', 0)
        .where('irradiance_wm2', '>', 0)
        .select('time', 'active_power_kw', 'irradiance_wm2', 'temperature_c', 'inverter_efficiency')
        .orderBy('time', 'asc')

      const weekMap = new Map<string, { sumOutput: number; sumIrrad: number; sumTemp: number; sumInv: number; tempCount: number; invCount: number; count: number }>()
      for (const d of allData as any[]) {
        const t = new Date(d.time)
        const weekStart = new Date(t.getFullYear(), 0, 1 + (Math.floor((t.getTime() - new Date(t.getFullYear(), 0, 1).getTime()) / 86400000 / 7)) * 7)
        const weekKey = weekStart.toISOString().slice(0, 10)
        if (!weekMap.has(weekKey)) weekMap.set(weekKey, { sumOutput: 0, sumIrrad: 0, sumTemp: 0, sumInv: 0, tempCount: 0, invCount: 0, count: 0 })
        const entry = weekMap.get(weekKey)!
        entry.sumOutput += d.active_power_kw
        entry.sumIrrad += d.irradiance_wm2
        if (d.temperature_c != null) { entry.sumTemp += d.temperature_c; entry.tempCount++ }
        if (d.inverter_efficiency != null) { entry.sumInv += d.inverter_efficiency; entry.invCount++ }
        entry.count++
      }

      const allIrrad = Array.from(weekMap.values()).map(v => v.sumIrrad / v.count).filter(v => v > 0).sort((a, b) => a - b)
      const baseIrrad = allIrrad.length > 0 ? allIrrad[Math.floor(allIrrad.length / 2)] : 500

      const weeklyData: Array<{ x: number; y: number; temp?: number; inv?: number }> = []
      for (const [weekStart, v] of weekMap) {
        const daysFromInstall = (new Date(weekStart).getTime() - installDate.getTime()) / (365.25 * 86400000)
        const avgOutput = v.sumOutput / v.count
        const avgIrrad = v.sumIrrad / v.count
        const equivOutput = avgIrrad > 0 ? +(avgOutput / avgIrrad * baseIrrad).toFixed(1) : 0
        if (equivOutput <= 0 || daysFromInstall < 0) continue
        const pt: any = { x: +daysFromInstall.toFixed(2), y: equivOutput }
        if (v.tempCount > 0) pt.temp = +(v.sumTemp / v.tempCount).toFixed(1)
        if (v.invCount > 0) pt.inv = +(v.sumInv / v.invCount).toFixed(3)
        weeklyData.push(pt)
      }

      // 简单相关系数
      const xArr = weeklyData.map(d => d.x)
      const yArr = weeklyData.map(d => d.y)
      const ageCorrelation = weeklyData.length >= 4 ? this.pearsonCorrelation(xArr, yArr) : 0

      // 偏相关：控制温度+逆变器效率（对数空间，排除其他因素干扰）
      let partialR = ageCorrelation
      const controlLabels: string[] = []
      const controlDetails: any[] = []
      const hasTemp = weeklyData.filter(d => d.temp != null).length >= 4
      const hasInv = weeklyData.filter(d => d.inv != null).length >= 4

      if (hasTemp || hasInv) {
        const partialRows = weeklyData.filter(d => d.y > 0 && (hasTemp ? d.temp != null : true) && (hasInv ? d.inv != null : true))
        if (partialRows.length >= 4) {
          const logX = partialRows.map(d => Math.log(Math.max(0.01, d.x)))
          const logY = partialRows.map(d => Math.log(d.y))
          const controls: number[][] = []
          if (hasTemp) { controls.push(partialRows.map(d => Math.log(d.temp!))); controlLabels.push('温度') }
          if (hasInv) { controls.push(partialRows.map(d => Math.log(d.inv!))); controlLabels.push('逆变器效率') }
          partialR = this.partialCorrelation(logX, logY, controls)
        }
        if (hasTemp) {
          const temps = weeklyData.filter(d => d.temp != null).map(d => d.temp!)
          controlDetails.push({ factorKey: 'temperature', factorLabel: '温度', unit: '°C', mean: +(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(2), stdDev: +this.stdDev(temps).toFixed(2), min: +Math.min(...temps).toFixed(2), max: +Math.max(...temps).toFixed(2) })
        }
        if (hasInv) {
          const invs = weeklyData.filter(d => d.inv != null).map(d => d.inv!)
          controlDetails.push({ factorKey: 'inverter_efficiency', factorLabel: '逆变器效率', unit: '', mean: +(invs.reduce((a,b)=>a+b,0)/invs.length).toFixed(4), stdDev: +this.stdDev(invs).toFixed(4), min: +Math.min(...invs).toFixed(4), max: +Math.max(...invs).toFixed(4) })
        }
      }

      results.push({
        stationId,
        factorType: 'equipment_age',
        factorLabel: '设备年限',
        correlationCoefficient: +ageCorrelation.toFixed(4),
        partialCorrelationCoefficient: +partialR.toFixed(4),
        controlledVariables: controlLabels.join('、'),
        controlDetails,
        impactDescription: `设备年限与等效出力（光照修正，排除${controlLabels.join('、') || '无'}干扰）：`
          + `${Math.abs(partialR) < 0.3 ? '趋势不显著'
            : `${partialR < 0 ? '负相关（衰减趋势' : '正相关（上升趋势'}`
              + `，${Math.abs(partialR) > 0.7 ? '强' : '中等'}）`}`,
        chartData: weeklyData.map(d => ({ x: d.x, y: d.y })).slice(0, 500),
        normalizedChartData: weeklyData.map(d => ({ x: d.x, y: d.y })).slice(0, 500),
        baseIrradiance: baseIrrad,
        ageYears,
      } as any)
    } else {
      results.push({
        stationId,
        factorType: 'equipment_age',
        factorLabel: '设备年限',
        correlationCoefficient: 0,
        partialCorrelationCoefficient: 0,
        controlledVariables: '',
        controlDetails: [],
        impactDescription: '暂无设备年限数据',
        chartData: [],
        normalizedChartData: [],
        baseIrradiance: 0,
      })
    }

    return results
  }

  // ==================== Extreme Scenario Simulation ====================
  async simulateExtreme(params: {
    stationId: string
    scenarioType: ExtremeScenarioType
    params: HighTempParams | RainstormParams
  }): Promise<ExtremeScenarioResult> {
    const { stationId, scenarioType, params: scenarioParams } = params

    // ========== 1. 电站信息 ==========
    const station = await db('solar_pv_stations')
      .join('grid_buses', 'solar_pv_stations.bus_id', 'grid_buses.id')
      .select(
        'solar_pv_stations.*',
        'grid_buses.name as bus_name',
        'grid_buses.zone as bus_zone',
        'grid_buses.voltage_level as busVoltageLevel',
      )
      .where('solar_pv_stations.id', stationId)
      .first()
    const capacityMw = station?.installed_capacity_mw || 100
    const busId = station?.bus_id
    const busVoltageLevel = station?.busVoltageLevel || '10kV'
    const busName = (station as any)?.bus_name || 'Unknown'
    const stationZone = (station as any)?.bus_zone || '未知'
    const panelType = station?.panel_type || '单晶硅'

    // 光伏温度系数（%/℃）：从面板类型推断，单晶硅 -0.35~-0.45，多晶硅 -0.40~-0.50
    const pvTempCoeffPct = panelType.includes('多晶') ? 0.45 : panelType.includes('薄膜') ? 0.25 : 0.38

    // 储能
    const storageEntities = busId
      ? await db('storage_entities').where('bus_id', busId).where('status', 'active')
      : []
    const totalStorageMw = storageEntities.reduce(
      (s: number, e: any) => s + (e.rated_power_kw || 0) / 1000, 0,
    )
    const totalStorageMwh = storageEntities.reduce(
      (s: number, e: any) => s + (e.rated_capacity_kwh || 0) / 1000, 0,
    )

    // 负荷
    const loadRows = busId
      ? await db('load_measurements')
          .where('bus_id', busId)
          .where('time', '>=', '2026-05-16')
          .where('time', '<', '2026-05-17')
          .select('time', 'active_power_mw')
          .orderBy('time', 'asc')
      : []
    const hourlyLoad = new Map<number, { sum: number; count: number }>()
    for (const r of loadRows) {
      const h = new Date(r.time).getHours()
      if (!hourlyLoad.has(h)) hourlyLoad.set(h, { sum: 0, count: 0 })
      const e = hourlyLoad.get(h)!
      e.sum += r.active_power_mw || 0
      e.count++
    }

    // 外送通道容量
    const exportCapacityMw = busVoltageLevel.includes('220') ? 300
      : busVoltageLevel.includes('110') ? 100 : 30

    // ========== 2. 场景参数解析 ==========
    let maxTemp = 40, minTemp = 25, peakHour = 14, durationHalf = 3
    let cloudCoverRatio = 0.8, rainfallMmh = 15, rainDurationH = 6, rainPeakHour = 14

    if (scenarioType === 'high_temperature') {
      const hp = scenarioParams as HighTempParams
      maxTemp = hp.maxTemperatureC
      minTemp = hp.minTemperatureC
      peakHour = hp.peakTimeHour
      durationHalf = hp.durationHalfHours
    } else {
      const rp = scenarioParams as RainstormParams
      cloudCoverRatio = rp.cloudCoverRatio
      rainfallMmh = rp.rainfallIntensityMmh
      rainDurationH = rp.durationHours
      rainPeakHour = rp.peakTimeHour
      // 暴雨日温度低于晴热日，典型夏季暴雨 22~28°C
      maxTemp = 28
      minTemp = 22
    }

    // 场景下储能降额
    let effectiveStorageMw = totalStorageMw
    if (scenarioType === 'high_temperature') {
      const storageDerate = Math.max(0, Math.min(0.25, (maxTemp - 35) * 0.008))
      effectiveStorageMw *= (1 - storageDerate)
    }

    // ========== 3. 生成24小时时序 ==========
    // 储能逐时模拟：初始SOC=80%（应急备妥状态），缺口先由储能填补，不够的才是净缺口
    let socMwh = totalStorageMwh * 0.8
    const timeSeriesData: TimePointAnalysis[] = []
    let hourlyRainfallMmh: number | undefined
    for (let h = 0; h < 24; h++) {
      // ===== 温度曲线：正弦波，最低温~5点，最高温~peakHour =====
      // 基础正弦：midpoint + amplitude * sin((h-8)*π/12)
      //   h=2(≈5点): sin(-π/2)=-1 → minTemp
      //   h=8: sin(0)=0 → midpoint
      //   h=14(peakHour): sin(π/2)=1 → maxTemp
      //   h=20: sin(π)=0 → midpoint
      let baseSin = Math.sin((h - 8) * Math.PI / 12)
      let tempC: number
      if (scenarioType === 'high_temperature') {
        // 高温场景：用 sin^k 让峰值更尖锐（k>1压缩峰宽，更贴近极端高温日特点）
        const sharpSin = Math.sign(baseSin) * Math.pow(Math.abs(baseSin), 2.2)
        tempC = (maxTemp + minTemp) / 2 + (maxTemp - minTemp) / 2 * sharpSin
      } else {
        // 暴雨场景：标准正弦即可
        tempC = (maxTemp + minTemp) / 2 + (maxTemp - minTemp) / 2 * baseSin
      }

      // 光伏基础曲线
      const solarCurve = h >= 6 && h <= 18 ? Math.sin(((h - 6) / 12) * Math.PI) : 0
      const normalOutput = +(capacityMw * solarCurve).toFixed(2)

      // ===== 光伏出力降额 =====
      // 面板温度 = 环境温度 + 辐照温升（辐照越强温升越大，最高约28℃）
      const panelTemp = tempC + solarCurve * 28
      let degradedOutput: number
      if (scenarioType === 'high_temperature') {
        // 温度损失：超过25℃标准测试温度后每度损失 pvTempCoeffPct%
        const tempLoss = pvTempCoeffPct / 100 * Math.max(0, panelTemp - 25)
        // 逆变器效率温敏：环境每升10℃效率约降0.5%，所有温度段均生效
        const inverterEffLoss = Math.max(0, (tempC - 25) * 0.0005)
        // 逆变器保护降额：环境温度超过45℃开始，上限12%
        const inverterDerate = tempC > 45 ? Math.min(0.12, (tempC - 45) * 0.008) : 0
        degradedOutput = +(normalOutput * (1 - tempLoss) * (1 - inverterEffLoss) * (1 - inverterDerate)).toFixed(2)
      } else {
        // 暴雨：云层削减辐照（云层基础削减因子 + 降雨强度附加）
        const rainStart = rainPeakHour - rainDurationH / 2
        const rainEnd = rainPeakHour + rainDurationH / 2
        const inRain = h >= rainStart && h <= rainEnd
        // 降雨强度因子：雨区中心最强，边缘递减，非雨区为0
        const rainIntensity = inRain ? 1 - Math.abs(h - rainPeakHour) / (rainDurationH / 2) : 0
        // 逐时降雨强度 mm/h（中心=rainfallMmh，边缘→0，非雨区=0）
        hourlyRainfallMmh = inRain ? +(rainfallMmh * rainIntensity).toFixed(1) : 0
        // 云层削减因子：基础0.75（纯云层），降雨中心叠加0.25 → 1.0
        const cloudBaseFactor = 0.75
        const rainFactor = cloudBaseFactor + rainIntensity * 0.25
        degradedOutput = +(normalOutput * Math.max(0.05, 1 - cloudCoverRatio * rainFactor)).toFixed(2)
      }

      const dropPct = normalOutput > 0
        ? +(((normalOutput - degradedOutput) / normalOutput) * 100).toFixed(2) : 0

      // 负荷（不随温度变化）
      const ld = hourlyLoad.get(h)
      const loadMw = ld ? +(ld.sum / ld.count).toFixed(2) : 0

      // 供需缺口：负荷 - 极端出力，正值=缺电
      const degradedOutputMw = degradedOutput
      const rawGapMw = +(loadMw - degradedOutputMw).toFixed(2)

      // 储能行为：缺电时放电填补，有余量时充电
      let storageDischargeMw = 0
      let netGapMw: number
      if (rawGapMw > 0 && socMwh > 0) {
        // 缺电 → 储能放电，放电量 = min(缺口, 额定功率, 剩余电量)
        storageDischargeMw = Math.min(rawGapMw, effectiveStorageMw, socMwh)
        storageDischargeMw = +storageDischargeMw.toFixed(2)
        socMwh -= storageDischargeMw
        netGapMw = +(rawGapMw - storageDischargeMw).toFixed(2)
      } else if (rawGapMw < 0 && socMwh < totalStorageMwh) {
        // 有余量且储能未满 → 充电
        const chargeMw = Math.min(-rawGapMw, effectiveStorageMw * 0.8, totalStorageMwh - socMwh)
        storageDischargeMw = -(+chargeMw.toFixed(2))
        socMwh += chargeMw
        netGapMw = 0
      } else {
        netGapMw = Math.max(0, rawGapMw)
      }
      const safetyMarginMw = loadMw * 0.05
      const backupNeededMw = netGapMw > 0 ? +(netGapMw + safetyMarginMw).toFixed(2) : 0

      timeSeriesData.push({
        time: `${String(h).padStart(2, '0')}:00`,
        temperatureC: +tempC.toFixed(1),
        rainfallIntensityMmh: hourlyRainfallMmh,
        outputKw: normalOutput,
        degradedOutputKw: degradedOutput,
        dropPct,
        loadMw,
        supplyGapMw: netGapMw,
        backupNeededMw,
        storageSupportHours: 0, // 汇总后计算
      })
    }

    // ========== 4. 汇总指标 ==========
    const totalNormal = timeSeriesData.reduce((s, d) => s + d.outputKw, 0)
    const totalDegraded = timeSeriesData.reduce((s, d) => s + d.degradedOutputKw, 0)
    const overallDropPct = totalNormal > 0
      ? +(((totalNormal - totalDegraded) / totalNormal) * 100).toFixed(2) : 0
    // 供电保障率：极端出力覆盖负荷的时段比例
    const supplyGuaranteeCount = timeSeriesData.filter(d => d.supplyGapMw <= 0).length
    const avgSupplyGuaranteeRate = timeSeriesData.length > 0
      ? +((supplyGuaranteeCount / timeSeriesData.length) * 100).toFixed(2) : 0
    const peakSupplyGapMw = +Math.max(...timeSeriesData.map(d => d.supplyGapMw)).toFixed(2)
    const peakBackupMw = +Math.max(...timeSeriesData.map(d => d.backupNeededMw)).toFixed(2)
    // 总缺电量：所有供需缺口（正值）之和
    const totalEnergyShortfallMwh = +(
      timeSeriesData.reduce((s, d) => s + Math.max(0, d.supplyGapMw), 0)
    ).toFixed(2)
    // 储能支撑时长：基于实际放电量计算
    const totalDischargedMwh = +(totalStorageMwh * 0.8 - socMwh).toFixed(2)
    const storageSupportHours = totalStorageMw > 0 && peakSupplyGapMw > 0
      ? +(totalDischargedMwh / peakSupplyGapMw).toFixed(1)
      : totalStorageMw > 0 ? 99 : 0
    // 回填 storageSupportHours 到时序数据
    for (const d of timeSeriesData) {
      d.storageSupportHours = storageSupportHours
    }

    // ========== 5. 分时段备用配置 ==========
    const backupConfig: BackupConfigSegment[] = []
    const timeBlocks = [
      { label: '00:00-06:00', hours: [0, 1, 2, 3, 4, 5] },
      { label: '06:00-10:00', hours: [6, 7, 8, 9] },
      { label: '10:00-14:00', hours: [10, 11, 12, 13] },
      { label: '14:00-18:00', hours: [14, 15, 16, 17] },
      { label: '18:00-22:00', hours: [18, 19, 20, 21] },
      { label: '22:00-24:00', hours: [22, 23] },
    ]
    for (const block of timeBlocks) {
      const pts = timeSeriesData.filter((_, i) => block.hours.includes(i))
      if (pts.length === 0) continue
      const avgLoad = +(pts.reduce((s, p) => s + p.loadMw, 0) / pts.length).toFixed(2)
      const avgPv = +(pts.reduce((s, p) => s + p.degradedOutputKw, 0) / pts.length).toFixed(2)
      const avgGap = +(pts.reduce((s, p) => s + Math.max(0, p.supplyGapMw), 0) / pts.length).toFixed(2)
      const maxGap = +Math.max(...pts.map(p => Math.max(0, p.supplyGapMw))).toFixed(2)

      let recType: BackupConfigSegment['recommendedType']
      let recDuration: number
      if (avgGap < 1 && maxGap < 2) {
        recType = 'grid_import'; recDuration = 1
      } else if (maxGap > 5 && block.label.includes('10:00')) {
        recType = 'gas_turbine'; recDuration = Math.min(4, block.hours.length)
      } else if (avgLoad > avgPv && block.label.includes('18:00')) {
        recType = 'demand_response'; recDuration = 4
      } else {
        recType = 'storage'; recDuration = Math.min(4, block.hours.length)
      }
      backupConfig.push({
        timeRange: block.label,
        loadMw: avgLoad,
        pvOutputMw: avgPv,
        supplyGapMw: avgGap,
        backupRequiredMw: +(maxGap * 1.15 + avgLoad * 0.05).toFixed(2),
        recommendedType: recType,
        recommendedCapacityMw: +(maxGap * 1.2).toFixed(2),
        recommendedDurationH: recDuration,
      })
    }

    // ========== 6. 报告 ==========
    const stationInfo: ScenarioStationInfo = {
      stationName: station?.station_name || 'Unknown',
      installedCapacityMw: capacityMw,
      gridConnectionVoltageKv: station?.grid_connection_voltage_kv || 0,
      zone: stationZone,
      busName,
      storagePowerMw: +totalStorageMw.toFixed(1),
      storageCapacityMwh: +totalStorageMwh.toFixed(1),
    }

    const scenarioSummary: Record<string, string | number> = {}
    let strategyAnalysis: ScenarioStrategyAnalysis
    let keyFindings: string[]
    let riskLevel: string
    let riskLevelLabel: string

    if (scenarioType === 'high_temperature') {
      scenarioSummary['场景类型'] = '高温极端场景'
      scenarioSummary['最高温度'] = `${maxTemp}℃`
      scenarioSummary['最低温度'] = `${minTemp}℃`
      scenarioSummary['峰值时刻'] = `${String(peakHour).padStart(2, '0')}:00`
      scenarioSummary['高温窗口半宽'] = `${durationHalf}h`
      scenarioSummary['光伏温度系数'] = `${pvTempCoeffPct}%/℃`

      const peakPanelTemp = maxTemp + 28 // 午间辐照最强时面板温度
      const riskStart = peakHour - durationHalf
      const riskEnd = peakHour + durationHalf

      strategyAnalysis = {
        cooling: {
          panelTempEstimate: `午间高峰时段面板工作温度预计达到 ${peakPanelTemp.toFixed(0)}℃（环境${maxTemp}℃ + 辐照温升约28℃），超过25℃标准测试温度 ${(peakPanelTemp - 25).toFixed(0)}℃`,
          inverterRiskPeriods: `${String(riskStart).padStart(2, '0')}:00-${String(riskEnd).padStart(2, '0')}:00 逆变器存在降额风险（面板温度>50℃），降额幅度约 ${(Math.min(0.15, Math.max(0, peakPanelTemp - 50) * 0.005) * 100).toFixed(1)}%`,
          measures: [
            '加强逆变器房通风散热，确保进风口无遮挡',
            '午间高峰时段开启强制风冷或水冷系统',
            '组件表面清洗，减少灰尘热斑效应',
            '检查散热风扇运行状态，备用风扇就位',
            '必要时降低逆变器输出功率至额定80%运行',
          ],
          expectedEffect: `采取主动散热措施后，预计面板工作温度可降低 ${(peakPanelTemp * 0.08).toFixed(1)}~${(peakPanelTemp * 0.12).toFixed(1)}℃，出力损失减少约 ${(pvTempCoeffPct * 3).toFixed(1)}~${(pvTempCoeffPct * 5).toFixed(1)} 个百分点`,
        },
        scheduling: {
          storageStrategy: `高温预警日${String(riskStart).padStart(2, '0')}:00前将储能SOC充至90%以上，${String(riskStart).padStart(2, '0')}:00-${String(riskEnd).padStart(2, '0')}:00 储能放电填补供需缺口，每次放电不超过额定功率${effectiveStorageMw.toFixed(0)}MW`,
          pvLimitAdvice: `建议将光伏出力上限设置在 ${(capacityMw * 0.85).toFixed(0)}MW 以内（额定${capacityMw}MW的85%），避免逆变器因过热保护跳闸`,
          loadShedAdvice: `将可中断负荷调度至 ${String(riskStart).padStart(2, '0')}:00-${String(riskEnd).padStart(2, '0')}:00 高温窗口，预计可削减 ${(capacityMw * 0.08).toFixed(1)}MW 净负荷`,
          maintenanceAdvice: `将设备检修安排在高温预警时段（${String(riskStart).padStart(2, '0')}:00-${String(riskEnd).padStart(2, '0')}:00），减少强迫停运风险`,
        },
      }

      keyFindings = [
        `高温（${maxTemp}℃）导致光伏出力较正常日下降${overallDropPct}%，午间${String(riskStart).padStart(2, '0')}:00-${String(riskEnd).padStart(2, '0')}:00为出力骤降最严重时段`,
        `最大供需缺口${peakSupplyGapMw}MW，供电保障率${avgSupplyGuaranteeRate}%，全天累计缺电${totalEnergyShortfallMwh}MWh，储能可支撑约${storageSupportHours}小时`,
        `峰值备用容量需求${peakBackupMw}MW，推荐${backupConfig.find(b => b.recommendedType === 'gas_turbine') ? '储能+' + backupConfig.find(b => b.recommendedType === 'gas_turbine')!.recommendedCapacityMw.toFixed(1) + 'MW燃气轮机组合' : '储能系统为主'}`,
      ]

      riskLevel = peakSupplyGapMw > 10 || overallDropPct > 20 ? 'high'
        : peakSupplyGapMw > 5 || overallDropPct > 10 ? 'medium' : 'low'
      riskLevelLabel = { high: '高风险', medium: '中风险', low: '低风险' }[riskLevel] || '中风险'
    } else {
      scenarioSummary['场景类型'] = '暴雨极端场景'
      scenarioSummary['降雨强度'] = `${rainfallMmh}mm/h`
      scenarioSummary['云层覆盖率'] = `${(cloudCoverRatio * 100).toFixed(0)}%`
      scenarioSummary['持续时长'] = `${rainDurationH}h`
      scenarioSummary['暴雨中心时刻'] = `${String(rainPeakHour).padStart(2, '0')}:00`

      const rainStart = rainPeakHour - rainDurationH / 2
      const rainEnd = rainPeakHour + rainDurationH / 2

      strategyAnalysis = {
        protection: {
          waterproofAssessment: `降雨强度${rainfallMmh}mm/h属${rainfallMmh >= 25 ? '大暴雨' : rainfallMmh >= 10 ? '暴雨' : '大雨'}级别，${rainfallMmh >= 25 ? '需重点关注配电柜、电缆沟防水' : '需加强排水巡查'}`,
          lineProtectionAdvice: `建议调整线路零序保护定值，漏电保护灵敏度提高至${rainfallMmh >= 25 ? '0.3s' : '0.5s'}切除，防止单相接地扩大为相间短路`,
          drainageAdvice: '检查场区排水沟渠畅通，备用排水泵就位，电缆沟积水实时监测',
          emergencySupplies: ['防水沙袋（配电室门口）', '应急照明灯（≥48h续航）', '柴油发电机燃料（≥48h）', '绝缘垫及防水胶带', '潜水泵（备用2台）'],
        },
        scheduling: {
          storageStrategy: `暴雨来临前将储能SOC充至95%，预留${(totalStorageMwh * 0.3).toFixed(1)}MWh应急备用电量，暴雨期间储能切换至应急备用模式`,
          pvLimitAdvice: `暴雨期间光伏出力降至额定${((1 - cloudCoverRatio) * 100).toFixed(0)}%以下，逆变器切换至低压穿越模式`,
          loadShedAdvice: `暴雨前将敏感负荷切换至非受灾区域，预计可转移${(capacityMw * 0.15).toFixed(1)}MW负荷`,
          maintenanceAdvice: '暴雨预警解除后全面检查设备绝缘，确认无积水方可恢复正常运行',
        },
      }

      keyFindings = [
        `暴雨（${rainfallMmh}mm/h，持续${rainDurationH}h）导致光伏出力较正常日下降${overallDropPct}%，${String(Math.floor(rainStart)).padStart(2, '0')}:00-${String(Math.ceil(rainEnd)).padStart(2, '0')}:00为影响最严重时段`,
        `最大供需缺口${peakSupplyGapMw}MW，供电保障率${avgSupplyGuaranteeRate}%，全天累计缺电${totalEnergyShortfallMwh}MWh，储能可支撑约${storageSupportHours}小时`,
        `峰值备用容量需求${peakBackupMw}MW，建议配置${(peakBackupMw * 1.2).toFixed(1)}MW储能应急备用`,
      ]

      riskLevel = rainfallMmh >= 25 || cloudCoverRatio >= 0.9 ? 'high'
        : rainfallMmh >= 10 || cloudCoverRatio >= 0.7 ? 'medium' : 'low'
      riskLevelLabel = { high: '高风险', medium: '中风险', low: '低风险' }[riskLevel] || '中风险'
    }

    const conclusion: ScenarioConclusion = {
      keyFindings,
      quantitativeMetrics: {
        totalEnergyShortfallMwh,
        peakBackupRequiredMw: peakBackupMw,
        avgSupplyGuaranteeRate,
        maxSupplyGapMw: peakSupplyGapMw,
      },
      backupRecommendation: peakBackupMw > 2
        ? `建议配置${(peakBackupMw * 1.2).toFixed(1)}MW备用电源（储能${(totalStorageMwh / 4).toFixed(1)}MWh + 燃气轮机${(peakSupplyGapMw * 1.2).toFixed(1)}MW组合），保障极端场景下供电可靠性`
        : `当前系统备用充足，建议维持${totalStorageMwh.toFixed(1)}MWh储能配置，加强日常运维即可`,
      riskLevel,
      riskLevelLabel,
    }

    // ========== 数据分析 ==========
    const peakDropPoint = timeSeriesData.reduce((a, b) => b.dropPct > a.dropPct ? b : a)
    const maxGapPoint = timeSeriesData.reduce((a, b) => b.supplyGapMw > a.supplyGapMw ? b : a)
    const minRatePoint = timeSeriesData.reduce((a, b) => b.supplyGapMw < a.supplyGapMw ? b : a)
    const maxTempPoint = timeSeriesData.reduce((a, b) => b.temperatureC > a.temperatureC ? b : a)
    const maxBackupPoint = timeSeriesData.reduce((a, b) => b.backupNeededMw > a.backupNeededMw ? b : a)
    const gapStart = timeSeriesData.findIndex(d => d.supplyGapMw > 1)
    const gapEnd = timeSeriesData.length - 1 - [...timeSeriesData].reverse().findIndex(d => d.supplyGapMw > 1)
    const gapPeriod = gapStart >= 0 && gapEnd > gapStart
      ? `${timeSeriesData[gapStart].time}-${timeSeriesData[gapEnd].time}` : '无供需缺口'

    const dataAnalysis: ScenarioDataAnalysis = {
      outputDrop: {
        overallDropPct,
        peakDropHour: peakDropPoint.time,
        peakDropPct: peakDropPoint.dropPct,
        worstPeriod: `${[timeSeriesData[6], timeSeriesData[7], timeSeriesData[12], timeSeriesData[13]]
          .sort((a, b) => b.dropPct - a.dropPct)[0].time} 前后`,
      },
      supplyGuarantee: {
        avgRate: avgSupplyGuaranteeRate,
        minRate: minRatePoint.supplyGapMw > 0 ? 0 : 100,
        minRateHour: minRatePoint.time,
      },
      supplyGap: {
        maxGapMw: peakSupplyGapMw,
        maxGapHour: maxGapPoint.time,
        totalShortfallMwh: totalEnergyShortfallMwh,
        gapPeriod,
      },
      ...(scenarioType === 'high_temperature' ? {
        temperature: {
          maxTempC: maxTempPoint.temperatureC,
          maxTempHour: maxTempPoint.time,
          peakPanelTempC: +(maxTempPoint.temperatureC + 28).toFixed(1),
          highTempWindow: `${String(peakHour - durationHalf).padStart(2, '0')}:00-${String(peakHour + durationHalf).padStart(2, '0')}:00`,
        },
      } : {
        rainstorm: {
          maxIntensityMmh: rainfallMmh,
          cloudCoverPct: +(cloudCoverRatio * 100).toFixed(0),
          affectedHours: rainDurationH,
          worstPeriod: `${String(rainPeakHour - rainDurationH / 2 | 0).padStart(2, '0')}:00-${String(rainPeakHour + rainDurationH / 2 | 0).padStart(2, '0')}:00`,
        },
      }),
      backup: {
        peakRequiredMw: peakBackupMw,
        peakRequiredHour: maxBackupPoint.time,
        recommendedType: scenarioType === 'high_temperature'
          ? (peakSupplyGapMw > 5 ? '燃气轮机+储能' : '储能系统')
          : '储能应急备用',
        recommendedCapacityMw: +(peakBackupMw * 1.2).toFixed(1),
      },
    }

    const report: ScenarioReport = {
      stationInfo,
      scenarioParams: scenarioSummary,
      dataAnalysis,
      strategyAnalysis,
      conclusion,
    }

    return {
      scenarioType,
      stationInfo,
      outputDropPct: overallDropPct,
      avgSupplyGuaranteeRate,
      peakSupplyGapMw,
      peakBackupRequiredMw: peakBackupMw,
      totalEnergyShortfallMwh,
      backupCapacityRequired: peakBackupMw,
      timeSeriesData,
      backupConfig,
      report,
    }
  }

  // ==================== Carbon Stats ====================
  async getCarbonStats(query: {
    stationId?: string
    zone?: string
    startDate: string
    endDate: string
    groupBy?: 'station' | 'zone'
  }) {
    const { stationId, zone, startDate, endDate, groupBy = 'station' } = query

    if (groupBy === 'zone') {
      const rows = await db('carbon_emissions as ce')
        .join('solar_pv_stations as spv', 'spv.plant_id', 'ce.plant_id')
        .join('grid_buses as gb', 'gb.id', 'spv.bus_id')
        .whereBetween('ce.period_start', [startDate, endDate])
        .modify((qb) => {
          if (zone) qb.where('gb.zone', zone)
        })
        .select(
          'gb.zone as groupKey',
          db.raw('SUM(ce.total_output_kwh) as totalOutputKwh'),
          db.raw('SUM(ce.co2_reduction_kg) as co2ReductionKg'),
          db.raw('SUM(ce.coal_saving_ton) as coalSavingTon'),
          db.raw('SUM(ce.so2_reduction_kg) as so2ReductionKg'),
          db.raw('SUM(ce.nox_reduction_kg) as noxReductionKg'),
          db.raw('COUNT(DISTINCT ce.plant_id) as stationCount'),
        )
        .groupBy('gb.zone')
        .orderBy('co2ReductionKg', 'desc')

      return rows.map((r: any) => ({
        ...r,
        co2PerMwh: r.totalOutputKwh > 0 ? +(r.co2ReductionKg / (r.totalOutputKwh / 1000)).toFixed(2) : 0,
      }))
    }

    // 按电站：聚合多个月份数据
    const rows = await db('carbon_emissions as ce')
      .join('solar_pv_stations as spv', 'spv.plant_id', 'ce.plant_id')
      .join('grid_buses as gb', 'gb.id', 'spv.bus_id')
      .whereBetween('ce.period_start', [startDate, endDate])
      .modify((qb) => {
        if (stationId) qb.where('spv.id', stationId)
        if (zone) qb.where('gb.zone', zone)
      })
      .select(
        'spv.id as stationId',
        'spv.station_name as stationName',
        'gb.zone',
        'gb.voltage_level as voltageLevel',
        db.raw('SUM(ce.total_output_kwh) as totalOutputKwh'),
        db.raw('SUM(ce.co2_reduction_kg) as co2ReductionKg'),
        db.raw('SUM(ce.coal_saving_ton) as coalSavingTon'),
        db.raw('SUM(ce.so2_reduction_kg) as so2ReductionKg'),
        db.raw('SUM(ce.nox_reduction_kg) as noxReductionKg'),
      )
      .groupBy('spv.id')
      .orderBy('co2ReductionKg', 'desc')

    return rows.map((r: any) => ({
      ...r,
      co2PerMwh: r.totalOutputKwh > 0 ? +(r.co2ReductionKg / (r.totalOutputKwh / 1000)).toFixed(2) : 0,
    }))
  }

  // ==================== Carbon Dynamic ====================
  async getCarbonDynamic(query: {
    stationId: string; startDate: string; endDate: string; granularity?: 'hour' | 'day'
  }) {
    const { stationId, startDate, endDate, granularity = 'day' } = query
    const co2PerKwh = 0.85; const coalPerKwh = 0.32
    let timeSeries: { time: string; outputKwh: number; co2ReductionKg: number; coalSavingKg: number; thermalCo2Kg: number }[] = []

    // 查询电站容量用于负荷估算
    const st = await db('solar_pv_stations').where('id', stationId).select('bus_id', 'installed_capacity_mw', 'station_name').first()
    const busId = (st as any)?.bus_id
    const capMw: number = (st as any)?.installed_capacity_mw || 50
    // 日负荷标幺曲线 + 峰值负荷（按电站容量1.5倍估算，光伏渗透率约67%）
    const lc = [0.45,0.40,0.38,0.35,0.38,0.50,0.65,0.78,0.88,0.92,0.95,0.92,0.88,0.90,0.92,0.95,0.98,1.0,0.95,0.88,0.78,0.65,0.55,0.48]
    const peakLoadMw = capMw * 1.5

    if (granularity === 'hour') {
      // 直接从逐小时种子数据查询光伏出力
      const pvRows = await db('pv_output_measurements')
        .where('station_id', stationId).whereBetween('time', [startDate, endDate])
        .select(db.raw("strftime('%Y-%m-%dT%H:00', time) as hour"), db.raw('AVG(active_power_kw) as avgPvKw'))
        .groupBy('hour').orderBy('hour', 'asc')

      // 查询负荷数据（优先使用实测，否则按电站容量估算）
      const loadRows = busId ? await db('load_measurements')
        .where('bus_id', busId).whereBetween('time', [startDate, endDate])
        .select(db.raw("strftime('%Y-%m-%dT%H:00', time) as hour"), 'active_power_mw')
        .orderBy('time', 'asc') : []
      const loadMap = new Map((loadRows as any[]).map((r: any) => [r.hour, r.active_power_mw || 0]))

      for (const pr of pvRows as any[]) {
        const pvKwh = +pr.avgPvKw.toFixed(2)
        const pvMw = +(pvKwh / 1000).toFixed(2)
        let loadMw = loadMap.get(pr.hour) || 0
        if (!loadMap.size) {
          loadMw = +(lc[parseInt(pr.hour.slice(11,13)) || 0] * peakLoadMw).toFixed(2)
        }
        const thermalMw = Math.max(0, loadMw - pvMw)
        const thermalCo2 = +(thermalMw * 1000 * co2PerKwh).toFixed(2)
        const pvCo2 = +(pvKwh * co2PerKwh).toFixed(2)
        timeSeries.push({ time: pr.hour, outputKwh: pvKwh, co2ReductionKg: pvCo2, coalSavingKg: +(pvKwh * coalPerKwh).toFixed(2), thermalCo2Kg: thermalCo2 })
      }
    } else {
      // 日模式：基于电站容量估算日负荷（日均负荷 × 24h），然后扣除光伏出力得火电部分
      const rows = await db('pv_output_measurements')
        .where('station_id', stationId).whereBetween('time', [startDate, endDate])
        .select(db.raw("strftime('%Y-%m-%d', time) as period"), db.raw('SUM(active_power_kw * 1) as outputKwh'))
        .groupBy('period').orderBy('period', 'asc')
      // 日均负荷 ≈ 峰值负荷 × 日负荷率(0.72) × 24h
      const avgDailyLoadKwh = peakLoadMw * 1000 * 0.72 * 24
      timeSeries = (rows as any[]).map((r: any) => {
        const pvKwh = +r.outputKwh.toFixed(2)
        const thermalKwh = Math.max(0, avgDailyLoadKwh - pvKwh)
        return {
          time: r.period,
          outputKwh: pvKwh,
          co2ReductionKg: +(pvKwh * co2PerKwh).toFixed(2),
          coalSavingKg: +(pvKwh * coalPerKwh).toFixed(2),
          thermalCo2Kg: +(thermalKwh * co2PerKwh).toFixed(2),
        }
      })
    }

    const totalOutputKwh = +timeSeries.reduce((s: any, d: any) => s + d.outputKwh, 0).toFixed(2)
    const totalCo2ReductionKg = +timeSeries.reduce((s: any, d: any) => s + d.co2ReductionKg, 0).toFixed(2)
    const totalCoalSavingKg = +timeSeries.reduce((s: any, d: any) => s + d.coalSavingKg, 0).toFixed(2)
    const stationName = (st as any)?.station_name || ''
    return { stationId, stationName, granularity, totalOutputKwh, co2ReductionKg: totalCo2ReductionKg, coalSavingTon: +(totalCoalSavingKg / 1000).toFixed(2), timeSeries, thermalFactor: { co2PerKwh, coalPerKwh, equivalentTrees: +(totalCo2ReductionKg * 0.05).toFixed(0) } }
  }

  // ==================== Joint Output Analysis ====================
  async getJointOutputAnalysis(query: {
    stationId: string
    storageId: string
    startDate: string
    endDate: string
  }) {
    const { stationId, storageId, startDate, endDate } = query

    // 直接从逐小时种子数据查询光伏出力
    const pvRows = await db('pv_output_measurements')
      .where('station_id', stationId)
      .whereBetween('time', [startDate, endDate])
      .select(db.raw("strftime('%Y-%m-%dT%H:00', time) as hour"), db.raw('AVG(active_power_kw) as pvKw'))
      .groupBy('hour').orderBy('hour', 'asc')

    // 自动匹配储能：优先同bus的storage_entities，否则按光伏容量20%配默认储能
    let ratedPowerKw = 500; let ratedCapacityKwh = 2000
    let storageName = '默认储能'
    const st = await db('solar_pv_stations').where('id', stationId).select('bus_id', 'installed_capacity_mw').first()
    if (storageId) {
      const storage = await db('storage_entities').where('id', storageId).first()
      if (storage) { ratedPowerKw = storage.rated_power_kw; ratedCapacityKwh = storage.rated_capacity_kwh; storageName = storage.name }
    } else if (st) {
      const busStorage = await db('storage_entities').where('bus_id', (st as any).bus_id).first()
      if (busStorage) { ratedPowerKw = busStorage.rated_power_kw; ratedCapacityKwh = busStorage.rated_capacity_kwh; storageName = busStorage.name }
      else {
        const capMw = (st as any).installed_capacity_mw
        // 杭州政策：集中式光伏配储≥10%装机容量，时长2h
        ratedPowerKw = Math.round(capMw * 1000 * 0.1)
        ratedCapacityKwh = Math.round(ratedPowerKw * 2)
        storageName = '默认储能(' + capMw + 'MW光伏配套)'
      }
    }

    const hourlyPv = (pvRows as any[]).map((r: any) => ({
      time: r.hour, pvOutputKw: +r.pvKw.toFixed(2),
    }))

    // 获取负荷曲线（用于智能充放电策略）
    // 负荷种子已统一使用本地时间（无时区），与PV数据strftime结果一致
    const busId = (st as any)?.bus_id
    const loadRows = busId ? await db('load_measurements')
      .where('bus_id', busId).whereBetween('time', [startDate, endDate])
      .select(db.raw("strftime('%Y-%m-%dT%H:00', time) as hour"), db.raw('AVG(active_power_mw) as avg_load_mw'))
      .groupBy('hour').orderBy('hour', 'asc') : []
    const loadMap = new Map((loadRows as any[]).map((r: any) => [r.hour, (r.avg_load_mw || 0) * 1000]))

    // 联合出力目标：跟随负荷曲线，保持稳定接近用户负荷
    // 光伏超出负荷 → 多余部分储能充电；光伏低于负荷 → 储能放电补充缺口
    const hourlyPvWithLoad = hourlyPv.map((d) => {
      const loadKw = loadMap.get(d.time) // 该时刻负荷(kW)
      return { ...d, loadKw }
    })
    // 有负荷数据的时刻用实际负荷，无负荷数据的时刻用光伏均值作为参考负荷
    const validLoads = hourlyPvWithLoad.filter((d) => d.loadKw != null).map((d) => d.loadKw!)
    const avgLoad = validLoads.length > 0
      ? validLoads.reduce((s, v) => s + v, 0) / validLoads.length
      : hourlyPv.reduce((s, d) => s + d.pvOutputKw, 0) / hourlyPv.length

    // 模拟一天的充放电循环（返回时序+终了SOC）
    function simulateDay(initSocKwh: number) {
      let soc = initSocKwh
      const ts = hourlyPvWithLoad.map((d) => {
        const targetLoadKw = d.loadKw != null ? d.loadKw : avgLoad
        let chargeKw = 0; let dischargeKw = 0
        const surplus = d.pvOutputKw - targetLoadKw

        if (surplus > 0 && soc < ratedCapacityKwh * 0.98) {
          chargeKw = Math.min(surplus, ratedPowerKw, (ratedCapacityKwh - soc))
          soc += chargeKw * 0.95 // 充电效率95%
        } else if (surplus < 0 && soc > ratedCapacityKwh * 0.02) {
          const deficit = -surplus
          dischargeKw = Math.min(deficit, ratedPowerKw, soc)
          soc -= dischargeKw
        }

        return {
          time: d.time,
          pvOutputKw: d.pvOutputKw,
          storageChargeKw: +chargeKw.toFixed(2),
          storageDischargeKw: +dischargeKw.toFixed(2),
          jointOutputKw: +(d.pvOutputKw + dischargeKw - chargeKw).toFixed(2),
          socKwh: +soc.toFixed(2),
        }
      })
      return { timeSeries: ts, endSoc: soc }
    }

    // 两遍模拟：第一遍SOC=0跑出白天充电→跨夜剩余电量，第二遍用跨夜SOC作为初始值
    const firstPass = simulateDay(0)
    const timeSeries = simulateDay(firstPass.endSoc).timeSeries

    // 计算指标
    const pvValues = timeSeries.map((d) => d.pvOutputKw)
    const jointValues = timeSeries.map((d) => d.jointOutputKw)
    const pvStdDev = this.stdDev(pvValues)
    const jointStdDev = this.stdDev(jointValues)
    const pvPeakValley = Math.max(...pvValues) - Math.min(...pvValues)
    const jointPeakValley = Math.max(...jointValues) - Math.min(...jointValues)
    const peakShavingCapacityKw = +(ratedPowerKw).toFixed(2)

    return {
      stationId,
      storageId,
      storageName: storageName,
      ratedPowerKw,
      ratedCapacityKwh,
      timeSeries,
      pvFluctuationStdDev: +pvStdDev.toFixed(2),
      jointFluctuationStdDev: +jointStdDev.toFixed(2),
      fluctuationImprovementPct: pvStdDev > 0 ? +(((pvStdDev - jointStdDev) / pvStdDev) * 100).toFixed(2) : 0,
      pvPeakValleyDiff: +pvPeakValley.toFixed(2),
      jointPeakValleyDiff: +jointPeakValley.toFixed(2),
      peakValleyImprovementPct: pvPeakValley > 0 ? +(((pvPeakValley - jointPeakValley) / pvPeakValley) * 100).toFixed(2) : 0,
      peakShavingCapacityKw,
    }
  }

  // ==================== Backfeed ====================
  async detectBackfeed(params: { plantId: string; threshold?: number }) {
    const data = await db('pv_output_measurements')
      .where('station_id', params.plantId)
      .select('time', 'active_power_kw', 'reactive_power_kvar')
      .orderBy('time', 'desc')
      .limit(1000)

    return data.map((d) => ({
      time: d.time,
      activePowerKw: d.active_power_kw,
      reactivePowerKvar: d.reactive_power_kvar ?? 0,
      apparentPowerKva: Math.sqrt(d.active_power_kw ** 2 + (d.reactive_power_kvar ?? 0) ** 2),
      direction: d.active_power_kw < 0 ? 'reverse' : 'forward',
      isBackfeed: d.active_power_kw < -(params.threshold || 0),
    }))
  }

  // ==================== Equipment ====================
  async calculateCapacity(query: { equipmentType?: string; stationId?: string }) {
    const qb = db('equipment')
      .leftJoin('solar_pv_stations', 'equipment.station_id', 'solar_pv_stations.id')
      .modify((q) => {
        if (query.equipmentType) q.where('equipment.equipment_type', query.equipmentType)
        if (query.stationId) q.where('equipment.station_id', query.stationId)
      })
    const rows = await qb.select(
      'equipment.id as equipmentId',
      'equipment.name as equipmentName',
      'equipment.equipment_type as equipmentType',
      'equipment.model_number as modelNumber',
      'equipment.manufacturer',
      'equipment.rated_capacity_kva as ratedCapacityKva',
      'equipment.rated_voltage_kv as ratedVoltageKv',
      'equipment.rated_current_a as ratedCurrentA',
      'equipment.installation_date as installationDate',
      'equipment.design_life_years as designLifeYears',
      'equipment.grade',
      'equipment.status',
      'equipment.station_id as stationId',
      'solar_pv_stations.station_name as stationName',
      'solar_pv_stations.installed_capacity_mw as stationCapacityMw',
      'solar_pv_stations.grid_connection_voltage_kv as gridVoltageKv',
    )

    // 批量查询各电站近90天实际运行峰值功率
    const stationIds = [...new Set(rows.map((r: any) => r.stationId).filter(Boolean))] as string[]
    const stationPeakKw: Record<string, number> = {}
    if (stationIds.length > 0) {
      const peakRows = await db('pv_output_measurements')
        .whereIn('station_id', stationIds)
        .groupBy('station_id')
        .select('station_id')
        .max('active_power_kw as maxKw')
      for (const pr of peakRows as any[]) {
        if (pr.station_id && pr.maxKw != null) {
          stationPeakKw[pr.station_id] = pr.maxKw
        }
      }
    }

    const pf = 0.95 // 功率因数，与种子数据线电流计算保持一致

    return rows.map((r: any) => {
      const ratedVoltageKv = r.ratedVoltageKv || r.gridVoltageKv || 10
      const ratedCapacityKva = r.ratedCapacityKva || 0
      const ratedCurrentA = r.ratedCurrentA || (ratedVoltageKv > 0 ? (ratedCapacityKva * 1000) / (Math.sqrt(3) * ratedVoltageKv) : 0)

      // 估算短路电流（简化计算：额定电流 / 阻抗标幺值，默认阻抗5%）
      const impedancePu = 0.05
      const shortCircuitCurrentA = ratedCurrentA / impedancePu

      // 穿越电流（取短路电流的60%作为穿越电流估算值）
      const throughCurrentA = shortCircuitCurrentA * 0.6

      // 负载率：基于实际运行峰值功率计算
      const stationId = r.stationId as string
      const peakKw = stationPeakKw[stationId] || 0
      let loadRate: number
      if (peakKw > 0) {
        // 有实际运行数据：用峰值功率折算实际电流/视在功率
        if (['BREAKER', 'CABLE', 'SWITCH'].includes(r.equipmentType)) {
          // 断路器/电缆/开关设备：实际运行电流 / 额定电流
          const actualCurrentA = ratedVoltageKv > 0 ? peakKw / (Math.sqrt(3) * ratedVoltageKv * pf) : 0
          loadRate = ratedCurrentA > 0 ? actualCurrentA / ratedCurrentA : 0
        } else {
          // 变压器/逆变器/储能：实际视在功率 / 额定容量
          const peakKva = peakKw / pf
          loadRate = ratedCapacityKva > 0 ? peakKva / ratedCapacityKva : 0
        }
      } else {
        // 无运行数据时回退用装机容量估算
        const stationMw = r.stationCapacityMw || 0
        const fallbackKw = stationMw * 1000
        if (['BREAKER', 'CABLE', 'SWITCH'].includes(r.equipmentType)) {
          const fallbackCurrentA = ratedVoltageKv > 0 ? fallbackKw / (Math.sqrt(3) * ratedVoltageKv * pf) : 0
          loadRate = ratedCurrentA > 0 ? fallbackCurrentA / ratedCurrentA : 0
        } else {
          const fallbackKva = fallbackKw / pf
          loadRate = ratedCapacityKva > 0 ? fallbackKva / ratedCapacityKva : 0
        }
      }

      // 过载判断
      const isOverloaded = loadRate > 0.8

      // 风险等级
      let riskLevel = 'normal'
      if (loadRate > 1.0) riskLevel = 'critical'
      else if (loadRate > 0.8) riskLevel = 'warning'

      // 设备类型特定评估
      const assessment: any = {}
      switch (r.equipmentType) {
        case 'TRANSFORMER': {
          assessment.shortCircuitCurrentKa = +(shortCircuitCurrentA / 1000).toFixed(2)
          assessment.throughCurrentKa = +(throughCurrentA / 1000).toFixed(2)
          assessment.thermalLimitKva = +(ratedCapacityKva * 1.3).toFixed(0)
          assessment.capacityMarginPct = +((1 - loadRate) * 100).toFixed(1)
          break
        }
        case 'BREAKER': {
          const breakingScores: Record<string, number> = { A: 63, B: 40, C: 25, D: 16 }
          assessment.ratedBreakingKa = breakingScores[r.grade] || 40
          assessment.actualShortCircuitKa = +(shortCircuitCurrentA / 1000).toFixed(2)
          assessment.breakingMargin = assessment.ratedBreakingKa - assessment.actualShortCircuitKa
          assessment.isInsufficient = assessment.breakingMargin < 0
          break
        }
        case 'CABLE': {
          assessment.ratedAmpacityA = ratedCurrentA || 400
          assessment.actualLoadA = +(loadRate * (ratedCurrentA || 400)).toFixed(1)
          assessment.thermalEffectA2s = +((assessment.actualLoadA ** 2) * 1).toFixed(0)
          assessment.isOverload = loadRate > 0.9
          assessment.temperatureMarginC = +(90 * (1 - loadRate)).toFixed(1)
          break
        }
        case 'SWITCH': {
          assessment.ratedThroughCurrentA = ratedCurrentA
          assessment.actualThroughCurrentA = throughCurrentA
          assessment.currentMarginPct = ratedCurrentA > 0 ? +((1 - throughCurrentA / ratedCurrentA) * 100).toFixed(1) : 0
          assessment.isInsufficient = throughCurrentA > ratedCurrentA
          break
        }
        default:
          break
      }

      return {
        equipmentId: r.equipmentId,
        equipmentName: r.equipmentName || r.modelNumber || r.equipmentId,
        equipmentType: r.equipmentType,
        modelNumber: r.modelNumber,
        manufacturer: r.manufacturer,
        ratedCapacityKva,
        ratedVoltageKv,
        ratedCurrentA: +ratedCurrentA.toFixed(1),
        installationDate: r.installationDate,
        designLifeYears: r.designLifeYears,
        grade: r.grade || 'B',
        status: r.status,
        stationId: r.stationId,
        stationName: r.stationName,
        stationCapacityMw: r.stationCapacityMw,
        shortCircuitCurrentA: +shortCircuitCurrentA.toFixed(1),
        throughCurrentA: +throughCurrentA.toFixed(1),
        loadRate: +loadRate.toFixed(3),
        isOverloaded,
        riskLevel,
        assessment,
      }
    })
  }

  async assessReliability(equipmentId: string) {
    const equipment = await db('equipment').where('id', equipmentId).first()
    if (!equipment) throw new Error('Equipment not found')

    const failures = await db('equipment_lifecycle')
      .where('equipment_id', equipmentId)
      .where('event_type', 'FAULT')
      .count('* as count')
      .first()

    const failureCount = Number(failures?.count || 0)
    const operatingDays = Math.max(1, (Date.now() - new Date(equipment.installation_date).getTime()) / 86400000)
    const failureRate = failureCount / operatingDays
    const reliability = Math.exp(-failureRate * 365)

    let grade: string
    if (reliability >= 0.999) grade = 'A'
    else if (reliability >= 0.99) grade = 'B'
    else grade = 'C'

    return { equipmentId, reliability, failureRate, grade }
  }

  /** 获取指定小时设备级功率（按额定容量比例分配） */
  async getEquipmentPower(stationId: string, hourTime: string) {
    // 获取该电站所有运行中设备
    const equipment = await db('equipment')
      .where('station_id', stationId)
      .where('status', 'operational')
      .select('id', 'name', 'equipment_type', 'rated_capacity_kva')
    if (!equipment.length) return { time: hourTime, stationActivePowerKw: 0, stationReactivePowerKvar: 0, totalRatedCapacityKva: 0, items: [] }

    // 该小时的电站级功率（取该小时内的平均值）
    const hourStart = hourTime.includes('T') ? hourTime : `${hourTime}T00:00:00`
    const hourEnd = hourTime.includes('T') ? hourTime.replace(/:\d{2}:\d{2}$/, ':59:59') : `${hourTime}T23:59:59`
    const m = await db('pv_output_measurements')
      .where('station_id', stationId)
      .where('time', '>=', hourStart)
      .where('time', '<=', hourEnd)
      .avg('active_power_kw as avgP')
      .avg('reactive_power_kvar as avgQ')
      .first() as { avgP: number | null; avgQ: number | null } | undefined
    const stationActiveKw = m?.avgP ?? 0
    const stationReactiveKvar = m?.avgQ ?? 0

    // 按额定容量比例分配
    const totalCapacity = equipment.reduce((s, e) => s + (e.rated_capacity_kva || 0), 0)
    const items = equipment.map((eq) => {
      const ratio = totalCapacity > 0 ? (eq.rated_capacity_kva || 0) / totalCapacity : 0
      // 非功率型设备（电缆、开关、断路器）不分配功率
      const isPowerBearing = ['TRANSFORMER', 'INVERTER', 'BATTERY'].includes(eq.equipment_type)
      const p = isPowerBearing ? +(stationActiveKw * ratio).toFixed(2) : null
      const q = isPowerBearing ? +(stationReactiveKvar * ratio).toFixed(2) : null
      const s = p != null && q != null ? +Math.sqrt(p * p + q * q).toFixed(2) : null
      return {
        equipmentId: eq.id,
        equipmentName: eq.name || eq.id,
        equipmentType: eq.equipment_type,
        ratedCapacityKva: eq.rated_capacity_kva || 0,
        activePowerKw: p,
        reactivePowerKvar: q,
        apparentPowerKva: s,
      }
    })
    return { time: hourTime, stationActivePowerKw: stationActiveKw, stationReactivePowerKvar: stationReactiveKvar, totalRatedCapacityKva: totalCapacity, items }
  }

  /** 获取某电站有功率数据的小时列表 */
  async getAvailableHours(stationId: string) {
    const rows = await db('pv_output_measurements')
      .where('station_id', stationId)
      .select(db.raw("DISTINCT strftime('%Y-%m-%dT%H', time) as hour"))
      .orderBy('hour', 'desc')
      .limit(168) // 最近7天
    return (rows as any[]).map(r => r.hour + ':00:00')
  }

  async getLifecycle(equipmentId: string) {
    return db('equipment_lifecycle')
      .where('equipment_id', equipmentId)
      .orderBy('event_date', 'desc')
  }

  async predictLife(params: { equipmentId: string }) {
    const equipment = await db('equipment').where('id', params.equipmentId).first()
    if (!equipment) throw new Error('Equipment not found')

    const installDate = new Date(equipment.installation_date)
    const ageYears = (Date.now() - installDate.getTime()) / (365.25 * 86400000)
    const calendarLifeYears = Math.max(0, equipment.design_life_years - ageYears)

    const cycleRecords = await db('battery_cycle_records')
      .where('equipment_id', params.equipmentId)
      .orderBy('record_month', 'asc')

    if (!cycleRecords.length) {
      return {
        equipmentId: params.equipmentId,
        currentAgeYears: +ageYears.toFixed(1),
        designLifeYears: equipment.design_life_years,
        remainingLifeYears: +calendarLifeYears.toFixed(1),
        degradationRate: +(ageYears / equipment.design_life_years).toFixed(3),
        isBattery: false,
      }
    }

    const latest = cycleRecords[cycleRecords.length - 1]
    const sohPct = latest.soh_pct
    const cumulativeCycles = latest.cumulative_cycles
    const cumulativeEnergyMwh = latest.cumulative_energy_mwh

    const recentRecords = cycleRecords.slice(-6)
    const degradationRates: number[] = []
    for (let i = 1; i < recentRecords.length; i++) {
      const sohDiff = recentRecords[i - 1].soh_pct - recentRecords[i].soh_pct
      degradationRates.push(sohDiff)
    }
    const avgMonthlyDegradation = degradationRates.length > 0
      ? degradationRates.reduce((a, b) => a + b, 0) / degradationRates.length
      : 0.15

    const failureSoh = 80
    const sohRemaining = Math.max(0, sohPct - failureSoh)
    const estimatedRemainingMonths = avgMonthlyDegradation > 0 ? sohRemaining / avgMonthlyDegradation : 60
    const estimatedRemainingYears = estimatedRemainingMonths / 12

    const recentMonthlyCycles = recentRecords.map((r) => r.cycle_count)
    const avgMonthlyCycles = recentMonthlyCycles.reduce((a, b) => a + b, 0) / recentMonthlyCycles.length
    const estimatedRemainingCycles = Math.round(avgMonthlyCycles * estimatedRemainingMonths)

    const avgDod = +(recentRecords.reduce((a, r) => a + r.avg_dod_pct, 0) / recentRecords.length).toFixed(1)
    const avgTemp = +(recentRecords.reduce((a, r) => a + r.avg_temp_c, 0) / recentRecords.length).toFixed(1)

    const replacementDate = new Date()
    replacementDate.setMonth(replacementDate.getMonth() + Math.round(estimatedRemainingMonths))

    return {
      equipmentId: params.equipmentId,
      currentAgeYears: +ageYears.toFixed(1),
      designLifeYears: equipment.design_life_years,
      remainingLifeYears: +Math.min(calendarLifeYears, estimatedRemainingYears).toFixed(1),
      degradationRate: +avgMonthlyDegradation.toFixed(3),
      isBattery: true,
      sohPct: +sohPct.toFixed(1),
      failureThresholdPct: failureSoh,
      cumulativeCycles,
      cumulativeEnergyMwh: +cumulativeEnergyMwh.toFixed(1),
      avgMonthlyCycles: Math.round(avgMonthlyCycles),
      estimatedRemainingCycles,
      estimatedRemainingMonths: Math.round(estimatedRemainingMonths),
      avgDodPct: avgDod,
      avgTempC: avgTemp,
      replacementDate: replacementDate.toISOString().split('T')[0],
      monthlyHistory: cycleRecords.slice(-12).map((r) => ({
        month: r.record_month,
        cycleCount: r.cycle_count,
        avgDodPct: r.avg_dod_pct,
        avgTempC: r.avg_temp_c,
        sohPct: r.soh_pct,
        cumulativeCycles: r.cumulative_cycles,
      })),
    }
  }

  async generateReplacementPlan(params: { plantId?: string }) {
    // 所有设备类型（排除逆变器）基于剩余寿命 + 重要性等级生成更换计划
    let query = db('equipment')
      .whereNot('equipment_type', 'INVERTER')
      .whereNot('equipment_type', 'BATTERY') // 电池单独处理
      .select('id', 'name', 'equipment_type', 'model_number', 'station_id', 'rated_capacity_kva', 'rated_voltage_kv', 'rated_current_a', 'installation_date', 'design_life_years', 'grade')
    if (params.plantId) query = query.where('station_id', params.plantId)
    const allEquipment = await query

    // 也查电池（用 SOH 判断）
    const batteries = await db('equipment').where('equipment_type', 'BATTERY')
      .modify((q) => { if (params.plantId) q.where('station_id', params.plantId) })
      .select('id', 'name', 'model_number', 'station_id', 'rated_capacity_kva', 'installation_date', 'design_life_years', 'grade')

    const now = new Date()
    const currentYear = now.getFullYear()

    const costPerUnit: Record<string, { unit: string; rate: number }> = {
      TRANSFORMER: { unit: 'kVA', rate: 30 },   // 元/kVA 市场价
      BREAKER: { unit: 'A', rate: 50 },           // 元/A
      CABLE: { unit: 'A', rate: 30 },             // 元/A
      SWITCH: { unit: 'A', rate: 60 },            // 元/A
      BATTERY: { unit: 'kWh', rate: 800 },        // 元/kWh
    }

    const plans: any[] = []

    // 处理非电池设备
    for (const eq of allEquipment) {
      const installYear = eq.installation_date ? new Date(eq.installation_date).getFullYear() : currentYear - 2
      const age = currentYear - installYear
      const designLife = eq.design_life_years || 20
      const remainingPct = (designLife - age) / designLife

      const importance = eq.equipment_type === 'TRANSFORMER' ? '主干' : '分支'
      let priority = remainingPct < 0.2 ? 1 : remainingPct < 0.4 ? 2 : remainingPct < 0.6 ? 3 : 4
      if (importance === '主干' && priority > 1) priority = Math.max(1, priority - 1)

      const reason = remainingPct < 0.2
        ? `已运行${age}年，剩余寿命${(remainingPct * 100).toFixed(0)}%，接近报废，建议尽快更换`
        : remainingPct < 0.4
          ? `已运行${age}年，剩余寿命${(remainingPct * 100).toFixed(0)}%，纳入年度更换计划`
          : remainingPct < 0.6
            ? `运行${age}年，剩余寿命${(remainingPct * 100).toFixed(0)}%，纳入中期更换规划`
            : `运行${age}年，剩余寿命${(remainingPct * 100).toFixed(0)}%，远期更换储备`

      const replacementDate = new Date()
      replacementDate.setMonth(replacementDate.getMonth() + Math.round(remainingPct * designLife * 12))

      const costCfg = costPerUnit[eq.equipment_type] || { unit: 'A', rate: 40 }
      const baseVal = eq.equipment_type === 'TRANSFORMER' ? (eq.rated_capacity_kva || 1000) : (eq.rated_current_a || 100)
      const estimatedCost = Math.round(baseVal * costCfg.rate)

      const station = await db('solar_pv_stations').where('id', eq.station_id).select('station_name as name').first()

      plans.push({
        equipmentId: eq.id,
        equipmentName: eq.name || eq.model_number || eq.id,
        equipmentType: eq.equipment_type,
        plantName: station?.name || '-',
        importance,
        remainingLifePct: +(remainingPct * 100).toFixed(0),
        designLifeYears: designLife,
        currentAgeYears: age,
        priority,
        reason,
        suggestedDate: replacementDate.toISOString().split('T')[0],
        estimatedCost,
      })
    }

    // 电池设备：基于 SOH 判断
    for (const eq of batteries) {
      const latest = await db('battery_cycle_records').where('equipment_id', eq.id).orderBy('record_month', 'desc').first()
      if (!latest || latest.soh_pct > 85) continue

      const station = await db('solar_pv_stations').where('id', eq.station_id).select('station_name as name').first()
      const recentRecords = await db('battery_cycle_records').where('equipment_id', eq.id).orderBy('record_month', 'desc').limit(6)
      const rates: number[] = []
      for (let i = 1; i < recentRecords.length; i++) rates.push(recentRecords[i - 1].soh_pct - recentRecords[i].soh_pct)
      const avgDeg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0.15
      const remainingMonths = avgDeg > 0 ? Math.round((latest.soh_pct - 80) / avgDeg) : 36
      const replacementDate = new Date(); replacementDate.setMonth(replacementDate.getMonth() + remainingMonths)
      const capacityKwh = latest.cumulative_energy_mwh ? Math.round(latest.cumulative_energy_mwh * 1000 / latest.cumulative_cycles) : 5000
      const estimatedCost = capacityKwh * 800

      plans.push({
        equipmentId: eq.id,
        equipmentName: eq.name || eq.model_number || eq.id,
        equipmentType: 'BATTERY',
        plantName: station?.name || '-',
        importance: '分支',
        remainingLifePct: latest.soh_pct,
        designLifeYears: eq.design_life_years || 12,
        currentAgeYears: currentYear - (eq.installation_date ? new Date(eq.installation_date).getFullYear() : currentYear - 2),
        currentSoh: latest.soh_pct,
        cumulativeCycles: latest.cumulative_cycles,
        priority: latest.soh_pct < 82 ? 1 : latest.soh_pct < 84 ? 2 : 3,
        reason: latest.soh_pct < 82 ? 'SOH 接近失效阈值，建议尽快更换'
          : latest.soh_pct < 84 ? 'SOH 下降加速，纳入季度更换计划'
          : 'SOH 持续下降，建议半年内安排更换',
        suggestedDate: replacementDate.toISOString().split('T')[0],
        estimatedCost,
      })
    }

    return plans.sort((a, b) => a.priority - b.priority)
  }

  // ==================== Voltage ====================
  async getVoltageFluctuation(query: { pointId: string; startDate: string; endDate: string }) {
    const data = await db('voltage_measurements')
      .where('equipment_id', query.pointId)
      .whereBetween('time', [query.startDate, query.endDate])
      .select('time', 'phase_a_v', 'phase_b_v', 'phase_c_v', 'voltage_deviation_pct')
      .orderBy('time', 'asc')

    const deviations = data.map((d) => d.voltage_deviation_pct)
    return {
      pointId: query.pointId,
      timeSeries: data.map((d) => ({
        time: d.time,
        voltageV: (d.phase_a_v + d.phase_b_v + d.phase_c_v) / 3,
        fluctuationPct: d.voltage_deviation_pct,
      })),
      maxFluctuationPct: Math.max(...deviations),
      avgFluctuationPct: deviations.reduce((a, b) => a + b, 0) / deviations.length,
      thresholdViolations: data.filter((d) => Math.abs(d.voltage_deviation_pct) > 5).length,
    }
  }

  async getPowerReliability(query: { startDate: string; endDate: string }) {
    return {
      saifi: 0.85,
      saidi: 120,
      theoreticalReliability: 0.998,
      actualReliability: 0.996,
      deviationPct: 0.2,
      faultTreeNodes: [],
    }
  }

  async getQualificationRate(query: { startDate: string; endDate: string; voltageLevel?: string }) {
    return db('voltage_measurements')
      .whereBetween('time', [query.startDate, query.endDate])
      .select(
        db.raw('COUNT(*) FILTER (WHERE ABS(voltage_deviation_pct) <= 7) as qualified_hours'),
        db.raw('COUNT(*) as total_hours'),
      )
      .first()
  }

  // ==================== Alerts ====================
  async getAlerts(query: { level?: string; limit?: number }) {
    return db('alerts')
      .modify((qb) => { if (query.level) qb.where('alert_level', query.level) })
      .orderBy('triggered_at', 'desc')
      .limit(query.limit || 50)
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    return db('alerts').where('id', alertId).update({
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
    })
  }

  // ==================== Event Trace ====================
  async traceEvent(eventId: string) {
    const alert = await db('alerts').where('id', eventId).first()
    if (!alert) throw new Error('Event not found')

    const relatedAlerts = await db('alerts')
      .where('source_id', alert.source_id)
      .orderBy('triggered_at', 'desc')

    return { event: alert, relatedEvents: relatedAlerts, possibleCauses: ['设备老化', '负荷变化', '气象影响'] }
  }

  // ==================== Power Quality Extensions ====================

  async getVoltageFluctuationDetail(query: { pointId: string; startDate: string; endDate: string; windowMinutes?: number }) {
    const windowMin = query.windowMinutes || 15

    // 获取电站信息（含 bus_id 用于关联负荷）
    const station = await db('solar_pv_stations')
      .where('id', query.pointId)
      .select('station_name', 'grid_connection_voltage_kv', 'bus_id')
      .first()
    if (!station) throw new Error('电站不存在')
    const nominalVoltageKv = station.grid_connection_voltage_kv || 10
    const nominalVoltageV = nominalVoltageKv * 1000

    // 从 pv_output_measurements 获取电压数据
    const data = await db('pv_output_measurements')
      .where('station_id', query.pointId)
      .whereBetween('time', [query.startDate, query.endDate])
      .select('time', 'voltage_v', 'active_power_kw')
      .orderBy('time', 'asc')

    // 获取该母线对应时段的负荷数据
    const loadData = await db('load_measurements')
      .where('bus_id', station.bus_id)
      .whereBetween('time', [query.startDate, query.endDate])
      .select('time', 'active_power_mw')
      .orderBy('time', 'asc')

    // 构建负荷查找：为每条光伏记录找最接近时刻的负荷值
    function findLoadKw(pvTime: string): number {
      if (loadData.length === 0) return 0
      const pvMs = new Date(pvTime).getTime()
      let closest = loadData[0]
      let minDiff = Math.abs(new Date(closest.time).getTime() - pvMs)
      for (let k = 1; k < loadData.length; k++) {
        const diff = Math.abs(new Date(loadData[k].time).getTime() - pvMs)
        if (diff < minDiff) { minDiff = diff; closest = loadData[k] }
      }
      return Math.round(closest.active_power_mw * 1000) // MW → kW
    }

    // 15分钟滑动窗口波动率计算
    const timeSeries: Array<{ time: string; voltageKv: number; activePowerKw: number; loadKw: number; fluctuationPct: number }> = []
    const alertList: Array<{ time: string; level: string; title: string; fluctuationPct: number; activePowerKw: number; loadKw: number }> = []
    const alertRecords: any[] = []

    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const pointTime = new Date(d.time).getTime()
      const windowStartTime = pointTime - windowMin * 60 * 1000

      // 收集窗口内的电压值
      const windowVoltages: number[] = []
      for (let j = i; j >= 0; j--) {
        const t = new Date(data[j].time).getTime()
        if (t >= windowStartTime) { windowVoltages.push(data[j].voltage_v) }
        else break
      }

      // 窗口内至少2条记录才计算波动率，否则为0
      let fluctuationPct = 0
      if (windowVoltages.length >= 2) {
        const vMax = Math.max(...windowVoltages)
        const vMin = Math.min(...windowVoltages)
        fluctuationPct = +(((vMax - vMin) / nominalVoltageV) * 100).toFixed(2)
      }

      const voltageKv = +(d.voltage_v / 1000).toFixed(2)
      const activePowerKw = d.active_power_kw
      const loadKw = findLoadKw(d.time)

      timeSeries.push({ time: d.time, voltageKv, activePowerKw, loadKw, fluctuationPct })

      if (fluctuationPct > 5) {
        alertList.push({ time: d.time, level: fluctuationPct > 7 ? 'CRITICAL' : 'WARN', title: `电压波动${fluctuationPct}%`, fluctuationPct, activePowerKw, loadKw })
        // 写入告警表（去重：同电站同时刻不重复）
        const existing = await db('alerts')
          .where({ source_type: 'VOLTAGE_FLUCTUATION', source_id: query.pointId, triggered_at: d.time })
          .first()
        if (!existing) {
          alertRecords.push({
            id: uuidv4(),
            alert_level: fluctuationPct > 7 ? 'CRITICAL' : 'WARN',
            source_type: 'VOLTAGE_FLUCTUATION',
            source_id: query.pointId,
            title: `电压波动${fluctuationPct}%`,
            message: `并网点${station.station_name}在${d.time}电压波动率达${fluctuationPct}%，超过5%阈值。光伏出力${activePowerKw}kW，负荷${loadKw}kW`,
            triggered_at: d.time,
            metadata: JSON.stringify({ fluctuationPct, activePowerKw, loadKw, nominalVoltageKv }),
          })
        }
      }
    }

    // 批量写入告警
    if (alertRecords.length > 0) {
      await db('alerts').insert(alertRecords)
    }

    // 查询该电站数据的实际起止时间
    const rangeResult = await db('pv_output_measurements')
      .where('station_id', query.pointId)
      .select(db.raw("MIN(time) as first_time, MAX(time) as last_time"))
      .first()

    const deviations = timeSeries.map(d => d.fluctuationPct)
    return {
      stationId: query.pointId,
      stationName: station.station_name,
      nominalVoltageKv,
      windowMinutes: windowMin,
      timeSeries,
      alerts: alertList,
      maxFluctuationPct: deviations.length ? +Math.max(...deviations).toFixed(2) : 0,
      avgFluctuationPct: deviations.length ? +(deviations.reduce((a, b) => a + b, 0) / deviations.length).toFixed(2) : 0,
      thresholdViolations: alertList.length,
      dataRange: {
        firstTime: (rangeResult as any)?.first_time || query.startDate,
        lastTime: (rangeResult as any)?.last_time || query.endDate,
      },
    }
  }

  async getPowerReliabilityDetail(query: { stationId: string; startDate: string; endDate: string; connectionType?: string; lineType?: string }) {
    const station = await db('solar_pv_stations').where('id', query.stationId).select('station_name', 'grid_connection_voltage_kv', 'installed_date', 'metadata').first()
    if (!station) throw new Error('电站不存在')

    const kv = station.grid_connection_voltage_kv || 10
    const ageYears = (new Date().getFullYear() - new Date(station.installed_date || '2024-01-01').getFullYear()) || 1
    const ageFactor = ageYears > 8 ? 1.5 : 1.0

    // 解析拓扑配置：query 参数可覆盖 metadata 默认值
    let topoConfig = { connectionType: 'single', lineType: 'dedicated' as string }
    try { if (station.metadata) topoConfig = JSON.parse(station.metadata) } catch {}
    if (query.connectionType) topoConfig.connectionType = query.connectionType
    if (query.lineType) topoConfig.lineType = query.lineType
    const connFactor = topoConfig.connectionType === 'loop' ? 0.15 : topoConfig.connectionType === 'double' ? 0.3 : 1.0
    const tapFactor = topoConfig.lineType === 'tap' ? 2.0 : 1.0

    // 行业标准故障率参数（次/年，IEEE Std 493 + 国内光伏运维数据）
    // key: 10kV | 110kV | 220kV 三档
    // 故障率参照国家能源局2024年报（光伏非计划停运0.03次/台年）校准，保留差异化
    const bp: Record<string, { rate: [number, number, number]; mttr: number }> = {
      'IGBT模块过流损坏': { rate: [0.014, 0.010, 0.006], mttr: 4 },
      '直流侧接地故障':   { rate: [0.007, 0.005, 0.003], mttr: 3 },
      '交流侧过压保护':   { rate: [0.005, 0.004, 0.002], mttr: 2 },
      '逆变器通讯中断':   { rate: [0.010, 0.007, 0.004], mttr: 1 },
      '保护装置误动':     { rate: [0.007, 0.005, 0.003], mttr: 2 },
      '保护装置拒动':     { rate: [0.002, 0.001, 0.0007], mttr: 6 },
      'CT/PT断线':       { rate: [0.004, 0.003, 0.002], mttr: 2 },
      '孤岛保护误动作':   { rate: [0.003, 0.002, 0.001], mttr: 1 },
      '频率/电压越限解列': { rate: [0.005, 0.003, 0.002], mttr: 1 },
      '架空线短路':       { rate: [0.014, 0.010, 0.005], mttr: 6 },
      '架空线断线':       { rate: [0.007, 0.005, 0.003], mttr: 8 },
      '绝缘子污闪':       { rate: [0.005, 0.004, 0.002], mttr: 4 },
      '电缆接头过热':     { rate: [0.007, 0.005, 0.003], mttr: 5 },
      '外力破坏':         { rate: [0.008, 0.005, 0.002], mttr: 8 },
      '绕组匝间短路':     { rate: [0, 0.005, 0.003], mttr: 24 },
      '绝缘老化击穿':     { rate: [0, 0.003, 0.002], mttr: 48 },
      '铁芯多点接地':     { rate: [0, 0.002, 0.001], mttr: 16 },
      '套管闪络':         { rate: [0, 0.003, 0.001], mttr: 8 },
      '冷却系统故障':     { rate: [0, 0.004, 0.003], mttr: 6 },
      '有载分接开关故障': { rate: [0, 0.002, 0.001], mttr: 12 },
      '主变差动保护动作': { rate: [0, 0, 0.001], mttr: 48 },
      '主变瓦斯保护动作': { rate: [0, 0, 0.0007], mttr: 36 },
    }

    const vkIdx = kv >= 220 ? 2 : kv >= 110 ? 1 : 0
    function R(name: string): number {
      const p = bp[name]; if (!p) return 0
      return +(p.rate[vkIdx] * ageFactor * connFactor * tapFactor).toFixed(4)
    }
    function M(name: string): number { return bp[name]?.mttr || 1 }

    // 构建分层故障树
    const rootName = kv >= 220 ? '区域停电' : kv >= 110 ? '区域停电' : '馈线停电'
    const treeDef: Array<{ id: string; name: string; parent: string | null; failureRate?: number; mttr?: number }> = [
      { id: 'root', name: rootName, parent: null },
    ]
    if (kv >= 220) treeDef.push({ id: 'tx', name: '主变跳闸', parent: 'root', failureRate: R('主变差动保护动作') + R('主变瓦斯保护动作'), mttr: 42 })
    const gridParent = kv >= 220 ? 'tx' : 'root'

    // L2: 中间节点
    treeDef.push(
      { id: 'n_poc', name: '并网点跳闸', parent: gridParent },
      { id: 'n_line', name: '线路故障', parent: gridParent },
    )
    if (kv >= 35) treeDef.push({ id: 'n_xfmr', name: '变压器故障', parent: gridParent })

    // L3: 子类
    treeDef.push(
      { id: 's_inv', name: '逆变器类故障', parent: 'n_poc' },
      { id: 's_prot', name: '保护类故障', parent: 'n_poc' },
      { id: 's_ctrl', name: '控制类故障', parent: 'n_poc' },
      { id: 's_oh', name: '架空线路', parent: 'n_line' },
      { id: 's_cable', name: '电缆线路', parent: 'n_line' },
    )
    if (kv >= 35) {
      treeDef.push(
        { id: 's_body', name: '变压器本体', parent: 'n_xfmr' },
        { id: 's_acc', name: '变压器附件', parent: 'n_xfmr' },
      )
    }

    // L4: 叶子节点
    treeDef.push(
      { id: 'l_igbt', name: 'IGBT模块过流损坏', parent: 's_inv', failureRate: R('IGBT模块过流损坏'), mttr: M('IGBT模块过流损坏') },
      { id: 'l_dcg', name: '直流侧接地故障', parent: 's_inv', failureRate: R('直流侧接地故障'), mttr: M('直流侧接地故障') },
      { id: 'l_acv', name: '交流侧过压保护', parent: 's_inv', failureRate: R('交流侧过压保护'), mttr: M('交流侧过压保护') },
      { id: 'l_comm', name: '逆变器通讯中断', parent: 's_inv', failureRate: R('逆变器通讯中断'), mttr: M('逆变器通讯中断') },
      { id: 'l_mis', name: '保护装置误动', parent: 's_prot', failureRate: R('保护装置误动'), mttr: M('保护装置误动') },
      { id: 'l_ref', name: '保护装置拒动', parent: 's_prot', failureRate: R('保护装置拒动'), mttr: M('保护装置拒动') },
      { id: 'l_ctpt', name: 'CT/PT断线', parent: 's_prot', failureRate: R('CT/PT断线'), mttr: M('CT/PT断线') },
      { id: 'l_isl', name: '孤岛保护误动作', parent: 's_ctrl', failureRate: R('孤岛保护误动作'), mttr: M('孤岛保护误动作') },
      { id: 'l_vf', name: '电压/频率越限解列', parent: 's_ctrl', failureRate: R('频率/电压越限解列'), mttr: M('频率/电压越限解列') },
      { id: 'l_ohsc', name: '架空线短路', parent: 's_oh', failureRate: R('架空线短路'), mttr: M('架空线短路') },
      { id: 'l_ohbr', name: '架空线断线', parent: 's_oh', failureRate: R('架空线断线'), mttr: M('架空线断线') },
      { id: 'l_flash', name: '绝缘子污闪', parent: 's_oh', failureRate: R('绝缘子污闪'), mttr: M('绝缘子污闪') },
      { id: 'l_joint', name: '电缆接头过热', parent: 's_cable', failureRate: R('电缆接头过热'), mttr: M('电缆接头过热') },
      { id: 'l_dam', name: '外力破坏', parent: 's_cable', failureRate: R('外力破坏'), mttr: M('外力破坏') },
    )
    if (kv >= 35) {
      treeDef.push(
        { id: 'l_wdg', name: '绕组匝间短路', parent: 's_body', failureRate: R('绕组匝间短路'), mttr: M('绕组匝间短路') },
        { id: 'l_ins', name: '绝缘老化击穿', parent: 's_body', failureRate: R('绝缘老化击穿'), mttr: M('绝缘老化击穿') },
        { id: 'l_core', name: '铁芯多点接地', parent: 's_body', failureRate: R('铁芯多点接地'), mttr: M('铁芯多点接地') },
        { id: 'l_bsh', name: '套管闪络', parent: 's_acc', failureRate: R('套管闪络'), mttr: M('套管闪络') },
        { id: 'l_cool', name: '冷却系统故障', parent: 's_acc', failureRate: R('冷却系统故障'), mttr: M('冷却系统故障') },
        { id: 'l_oltc', name: '有载分接开关故障', parent: 's_acc', failureRate: R('有载分接开关故障'), mttr: M('有载分接开关故障') },
      )
    }

    // 计算
    const leaves = treeDef.filter(n => n.failureRate != null && n.failureRate > 0)
    const totalSAIFI = +leaves.reduce((s, n) => s + (n.failureRate || 0), 0).toFixed(4)
    const totalWeightedMTTR = leaves.reduce((s, n) => s + (n.failureRate || 0) * (n.mttr || 0), 0)
    const totalSAIDI = +((totalWeightedMTTR / (totalSAIFI || 1)) * 60).toFixed(1)
    const theoreticalReliability = +(1 - totalWeightedMTTR / 8760).toFixed(4)

    // 贡献值分解（按 L2 中间节点分组）
    function leafSum(pid: string) {
      return +leaves.filter(n => {
        // 递归向上查找：叶子属于哪个 L2 中间节点
        const node = treeDef.find(t => t.id === n.id)
        if (!node) return false
        // 对叶子节点往上层查找
        const p3 = treeDef.find(t => t.id === node.parent)
        if (!p3) return false
        // L3节点的parent就是L2节点
        if (p3.parent === pid) return true
        return false
      }).reduce((s, n) => s + (n.failureRate || 0), 0).toFixed(4)
    }
    const contributions = [
      { group: '并网点跳闸', saifi: leafSum('n_poc'), saidiPct: +((leafSum('n_poc') / (totalSAIFI || 1)) * 100).toFixed(1) },
      { group: '线路故障', saifi: leafSum('n_line'), saidiPct: +((leafSum('n_line') / (totalSAIFI || 1)) * 100).toFixed(1) },
    ]
    if (kv >= 35) contributions.push({ group: '变压器故障', saifi: leafSum('n_xfmr'), saidiPct: +((leafSum('n_xfmr') / (totalSAIFI || 1)) * 100).toFixed(1) })
    if (kv >= 220) contributions.push({ group: '主变跳闸', saifi: leafSum('tx'), saidiPct: +((leafSum('tx') / (totalSAIFI || 1)) * 100).toFixed(1) })

    // 实际停电数据
    const outages = await db('outage_events')
      .where('station_id', query.stationId)
      .whereBetween('start_time', [query.startDate, query.endDate])
      .select('start_time', 'duration_minutes', 'cause')

    const monthCount = Math.max(1, (new Date(query.endDate).getFullYear() - new Date(query.startDate).getFullYear()) * 12 + new Date(query.endDate).getMonth() - new Date(query.startDate).getMonth() + 1)
    const actualOutageCount = outages.length
    const actualSAIFI = +(actualOutageCount / monthCount * 12).toFixed(2)
    const actualSAIDI = outages.reduce((s, o) => s + (o.duration_minutes || 0), 0)

    // 逐月对比
    const monthlyComparison: Array<{ month: string; theoretical: number; actual: number | null; actualSAIDI: number | null }> = []
    const start = new Date(query.startDate)
    const end = new Date(query.endDate)
    for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m.setMonth(m.getMonth() + 1)) {
      const mStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
      const mOutages = outages.filter((o: any) => o.start_time.startsWith(mStr))
      const mSAIFI = mOutages.length * 12
      const mSAIDIMinutes = mOutages.reduce((s: number, o: any) => s + (o.duration_minutes || 0), 0)
      monthlyComparison.push({
        month: mStr,
        theoretical: totalSAIFI,
        actual: mOutages.length > 0 ? +mSAIFI.toFixed(2) : null,
        actualSAIDI: mOutages.length > 0 ? mSAIDIMinutes : null,
      })
    }

    return {
      stationId: query.stationId,
      stationName: station.station_name,
      voltageKv: kv,
      topologyConfig: topoConfig,
      faultTree: treeDef,
      saifi: totalSAIFI,
      saidi: totalSAIDI,
      theoreticalReliability,
      contributions,
      actualSAIFI,
      actualSAIDI,
      actualOutageCount,
      deviationPct: actualOutageCount > 0 ? +Math.abs((actualSAIFI - totalSAIFI) / (totalSAIFI || 1) * 100).toFixed(1) : null,
      monthlyComparison,
    }
  }

  async getQualificationRateDetail(query: { startDate: string; endDate: string; voltageLevel?: string }) {
    // 查询各电站逐时电压数据，关联区域和电压等级
    const rows = await db('pv_output_measurements')
      .join('solar_pv_stations', 'solar_pv_stations.id', 'pv_output_measurements.station_id')
      .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
      .whereBetween('pv_output_measurements.time', [query.startDate, query.endDate])
      .modify((qb) => { if (query.voltageLevel) qb.where('grid_buses.voltage_level', query.voltageLevel) })
      .select(
        'pv_output_measurements.time',
        'pv_output_measurements.voltage_v',
        'pv_output_measurements.active_power_kw',
        'pv_output_measurements.actual_weather',
        'pv_output_measurements.temperature_c',
        'solar_pv_stations.grid_connection_voltage_kv',
        'solar_pv_stations.bus_id',
        'solar_pv_stations.station_name',
        'grid_buses.zone',
        'grid_buses.voltage_level',
      )
      .orderBy('pv_output_measurements.time', 'asc')

    // 电压合格标准
    const stdMap: Record<string, number> = { '10KV': 7, '35KV': 5, '110KV': 3, '220KV': 3 }
    function getThreshold(kv: number): number {
      if (kv >= 220) return 3; if (kv >= 110) return 3; if (kv >= 35) return 5; return 7
    }

    // 查询负荷数据，用于异常点的负荷状态判断
    const loadRows = await db('load_measurements')
      .whereBetween('time', [query.startDate, query.endDate])
      .select('bus_id', 'time', 'active_power_mw')
      .orderBy('time', 'asc')
    // 按 bus_id 分组
    const loadByBus = new Map<string, Array<{ time: string; mw: number }>>()
    for (const lr of loadRows as any[]) {
      if (!loadByBus.has(lr.bus_id)) loadByBus.set(lr.bus_id, [])
      loadByBus.get(lr.bus_id)!.push({ time: lr.time, mw: lr.active_power_mw })
    }
    // 为给定时间和母线找最近负荷值
    function findLoad(busId: string, timeStr: string): { kw: number; status: string } {
      const list = loadByBus.get(busId)
      if (!list || list.length === 0) return { kw: 0, status: '' }
      const t = new Date(timeStr).getTime()
      let closest = list[0], minDiff = Infinity
      for (const l of list) {
        const d = Math.abs(new Date(l.time).getTime() - t)
        if (d < minDiff) { minDiff = d; closest = l }
      }
      const kw = Math.round(closest.mw * 1000)
      // 判断负荷状态：>80%峰值为高峰，<30%峰值为低谷
      const allMw = list.map(l => l.mw)
      const peak = Math.max(...allMw, 1)
      const ratio = closest.mw / peak
      let status = ''
      if (ratio > 0.8) status = '负荷高峰期'
      else if (ratio < 0.3) status = '负荷低谷期'
      return { kw, status }
    }

    // 按 zone + voltageLevel 分组统计
    const ledgerMap = new Map<string, { zone: string; voltageLevel: string; total: number; qualified: number }>()
    const trendMap = new Map<string, Map<string, { total: number; qualified: number }>>() // month -> key -> stats
    const anomalyPoints: Array<{ time: string; zone: string; rate: number; weather: string; pvStatus: string; loadStatus: string }> = []

    for (const r of rows as any[]) {
      const kv = r.grid_connection_voltage_kv || 10
      const threshold = getThreshold(kv)
      const deviationPct = Math.abs((r.voltage_v / 1000 - kv) / kv * 100)
      const isQualified = deviationPct <= threshold
      const zone = r.zone || '未知'
      const vl = r.voltage_level || (kv >= 220 ? '220kV' : kv >= 110 ? '110kV' : '10kV')
      const key = `${zone}|${vl}`
      const month = r.time.slice(0, 7)

      // 台账统计
      if (!ledgerMap.has(key)) ledgerMap.set(key, { zone, voltageLevel: vl, total: 0, qualified: 0 })
      const entry = ledgerMap.get(key)!
      entry.total++
      if (isQualified) entry.qualified++

      // 趋势统计（按月）
      if (!trendMap.has(month)) trendMap.set(month, new Map())
      const mMap = trendMap.get(month)!
      if (!mMap.has(key)) mMap.set(key, { total: 0, qualified: 0 })
      const mEntry = mMap.get(key)!
      mEntry.total++
      if (isQualified) mEntry.qualified++

      // 异常检测：根因分析——判断主因是光伏出力/气象/负荷中的哪一个
      if (!isQualified) {
        const temp = r.temperature_c || 25
        const power = r.active_power_kw || 0
        const weather = r.actual_weather || '晴'
        const loadInfo = findLoad(r.bus_id, r.time)
        // 根因判断：按优先级匹配
        let rootCause = ''
        let causeType = ''
        if (weather.includes('雨') || weather.includes('暴雨')) {
          rootCause = `${weather}导致绝缘降低，电压偏差增大`; causeType = '气象条件'
        } else if (temp > 35) {
          rootCause = `高温${temp}°C导致设备降额运行，电压越限`; causeType = '气象条件'
        } else if (loadInfo.status === '负荷低谷期' && power > 0) {
          rootCause = `负荷低谷期(${loadInfo.kw}kW)光伏倒送导致电压偏高`; causeType = '负荷情况'
        } else if (loadInfo.status === '负荷高峰期' && power === 0) {
          rootCause = `负荷高峰期(${loadInfo.kw}kW)无功不足导致电压偏低`; causeType = '负荷情况'
        } else if (power > 0) {
          rootCause = `光伏出力${power}kW时段电压偏差${deviationPct.toFixed(1)}%`; causeType = '光伏出力'
        } else {
          rootCause = `夜间无功倒送导致电压偏高${deviationPct.toFixed(1)}%`; causeType = '光伏出力'
        }
        anomalyPoints.push({
          time: r.time.slice(0, 16).replace('T', ' '),
          zone,
          rate: +(deviationPct).toFixed(1),
          weather: `${weather} ${temp}°C`,
          pvStatus: power > 0 ? `${power}kW` : '0',
          loadStatus: loadInfo.kw > 0 ? `${loadInfo.kw}kW` : '-',
          rootCause,
          causeType,
        })
      }
    }

    // 只取前20条最严重的异常
    anomalyPoints.sort((a, b) => b.rate - a.rate)
    const topAnomalies = anomalyPoints.slice(0, 20)

    // 组装台账（汇总 + 按月）
    const summaryLedger = Array.from(ledgerMap.values()).map(e => ({
      zone: e.zone,
      voltageLevel: e.voltageLevel,
      totalHours: e.total,
      qualifiedHours: e.qualified,
      rate: +((e.qualified / (e.total || 1)) * 100).toFixed(2),
      violations: e.total - e.qualified,
      period: '汇总',
    })).sort((a, b) => a.zone.localeCompare(b.zone) || a.voltageLevel.localeCompare(b.voltageLevel))

    // 按月台账
    const months = Array.from(trendMap.keys()).sort()
    const allKeys = Array.from(ledgerMap.keys()).sort()
    const monthlyLedger: any[] = []
    const trendData: any[] = []
    for (const m of months) {
      const mMap = trendMap.get(m)!
      const item: any = { month: m }
      for (const key of allKeys) {
        const [zone, vl] = key.split('|')
        const s = mMap.get(key)
        const r = s ? +((s.qualified / (s.total || 1)) * 100).toFixed(1) : null
        item[key] = r
        if (s) {
          monthlyLedger.push({
            zone, voltageLevel: vl, period: m,
            totalHours: s.total, qualifiedHours: s.qualified,
            rate: r, violations: s.total - s.qualified,
          })
        }
      }
      trendData.push(item)
    }
    monthlyLedger.sort((a, b) => a.period.localeCompare(b.period) || a.zone.localeCompare(b.zone) || a.voltageLevel.localeCompare(b.voltageLevel))

    return { summaryLedger, monthlyLedger, trendData, trendKeys: allKeys, anomalyPoints: topAnomalies }
  }

  async getEquipmentImpact(query: { startDate: string; endDate: string }) {
    const equipments = await db('equipment')
      .join('solar_pv_stations', 'solar_pv_stations.id', 'equipment.station_id')
      .select(
        'equipment.id', 'equipment.name', 'equipment.equipment_type', 'equipment.rated_voltage_kv',
        'equipment.grade', 'equipment.design_life_years', 'equipment.installation_date',
        'equipment.station_id',
        'solar_pv_stations.station_name',
      )
      .limit(50)
    const result = []
    for (const eq of equipments as any[]) {
      const faults = await db('equipment_lifecycle')
        .where('equipment_id', eq.id).where('event_type', 'FAULT')
        .count('* as cnt').first()
      const voltageAlerts = await db('alerts')
        .where('source_type', 'VOLTAGE_FLUCTUATION').where('source_id', eq.station_id)
        .whereBetween('triggered_at', [query.startDate, query.endDate])
        .count('* as cnt').first()
      const faultCnt = (faults as any)?.cnt || 0
      const alertCnt = (voltageAlerts as any)?.cnt || 0
      // 查询设备温升数据
      const normalRow = await db('equipment_temperature')
        .where({ equipment_id: eq.id, voltage_status: 'normal' })
        .whereBetween('time', [query.startDate, query.endDate])
        .avg('temp_c as avg_temp').first()
      const surgeRow = await db('equipment_temperature')
        .where({ equipment_id: eq.id, voltage_status: 'surge' })
        .whereBetween('time', [query.startDate, query.endDate])
        .avg('temp_c as avg_temp').first()
      const sagRow = await db('equipment_temperature')
        .where({ equipment_id: eq.id, voltage_status: 'sag' })
        .whereBetween('time', [query.startDate, query.endDate])
        .avg('temp_c as avg_temp').first()
      const normalTemp = (normalRow as any)?.avg_temp || 0
      const surgeTemp = (surgeRow as any)?.avg_temp || 0
      const sagTemp = (sagRow as any)?.avg_temp || 0
      // 统一薄弱判定：温升超理论值 2 倍
      const theoryRiseMap: Record<string, number> = { TRANSFORMER: 8, INVERTER: 6, BREAKER: 4, CABLE: 3, SWITCH: 4, BATTERY: 5 }
      const theory = theoryRiseMap[eq.equipment_type] || 5
      const thisRise = surgeTemp + sagTemp > 0 ? (surgeTemp + sagTemp - normalTemp * 2) / 2 : 0
      const weakFlag = thisRise > theory * 2.0
      const installYear = new Date(eq.installation_date || '2020-01-01').getFullYear()
      const runYears = new Date().getFullYear() - installYear
      result.push({
        id: eq.id,
        stationName: eq.station_name,
        device: eq.name || eq.equipment_type,
        type: { TRANSFORMER: '变压器', BREAKER: '断路器', CABLE: '电缆', SWITCH: '开关', INVERTER: '逆变器', BATTERY: '电池' }[eq.equipment_type] || eq.equipment_type,
        ratedVoltage: (eq.rated_voltage_kv || 0) + 'kV',
        surgeCount: alertCnt,
        sagCount: faultCnt,
        noramlTemp: +normalTemp.toFixed(1),
        surgeTemp: +surgeTemp.toFixed(1),
        sagTemp: +sagTemp.toFixed(1),
        runYears: `${runYears}/${eq.design_life_years || 20}年`,
        risk: weakFlag ? '薄弱' : faultCnt > 0 ? '关注' : '正常',
      })
    }
    return result.sort((a) => a.risk === '薄弱' ? -1 : 1).slice(0, 12)
  }

  async getEquipmentEvents(query: { equipmentId: string }) {
    const eq = await db('equipment').where('id', query.equipmentId).select('id', 'name', 'equipment_type').first()
    if (!eq) throw new Error('设备不存在')
    const hasData = await db('equipment_temperature').where('equipment_id', query.equipmentId).first()
    if (!hasData) return { events: [], typeAvgRise: 0, thisAvgRise: 0, isWeak: false, noData: true }
    const normalRow = await db('equipment_temperature')
      .where({ equipment_id: query.equipmentId, voltage_status: 'normal' }).avg('temp_c as avg_temp').first()
    const normalT = (normalRow as any)?.avg_temp || 0
    // 该设备每次异常事件的温升
    const events = await db('equipment_temperature')
      .where('equipment_id', query.equipmentId).whereIn('voltage_status', ['surge', 'sag'])
      .select('time', 'temp_c', 'voltage_status', 'voltage_deviation_pct')
      .orderBy('time', 'asc').limit(200)
    const eqEvents = events.map((r: any) => ({
      time: r.time?.slice(0, 16).replace('T', ' '),
      status: r.voltage_status,
      tempRise: +((r.temp_c || 0) - normalT).toFixed(1),
      deviationPct: r.voltage_deviation_pct,
    }))
    // 同类设备平均温升
    const thisAvgRise = eqEvents.length > 0 ? +(eqEvents.reduce((s, e) => s + e.tempRise, 0) / eqEvents.length).toFixed(1) : 0
    const typeCount = (await db('equipment').where('equipment_type', eq.equipment_type).whereNot('id', query.equipmentId).count('* as cnt').first() as any)?.cnt || 0
    // 设备理论温升（设计值）
    const theoryRiseMap: Record<string, number> = { TRANSFORMER: 8, INVERTER: 6, BREAKER: 4, CABLE: 3, SWITCH: 4, BATTERY: 5 }
    const theory = theoryRiseMap[eq.equipment_type] || 5
    // 用同类正常设备（温升不超理论值）的平均值做基准，该设备超 1.3 倍即薄弱
    let normalPeerTotal = 0, normalPeerCount = 0
    if (typeCount > 0) {
      // 重新算同类设备的 thisAvgRise，找不超理论值的
      const allPeers = await db('equipment').where('equipment_type', eq.equipment_type).select('id')
      for (const peer of allPeers as any[]) {
        const pn = await db('equipment_temperature').where({ equipment_id: peer.id, voltage_status: 'normal' }).avg('temp_c as avg_temp').first()
        const ps = await db('equipment_temperature').where({ equipment_id: peer.id, voltage_status: 'surge' }).avg('temp_c as avg_temp').first()
        const pg = await db('equipment_temperature').where({ equipment_id: peer.id, voltage_status: 'sag' }).avg('temp_c as avg_temp').first()
        const pnT = (pn as any)?.avg_temp || 0; const psT = (ps as any)?.avg_temp || 0; const pgT = (pg as any)?.avg_temp || 0
        const pRise = (psT + pgT - pnT * 2) / 2
        if (pRise <= theory) { normalPeerTotal += pRise; normalPeerCount++ }
      }
    }
    const peerBaseline = normalPeerCount > 0 ? +(normalPeerTotal / normalPeerCount).toFixed(1) : theory
    const isWeak = typeCount > 0 ? thisAvgRise > peerBaseline * 2.0 : false
    return { events: eqEvents, typeAvgRise: peerBaseline, thisAvgRise, theoryRise: theory, isWeak, noPeer: typeCount === 0 }
  }

  async getComplaintStats(query: { startDate: string; endDate: string }) {
    const rows = await db('complaint_stats')
      .select('industry')
      .sum('complaints as total_complaints')
      .sum('loss_estimate_wan as total_loss')
      .groupBy('industry')
    return (rows as any[]).map(r => ({
      industry: r.industry,
      complaints: r.total_complaints,
      lossEstimate: r.total_loss,
      mainIssue: r.industry === '制造业' ? '电压骤降导致设备停机' : r.industry === '商业' ? '电压波动影响精密仪器' : r.industry === '居民' ? '电压不稳导致电器损坏' : '电压偏低影响灌溉设备',
    }))
  }

  async getHotspotDistribution(query: { startDate: string; endDate: string }) {
    // 按 zone 聚合电压波动率 + 告警数
    const zoneData = await db('pv_output_measurements')
      .join('solar_pv_stations', 'solar_pv_stations.id', 'pv_output_measurements.station_id')
      .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
      .whereBetween('pv_output_measurements.time', [query.startDate, query.endDate])
      .select(
        'grid_buses.zone',
        db.raw('AVG(voltage_v) as avg_voltage'),
        db.raw('MAX(voltage_v) as max_voltage'),
        db.raw('MIN(voltage_v) as min_voltage'),
        'grid_buses.voltage_level',
      )
      .groupBy('grid_buses.zone')
    const result = []
    for (const zd of zoneData as any[]) {
      const kv = zd.voltage_level ? parseFloat(zd.voltage_level) : 10
      const nominalV = kv * 1000
      const maxDev = Math.abs((zd.max_voltage - nominalV) / nominalV * 100)
      const minDev = Math.abs((zd.min_voltage - nominalV) / nominalV * 100)
      const avgFluctuation = +Math.max(maxDev, minDev).toFixed(1)
      const alertCnt = await db('alerts')
        .join('solar_pv_stations', 'solar_pv_stations.id', 'alerts.source_id')
        .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
        .where('grid_buses.zone', zd.zone)
        .where('alerts.source_type', 'VOLTAGE_FLUCTUATION')
        .whereBetween('alerts.triggered_at', [query.startDate, query.endDate])
        .count('* as cnt').first()
      // 投诉数据：通过 station_id→zone 关联 complaint_stats
      const compRow = await db('complaint_stats')
        .join('solar_pv_stations', 'solar_pv_stations.id', 'complaint_stats.station_id')
        .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
        .where('grid_buses.zone', zd.zone)
        .sum('complaint_stats.complaints as total')
        .first()
      const totalComplaints = (compRow as any)?.total || 0
      // 按该区域电站数均摊
      const stationCnt = await db('solar_pv_stations')
        .join('grid_buses', 'grid_buses.id', 'solar_pv_stations.bus_id')
        .where('grid_buses.zone', zd.zone).count('* as cnt').first()
      const cnt = (stationCnt as any)?.cnt || 1
      result.push({
        zone: zd.zone,
        complaints: Math.round(totalComplaints / cnt),
        avgFluctuation,
        risk: avgFluctuation > 5 ? '高' : avgFluctuation > 2 ? '中' : '低',
      })
    }
    return result
  }

  async traceEventDetail(eventId: string) {
    const alert = await db('alerts').where('id', eventId).first()
    if (!alert) throw new Error('事件不存在')

    const relatedAlerts = await db('alerts')
      .where('source_id', alert.source_id).whereNot('id', eventId)
      .orderBy('triggered_at', 'desc')
    const allTypeAlerts = await db('alerts')
      .where('source_type', alert.source_type).where('source_id', alert.source_id)
      .count('* as cnt').first()

    // 查询告警时刻的实际数据推断根因（不再用硬编码 causeMap）
    const t = alert.triggered_at?.slice(0, 16) || ''
    let rootCause = '电压异常'
    let secondary: string[] = []
    let measures: string[] = []
    let probability = 50

    if (alert.source_type === 'FREQUENCY_DEVIATION') {
      rootCause = '电网频率异常波动，可能由大负荷投切或发电出力突变引起'
      secondary = ['光伏出力波动', '上级电网频率扰动']
      measures = ['加强频率监测', '优化逆变器频率响应', '与调度协调频率控制']
      probability = 70
    } else if (alert.source_type === 'POWER_FACTOR') {
      rootCause = '无功补偿不足或逆变器无功控制异常，导致功率因数偏低'
      secondary = ['无功补偿装置故障', '逆变器功率因数控制失效']
      measures = ['检查无功补偿装置', '优化逆变器无功出力', '加装SVG/SVC装置']
      probability = 75
    } else if (alert.source_type === 'VOLTAGE_FLUCTUATION') {
      // 查该时刻光伏和天气数据
      const pvRow = await db('pv_output_measurements')
        .where('station_id', alert.source_id).where('time', 'like', `${t}%`).first()
        .select('active_power_kw', 'actual_weather', 'temperature_c')
      // 查负荷
      const st = await db('solar_pv_stations').where('id', alert.source_id).select('bus_id').first()
      let loadKw = 0
      if (st) {
        const lr = await db('load_measurements').where('bus_id', st.bus_id).where('time', 'like', `${t.slice(0, 10)}%`).orderBy('time', 'asc').limit(50)
        if (lr.length > 0) {
          let closest = lr[0], minD = Infinity
          const tMs = new Date(alert.triggered_at).getTime()
          for (const r of lr) { const d = Math.abs(new Date(r.time).getTime() - tMs); if (d < minD) { minD = d; closest = r } }
          loadKw = Math.round((closest as any).active_power_mw * 1000)
        }
      }
      const pv = pvRow as any
      const temp = pv?.temperature_c || 25
      const power = pv?.active_power_kw || 0
      const weather = pv?.actual_weather || ''
      // 根因推断
      if (weather.includes('雨') || weather.includes('暴雨')) {
        rootCause = '气象因素：' + weather + '导致绝缘降低'
        secondary = ['温度' + temp + '°C', '光伏出力' + power + 'kW', '负荷' + loadKw + 'kW']
        measures = ['加强防水防潮措施', '定期检查绝缘子', '加装防雨罩']
      } else if (temp > 35) {
        rootCause = '气象因素：高温' + temp + '°C导致设备降额'
        secondary = ['天气' + weather, '光伏出力' + power + 'kW', '负荷' + loadKw + 'kW']
        measures = ['增设散热装置', '降低出力运行', '加强温度监测']
      } else if (power > 0 && loadKw > 0 && power > loadKw * 1.5) {
        rootCause = '光伏出力：出力' + power + 'kW远超负荷' + loadKw + 'kW，倒送引起电压抬升'
        secondary = ['天气' + weather, '温度' + temp + '°C']
        measures = ['加装储能吸收倒送功率', '调节逆变器无功出力', '优化并网点电压控制']
      } else if (power > 0) {
        rootCause = '光伏出力：出力波动达' + power + 'kW，逆变器调节滞后'
        secondary = ['天气' + weather, '温度' + temp + '°C', '负荷' + loadKw + 'kW']
        measures = ['优化逆变器控制策略', '加装储能平滑出力', '加强气象预警联动']
      } else {
        rootCause = '负荷因素：夜间负荷' + loadKw + 'kW，无功倒送导致电压偏高'
        secondary = ['天气' + weather, '温度' + temp + '°C']
        measures = ['加装无功补偿装置', '优化电压调节策略', '定期检修逆变器']
      }
      const totalCnt = (allTypeAlerts as any)?.cnt || 1
      const similarCnt = relatedAlerts.length + 1
      probability = Math.min(95, Math.round(similarCnt / totalCnt * 100))
    }

    return {
      event: alert,
      relatedEvents: relatedAlerts,
      primaryCause: rootCause,
      probability,
      secondaryCauses: secondary,
      preventiveMeasures: measures,
    }
  }

  // ==================== Helpers ====================
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length
    if (n < 2) return 0
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
    const sumX2 = x.reduce((a, b) => a + b * b, 0)
    const sumY2 = y.reduce((a, b) => a + b * b, 0)
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  }

  /** 多元线性回归残差：Y 对 X 矩阵回归后的残差向量 */
  private regressionResiduals(Y: number[], X: number[][]): number[] {
    const n = Y.length
    const k = X.length // 自变量个数
    if (n < k + 2) return Y.map(() => 0)

    // 构建设计矩阵 [1, X₁, X₂, ... Xₖ]
    // 用正规方程 (XᵀX)β = XᵀY 求解
    const p = k + 1 // 含截距项
    const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0))
    const XtY: number[] = Array(p).fill(0)

    for (let i = 0; i < n; i++) {
      const row = [1, ...X.map(col => col[i])]
      for (let r = 0; r < p; r++) {
        XtY[r] += row[r] * Y[i]
        for (let c = 0; c < p; c++) {
          XtX[r][c] += row[r] * row[c]
        }
      }
    }

    // 高斯消元求解 β
    const beta = this.gaussElimination(XtX, XtY)
    if (!beta) return Y.map(() => 0)

    // 计算残差 Y - Xβ
    const residuals: number[] = []
    for (let i = 0; i < n; i++) {
      let pred = beta[0] // 截距
      for (let j = 0; j < k; j++) {
        pred += beta[j + 1] * X[j][i]
      }
      residuals.push(Y[i] - pred)
    }
    return residuals
  }

  /** 偏相关系数：控制 controlVars 后，x 与 y 的净相关 */
  private partialCorrelation(
    x: number[], y: number[], controlVars: number[][],
  ): number {
    const validControlVars = controlVars.filter(c => c.length === x.length)
    if (validControlVars.length === 0) return this.pearsonCorrelation(x, y)

    const xRes = this.regressionResiduals(x, validControlVars)
    const yRes = this.regressionResiduals(y, validControlVars)
    return this.pearsonCorrelation(xRes, yRes)
  }

  /** 高斯消元求解线性方程组 Ax = b */
  private gaussElimination(A: number[][], b: number[]): number[] | null {
    const n = A.length
    const M: number[][] = A.map((row, i) => [...row, b[i]])

    for (let col = 0; col < n; col++) {
      // 部分主元选取
      let maxRow = col
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
      }
      if (Math.abs(M[maxRow][col]) < 1e-12) return null
      ;[M[col], M[maxRow]] = [M[maxRow], M[col]]

      for (let row = col + 1; row < n; row++) {
        const factor = M[row][col] / M[col][col]
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j]
        }
      }
    }

    const x: number[] = Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n]
      for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j]
      x[i] = sum / M[i][i]
    }
    return x
  }

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length)
  }

  // ==================== 报告导出 ====================

  async generateReportWord(result: ExtremeScenarioResult) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
    const r = result.report

    const children: any[] = [
      new Paragraph({ text: '极端场景应对方案报告', heading: HeadingLevel.TITLE, spacing: { after: 300 } }),
    ]

    // 一、电站基础信息
    children.push(new Paragraph({ text: '一、模拟电站基础信息', heading: HeadingLevel.HEADING_1 }))
    const si = r.stationInfo
    children.push(
      new Paragraph({ text: `电站名称：${si.stationName}` }),
      new Paragraph({ text: `装机容量：${si.installedCapacityMw} MW` }),
      new Paragraph({ text: `并网电压等级：${si.gridConnectionVoltageKv} kV` }),
      new Paragraph({ text: `所属区域：${si.zone}` }),
      new Paragraph({ text: `关联母线：${si.busName}` }),
      new Paragraph({ text: `储能配置：${si.storagePowerMw}MW / ${si.storageCapacityMwh}MWh` }),
      new Paragraph({ text: '', spacing: { after: 100 } }),
    )

    // 场景参数
    children.push(new Paragraph({ children: [new TextRun({ text: '本次模拟场景参数：', bold: true })] }))
    for (const [k, v] of Object.entries(r.scenarioParams)) {
      children.push(new Paragraph({ text: `${k}：${v}` }))
    }
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }))

    // 二、模拟数据分析
    children.push(new Paragraph({ text: '二、模拟数据分析', heading: HeadingLevel.HEADING_1 }))
    const da = r.dataAnalysis
    children.push(
      new Paragraph({ children: [new TextRun({ text: '出力骤降分析：', bold: true })] }),
      new Paragraph({ text: `  全天出力平均骤降 ${da.outputDrop.overallDropPct}%，最大骤降发生在 ${da.outputDrop.peakDropHour}（${da.outputDrop.peakDropPct}%），最严重时段 ${da.outputDrop.worstPeriod}` }),
      new Paragraph({ children: [new TextRun({ text: '供电保障分析：', bold: true })] }),
      new Paragraph({ text: `  全天供电保障率 ${da.supplyGuarantee.avgRate}%，供电最紧张时段 ${da.supplyGuarantee.minRateHour}` }),
      new Paragraph({ children: [new TextRun({ text: '供需缺口分析：', bold: true })] }),
      new Paragraph({ text: `  最大供需缺口 ${da.supplyGap.maxGapMw} MW（${da.supplyGap.maxGapHour}），全天累计缺电量 ${da.supplyGap.totalShortfallMwh} MWh，缺口时段 ${da.supplyGap.gapPeriod}` }),
      new Paragraph({ children: [new TextRun({ text: '备用需求分析：', bold: true })] }),
      new Paragraph({ text: `  峰值备用需求 ${da.backup.peakRequiredMw} MW（${da.backup.peakRequiredHour}），推荐 ${da.backup.recommendedType} 配置 ${da.backup.recommendedCapacityMw} MW` }),
    )
    if (da.temperature) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: '温度分析：', bold: true })] }),
        new Paragraph({ text: `  最高环境温度 ${da.temperature.maxTempC}℃（${da.temperature.maxTempHour}），光伏面板峰值温度约 ${da.temperature.peakPanelTempC}℃，高温窗口 ${da.temperature.highTempWindow}` }),
      )
    }
    if (da.rainstorm) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: '暴雨影响分析：', bold: true })] }),
        new Paragraph({ text: `  最大降雨强度 ${da.rainstorm.maxIntensityMmh} mm/h，云层覆盖率 ${da.rainstorm.cloudCoverPct}%，影响时长 ${da.rainstorm.affectedHours}h，最严重时段 ${da.rainstorm.worstPeriod}` }),
      )
    }
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }))

    // 三、策略分析
    children.push(new Paragraph({ text: '三、策略分析', heading: HeadingLevel.HEADING_1 }))
    const sa = r.strategyAnalysis

    if (sa.cooling) {
      children.push(new Paragraph({ text: '散热策略', heading: HeadingLevel.HEADING_2 }))
      children.push(new Paragraph({ text: `面板温度估算：${sa.cooling.panelTempEstimate}` }))
      children.push(new Paragraph({ text: `逆变器风险时段：${sa.cooling.inverterRiskPeriods}` }))
      children.push(new Paragraph({ children: [new TextRun({ text: '散热措施：', bold: true })] }))
      for (const m of sa.cooling.measures) {
        children.push(new Paragraph({ text: `  • ${m}` }))
      }
      children.push(new Paragraph({ text: `预期效果：${sa.cooling.expectedEffect}` }))
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }))
    }

    if (sa.protection) {
      children.push(new Paragraph({ text: '防护策略', heading: HeadingLevel.HEADING_2 }))
      children.push(new Paragraph({ text: `防水评估：${sa.protection.waterproofAssessment}` }))
      children.push(new Paragraph({ text: `线路保护：${sa.protection.lineProtectionAdvice}` }))
      children.push(new Paragraph({ text: `排水建议：${sa.protection.drainageAdvice}` }))
      children.push(new Paragraph({ children: [new TextRun({ text: '应急物资：', bold: true })] }))
      for (const s of sa.protection.emergencySupplies) {
        children.push(new Paragraph({ text: `  • ${s}` }))
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }))
    }

    if (sa.scheduling) {
      children.push(new Paragraph({ text: '调度策略', heading: HeadingLevel.HEADING_2 }))
      children.push(new Paragraph({ text: `储能调度：${sa.scheduling.storageStrategy}` }))
      children.push(new Paragraph({ text: `光伏建议：${sa.scheduling.pvLimitAdvice}` }))
      children.push(new Paragraph({ text: `负荷调度：${sa.scheduling.loadShedAdvice}` }))
      children.push(new Paragraph({ text: `检修建议：${sa.scheduling.maintenanceAdvice}` }))
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }))
    }

    // 四、总结报告
    children.push(new Paragraph({ text: '四、总结报告', heading: HeadingLevel.HEADING_1 }))
    const c = r.conclusion
    children.push(new Paragraph({ children: [new TextRun({ text: '关键结论：', bold: true })] }))
    for (const f of c.keyFindings) {
      children.push(new Paragraph({ text: `  • ${f}` }))
    }
    children.push(new Paragraph({ text: '', spacing: { after: 100 } }))
    children.push(new Paragraph({ children: [new TextRun({ text: '量化指标：', bold: true })] }))
    children.push(new Paragraph({ text: `  总缺电量：${c.quantitativeMetrics.totalEnergyShortfallMwh} MWh` }))
    children.push(new Paragraph({ text: `  峰值备用需求：${c.quantitativeMetrics.peakBackupRequiredMw} MW` }))
    children.push(new Paragraph({ text: `  供电保障率：${c.quantitativeMetrics.avgSupplyGuaranteeRate}%` }))
    children.push(new Paragraph({ text: `  最大供需缺口：${c.quantitativeMetrics.maxSupplyGapMw} MW` }))
    children.push(new Paragraph({ text: '', spacing: { after: 100 } }))
    children.push(new Paragraph({ text: `备用电源配置建议：${c.backupRecommendation}` }))
    children.push(new Paragraph({ text: `综合风险评级：${c.riskLevelLabel}` }))

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toBuffer(doc)
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: `极端场景应对方案报告_${new Date().toISOString().slice(0, 10)}.docx`,
    }
  }

  async generateReportPdf(result: ExtremeScenarioResult) {
    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const buffers: Buffer[] = []
    doc.on('data', (chunk: Buffer) => buffers.push(chunk))
    const endPromise = new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(buffers))) })

    // 注册中文字体（Windows 系统黑体）
    doc.registerFont('SimHei', 'C:\\Windows\\Fonts\\simhei.ttf')
    const F = 'SimHei'

    const r = result.report
    const si = r.stationInfo
    const sa = r.strategyAnalysis
    const c = r.conclusion

    doc.font(F).fontSize(18).text('极端场景应对方案报告', { align: 'center' })
    doc.moveDown(0.8)

    // 一
    doc.font(F).fontSize(14).text('一、模拟电站基础信息')
    doc.font(F).fontSize(10)
      .text(`电站名称：${si.stationName}`)
      .text(`装机容量：${si.installedCapacityMw} MW`)
      .text(`并网电压等级：${si.gridConnectionVoltageKv} kV`)
      .text(`所属区域：${si.zone}`)
      .text(`关联母线：${si.busName}`)
      .text(`储能配置：${si.storagePowerMw}MW / ${si.storageCapacityMwh}MWh`)
    doc.moveDown(0.3)
    doc.font(F).fontSize(10).text('模拟参数：')
    for (const [k, v] of Object.entries(r.scenarioParams)) {
      doc.font(F).fontSize(10).text(`  ${k}：${v}`)
    }
    doc.moveDown(0.5)

    // 二、数据分析
    const da = r.dataAnalysis
    doc.font(F).fontSize(14).text('二、模拟数据分析')
    doc.font(F).fontSize(10)
    doc.font(F).text('【出力骤降分析】')
    doc.font(F).text(`  全天出力平均骤降 ${da.outputDrop.overallDropPct}%，最大骤降发生在 ${da.outputDrop.peakDropHour}（${da.outputDrop.peakDropPct}%），最严重时段 ${da.outputDrop.worstPeriod}`)
    doc.font(F).text('【供电保障分析】')
    doc.font(F).text(`  全天供电保障率 ${da.supplyGuarantee.avgRate}%，供电最紧张时段 ${da.supplyGuarantee.minRateHour}`)
    doc.font(F).text('【供需缺口分析】')
    doc.font(F).text(`  最大供需缺口 ${da.supplyGap.maxGapMw} MW（${da.supplyGap.maxGapHour}），全天累计缺电量 ${da.supplyGap.totalShortfallMwh} MWh，缺口时段 ${da.supplyGap.gapPeriod}`)
    if (da.temperature) {
      doc.font(F).text('【温度分析】')
      doc.font(F).text(`  最高环境温度 ${da.temperature.maxTempC}℃（${da.temperature.maxTempHour}），光伏面板峰值温度约 ${da.temperature.peakPanelTempC}℃，高温窗口 ${da.temperature.highTempWindow}`)
    }
    if (da.rainstorm) {
      doc.font(F).text('【暴雨影响分析】')
      doc.font(F).text(`  最大降雨强度 ${da.rainstorm.maxIntensityMmh} mm/h，云层覆盖率 ${da.rainstorm.cloudCoverPct}%，影响时长 ${da.rainstorm.affectedHours}h，最严重时段 ${da.rainstorm.worstPeriod}`)
    }
    doc.font(F).text('【备用需求分析】')
    doc.font(F).text(`  峰值备用需求 ${da.backup.peakRequiredMw} MW（${da.backup.peakRequiredHour}），推荐 ${da.backup.recommendedType} 配置 ${da.backup.recommendedCapacityMw} MW`)
    doc.moveDown(0.5)

    // 三
    doc.font(F).fontSize(14).text('三、策略分析')
    doc.font(F).fontSize(10)

    if (sa.cooling) {
      doc.font(F).fontSize(11).text('散热策略')
      doc.font(F).fontSize(10)
        .text(`面板温度估算：${sa.cooling.panelTempEstimate}`)
        .text(`逆变器风险时段：${sa.cooling.inverterRiskPeriods}`)
        .text('散热措施：')
      for (const m of sa.cooling.measures) { doc.font(F).text(`  • ${m}`) }
      doc.font(F).text(`预期效果：${sa.cooling.expectedEffect}`)
      doc.moveDown(0.3)
    }

    if (sa.protection) {
      doc.font(F).fontSize(11).text('防护策略')
      doc.font(F).fontSize(10)
        .text(`防水评估：${sa.protection.waterproofAssessment}`)
        .text(`线路保护：${sa.protection.lineProtectionAdvice}`)
        .text(`排水建议：${sa.protection.drainageAdvice}`)
        .text('应急物资：')
      for (const s of sa.protection.emergencySupplies) { doc.font(F).text(`  • ${s}`) }
      doc.moveDown(0.3)
    }

    if (sa.scheduling) {
      doc.font(F).fontSize(11).text('调度策略')
      doc.font(F).fontSize(10)
        .text(`储能调度：${sa.scheduling.storageStrategy}`)
        .text(`光伏建议：${sa.scheduling.pvLimitAdvice}`)
        .text(`负荷调度：${sa.scheduling.loadShedAdvice}`)
        .text(`检修建议：${sa.scheduling.maintenanceAdvice}`)
      doc.moveDown(0.5)
    }

    // 四
    doc.font(F).fontSize(14).text('四、总结报告')
    doc.font(F).fontSize(10)
    doc.text('关键结论：')
    for (const f of c.keyFindings) { doc.font(F).text(`  • ${f}`) }
    doc.moveDown(0.3)
    doc.font(F).text('量化指标：')
    doc.font(F).text(`  总缺电量：${c.quantitativeMetrics.totalEnergyShortfallMwh} MWh`)
    doc.font(F).text(`  峰值备用需求：${c.quantitativeMetrics.peakBackupRequiredMw} MW`)
    doc.font(F).text(`  供电保障率：${c.quantitativeMetrics.avgSupplyGuaranteeRate}%`)
    doc.font(F).text(`  最大供需缺口：${c.quantitativeMetrics.maxSupplyGapMw} MW`)
    doc.moveDown(0.3)
    doc.font(F).text(`备用电源配置建议：${c.backupRecommendation}`)
    doc.font(F).text(`综合风险评级：${c.riskLevelLabel}`)

    doc.end()
    const buffer = await endPromise
    return {
      buffer,
      contentType: 'application/pdf',
      filename: `极端场景应对方案报告_${new Date().toISOString().slice(0, 10)}.pdf`,
    }
  }
}
