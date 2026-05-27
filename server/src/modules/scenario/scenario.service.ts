import { db } from '../../config/database.js'
import { v4 as uuidv4 } from 'uuid'

export class ScenarioService {
  // ==================== 互动场景管理 ====================

  async listScenarios(query: {
    name?: string
    type?: string
    status?: string
    tag?: string
    device?: string
    date_start?: string
    date_end?: string
    page?: number
    pageSize?: number
  }) {
    const { name, type, status, tag, device, date_start, date_end, page = 1, pageSize = 20 } = query

    let baseQuery = db('interactive_scenarios').select('*')

    if (name) {
      baseQuery = baseQuery.where('name', 'like', `%${name}%`)
    }
    if (type) {
      baseQuery = baseQuery.where('type', type)
    }
    if (status) {
      baseQuery = baseQuery.where('status', status)
    }
    if (date_start) {
      baseQuery = baseQuery.where('created_at', '>=', date_start)
    }
    if (date_end) {
      baseQuery = baseQuery.where('created_at', '<=', date_end + ' 23:59:59')
    }
    if (tag) {
      baseQuery = baseQuery.where('tags', 'like', `%"${tag}"%`)
    }

    // 设备筛选：需解析 config JSON 中的 accessPoints.equipmentIds
    let allRows = await baseQuery.orderBy('created_at', 'desc')

    const parsed = allRows.map((r: any) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : [],
      config: r.config ? JSON.parse(r.config) : null,
      control_logic: r.control_logic ? JSON.parse(r.control_logic) : null,
    }))

    // 节点筛选在 JS 层处理（config.accessPoints[].nodeName）
    let filtered = parsed
    if (device) {
      const keyword = String(device).toLowerCase()
      filtered = parsed.filter((s: any) => {
        const aps = s.config?.accessPoints || []
        return aps.some((ap: any) => (ap.nodeName || '').toLowerCase().includes(keyword))
      })
    }

    const total = filtered.length
    const offset = (page - 1) * pageSize
    const list = filtered.slice(offset, offset + pageSize)

    return { total, list, page, pageSize }
  }

  async getScenario(id: string) {
    const row = await db('interactive_scenarios').where('id', id).first()
    if (!row) return null
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      config: row.config ? JSON.parse(row.config) : null,
      control_logic: row.control_logic ? JSON.parse(row.control_logic) : null,
    }
  }

  async createScenario(data: any, userId: string) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const row = {
      id,
      name: data.name,
      type: data.type || 'custom',
      description: data.description || '',
      config: data.config ? JSON.stringify(data.config) : null,
      control_logic: data.control_logic ? JSON.stringify(data.control_logic) : null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      status: data.status || 'draft',
      created_by: userId,
      created_at: now,
      updated_at: now,
    }
    await db('interactive_scenarios').insert(row)
    return this.getScenario(id)
  }

  async updateScenario(id: string, data: any) {
    const now = new Date().toISOString()
    const update: any = { updated_at: now }
    if (data.name !== undefined) update.name = data.name
    if (data.type !== undefined) update.type = data.type
    if (data.description !== undefined) update.description = data.description
    if (data.config !== undefined) update.config = JSON.stringify(data.config)
    if (data.control_logic !== undefined) update.control_logic = JSON.stringify(data.control_logic)
    if (data.tags !== undefined) update.tags = JSON.stringify(data.tags)
    if (data.status !== undefined) update.status = data.status

    const old = await db('interactive_scenarios').where('id', id).first()
    if (!old) return null

    await db('interactive_scenarios').where('id', id).update(update)

    // 创建版本历史
    const versionCount = await db('scenario_versions').where('scenario_id', id).count('* as total').first()
    await db('scenario_versions').insert({
      id: uuidv4(),
      scenario_id: id,
      version_number: (Number((versionCount as any).total) || 0) + 1,
      config_snapshot: old.config,
      control_logic_snapshot: old.control_logic,
      changelog: data.changelog || '更新场景配置',
      created_by: data.updated_by || old.created_by,
      created_at: now,
    })

    return this.getScenario(id)
  }

  async deleteScenario(id: string) {
    await db('interactive_scenarios').where('id', id).delete()
    return { id }
  }

  async batchDeleteScenarios(ids: string[]) {
    await db('interactive_scenarios').whereIn('id', ids).delete()
    return { deleted: ids.length }
  }

  async copyScenario(id: string) {
    const original = await this.getScenario(id)
    if (!original) return null
    const newId = uuidv4()
    const now = new Date().toISOString()
    const row = {
      id: newId,
      name: original.name + ' (副本)',
      type: original.type,
      description: original.description,
      config: original.config ? JSON.stringify(original.config) : null,
      control_logic: original.control_logic ? JSON.stringify(original.control_logic) : null,
      tags: original.tags ? JSON.stringify(original.tags) : null,
      status: 'draft',
      created_by: original.created_by,
      created_at: now,
      updated_at: now,
    }
    await db('interactive_scenarios').insert(row)
    return this.getScenario(newId)
  }

  async getScenarioVersions(scenarioId: string) {
    return db('scenario_versions')
      .where('scenario_id', scenarioId)
      .orderBy('version_number', 'desc')
  }

  async restoreVersion(scenarioId: string, versionId: string) {
    const version = await db('scenario_versions').where('id', versionId).first()
    if (!version || version.scenario_id !== scenarioId) return null
    const now = new Date().toISOString()
    await db('interactive_scenarios').where('id', scenarioId).update({
      config: version.config_snapshot,
      control_logic: version.control_logic_snapshot,
      updated_at: now,
    })
    return this.getScenario(scenarioId)
  }

  async exportScenarios(ids: string[]) {
    const scenarios = await db('interactive_scenarios').whereIn('id', ids)
    return scenarios.map((s: any) => ({
      名称: s.name,
      类型: s.type,
      描述: s.description,
      标签: s.tags,
      状态: s.status,
      配置: s.config,
      控制逻辑: s.control_logic,
      创建时间: s.created_at,
      更新时间: s.updated_at,
    }))
  }

  async previewScenario(config: any) {
    const accessPoints = config.accessPoints || []
    const controlRules = config.controlRules || []
    const dataSource = config.dataSource || {}

    // 基于接入点计算预期指标
    const totalCapacity = accessPoints.reduce((sum: number, ap: any) => sum + (ap.connectedCapacity || 0), 0)
    const avgLoad = 70
    const peakLoad = 90

    // 从各接入点参数中提取影响因子
    const srcAp = accessPoints.find((ap: any) => ap.nodeType === 'SOURCE')
    const stAp = accessPoints.find((ap: any) => ap.nodeType === 'STORAGE')
    const srcParams = srcAp?.params || { outputUpperLimit: 95, outputLowerLimit: 10 }
    const stParams = stAp?.params || { socUpper: 90, socLower: 20 }
    const pvOutputFactor = (srcParams.outputUpperLimit || 95) / 100
    const storageBuffer = ((stParams.socUpper || 90) - (stParams.socLower || 20)) / 100

    // 根据负荷水平估算电压(kV)，以110kV为基准
    const loadFactor = avgLoad / 100
    const nominalVoltage = 110
    const baseVoltage = nominalVoltage * (1.0 + (1 - loadFactor) * 0.03)
    const minVoltage = baseVoltage - nominalVoltage * loadFactor * 0.06
    const maxVoltage = baseVoltage + nominalVoltage * (1 - loadFactor) * 0.04

    // 频率估算
    const baseFrequency = 50.0 + (loadFactor - 0.7) * 0.15
    const minFrequency = baseFrequency - 0.2
    const maxFrequency = baseFrequency + 0.2

    // 线路负载率估算，储能缓冲可降低峰值
    const avgLoadRate = loadFactor * 85 + (totalCapacity > 0 ? Math.min(totalCapacity / 1000 * 10, 10) : 0)
    const peakLoadRate = (peakLoad / 100) * 90 * (1 - storageBuffer * 0.3)

    // 消纳率估算（光伏接入点越多越容易消纳不足，储能缓冲可提升消纳）
    const pvApCount = accessPoints.filter((ap: any) => ap.connectionType === 'DC' || ap.nodeType === 'SOURCE' || ap.plantName?.includes('光伏')).length
    const storageCount = accessPoints.filter((ap: any) => ap.nodeType === 'STORAGE').length
    const consumptionRate = Math.min(100, 92 + pvApCount * 2 - loadFactor * 5 + storageCount * 3 + storageBuffer * 10)

    // 数据源类型影响
    const isRealtime = dataSource.type === 'realtime' || dataSource.type === 'hybrid'
    const dataReliability = isRealtime ? '高' : dataSource.type === 'history' ? '中' : '高'

    // 越限判断
    const voltageUpper = 121, voltageLower = 99, loadRateLimit = 90
    const violations: any[] = []
    if (minVoltage < voltageLower) violations.push({ metric: '电压', value: minVoltage.toFixed(1), threshold: voltageLower, level: 'warning', detail: `最低电压 ${minVoltage.toFixed(1)} kV < 下限 ${voltageLower} kV` })
    if (maxVoltage > voltageUpper) violations.push({ metric: '电压', value: maxVoltage.toFixed(1), threshold: voltageUpper, level: 'warning', detail: `最高电压 ${maxVoltage.toFixed(1)} kV > 上限 ${voltageUpper} kV` })
    if (Math.abs(baseFrequency - 50) > 0.5) violations.push({ metric: '频率', value: baseFrequency.toFixed(2), threshold: 50, level: 'danger', detail: `频率偏差 ${Math.abs(baseFrequency - 50).toFixed(2)} Hz` })
    if (peakLoadRate > loadRateLimit) violations.push({ metric: '负载率', value: peakLoadRate.toFixed(1), threshold: loadRateLimit, level: 'warning', detail: `峰值负载率 ${peakLoadRate.toFixed(1)}% > 上限 ${loadRateLimit}%` })

    // 建议
    const suggestions: string[] = []
    if (minVoltage < voltageLower) suggestions.push('建议增加无功补偿或调整变压器分接头以提升电压')
    if (maxVoltage > voltageUpper) suggestions.push('建议限制光伏出力或投入电抗器以降低电压')
    if (peakLoadRate > loadRateLimit) suggestions.push('建议调整负荷曲线削峰或增加线路容量')
    if (consumptionRate < 90) suggestions.push('建议增加储能配置以提高消纳率')
    if (!violations.length) suggestions.push('当前参数配置合理，预期运行效果良好')

    const overallStatus = violations.some(v => v.level === 'danger') ? '风险' : violations.length > 0 ? '关注' : '正常'

    return {
      indicators: {
        voltage: { min: minVoltage.toFixed(1), max: maxVoltage.toFixed(1), unit: 'kV', status: minVoltage >= voltageLower && maxVoltage <= voltageUpper ? '正常' : '越限' },
        frequency: { avg: baseFrequency.toFixed(2), min: minFrequency.toFixed(2), max: maxFrequency.toFixed(2), unit: 'Hz', status: Math.abs(baseFrequency - 50) <= 0.5 ? '正常' : '越限' },
        loadRate: { avg: avgLoadRate.toFixed(1), peak: peakLoadRate.toFixed(1), unit: '%', status: peakLoadRate <= loadRateLimit ? '正常' : '越限' },
        consumptionRate: { value: consumptionRate.toFixed(1), unit: '%', status: consumptionRate >= 90 ? '正常' : '偏低' },
      },
      configSummary: {
        accessPointCount: accessPoints.length,
        totalCapacity,
        dataReliability,
        pvStationCount: pvApCount,
      },
      violations,
      suggestions,
      overallStatus,
    }
  }

  // ==================== 策略管理 ====================

  async listStrategies(query: { scenario_id?: string; strategy_type?: string; status?: string }) {
    let q = db('scenario_strategies').select('*')
    if (query.scenario_id) q = q.where('scenario_id', query.scenario_id)
    if (query.strategy_type) q = q.where('strategy_type', query.strategy_type)
    if (query.status) q = q.where('status', query.status)
    const list = await q.orderBy('created_at', 'desc')
    return list.map((r: any) => ({
      ...r,
      config: r.config ? JSON.parse(r.config) : null,
      constraints: r.constraints ? JSON.parse(r.constraints) : null,
      economic_targets: r.economic_targets ? JSON.parse(r.economic_targets) : null,
    }))
  }

  async getStrategy(id: string) {
    const row = await db('scenario_strategies').where('id', id).first()
    if (!row) return null
    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
      constraints: row.constraints ? JSON.parse(row.constraints) : null,
      economic_targets: row.economic_targets ? JSON.parse(row.economic_targets) : null,
    }
  }

  async createStrategy(data: any) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const row = {
      id,
      scenario_id: data.scenario_id,
      name: data.name,
      strategy_type: data.strategy_type || 'comprehensive',
      config: data.config ? JSON.stringify(data.config) : null,
      constraints: data.constraints ? JSON.stringify(data.constraints) : null,
      economic_targets: data.economic_targets ? JSON.stringify(data.economic_targets) : null,
      generated_by_algorithm: data.generated_by_algorithm || '0',
      status: data.status || 'draft',
      created_at: now,
      updated_at: now,
    }
    await db('scenario_strategies').insert(row)
    return this.getStrategy(id)
  }

  async updateStrategy(id: string, data: any) {
    const now = new Date().toISOString()
    const update: any = { updated_at: now }
    if (data.name !== undefined) update.name = data.name
    if (data.config !== undefined) update.config = JSON.stringify(data.config)
    if (data.constraints !== undefined) update.constraints = JSON.stringify(data.constraints)
    if (data.economic_targets !== undefined) update.economic_targets = JSON.stringify(data.economic_targets)
    if (data.status !== undefined) update.status = data.status
    await db('scenario_strategies').where('id', id).update(update)
    return this.getStrategy(id)
  }

  async deleteStrategy(id: string) {
    await db('scenario_strategies').where('id', id).delete()
    return { id }
  }

  async generateStrategy(scenarioId: string) {
    const scenario = await this.getScenario(scenarioId)
    if (!ScenarioService) throw new Error('场景不存在')

    const now = new Date().toISOString()
    const id = uuidv4()

    // 根据场景类型和配置自动生成策略
    const config = scenario?.config || {}
    const constraints = {
      voltageUpperLimit: 1.07,
      voltageLowerLimit: 0.93,
      frequencyUpperLimit: 50.5,
      frequencyLowerLimit: 49.5,
      lineLoadRateLimit: 0.9,
      transformerLoadRateLimit: 0.85,
    }
    const economicTargets = {
      targetConsumptionRate: 0.95,
      maxOperationCostPerKwh: 0.42,
      minComprehensiveEfficiency: 0.88,
    }
    const strategyConfig = {
      sourceRegulation: {
        pvOutputUpperLimit: 0.95,
        pvOutputLowerLimit: 0.1,
        regulationDelay: 30,
      },
      gridRegulation: {
        tapRegulationEnabled: true,
        reactivePowerCompensation: true,
      },
      loadRegulation: {
        peakClippingRate: 0.15,
        valleyFillingRate: 0.12,
        interruptibleLoadRatio: 0.05,
      },
      storageRegulation: {
        chargeSchedule: '00:00-06:00',
        dischargeSchedule: '10:00-12:00,18:00-21:00',
        socUpperLimit: 0.9,
        socLowerLimit: 0.2,
      },
    }

    const row = {
      id,
      scenario_id: scenarioId,
      name: scenario?.name ? `${scenario.name}-自动策略` : '自动生成策略',
      strategy_type: 'comprehensive',
      config: JSON.stringify(strategyConfig),
      constraints: JSON.stringify(constraints),
      economic_targets: JSON.stringify(economicTargets),
      generated_by_algorithm: '1',
      status: 'draft',
      created_at: now,
      updated_at: now,
    }
    await db('scenario_strategies').insert(row)
    return this.getStrategy(id)
  }

  // ==================== 模拟与验证 ====================

  async listSimulations(query: { scenario_id?: string; status?: string }) {
    let q = db('scenario_simulations').select('*')
    if (query.scenario_id) q = q.where('scenario_id', query.scenario_id)
    if (query.status) q = q.where('status', query.status)
    return q.orderBy('created_at', 'desc')
  }

  async startSimulation(data: { scenario_id: string; strategy_id?: string; boundary_conditions?: any; time_range?: any }, userId: string) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const row = {
      id,
      scenario_id: data.scenario_id,
      strategy_id: data.strategy_id || null,
      status: 'running',
      boundary_conditions: data.boundary_conditions ? JSON.stringify(data.boundary_conditions) : null,
      time_range: data.time_range ? JSON.stringify(data.time_range) : null,
      progress: 0,
      started_at: now,
      created_by: userId,
    }
    await db('scenario_simulations').insert(row)

    // 模拟进度推进
    this.simulateProgress(id)

    return this.getSimulation(id)
  }

  private async simulateProgress(simulationId: string) {
    const steps = [20, 40, 60, 80, 95, 100]
    const delays = [1000, 1500, 1000, 1500, 2000, 1000]

    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, delays[i]))
      const sim = await db('scenario_simulations').where('id', simulationId).first()
      if (!sim || sim.status === 'stopped') return

      await db('scenario_simulations').where('id', simulationId).update({ progress: steps[i] })

      // 生成模拟指标数据
      if (steps[i] % 20 === 0 || steps[i] === 100) {
        await this.generateMetrics(simulationId, steps[i])
      }
    }

    await db('scenario_simulations').where('id', simulationId).update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
    })
  }

  private async generateMetrics(simulationId: string, progress: number) {
    const baseVoltage = 1.0 + (Math.random() - 0.5) * 0.06
    const baseFrequency = 50 + (Math.random() - 0.5) * 0.4
    const basePower = 80 + Math.random() * 20
    const now = new Date().toISOString()

    const metrics = [
      { id: uuidv4(), simulation_id: simulationId, timestamp: now, metric_type: 'voltage', unit: 'p.u.', value: Math.round(baseVoltage * 1000) / 1000, threshold: 1.07, is_violation: baseVoltage > 1.07 ? 1 : 0 },
      { id: uuidv4(), simulation_id: simulationId, timestamp: now, metric_type: 'frequency', unit: 'Hz', value: Math.round(baseFrequency * 100) / 100, threshold: 50.5, is_violation: Math.abs(baseFrequency - 50) > 0.5 ? 1 : 0 },
      { id: uuidv4(), simulation_id: simulationId, timestamp: now, metric_type: 'load_rate', unit: '%', value: Math.round(basePower * 10) / 10, threshold: 90, is_violation: basePower > 90 ? 1 : 0 },
      { id: uuidv4(), simulation_id: simulationId, timestamp: now, metric_type: 'consumption_rate', unit: '%', value: Math.round((85 + Math.random() * 10) * 10) / 10, threshold: 95, is_violation: 0 },
    ]
    await db('simulation_metrics').insert(metrics)
  }

  async getSimulation(id: string) {
    const row = await db('scenario_simulations').where('id', id).first()
    if (!row) return null
    return {
      ...row,
      boundary_conditions: row.boundary_conditions ? JSON.parse(row.boundary_conditions) : null,
      time_range: row.time_range ? JSON.parse(row.time_range) : null,
    }
  }

  async stopSimulation(id: string) {
    await db('scenario_simulations').where('id', id).update({ status: 'stopped' })
    return this.getSimulation(id)
  }

  async getSimulationResults(simulationId: string) {
    const metrics = await db('simulation_metrics')
      .where('simulation_id', simulationId)
      .orderBy('timestamp', 'asc')

    const grouped: Record<string, any[]> = {}
    for (const m of metrics) {
      if (!grouped[m.metric_type]) grouped[m.metric_type] = []
      grouped[m.metric_type].push(m)
    }

    const violations = metrics.filter((m: any) => m.is_violation)
    return { metrics, grouped, violations }
  }

  // ==================== 执行效果评估 ====================

  async listEvaluations(query: { simulation_id?: string }) {
    let q = db('scenario_evaluations').select('*')
    if (query.simulation_id) q = q.where('simulation_id', query.simulation_id)
    const list = await q.orderBy('created_at', 'desc')
    return list.map((r: any) => ({
      ...r,
      execution_log: r.execution_log ? JSON.parse(r.execution_log) : null,
      evaluation_report: r.evaluation_report ? JSON.parse(r.evaluation_report) : null,
      issues: r.issues ? JSON.parse(r.issues) : null,
    }))
  }

  async getEvaluation(id: string) {
    const row = await db('scenario_evaluations').where('id', id).first()
    if (!row) return null
    return {
      ...row,
      execution_log: row.execution_log ? JSON.parse(row.execution_log) : null,
      evaluation_report: row.evaluation_report ? JSON.parse(row.evaluation_report) : null,
      issues: row.issues ? JSON.parse(row.issues) : null,
    }
  }

  async generateEvaluation(simulationId: string) {
    const sim = await this.getSimulation(simulationId)
    if (!sim) throw new Error('模拟记录不存在')

    const results = await this.getSimulationResults(simulationId)
    const id = uuidv4()
    const now = new Date().toISOString()

    // 根据模拟结果计算评估数据
    const violationCount = results.violations.length
    const totalMetrics = results.metrics.length
    const passRate = totalMetrics > 0 ? Math.round(((totalMetrics - violationCount) / totalMetrics) * 100) : 100
    const effectivenessScore = Math.max(0, Math.min(100, passRate - Math.random() * 5))

    const executionLog = {
      startTime: sim.started_at,
      endTime: now,
      totalSteps: 5,
      completedSteps: 5,
      metricsGenerated: totalMetrics,
      violationsDetected: violationCount,
      events: [
        { time: sim.started_at, event: '模拟启动', level: 'info' },
        { time: now, event: '模拟完成', level: 'info' },
      ],
    }

    const evaluationReport = {
      summary: `模拟共产生 ${totalMetrics} 个指标数据，其中 ${violationCount} 个越限，综合通过率 ${passRate}%`,
      passRate,
      violationCount,
      effectivenessScore: Math.round(effectivenessScore),
      securityAssessment: passRate >= 90 ? '安全' : passRate >= 70 ? '基本安全' : '不满足安全要求',
      economicAssessment: effectivenessScore >= 80 ? '经济性良好' : '经济性一般，建议优化',
    }

    const issues = violationCount > 0
      ? results.violations.map((v: any) => ({
        type: v.metric_type,
        value: v.value,
        threshold: v.threshold,
        description: `${v.metric_type} 越限: ${v.value} (阈值: ${v.threshold})`,
      }))
      : []

    const suggestions = violationCount > 3
      ? ['建议调整光伏出力上限', '优化储能充放电策略', '加强无功补偿配置']
      : violationCount > 0
        ? ['建议微调策略参数以消除越限']
        : ['当前策略效果良好，建议保持']

    const row = {
      id,
      simulation_id: simulationId,
      strategy_id: sim.strategy_id,
      execution_log: JSON.stringify(executionLog),
      evaluation_report: JSON.stringify(evaluationReport),
      effectiveness_score: effectivenessScore,
      issues: JSON.stringify(issues),
      suggestions: suggestions.join('; '),
      created_at: now,
    }
    await db('scenario_evaluations').insert(row)
    return this.getEvaluation(id)
  }

  // ==================== 人工干预 ====================

  async listInterventions(query: { scenario_id?: string; operation_type?: string; start_date?: string; end_date?: string }) {
    let q = db('scenario_interventions').select('*')
    if (query.scenario_id) q = q.where('scenario_id', query.scenario_id)
    if (query.operation_type) q = q.where('operation_type', query.operation_type)
    if (query.start_date) q = q.where('operated_at', '>=', query.start_date)
    if (query.end_date) q = q.where('operated_at', '<=', query.end_date)
    const list = await q.orderBy('operated_at', 'desc')
    return list.map((r: any) => ({
      ...r,
      operation_params: r.operation_params ? JSON.parse(r.operation_params) : null,
    }))
  }

  async createIntervention(data: { scenario_id: string; simulation_id?: string; operation_type: string; operation_params?: any; reason?: string }, userId: string) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const row = {
      id,
      scenario_id: data.scenario_id,
      simulation_id: data.simulation_id || null,
      operation_type: data.operation_type,
      operation_params: data.operation_params ? JSON.stringify(data.operation_params) : null,
      operator: userId,
      reason: data.reason || '',
      operated_at: now,
    }
    await db('scenario_interventions').insert(row)

    // 如果是暂停操作，同时暂停运行中的模拟
    if (data.operation_type === 'pause' && data.simulation_id) {
      await db('scenario_simulations').where('id', data.simulation_id).update({ status: 'stopped' })
    }

    return {
      ...row,
      operation_params: data.operation_params || null,
    }
  }

  async getRunningSimulations() {
    const running = await db('scenario_simulations')
      .where('status', 'running')
      .orderBy('started_at', 'desc')

    const result = []
    for (const sim of running) {
      const scenario = await db('interactive_scenarios').where('id', sim.scenario_id).first()
      result.push({
        ...sim,
        boundary_conditions: sim.boundary_conditions ? JSON.parse(sim.boundary_conditions) : null,
        time_range: sim.time_range ? JSON.parse(sim.time_range) : null,
        scenario_name: scenario?.name || '未知场景',
      })
    }
    return result
  }
}
