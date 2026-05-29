import { db } from '../../config/database.js'
import type { PvOutputStatsQuery, ExtremeScenarioType, ExtremeScenarioResult } from '@new-energy/shared'

export class GridDiagnosisService {
  // ==================== PV Output ====================
  async getPvOutputStats(query: PvOutputStatsQuery) {
    const { startDate, endDate, aggregationType } = query
    return db('pv_output_measurements')
      .whereBetween('time', [startDate, endDate])
      .select(
        'station_id',
        db.raw('SUM(active_power_kw * interval_hours) as total_output_kwh'),
        db.raw('AVG(active_power_kw) as avg_output_kw'),
        db.raw('MAX(active_power_kw) as max_output_kw'),
      )
      .groupBy('station_id')
  }

  async getFactors(query: { plantId: string; startDate: string; endDate: string }) {
    const { plantId, startDate, endDate } = query
    const data = await db('pv_output_measurements')
      .where('station_id', plantId)
      .whereBetween('time', [startDate, endDate])
      .select('active_power_kw', 'temperature_c', 'irradiance_wm2', 'humidity_pct', 'inverter_efficiency')
      .orderBy('time', 'asc')

    // Calculate correlation coefficients
    const factors = ['irradiance', 'temperature', 'humidity', 'inverter_efficiency'] as const
    return factors.map((factor) => {
      const fieldMap = { irradiance: 'irradiance_wm2', temperature: 'temperature_c', humidity: 'humidity_pct', inverter_efficiency: 'inverter_efficiency' }
      const xArr = data.map((d) => d[fieldMap[factor]])
      const yArr = data.map((d) => d.active_power_kw)
      const correlation = this.pearsonCorrelation(xArr, yArr)
      return {
        plantId,
        factorType: factor,
        correlationCoefficient: correlation,
        impactDescription: `${factor} 与光伏出力的相关系数为 ${correlation.toFixed(3)}`,
        chartData: xArr.map((x, i) => ({ x, y: yArr[i] })),
      }
    })
  }

  async simulateExtreme(params: { plantId: string; scenarioType: ExtremeScenarioType }): Promise<ExtremeScenarioResult> {
    const { scenarioType } = params
    const dropPct = scenarioType === 'high_temperature' ? 0.15 : 0.25
    const backupFactor = scenarioType === 'high_temperature' ? 0.2 : 0.3
    const capacityBase = 1000 // Should come from plant data

    return {
      scenarioType,
      outputDropPct: dropPct * 100,
      absorptionCapacityChange: -dropPct * capacityBase,
      backupCapacityRequired: capacityBase * backupFactor,
      recommendations:
        scenarioType === 'high_temperature'
          ? ['加强散热装置维护', '调整逆变器运行参数', '启用备用电源']
          : ['加固设备防潮措施', '调整线路保护定值', '启用排水设施'],
      timeSeriesData: [], // Would be populated from simulation engine
    }
  }

  // ==================== Carbon ====================
  async getCarbonStats(query: { plantId?: string; startDate: string; endDate: string }) {
    return db('carbon_emissions')
      .whereBetween('period_start', [query.startDate, query.endDate])
      .modify((qb) => { if (query.plantId) qb.where('station_id', query.plantId) })
      .orderBy('period_start', 'desc')
  }

  // ==================== Joint Output ====================
  async getJointOutputAnalysis(query: { plantId: string; storageId: string; startDate: string; endDate: string }) {
    // Join PV output with storage data
    const pvData = await db('pv_output_measurements')
      .where('station_id', query.plantId)
      .whereBetween('time', [query.startDate, query.endDate])
      .select('time', 'active_power_kw')
      .orderBy('time', 'asc')

    return {
      plantId: query.plantId,
      storageId: query.storageId,
      timeSeries: pvData.map((d) => ({
        time: d.time,
        pvOutputKw: d.active_power_kw,
        storageChargeKw: 0, // placeholder
        storageDischargeKw: 0,
        jointOutputKw: d.active_power_kw,
      })),
      fluctuationStdDev: this.stdDev(pvData.map((d) => d.active_power_kw)),
      peakValleyDiff: Math.max(...pvData.map((d) => d.active_power_kw)) - Math.min(...pvData.map((d) => d.active_power_kw)),
      peakShavingCapacityKw: 0,
    }
  }

  // ==================== Backfeed ====================
  async detectBackfeed(params: { plantId: string; threshold?: number }) {
    const data = await db('pv_output_measurements')
      .where('station_id', params.plantId)
      .select('time', 'active_power_kw')
      .orderBy('time', 'desc')
      .limit(1000)

    return data.map((d) => ({
      time: d.time,
      activePowerKw: d.active_power_kw,
      direction: d.active_power_kw < 0 ? 'reverse' : 'forward',
      isBackfeed: d.active_power_kw < -(params.threshold || 0),
    }))
  }

