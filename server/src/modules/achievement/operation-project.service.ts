import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

export class OperationProjectService {
  // ==================== 运行数据实时聚合（不写入数据库） ====================

  async getRunningStats(projectId: string, periodStart: string, periodEnd: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project) throw new Error('项目不存在')

    const stationId = (project as any).station_id
    if (!stationId) throw new Error('项目未关联实际电站')

    let installedCapacityMw = 0
    let nominalVoltageKv = 220
    const station = await db('solar_pv_stations').where('id', stationId).first()
    if (station) {
      installedCapacityMw = station.installed_capacity_mw || 0
      nominalVoltageKv = station.grid_connection_voltage_kv || 220
    }

    const autoValues = await this.aggregateMeasurements(
      stationId, periodStart, periodEnd, installedCapacityMw, nominalVoltageKv,
    )

    // 规划目标从 projects.custom_fields 读取
    const cf = JSON.parse((project as any).custom_fields || '{}')

    return {
      projectId,
      stationId,
      stationName: station?.station_name || null,
      periodStart,
      periodEnd,
      // 自动聚合值（单位与规划目标对齐：发电量=万kWh，率值=%）
      auto: {
        outputMwh: autoValues.outputKwh != null ? Math.round(autoValues.outputKwh / 100) / 100 : null,
        equivalentHours: autoValues.equivalentHours,
        voltageCompliancePct: autoValues.voltageCompliancePct,
        frequencyCompliancePct: autoValues.frequencyCompliancePct,
        powerFactorRate: autoValues.powerFactorRate,
        voltageViolationRate: autoValues.voltageViolationRate,
        reactiveReverseRate: autoValues.reactiveReverseRate,
        absorptionRatePct: null,  // 消纳率无法自动计算，需手动录入
        completenessPct: autoValues.completenessPct,
      },
      // 规划目标（与 auto 字段名/单位对齐）
      planned: {
        outputMwh: cf.planned_annual_output_mwh ?? null,
        equivalentHours: cf.planned_equivalent_hours ?? null,
        absorptionRatePct: cf.planned_absorption_rate_pct ?? null,
        voltageCompliancePct: cf.planned_voltage_compliance_pct ?? null,
      },
    }
  }

  // ==================== 成效验证评估 ====================

  async listVerifications(projectId: string) {
    return db('effectiveness_verifications')
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
  }

  async getVerification(id: string) {
    return db('effectiveness_verifications').where('id', id).first()
  }

  async createVerification(projectId: string, data: any, userId: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project) throw new Error('项目不存在')

    const id = uuid()
    const periodStart = data.periodStart
    const periodEnd = data.periodEnd
    const stationId = (project as any).station_id

    let installedCapacityMw = 0
    let nominalVoltageKv = 220
    if (stationId) {
      const station = await db('solar_pv_stations').where('id', stationId).first()
      installedCapacityMw = station?.installed_capacity_mw || 0
      nominalVoltageKv = station?.grid_connection_voltage_kv || 220
    }

    const autoValues = await this.aggregateMeasurements(
      stationId, periodStart, periodEnd, installedCapacityMw, nominalVoltageKv,
    )

    // 手动修正值
    const finalOutputKwh = data.finalOutputKwh ?? null
    const finalEquivalentHours = data.finalEquivalentHours ?? null
    const finalVoltageCompliancePct = data.finalVoltageCompliancePct ?? null
    const finalFrequencyCompliancePct = data.finalFrequencyCompliancePct ?? null
    const finalPowerFactorRate = data.finalPowerFactorRate ?? null
    const finalVoltageViolationRate = data.finalVoltageViolationRate ?? null
    const finalReactiveReverseRate = data.finalReactiveReverseRate ?? null
    const finalCompletenessPct = data.finalCompletenessPct ?? null
    const correctionNote = data.correctionNote || null

    const hasManualOverride = (
      finalOutputKwh !== null ||
      finalEquivalentHours !== null ||
      finalVoltageCompliancePct !== null ||
      finalFrequencyCompliancePct !== null ||
      finalPowerFactorRate !== null ||
      finalVoltageViolationRate !== null ||
      finalReactiveReverseRate !== null ||
      finalCompletenessPct !== null
    ) ? 1 : 0

    const cf = JSON.parse((project as any).custom_fields || '{}')
    const plannedOutputMwh = cf.planned_annual_output_mwh ?? null
    const plannedEquivalentHours = cf.planned_equivalent_hours ?? null
    const plannedAbsorptionRatePct = cf.planned_absorption_rate_pct ?? null
    const plannedVoltageCompliancePct = cf.planned_voltage_compliance_pct ?? null

    const absorptionRatePct = data.absorptionRatePct ?? null

    let isEffective = 1
    const finalOut = finalOutputKwh ?? autoValues.outputKwh
    const finalVol = finalVoltageCompliancePct ?? autoValues.voltageCompliancePct
    const finalFreq = finalFrequencyCompliancePct ?? autoValues.frequencyCompliancePct
    const finalPF = finalPowerFactorRate ?? autoValues.powerFactorRate

    if (plannedOutputMwh && finalOut) {
      const dev = Math.abs((finalOut / 10000 - plannedOutputMwh) / plannedOutputMwh * 100)
      if (dev > 10) isEffective = 0
    }
    if (plannedVoltageCompliancePct && finalVol) {
      if (Math.abs(finalVol - plannedVoltageCompliancePct) > 10) isEffective = 0
    }
    if (finalFreq && finalFreq < 99) isEffective = 0
    if (finalPF && finalPF < 95) isEffective = 0

    await db('effectiveness_verifications').insert({
      id,
      project_id: projectId,
      period_start: periodStart,
      period_end: periodEnd,

      auto_output_kwh: autoValues.outputKwh,
      auto_equivalent_hours: autoValues.equivalentHours,
      auto_voltage_compliance_pct: autoValues.voltageCompliancePct,
      auto_frequency_compliance_pct: autoValues.frequencyCompliancePct,
      auto_power_factor_rate: autoValues.powerFactorRate,
      auto_voltage_violation_rate_pct: autoValues.voltageViolationRate,
      auto_reactive_reverse_rate_pct: autoValues.reactiveReverseRate,
      auto_completeness_pct: autoValues.completenessPct,

      final_output_kwh: finalOutputKwh,
      final_equivalent_hours: finalEquivalentHours,
      final_voltage_compliance_pct: finalVoltageCompliancePct,
      final_frequency_compliance_pct: finalFrequencyCompliancePct,
      final_power_factor_rate: finalPowerFactorRate,
      final_voltage_violation_rate_pct: finalVoltageViolationRate,
      final_reactive_reverse_rate_pct: finalReactiveReverseRate,
      final_completeness_pct: finalCompletenessPct,

      absorption_rate_pct: absorptionRatePct,

      planned_output_mwh: plannedOutputMwh,
      planned_equivalent_hours: plannedEquivalentHours,
      planned_absorption_rate_pct: plannedAbsorptionRatePct,
      planned_voltage_compliance_pct: plannedVoltageCompliancePct,

      manual_override: hasManualOverride,
      correction_note: correctionNote,

      is_effective: isEffective,
      remarks: data.remarks || null,

      verified_by: userId,
      created_at: new Date().toISOString(),
    })

    return this.getVerification(id)
  }

  async updateVerification(id: string, data: any) {
    const current = await db('effectiveness_verifications').where('id', id).first()
    if (!current) return null

    const updateData: Record<string, any> = {}
    if (data.finalOutputKwh !== undefined) updateData.final_output_kwh = data.finalOutputKwh
    if (data.finalEquivalentHours !== undefined) updateData.final_equivalent_hours = data.finalEquivalentHours
    if (data.finalVoltageCompliancePct !== undefined) updateData.final_voltage_compliance_pct = data.finalVoltageCompliancePct
    if (data.finalFrequencyCompliancePct !== undefined) updateData.final_frequency_compliance_pct = data.finalFrequencyCompliancePct
    if (data.finalPowerFactorRate !== undefined) updateData.final_power_factor_rate = data.finalPowerFactorRate
    if (data.finalVoltageViolationRate !== undefined) updateData.final_voltage_violation_rate_pct = data.finalVoltageViolationRate
    if (data.finalReactiveReverseRate !== undefined) updateData.final_reactive_reverse_rate_pct = data.finalReactiveReverseRate
    if (data.finalCompletenessPct !== undefined) updateData.final_completeness_pct = data.finalCompletenessPct
    if (data.absorptionRatePct !== undefined) updateData.absorption_rate_pct = data.absorptionRatePct
    if (data.correctionNote !== undefined) updateData.correction_note = data.correctionNote
    if (data.remarks !== undefined) updateData.remarks = data.remarks
    if (data.isEffective !== undefined) updateData.is_effective = data.isEffective

    const merged = { ...current, ...updateData }
    const hasManualOverride = (
      merged.final_output_kwh !== null ||
      merged.final_equivalent_hours !== null ||
      merged.final_voltage_compliance_pct !== null ||
      merged.final_frequency_compliance_pct !== null ||
      merged.final_power_factor_rate !== null ||
      merged.final_voltage_violation_rate_pct !== null ||
      merged.final_reactive_reverse_rate_pct !== null ||
      merged.final_completeness_pct !== null
    ) ? 1 : 0
    updateData.manual_override = hasManualOverride

    const finalOut = merged.final_output_kwh ?? merged.auto_output_kwh
    const finalVol = merged.final_voltage_compliance_pct ?? merged.auto_voltage_compliance_pct
    const finalFreq = merged.final_frequency_compliance_pct ?? merged.auto_frequency_compliance_pct
    const finalPF = merged.final_power_factor_rate ?? merged.auto_power_factor_rate
    const planned = merged.planned_output_mwh
    const plannedVol = merged.planned_voltage_compliance_pct

    let isEffective = 1
    if (planned && finalOut) {
      const dev = Math.abs((finalOut / 10000 - planned) / planned * 100)
      if (dev > 10) isEffective = 0
    }
    if (plannedVol && finalVol) {
      if (Math.abs(finalVol - plannedVol) > 10) isEffective = 0
    }
    if (finalFreq && finalFreq < 99) isEffective = 0
    if (finalPF && finalPF < 95) isEffective = 0
    updateData.is_effective = isEffective

    await db('effectiveness_verifications').where('id', id).update(updateData)
    return this.getVerification(id)
  }

  // ==================== 成效评估报告生成 ====================

  async generateReport(verificationId: string) {
    const v = await db('effectiveness_verifications').where('id', verificationId).first()
    if (!v) throw new Error('评估记录不存在')

    const project = await db('projects').where('id', v.project_id).first()
    if (!project) throw new Error('项目不存在')

    const station = project.station_id
      ? await db('solar_pv_stations').where('id', project.station_id).first()
      : null

    const cf = JSON.parse(project.custom_fields || '{}')

    const f = (auto: any, final: any) => final ?? auto
    const pct = (v: number | null) => v != null ? v.toFixed(1) + '%' : '-'

    // 指标项（区分正向/反向/中性）
    type Itype = 'positive' | 'negative' | 'neutral'
    function item(label: string, planned: number | null, auto: number | null, final: number | null, unit: string, itype: Itype) {
      const actual = f(auto, final)
      let dev: number | null = null, devStr = '-', status = '正常'
      if (planned != null && actual != null) {
        if (itype === 'negative') {
          dev = actual - planned; devStr = (dev>0?'+':'')+dev.toFixed(2)+'个百分点'; status = dev > 0 ? '偏差' : '正常'
        } else if (itype === 'positive') {
          dev = actual - planned; devStr = (dev>0?'+':'')+dev.toFixed(2)+'个百分点'; status = dev < 0 ? '偏差' : '正常'
        } else {
          dev = (actual - planned) / planned * 100; devStr = (dev>0?'+':'')+dev.toFixed(2)+'%'; status = Math.abs(dev) > 10 ? '偏差' : '正常'
        }
      }
      return { label, planned: planned != null ? planned + unit : '-', actual: actual != null ? actual + unit : '-', deviation: devStr, status }
    }

    const dims = [
      {
        dimension: '并网性能',
        indicators: [
          item('电压合格率', cf.planned_voltage_compliance_pct ?? null, v.auto_voltage_compliance_pct, v.final_voltage_compliance_pct, '%', 'positive'),
          item('频率合格率', null, v.auto_frequency_compliance_pct, v.final_frequency_compliance_pct, '%', 'positive'),
          item('功率因数达标率', null, v.auto_power_factor_rate, v.final_power_factor_rate, '%', 'positive'),
        ],
      },
      {
        dimension: '电网影响',
        indicators: [
          item('电压越限率', null, v.auto_voltage_violation_rate_pct, v.final_voltage_violation_rate_pct, '%', 'negative'),
          item('无功倒送率', null, v.auto_reactive_reverse_rate_pct, v.final_reactive_reverse_rate_pct, '%', 'negative'),
          item('消纳率', cf.planned_absorption_rate_pct ?? null, null, v.absorption_rate_pct, '%', 'positive'),
        ],
      },
      {
        dimension: '经济效益',
        indicators: [
          {
            ...item('发电量(万kWh)', cf.planned_annual_output_mwh ?? null, v.auto_output_kwh != null ? Math.round(v.auto_output_kwh / 1000) / 10 : null, v.final_output_kwh != null ? Math.round(v.final_output_kwh / 1000) / 10 : null, '', 'neutral'),
            label: '发电量', unit: '万kWh',
            planned: cf.planned_annual_output_mwh != null ? cf.planned_annual_output_mwh + '万kWh' : '-',
            actual: (f(v.auto_output_kwh != null ? Math.round(v.auto_output_kwh / 1000) / 10 : null, v.final_output_kwh != null ? Math.round(v.final_output_kwh / 1000) / 10 : null)?.toFixed(1) || '-') + '万kWh',
          },
          {
            ...item('等效利用小时', cf.planned_equivalent_hours ?? null, v.auto_equivalent_hours, v.final_equivalent_hours, 'h', 'neutral'),
            label: '等效利用小时', unit: 'h',
          },
          item('数据完整率', null, v.auto_completeness_pct, v.final_completeness_pct, '%', 'positive'),
        ],
      },
    ]

    // 偏差项（含自动原因）
    const causeMap: Record<string, string> = {
      '发电量': '理论发电量基于标准辐照条件估算，实际运行受气象条件、组件衰减、逆变器效率、灰尘遮挡等因素影响，可能导致实际出力低于预期',
      '等效利用小时': '利用小时数偏低通常与发电量不足直接相关，也可能受电网限电、设备故障停机、检修时间长等因素影响',
      '电压合格率': '电压偏差可能源于电网侧电压波动、无功补偿装置容量不足、变压器分接头设置不当或逆变器无功控制策略未优化',
      '频率合格率': '频率偏差通常反映电网侧频率波动或电站孤岛检测灵敏度设置不当，也可能是测量装置精度问题',
      '功率因数达标率': '功率因数偏低通常由无功补偿不足引起，可能原因包括电容器组容量衰减、SVG控制参数不当、逆变器无功出力未能充分利用',
      '电压越限率': '电压越限说明电站出力对电网电压产生了显著影响，可能因为接入点短路容量偏小、线路阻抗较大、无功控制响应速度不够',
      '无功倒送率': '无功倒送可能由逆变器无功控制策略不当、电网电压偏高导致逆变器吸收无功、或并网点电压调节需求引起',
      '消纳率': '消纳率偏低可能受电网调度限制、线路输送容量瓶颈、区域负荷消纳空间不足或电力市场交易机制影响',
      '数据完整率': '数据完整率不足可能由通信中断、测量装置故障、数据采集系统异常或维护期间设备停机导致',
    }
    const deviations: any[] = []
    for (const dim of dims) {
      for (const ind of dim.indicators as any[]) {
        if (ind.status === '偏差') {
          deviations.push({
            dimension: dim.dimension, indicator: ind.label,
            planned: ind.planned, actual: ind.actual, deviation: ind.deviation,
            autoCause: causeMap[ind.label] || '该指标出现偏差，建议结合现场运行日志、设备检修记录和电网调度数据做进一步根因分析',
          })
        }
      }
    }

    // 成效亮点（结构化）
    const highlights: Array<{text:string;dimension:string;indicator:string}> = []
    for (const dim of dims) {
      for (const ind of dim.indicators as any[]) {
        if (ind.status === '正常' && ind.deviation !== '-' && ind.label !== '电压越限率' && ind.label !== '无功倒送率') {
          highlights.push({ text: `${dim.dimension}·${ind.label}：实际${ind.actual}，符合规划预期`, dimension: dim.dimension, indicator: ind.label })
        }
      }
    }
    if (highlights.length === 0) highlights.push({ text: '各项指标均需关注', dimension: '综合', indicator: '' })

    // 改进项（结构化）
    const improvements = deviations.map(d => ({ text: `${d.dimension}·${d.indicator}偏差${d.deviation}，建议核查运行工况并制定整改措施`, dimension: d.dimension, indicator: d.indicator }))

    return {
      projectInfo: {
        projectCode: project.project_code,
        projectName: project.project_name,
        stationName: station?.station_name || '-',
        capacityMw: station?.installed_capacity_mw || '-',
        gridVoltageKv: station?.grid_connection_voltage_kv || '-',
        operationDate: project.actual_completion_date || '-',
      },
      evaluationPeriod: {
        start: v.period_start?.slice(0, 10),
        end: v.period_end?.slice(0, 10),
      },
      dimensions: dims,
      deviations,
      highlights: highlights.slice(0, 5),
      improvements: improvements.slice(0, 5),
      dataCompleteness: pct(f(v.auto_completeness_pct, v.final_completeness_pct)),
      hasManualCorrection: v.manual_override === 1,
      correctionNote: v.correction_note || null,
      overallVerdict: v.is_effective ? '达标' : '未达标',
      verifiedAt: v.created_at?.slice(0, 10),
    }
  }

  // ==================== 经验教训案例库 ====================

  async listLessons(projectId: string) {
    return db('lesson_learned')
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
  }

  async createLesson(data: any, userId: string) {
    const [row] = await db('lesson_learned').insert({
      id: uuid(),
      project_id: data.projectId,
      verification_id: data.verificationId || null,
      title: data.title,
      type: data.type,
      dimension: data.dimension,
      indicator: data.indicator || null,
      content: data.content,
      cause: data.cause || null,
      suggestion: data.suggestion || null,
      created_by: userId,
      created_at: new Date().toISOString(),
    }).returning('*')
    return row
  }

  async deleteLesson(id: string) {
    await db('lesson_learned').where('id', id).del()
    return { deleted: true }
  }

  // ==================== 竣工对标（功能二） ====================

  async getCompletionComparison(projectId: string) {
    const project = await db('projects').where('id', projectId).first()
    if (!project) throw new Error('项目不存在')
    const stationId = (project as any).station_id
    if (!stationId) throw new Error('项目未关联实际电站')

    const station = await db('solar_pv_stations').where('id', stationId).first()
    const installedCapacityMw = station?.installed_capacity_mw || 0
    const nominalVoltageKv = station?.grid_connection_voltage_kv || 220
    const completionDate = (project as any).actual_completion_date

    // 竣工至今全部数据
    const periodStart = completionDate || '2024-01-01'
    const periodEnd = new Date().toISOString().slice(0, 10)

    const auto = await this.aggregateMeasurements(stationId, periodStart, periodEnd, installedCapacityMw, nominalVoltageKv)
    const cf = JSON.parse((project as any).custom_fields || '{}')

    // 规划目标（项目设定 + 行业默认）
    const planned = {
      voltageCompliancePct: cf.planned_voltage_compliance_pct ?? 99,
      frequencyCompliancePct: cf.planned_frequency_compliance_pct ?? 99,
      powerFactorRate: cf.planned_power_factor_rate ?? 95,
      voltageViolationRate: cf.planned_voltage_violation_rate ?? 5,
      reactiveReverseRate: cf.planned_reactive_reverse_rate ?? 2,
      absorptionRatePct: cf.planned_absorption_rate_pct ?? 95,
      outputMwh: cf.planned_annual_output_mwh ?? null,
      equivalentHours: cf.planned_equivalent_hours ?? null,
      completenessPct: cf.planned_completeness_pct ?? 95,
    }

    // 指标对比（区分正向/反向/中性）
    type IndicatorType = 'positive' | 'negative' | 'neutral'
    function item(label: string, unit: string, pv: number | null, av: number | null, itype: IndicatorType) {
      let dev: number | null = null, devStr = '-', status = '正常'
      if (pv != null && av != null) {
        if (itype === 'negative') {
          // 反向指标（越小越好）：越限率/倒送率，偏差=实际-目标，正=超标
          dev = av - pv
          devStr = (dev > 0 ? '+' : '') + dev.toFixed(2) + '个百分点'
          status = dev > 0 ? '偏差' : '正常'  // 只要超过目标就是偏差
        } else if (itype === 'positive') {
          // 正向指标（越高越好）：合格率/达标率，偏差=实际-目标，负=不达标
          dev = av - pv
          devStr = (dev > 0 ? '+' : '') + dev.toFixed(2) + '个百分点'
          status = dev < 0 ? '偏差' : '正常'  // 只要低于目标就是偏差
        } else {
          // 中性指标（相对偏差）：发电量/利用小时
          dev = (av - pv) / pv * 100
          devStr = (dev > 0 ? '+' : '') + dev.toFixed(2) + '%'
          status = Math.abs(dev) > 10 ? '偏差' : '正常'
        }
      }
      return { label, unit, planned: pv != null ? pv + unit : '-', actual: av != null ? av + unit : '-', deviation: devStr, status }
    }

    // 年化处理：发电量/利用小时取年均值，而非累计值
    const startMs = new Date(periodStart).getTime()
    const endMs = new Date().getTime()
    const operateYears = Math.max(0.5, (endMs - startMs) / (365 * 24 * 3600 * 1000))
    const annualOutputKwh = auto.outputKwh != null ? auto.outputKwh / operateYears : null
    const outMwh = annualOutputKwh != null ? Math.round(annualOutputKwh / 10) / 100 : null
    const annualEquivHours = auto.equivalentHours != null ? Math.round(auto.equivalentHours / operateYears * 100) / 100 : null

    // 消纳率取最新评估记录中手动录入的值
    const latestVer = await db('effectiveness_verifications')
      .where('project_id', projectId)
      .whereNotNull('absorption_rate_pct')
      .orderBy('created_at', 'desc')
      .first()
    const actualAbsorption = latestVer?.absorption_rate_pct ?? null

    const dimensions = [
      {
        dimension: '并网性能',
        indicators: [
          item('电压合格率', '%', planned.voltageCompliancePct, auto.voltageCompliancePct, 'positive'),
          item('频率合格率', '%', planned.frequencyCompliancePct, auto.frequencyCompliancePct, 'positive'),
          item('功率因数达标率', '%', planned.powerFactorRate, auto.powerFactorRate, 'positive'),
        ],
      },
      {
        dimension: '电网影响',
        indicators: [
          item('电压越限率', '%', planned.voltageViolationRate, auto.voltageViolationRate, 'negative'),
          item('无功倒送率', '%', planned.reactiveReverseRate, auto.reactiveReverseRate, 'negative'),
          item('消纳率', '%', planned.absorptionRatePct, actualAbsorption, 'positive'),
        ],
      },
      {
        dimension: '经济效益',
        indicators: [
          item('发电量', '万kWh', planned.outputMwh, outMwh, 'neutral'),
          item('等效利用小时', 'h', planned.equivalentHours, annualEquivHours, 'neutral'),
        ],
      },
    ]

    // 整体判定
    const allOk = dimensions.every(d => d.indicators.every((i: any) => i.status !== '偏差'))

    return {
      projectId,
      periodStart,
      periodEnd,
      planned,
      auto: {
        outputMwh: outMwh,
        equivalentHours: annualEquivHours,
        voltageCompliancePct: auto.voltageCompliancePct,
        frequencyCompliancePct: auto.frequencyCompliancePct,
        powerFactorRate: auto.powerFactorRate,
        voltageViolationRate: auto.voltageViolationRate,
        reactiveReverseRate: auto.reactiveReverseRate,
        completenessPct: auto.completenessPct,
      },
      dimensions,
      overallVerdict: allOk ? '达标' : '未达标',
    }
  }

  async updateCompletionTargets(projectId: string, targets: Record<string, number>) {
    const project = await db('projects').where('id', projectId).first()
    if (!project) throw new Error('项目不存在')
    const cf = JSON.parse((project as any).custom_fields || '{}')
    const fieldMap: Record<string, string> = {
      voltageCompliancePct: 'planned_voltage_compliance_pct',
      frequencyCompliancePct: 'planned_frequency_compliance_pct',
      powerFactorRate: 'planned_power_factor_rate',
      voltageViolationRate: 'planned_voltage_violation_rate',
      reactiveReverseRate: 'planned_reactive_reverse_rate',
      absorptionRatePct: 'planned_absorption_rate_pct',
      outputMwh: 'planned_annual_output_mwh',
      equivalentHours: 'planned_equivalent_hours',
      completenessPct: 'planned_completeness_pct',
    }
    for (const [key, field] of Object.entries(fieldMap)) {
      if (targets[key] !== undefined) cf[field] = targets[key]
    }
    await db('projects').where('id', projectId).update({
      custom_fields: JSON.stringify(cf),
      updated_at: new Date().toISOString(),
    })
    return { ok: true }
  }

  // ==================== 自动聚合计算 ====================

  private async aggregateMeasurements(
    stationId: string,
    periodStart: string,
    periodEnd: string,
    installedCapacityMw: number,
    nominalVoltageKv: number,
  ) {
    const rows = await db('pv_output_measurements')
      .where('station_id', stationId)
      .where('time', '>=', periodStart)
      .where('time', '<=', periodEnd)
      .select(
        'active_power_kw',
        'reactive_power_kvar',
        'voltage_v',
        'frequency_hz',
        'power_factor',
      )

    const total = rows.length
    if (total === 0) {
      return {
        outputKwh: null,
        equivalentHours: null,
        voltageCompliancePct: null,
        frequencyCompliancePct: null,
        powerFactorRate: null,
        voltageViolationRate: null,
        reactiveReverseRate: null,
        completenessPct: 0,
      }
    }

    let totalOutputKwh = 0
    let voltageOk = 0
    let frequencyOk = 0
    let powerFactorOk = 0
    let reactiveReverseCount = 0

    // 电压合规阈值按电压等级区分（国标）
    let voltBand: number
    if (nominalVoltageKv >= 110) voltBand = 0.03      // 110kV/220kV: ±3%
    else if (nominalVoltageKv >= 35) voltBand = 0.05   // 35kV: ±5%
    else voltBand = 0.07                                // 10kV及以下: ±7%
    const vMin = nominalVoltageKv * 1000 * (1 - voltBand)
    const vMax = nominalVoltageKv * 1000 * (1 + voltBand)

    for (const r of rows as any[]) {
      totalOutputKwh += (r.active_power_kw || 0) * 0.25

      const v = r.voltage_v || 0
      if (v >= vMin && v <= vMax) voltageOk++

      const f = r.frequency_hz || 0
      if (f >= 49.5 && f <= 50.5) frequencyOk++

      const pf = r.power_factor || 0
      if (pf >= 0.9) powerFactorOk++

      // 无功倒送：无功功率为负（向电网倒送无功）
      if ((r.reactive_power_kvar || 0) < 0) reactiveReverseCount++
    }

    const startMs = new Date(periodStart).getTime()
    const endMs = new Date(periodEnd).getTime()
    const days = Math.max(1, Math.ceil((endMs - startMs) / (24 * 3600 * 1000)))
    const expectedPoints = days * 96

    // 电压越限率 = 1 - 电压合格率
    const voltageCompliancePct = Math.round((voltageOk / total) * 10000) / 100

    return {
      outputKwh: Math.round(totalOutputKwh * 100) / 100,
      equivalentHours: installedCapacityMw > 0
        ? Math.round((totalOutputKwh / (installedCapacityMw * 1000)) * 100) / 100
        : null,
      voltageCompliancePct,
      frequencyCompliancePct: Math.round((frequencyOk / total) * 10000) / 100,
      powerFactorRate: Math.round((powerFactorOk / total) * 10000) / 100,
      voltageViolationRate: Math.round((100 - voltageCompliancePct) * 100) / 100,
      reactiveReverseRate: Math.round((reactiveReverseCount / total) * 10000) / 100,
      completenessPct: Math.round((total / expectedPoints) * 10000) / 100,
    }
  }
}