  // ==================== Equipment ====================
  async calculateCapacity(query: { equipmentType?: string; plantId?: string }) {
    const qb = db('equipment').modify((q) => {
      if (query.equipmentType) q.where('equipment_type', query.equipmentType)
      if (query.plantId) q.where('station_id', query.plantId)
    })
    return qb.select(
      'id as equipmentId',
      'equipment_type as equipmentType',
      'rated_capacity_kva as ratedCapacityKva',
      'rated_current_a as ratedCurrentA',
    )
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

    // 查询电池循环记录
    const cycleRecords = await db('battery_cycle_records')
      .where('equipment_id', params.equipmentId)
      .orderBy('record_month', 'asc')

    if (!cycleRecords.length) {
      // 非电池设备，返回日历寿命
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

    // 计算近6个月平均月衰减率
    const recentRecords = cycleRecords.slice(-6)
    const degradationRates: number[] = []
    for (let i = 1; i < recentRecords.length; i++) {
      const sohDiff = recentRecords[i - 1].soh_pct - recentRecords[i].soh_pct
      degradationRates.push(sohDiff)
    }
    const avgMonthlyDegradation = degradationRates.length > 0
      ? degradationRates.reduce((a, b) => a + b, 0) / degradationRates.length
      : 0.15

    // 失效阈值 80% SOH
    const failureSoh = 80
    const sohRemaining = Math.max(0, sohPct - failureSoh)
    const estimatedRemainingMonths = avgMonthlyDegradation > 0 ? sohRemaining / avgMonthlyDegradation : 60
    const estimatedRemainingYears = estimatedRemainingMonths / 12

    // 近6个月平均月循环次数
    const recentMonthlyCycles = recentRecords.map(r => r.cycle_count)
    const avgMonthlyCycles = recentMonthlyCycles.reduce((a, b) => a + b, 0) / recentMonthlyCycles.length
    const estimatedRemainingCycles = Math.round(avgMonthlyCycles * estimatedRemainingMonths)

    // 近6个月平均DOD和温度
    const avgDod = +(recentRecords.reduce((a, r) => a + r.avg_dod_pct, 0) / recentRecords.length).toFixed(1)
    const avgTemp = +(recentRecords.reduce((a, r) => a + r.avg_temp_c, 0) / recentRecords.length).toFixed(1)

    // 生成更换建议
    const replacementDate = new Date()
    replacementDate.setMonth(replacementDate.getMonth() + Math.round(estimatedRemainingMonths))

    return {
      equipmentId: params.equipmentId,
      currentAgeYears: +ageYears.toFixed(1),
      designLifeYears: equipment.design_life_years,
      remainingLifeYears: +Math.min(calendarLifeYears, estimatedRemainingYears).toFixed(1),
      degradationRate: +avgMonthlyDegradation.toFixed(3),
      // 电池特有字段
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
      // 最近12个月月度数据
      monthlyHistory: cycleRecords.slice(-12).map(r => ({
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
    // 获取所有电池设备的最新循环记录
    let query = db('equipment').where('equipment_type', 'BATTERY').select('id', 'name', 'model_number', 'station_id', 'grade')
    if (params.plantId) {
      query = query.where('station_id', params.plantId)
    }
    const batteryEquipment = await query

    const plans: any[] = []
    for (const eq of batteryEquipment) {
      const latest = await db('battery_cycle_records')
        .where('equipment_id', eq.id)
        .orderBy('record_month', 'desc')
        .first()

      if (!latest || latest.soh_pct > 85) continue // SOH>85%暂不需要更换计划

      const plant = await db('solar_pv_stations').where('id', eq.station_id).select('station_name as name').first()
      // 计算剩余月份
      const recentRecords = await db('battery_cycle_records')
        .where('equipment_id', eq.id)
        .orderBy('record_month', 'desc')
        .limit(6)
      const rates: number[] = []
      for (let i = 1; i < recentRecords.length; i++) {
        rates.push(recentRecords[i - 1].soh_pct - recentRecords[i].soh_pct)
      }
      const avgDeg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0.15
      const remainingMonths = avgDeg > 0 ? Math.round((latest.soh_pct - 80) / avgDeg) : 36

      const replacementDate = new Date()
      replacementDate.setMonth(replacementDate.getMonth() + remainingMonths)

      // 估算更换成本（元/kWh × 容量）
      const capacityKwh = latest.cumulative_energy_mwh
        ? Math.round(latest.cumulative_energy_mwh * 1000 / latest.cumulative_cycles)
        : 5000
      const estimatedCost = capacityKwh * (eq.grade === 'C' ? 1200 : eq.grade === 'B' ? 1100 : 1000)

      plans.push({
        equipmentId: eq.id,
        equipmentName: eq.name || eq.model_number || eq.id,
        plantName: plant?.name || '-',
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
        db.raw(`COUNT(*) FILTER (WHERE ABS(voltage_deviation_pct) <= 7) as qualified_hours`),
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

  // ==================== Helpers ====================
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
    const sumX2 = x.reduce((a, b) => a + b * b, 0)
    const sumY2 = y.reduce((a, b) => a + b * b, 0)
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  }

  private stdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length)
  }
}
