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
    scenario_condition?: string
    date_start?: string
    date_end?: string
    page?: number
    pageSize?: number
  }) {
    const { name, type, status, tag, device, scenario_condition, date_start, date_end, page = 1, pageSize = 20 } = query

    let baseQuery = db('interactive_scenarios').select('*')

    if (name) {
      baseQuery = baseQuery.where('name', 'like', `%${name}%`)
    }
    if (type) {
      baseQuery = baseQuery.where('type', type)
    }
    if (scenario_condition) {
      baseQuery = baseQuery.where('scenario_condition', scenario_condition)
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
      scenario_condition: data.scenario_condition || 'normal',
      version_limit: data.version_limit ?? 10,
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
    if (data.scenario_condition !== undefined) update.scenario_condition = data.scenario_condition
    if (data.version_limit !== undefined) update.version_limit = data.version_limit

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

    // 清理超出 version_limit 的旧版本（保留最新 N 条）
    const limit = update.version_limit ?? (old.version_limit ?? 10)
    const allVersions = await db('scenario_versions')
      .where('scenario_id', id)
      .orderBy('version_number', 'desc')
    if (allVersions.length > limit) {
      const toDelete = allVersions.slice(limit).map((v: any) => v.id)
      await db('scenario_versions').whereIn('id', toDelete).delete()
    }

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

  async batchCopyScenarios(ids: string[]) {
    const results: any[] = []
    for (const id of ids) {
      const result = await this.copyScenario(id)
      if (result) results.push(result)
    }
    return { copied: results.length, results }
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

    // 根据负荷水平估算电压(kV)，取电网接入点电压等级为基准
    const loadFactor = avgLoad / 100
    const gridAp = accessPoints.find((ap: any) => ap.nodeType === 'GRID')
    const nominalVoltage = gridAp?.voltageLevel || 220
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

    // 越限判断 (kV)
    const voltageUpper = nominalVoltage * 1.10, voltageLower = nominalVoltage * 0.90, loadRateLimit = 90
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
    if (!scenario) throw new Error('场景不存在')

    const config = scenario?.config || {}
    const accessPoints = config.accessPoints || []
    const topology = config.topology || { nodes: [], edges: [] }
    const pvAps = accessPoints.filter((ap: any) => ap.nodeType === 'SOURCE')
    const storageAps = accessPoints.filter((ap: any) => ap.nodeType === 'STORAGE')
    const loadAps = accessPoints.filter((ap: any) => ap.nodeType === 'LOAD')

    const totalPv = pvAps.reduce((s: number, ap: any) => s + (ap.connectedCapacity || 0), 0) || 50000
    const totalStorage = storageAps.reduce((s: number, ap: any) => s + ((ap.params?.ratedCapacityKwh || 10000)), 0) || 10000
    const totalLoad = loadAps.reduce((s: number, ap: any) => s + (ap.connectedCapacity || 0), 0) || 80000

    // 取电网接入点电压等级作为基准
    const gridAp = accessPoints.find((ap: any) => ap.nodeType === 'GRID')
    const baseKV = gridAp?.voltageLevel || 220

    // 安全约束 (kV)
    const constraints = {
      voltageUpperLimit: baseKV * 1.07,
      voltageLowerLimit: baseKV * 0.93,
      frequencyUpperLimit: 50.5,
      frequencyLowerLimit: 49.5,
      lineLoadRateLimit: 0.9,
    }
    const economicTargets = {
      optimizationMode: 'cost_first',
      targetConsumptionRate: 0.95,
      maxOperationCostPerKwh: 0.42,
    }

    // 峰谷电价 (元/kWh)
    const priceTable: Record<string, { buy: number; sell: number }> = {
      '00:00-04:00': { buy: 0.3, sell: 0.25 },
      '04:00-06:00': { buy: 0.3, sell: 0.25 },
      '06:00-08:00': { buy: 0.5, sell: 0.4 },
      '08:00-10:00': { buy: 0.8, sell: 0.7 },
      '10:00-12:00': { buy: 0.8, sell: 0.7 },
      '12:00-14:00': { buy: 0.5, sell: 0.4 },
      '14:00-16:00': { buy: 0.8, sell: 0.7 },
      '16:00-18:00': { buy: 0.8, sell: 0.7 },
      '18:00-20:00': { buy: 1.0, sell: 0.85 },
      '20:00-22:00': { buy: 0.8, sell: 0.7 },
      '22:00-24:00': { buy: 0.5, sell: 0.4 },
    }

    // 生成 12 段 (每 2 小时) 的设备调度指令
    const segments = [
      '00:00-02:00', '02:00-04:00', '04:00-06:00', '06:00-08:00',
      '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00',
      '16:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-24:00',
    ]
    const priceSegments = [
      '00:00-04:00', '00:00-04:00', '04:00-06:00', '06:00-08:00',
      '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00',
      '16:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-24:00',
    ]

    const schedule: any[] = []
    for (let i = 0; i < segments.length; i++) {
      const hour = i * 2
      const daylightFactor = hour >= 6 && hour <= 18 ? Math.sin(Math.PI * (hour + 1 - 6) / 12) : 0

      // 负荷双峰 (上午10点 + 晚上19点)
      const morningPeak = Math.exp(-Math.pow((hour + 1 - 10) / 3, 2)) * 0.6
      const eveningPeak = Math.exp(-Math.pow((hour + 1 - 19) / 3, 2)) * 0.7
      const loadFactor = 0.4 + morningPeak + eveningPeak
      const loadDemand = totalLoad * loadFactor * 0.85

      // 光伏出力
      const pvOutput = totalPv * daylightFactor * 0.85

      // 净功率 → 储能调度方向
      const netPower = pvOutput - loadDemand
      const price = priceTable[priceSegments[i]] || { buy: 0.5, sell: 0.4 }

      let storageAction = '待机'
      let storageTarget = 0
      let reason = ''

      if (netPower > 0) {
        // 光伏有余电
        storageAction = '充电'
        storageTarget = Math.min(netPower, totalStorage * 0.15)
        reason = '光伏出力超过负荷，余电储能充电'
      } else if (price.buy >= 0.8) {
        // 峰段 → 储能放电削峰
        storageAction = '放电'
        storageTarget = Math.min(Math.abs(netPower) * 0.6, totalStorage * 0.15)
        reason = '峰段电价高，储能放电削峰减少购电成本'
      } else if (price.buy <= 0.3) {
        // 谷段 → 储能充电
        storageAction = '充电'
        storageTarget = totalStorage * 0.1
        reason = '谷段电价低，储能充电为峰段储备'
      } else {
        storageAction = '待机'
        reason = '平段，保持当前状态'
      }

      // 安全校验 (kV)
      const estVoltagePU = 1.0 - loadFactor * 0.08 + daylightFactor * 0.03
      const estVoltageKV = estVoltagePU * baseKV
      if (estVoltageKV > constraints.voltageUpperLimit) {
        storageAction = '充电'
        storageTarget = totalStorage * 0.12
        reason = '电压偏高，储能充电吸收无功以降压'
      } else if (estVoltageKV < constraints.voltageLowerLimit) {
        storageAction = '放电'
        storageTarget = totalStorage * 0.12
        reason = '电压偏低，储能放电支撑电压'
      }
      const estLoadRate = (loadDemand / totalLoad) * 100
      if (estLoadRate > constraints.lineLoadRateLimit * 100) {
        storageAction = '放电'
        storageTarget = totalStorage * 0.15
        reason = '负载率过高，储能放电削峰缓解线路压力'
      }

      schedule.push({
        timeRange: segments[i],
        deviceType: 'storage',
        deviceName: storageAps[0]?.nodeName || '储能系统',
        action: storageAction,
        targetValue: Math.round(storageTarget),
        unit: 'kW',
        expectedLoad: Math.round(loadDemand),
        expectedPvOutput: Math.round(pvOutput),
        reason,
      })

      // 光伏调度指令
      schedule.push({
        timeRange: segments[i],
        deviceType: 'source',
        deviceName: pvAps[0]?.nodeName || '光伏电站',
        action: daylightFactor > 0 ? '发电' : '待机',
        targetValue: Math.round(pvOutput),
        unit: 'kW',
        reason: daylightFactor > 0 ? `光照时段，预计出力${Math.round(pvOutput)}kW` : '无光照，待机',
      })

      // 负荷侧指令
      if (loadFactor > 0.7) {
        schedule.push({
          timeRange: segments[i],
          deviceType: 'load',
          deviceName: loadAps[0]?.nodeName || '负荷中心',
          action: '削峰',
          targetValue: Math.round(loadDemand * 0.1),
          unit: 'kW',
          reason: `负荷高峰时段(负荷因子${(loadFactor * 100).toFixed(0)}%)，削减10%可中断负荷`,
        })
      }
    }

    const strategyConfig = {
      control_rules: config.controlRules || [],
      schedule,
      dataSource: config.dataSource || { type: 'hybrid', dataTypes: ['pv_output', 'load', 'voltage'] },
    }

    const now = new Date().toISOString()
    const id = uuidv4()
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
    return q.orderBy('started_at', 'desc')
  }

  async startSimulation(data: {
    scenario_id: string
    strategy_id?: string
    boundary_conditions?: any
    time_range?: any
    step_interval_minutes?: number
    speed_multiplier?: number
    faults?: any[]
  }, userId: string) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const row = {
      id,
      scenario_id: data.scenario_id,
      strategy_id: data.strategy_id || null,
      status: 'running',
      boundary_conditions: data.boundary_conditions ? JSON.stringify(data.boundary_conditions) : null,
      time_range: data.time_range ? JSON.stringify(data.time_range) : null,
      step_interval_minutes: data.step_interval_minutes || 1,
      speed_multiplier: data.speed_multiplier || 1,
      current_step: 0,
      progress: 0,
      started_at: now,
      created_by: userId,
    }
    await db('scenario_simulations').insert(row)

    // 模拟进度推进（后台异步，不阻塞响应）
    this.simulateProgress(id).catch((err) => {
      console.error(`[Simulation ${id}] 模拟执行失败:`, err)
      db('scenario_simulations').where('id', id).update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      }).catch(() => {})
    })

    return this.getSimulation(id)
  }

  private async simulateProgress(simulationId: string) {
    const sim = await db('scenario_simulations').where('id', simulationId).first()
    if (!sim) return

    const stepIntervalMinutes = sim.step_interval_minutes || 1
    const speedMultiplier = sim.speed_multiplier || 1
    const TOTAL_STEPS = Math.floor(1440 / stepIntervalMinutes)
    const STEP_DELAY_MS = Math.max(1, Math.floor(300 / speedMultiplier))

    // 读取场景和策略配置
    const scenario = await db('interactive_scenarios').where('id', sim.scenario_id).first()
    const strategy = sim.strategy_id ? await db('scenario_strategies').where('id', sim.strategy_id).first() : null

    const scenarioConfig = scenario?.config ? JSON.parse(scenario.config) : {}
    const accessPoints = scenarioConfig.accessPoints || []
    const topology = scenarioConfig.topology || { nodes: [], edges: [] }

    // 解析策略配置——兼容两种格式
    const strategyConfig = strategy?.config ? JSON.parse(strategy.config) : {}
    const strategyConstraints = strategy?.constraints ? JSON.parse(strategy.constraints) : {}
    const strategyEconomic = strategy?.economic_targets ? JSON.parse(strategy.economic_targets) : {}

    // 约束阈值：优先从策略读取，回退到 scene config 或默认值
    const constraints = {
      voltageUpperLimit: strategyConstraints.voltageUpperLimit || strategyConfig.constraints?.voltageUpperLimit || 1.07,
      voltageLowerLimit: strategyConstraints.voltageLowerLimit || strategyConfig.constraints?.voltageLowerLimit || 0.93,
      frequencyUpperLimit: strategyConstraints.frequencyUpperLimit || 50.5,
      frequencyLowerLimit: strategyConstraints.frequencyLowerLimit || 49.5,
      lineLoadRateLimit: strategyConstraints.lineLoadRateLimit || strategyConfig.constraints?.lineLoadRateLimit || 0.9,
      devicePowerLimitPct: strategyConfig.constraints?.devicePowerLimitPct || 100,
    }
    const economicTargets = {
      optimizationMode: strategyEconomic.optimizationMode || strategyConfig.economic_targets?.optimizationMode || 'cost_first',
      targetConsumptionRate: strategyEconomic.targetConsumptionRate || strategyConfig.economic_targets?.targetConsumptionRate || 0.95,
      maxOperationCostPerKwh: strategyEconomic.maxOperationCostPerKwh || strategyConfig.economic_targets?.maxOperationCostPerKwh || 0.42,
    }

    // 电压约束转 kV: 值<5 视为标幺值，乘以基准电压
    const gridApRef = accessPoints.find((ap: any) => ap.nodeType === 'GRID')
    const baseVoltageLevel = gridApRef?.voltageLevel || 220
    const voltageUpperKV = constraints.voltageUpperLimit < 5 ? constraints.voltageUpperLimit * baseVoltageLevel : constraints.voltageUpperLimit
    const voltageLowerKV = constraints.voltageLowerLimit < 5 ? constraints.voltageLowerLimit * baseVoltageLevel : constraints.voltageLowerLimit

    // 边界条件
    const bc = sim.boundary_conditions ? JSON.parse(sim.boundary_conditions) : {}
    const maxLoadFactor = (bc.maxLoad || 100) / 100
    const minLoadFactor = (bc.minLoad || 30) / 100
    const pvOutputFactor = (bc.pvOutput || 80) / 100

    // 解析时间范围
    const timeRange = sim.time_range ? JSON.parse(sim.time_range) : {}
    const startTime = timeRange.start ? new Date(timeRange.start) : new Date()
    const endTime = timeRange.end ? new Date(timeRange.end) : new Date(startTime.getTime() + 30 * 60000)
    const stepMs = (endTime.getTime() - startTime.getTime()) / (TOTAL_STEPS - 1)

    // 提取光伏/储能/负荷节点参数
    const pvAps = accessPoints.filter((ap: any) => ap.nodeType === 'SOURCE')
    const storageAps = accessPoints.filter((ap: any) => ap.nodeType === 'STORAGE')
    const loadAps = accessPoints.filter((ap: any) => ap.nodeType === 'LOAD')
    const gridAps = accessPoints.filter((ap: any) => ap.nodeType === 'GRID')

    const totalPvCapacity = pvAps.reduce((s: number, ap: any) => s + (ap.connectedCapacity || 0), 0) || 50000
    const totalStorageCapacity = storageAps.reduce((s: number, ap: any) => s + ((ap.params?.ratedCapacityKwh || 10000)), 0) || 10000
    const totalLoadCapacity = loadAps.reduce((s: number, ap: any) => s + (ap.connectedCapacity || 0), 0) || 80000

    // 策略规则
    const controlRules: any[] = strategyConfig.control_rules || []
    const schedule: any[] = strategyConfig.schedule || []

    let storageSoc = 20 + Math.random() * 30 // 储能初始 SOC (20%-50% 波动，模拟实际运行)
    const eventLog: { step: number; time: string; description: string; level: number }[] = []

    // 解析故障注入列表
    const faults: any[] = bc.faults || []

    const startStep = sim.current_step || 0
    for (let step = startStep; step < TOTAL_STEPS; step++) {
      await new Promise((r) => setTimeout(r, STEP_DELAY_MS))

      const currentSim = await db('scenario_simulations').where('id', simulationId).first()
      if (!currentSim) { console.log(`[Sim ${simulationId}] 记录不存在，退出`); return }
      if (currentSim.status === 'stopped') { console.log(`[Sim ${simulationId}] step=${step} 状态=stopped，退出循环`); return }
      if (currentSim.status === 'paused') { console.log(`[Sim ${simulationId}] step=${step} 状态=paused，暂停循环等待恢复`); return }

      const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100)
      const stepTime = new Date(startTime.getTime() + step * stepMs)
      const stepTimeStr = stepTime.toISOString()
      const hourOfDay = stepTime.getHours() + stepTime.getMinutes() / 60

      // --- 故障注入 ---
      let faultPvDropFactor = 1
      let faultLoadSurgeFactor = 1
      let faultLineTrips: string[] = []
      for (const fault of faults) {
        if (fault.at_step === step) {
          if (fault.type === 'pv_drop') {
            faultPvDropFactor = 1 - (fault.drop_pct || 50) / 100
            eventLog.push({ step, time: stepTimeStr, description: `故障注入: 光伏出力骤降${fault.drop_pct || 50}%`, level: 2 })
          } else if (fault.type === 'load_surge') {
            faultLoadSurgeFactor = fault.multiplier || 1.3
            eventLog.push({ step, time: stepTimeStr, description: `故障注入: 负荷突增${Math.round(((fault.multiplier || 1.3) - 1) * 100)}%`, level: 2 })
          } else if (fault.type === 'line_trip') {
            faultLineTrips.push(fault.edgeId || fault.edgeName || '')
            eventLog.push({ step, time: stepTimeStr, description: `故障注入: 支路${fault.edgeId || fault.edgeName || '未知'}跳闸`, level: 2 })
          }
        }
      }

      // 读取干预参数（暂停或强制控制时写入的覆盖参数）
      let pausedParams: any = null
      try {
        pausedParams = currentSim.paused_params ? JSON.parse(currentSim.paused_params) : null
      } catch (e) {
        console.warn(`[Sim ${simulationId}] paused_params 解析失败，忽略`, e)
      }
      if (pausedParams && !pausedParams._applied) {
        try {
          // 首次应用干预参数时记录事件
          const changes: string[] = []
          if (pausedParams.pvOutputLimit !== undefined) changes.push(`光伏上限→${pausedParams.pvOutputLimit}%`)
          if (pausedParams.chargePower !== undefined) changes.push(`储能充电→${pausedParams.chargePower}kW`)
          if (pausedParams.loadShedRatio !== undefined) changes.push(`负荷切除→${pausedParams.loadShedRatio}%`)
          if (changes.length > 0) {
            eventLog.push({ step, time: stepTimeStr, description: `人工干预生效: ${changes.join('，')}`, level: 2 })
            console.log(`[Sim ${simulationId}] step=${step} 干预生效: ${changes.join('，')}`)
          }
          // 标记已应用，避免重复记录
          await db('scenario_simulations').where('id', simulationId).update({
            paused_params: JSON.stringify({ ...pausedParams, _applied: true }),
          })
          pausedParams._applied = true
        } catch (e) {
          console.error(`[Sim ${simulationId}] 应用干预失败:`, e)
        }
      }

      // 暂停参数覆盖 — 支持两种命名约定
      const effectivePvFactor = pausedParams?.pvOutputLimit !== undefined
        ? pausedParams.pvOutputLimit / 100
        : (pausedParams?.pvOutputFactor ?? pvOutputFactor)
      const effectiveMaxLoad = pausedParams?.maxLoadFactor ?? maxLoadFactor
      const effectiveLoadShedRatio = (pausedParams?.loadShedRatio ?? 0) / 100 // 干预负荷切除
      const effectiveChargePower = pausedParams?.chargePower // kW, 干预储能充电功率

      // --- 模拟光照曲线 (6:00-18:00 为正弦波峰值) ---
      const daylightFactor = hourOfDay >= 6 && hourOfDay <= 18
        ? Math.sin(Math.PI * (hourOfDay - 6) / 12)
        : 0
      const cloudNoise = 1 + (Math.sin(step * 0.7) * 0.15) + (Math.random() - 0.5) * 0.1
      const pvOutput = totalPvCapacity * daylightFactor * effectivePvFactor * cloudNoise * faultPvDropFactor

      // --- 模拟负荷曲线 (双峰: 上午9-11, 晚上18-20) ---
      const morningPeak = Math.exp(-Math.pow((hourOfDay - 10) / 3, 2)) * 0.6
      const eveningPeak = Math.exp(-Math.pow((hourOfDay - 19) / 3, 2)) * 0.7
      const baseLoad = 0.4
      const loadFactor = baseLoad + morningPeak + eveningPeak
      const loadRange = maxLoadFactor - minLoadFactor
      const loadDemand = totalLoadCapacity * (minLoadFactor + loadFactor * (effectiveMaxLoad - minLoadFactor))
      const loadNoise = 1 + (Math.random() - 0.5) * 0.06
      const finalLoadDemand = loadDemand * loadNoise * faultLoadSurgeFactor * (1 - effectiveLoadShedRatio)

      // --- 储能充放电逻辑 ---
      const netPower = pvOutput - finalLoadDemand
      // 干预充电功率覆盖
      const chargeRate = effectiveChargePower !== undefined
        ? Math.min(effectiveChargePower, totalStorageCapacity * 0.30) / totalStorageCapacity * 30
        : totalStorageCapacity * 0.15
      if (netPower > 0 && storageSoc < 90) {
        storageSoc = Math.min(90, storageSoc + (netPower / totalStorageCapacity) * 30)
      } else if (netPower < 0 && storageSoc > 20) {
        storageSoc = Math.max(20, storageSoc + (netPower / totalStorageCapacity) * 30)
      }
      // 干预充电功率强制充电
      if (effectiveChargePower !== undefined && storageSoc < 90) {
        storageSoc = Math.min(90, storageSoc + (effectiveChargePower / (totalStorageCapacity || 1)) * (STEP_DELAY_MS / 1000) * 2)
      }
      storageSoc += (Math.random() - 0.5) * 2 // 噪声
      storageSoc = Math.max(15, Math.min(95, storageSoc))

      // --- 电压计算 kV (负荷越高电压越低) ---
      const loadRatio = finalLoadDemand / (totalLoadCapacity || 1)
      const voltagePU = 1.0 - loadRatio * 0.08 + (pvOutput / (totalPvCapacity || 1)) * 0.03
      const voltageNoise = (Math.random() - 0.5) * 0.015
      const systemVoltageKV = baseVoltageLevel * (Math.max(0.88, Math.min(1.12, voltagePU + voltageNoise)))

      // --- 频率计算 (功率不平衡导致频偏) ---
      const powerImbalance = (finalLoadDemand - pvOutput) / (totalLoadCapacity || 1)
      const systemFrequency = 50.0 + powerImbalance * 0.3 + (Math.random() - 0.5) * 0.1

      // --- 负载率 ---
      const systemLoadRate = (finalLoadDemand / (totalLoadCapacity || 1)) * 100

      // --- 消纳率 ---
      const pvConsumed = Math.min(pvOutput, finalLoadDemand + (storageSoc < 90 ? chargeRate : 0))
      const consumptionRate = pvOutput > 0 ? Math.min(100, (pvConsumed / pvOutput) * 100) : 100

      // --- 运营成本估算 ---
      const gridImport = Math.max(0, finalLoadDemand - pvOutput - (storageSoc > 20 ? chargeRate : 0))
      const operationCost = (pvOutput * 0.05 + gridImport * 0.42 + Math.abs(netPower) * 0.02) / (finalLoadDemand || 1)

      // --- 策略事件检测 ---
      const stepEvents: { description: string; level: number }[] = []

      // 光伏超发检测
      if (pvOutput > totalPvCapacity * 0.85 && storageSoc < 80) {
        stepEvents.push({ description: `光伏出力过高 (${Math.round(pvOutput)}kW)，储能开始充电`, level: 1 })
      }
      // 电压越限检测
      if (systemVoltageKV > voltageUpperKV) {
        stepEvents.push({ description: `电压越上限: ${systemVoltageKV.toFixed(1)}kV > ${voltageUpperKV.toFixed(1)}kV，建议限制光伏出力或投入电抗器`, level: 2 })
        storageSoc = Math.min(95, storageSoc + 3) // 储能充电缓解过压
      } else if (systemVoltageKV < voltageLowerKV) {
        stepEvents.push({ description: `电压越下限: ${systemVoltageKV.toFixed(1)}kV < ${voltageLowerKV.toFixed(1)}kV，建议增加无功补偿`, level: 2 })
        storageSoc = Math.max(15, storageSoc - 3) // 储能放电支撑电压
      }
      // 负载率越限
      if (systemLoadRate > constraints.lineLoadRateLimit * 100) {
        stepEvents.push({ description: `线路负载率过高: ${systemLoadRate.toFixed(1)}% > ${(constraints.lineLoadRateLimit * 100).toFixed(0)}%，触发削峰控制`, level: 2 })
      }
      // 消纳率偏低
      if (consumptionRate < economicTargets.targetConsumptionRate * 100 && pvOutput > totalPvCapacity * 0.3) {
        stepEvents.push({ description: `消纳率偏低: ${consumptionRate.toFixed(1)}% < 目标${(economicTargets.targetConsumptionRate * 100).toFixed(0)}%，建议增加储能配置`, level: 1 })
      }
      // 频率越限
      if (Math.abs(systemFrequency - 50) > 0.5) {
        stepEvents.push({ description: `频率偏差过大: ${systemFrequency.toFixed(2)}Hz，偏差${Math.abs(systemFrequency - 50).toFixed(2)}Hz`, level: 2 })
      }

      // 记录事件
      for (const ev of stepEvents) {
        eventLog.push({ step, time: stepTimeStr, description: ev.description, level: ev.level })
      }

      // --- 批量生成指标数据 ---
      const metricsBatch: any[] = []

      // 系统级指标
      metricsBatch.push(
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'voltage', unit: 'kV', value: Math.round(systemVoltageKV * 100) / 100, threshold: Math.round(voltageUpperKV * 100) / 100, is_violation: systemVoltageKV > voltageUpperKV || systemVoltageKV < voltageLowerKV ? 1 : 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'frequency', unit: 'Hz', value: Math.round(systemFrequency * 100) / 100, threshold: constraints.frequencyUpperLimit, is_violation: Math.abs(systemFrequency - 50) > 0.5 ? 1 : 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'load_rate', unit: '%', value: Math.round(systemLoadRate * 10) / 10, threshold: Math.round(constraints.lineLoadRateLimit * 100), is_violation: systemLoadRate > constraints.lineLoadRateLimit * 100 ? 1 : 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'consumption_rate', unit: '%', value: Math.round(consumptionRate * 10) / 10, threshold: Math.round(economicTargets.targetConsumptionRate * 100), is_violation: consumptionRate < economicTargets.targetConsumptionRate * 100 ? 1 : 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'pv_output', unit: 'kW', value: Math.round(pvOutput), threshold: Math.round(totalPvCapacity), is_violation: 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'load_demand', unit: 'kW', value: Math.round(finalLoadDemand), threshold: Math.round(totalLoadCapacity), is_violation: 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'storage_soc', unit: '%', value: Math.round(storageSoc * 10) / 10, threshold: 90, is_violation: storageSoc > 90 || storageSoc < 20 ? 1 : 0 },
        { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'operation_cost', unit: '¥/kWh', value: Math.round(operationCost * 1000) / 1000, threshold: economicTargets.maxOperationCostPerKwh, is_violation: operationCost > economicTargets.maxOperationCostPerKwh ? 1 : 0 },
      )

      // 接入点级别指标
      for (const ap of accessPoints) {
        const apName = ap.nodeName || '未命名'
        const apVoltage = systemVoltageKV + (Math.random() - 0.5) * 0.02 * baseVoltageLevel
        const apLoadRate = ap.nodeType === 'LOAD' ? loadRatio * 100 * (0.8 + Math.random() * 0.4) : systemLoadRate * (0.7 + Math.random() * 0.6)
        metricsBatch.push(
          { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: `voltage:${apName}`, unit: 'kV', value: Math.round(apVoltage * 100) / 100, threshold: Math.round(voltageUpperKV * 100) / 100, is_violation: apVoltage > voltageUpperKV || apVoltage < voltageLowerKV ? 1 : 0 },
          { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: `load_rate:${apName}`, unit: '%', value: Math.round(apLoadRate * 10) / 10, threshold: Math.round(constraints.lineLoadRateLimit * 100), is_violation: apLoadRate > constraints.lineLoadRateLimit * 100 ? 1 : 0 },
        )
      }

      // 拓扑支路级别指标
      for (const edge of topology.edges || []) {
        const edgeName = `${getNodeNameById(topology.nodes, edge.sourceId)}-${getNodeNameById(topology.nodes, edge.targetId)}`
        const edgeLoadRate = systemLoadRate * (0.6 + Math.random() * 0.8)
        metricsBatch.push(
          { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: `load_rate:${edgeName}`, unit: '%', value: Math.round(edgeLoadRate * 10) / 10, threshold: Math.round(constraints.lineLoadRateLimit * 100), is_violation: edgeLoadRate > constraints.lineLoadRateLimit * 100 ? 1 : 0 },
        )
      }

      // 策略事件指标
      for (const ev of stepEvents) {
        metricsBatch.push(
          { id: uuidv4(), simulation_id: simulationId, timestamp: stepTimeStr, metric_type: 'strategy_event', unit: ev.description, value: 0, threshold: 0, is_violation: ev.level },
        )
      }

      await db('simulation_metrics').insert(metricsBatch)
      await db('scenario_simulations').where('id', simulationId).update({ progress, current_step: step + 1 })
    }

    // 模拟完成
    await db('scenario_simulations').where('id', simulationId).update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
    })
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

  async pauseSimulation(id: string) {
    const sim = await db('scenario_simulations').where('id', id).first()
    if (!sim || sim.status !== 'running') throw new Error('模拟未运行，无法暂停')
    await db('scenario_simulations').where('id', id).update({ status: 'paused' })
    return this.getSimulation(id)
  }

  async resumeSimulation(id: string) {
    const sim = await db('scenario_simulations').where('id', id).first()
    if (!sim || sim.status !== 'paused') throw new Error('模拟未暂停，无法恢复')
    await db('scenario_simulations').where('id', id).update({ status: 'running' })
    // 后台恢复循环
    this.simulateProgress(id).catch((err) => {
      console.error(`[Simulation ${id}] 模拟恢复失败:`, err)
      db('scenario_simulations').where('id', id).update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      }).catch(() => {})
    })
    return this.getSimulation(id)
  }

  async updateSimulationParams(id: string, params: any) {
    const sim = await db('scenario_simulations').where('id', id).first()
    if (!sim) throw new Error('模拟不存在')
    if (sim.status !== 'paused' && sim.status !== 'running') throw new Error('只能在运行或暂停状态下修改参数')
    await db('scenario_simulations').where('id', id).update({
      paused_params: JSON.stringify(params),
    })
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
    const strategy = sim.strategy_id ? await db('scenario_strategies').where('id', sim.strategy_id).first() : null
    const strategyEconomic = strategy?.economic_targets ? JSON.parse(strategy.economic_targets) : {}
    const id = uuidv4()
    const now = new Date().toISOString()

    // 提取关键指标
    const allMetrics = results.metrics || []
    const getSeries = (type: string) => allMetrics.filter((m: any) => m.metric_type === type)

    const voltageSeries = getSeries('voltage')
    const loadRateSeries = getSeries('load_rate')
    const consumptionRateSeries = getSeries('consumption_rate')
    const operationCostSeries = getSeries('operation_cost')
    const pvOutputSeries = getSeries('pv_output')
    const loadDemandSeries = getSeries('load_demand')

    const avgVoltage = voltageSeries.length > 0 ? voltageSeries.reduce((s: number, m: any) => s + m.value, 0) / voltageSeries.length : 0
    const avgLoadRate = loadRateSeries.length > 0 ? loadRateSeries.reduce((s: number, m: any) => s + m.value, 0) / loadRateSeries.length : 0
    const avgConsumptionRate = consumptionRateSeries.length > 0 ? consumptionRateSeries.reduce((s: number, m: any) => s + m.value, 0) / consumptionRateSeries.length : 0
    const avgCost = operationCostSeries.length > 0 ? operationCostSeries.reduce((s: number, m: any) => s + m.value, 0) / operationCostSeries.length : 0

    const violationCount = results.violations.length
    const totalMetrics = allMetrics.filter((m: any) => m.metric_type !== 'strategy_event').length
    const passRate = totalMetrics > 0 ? Math.round(((totalMetrics - violationCount) / totalMetrics) * 100) : 100

    // 目标达成计算
    const targetConsumptionRate = strategyEconomic.targetConsumptionRate || 0.95
    const maxOperationCost = strategyEconomic.maxOperationCostPerKwh || 0.42
    const consumptionAchievement = targetConsumptionRate > 0 ? Math.round((avgConsumptionRate / (targetConsumptionRate * 100)) * 100) : 100
    const costAchievement = maxOperationCost > 0 ? Math.round(((maxOperationCost - avgCost) / maxOperationCost) * 100 + 50) : 0

    // 经济明细
    const totalPv = pvOutputSeries.reduce((s: number, m: any) => s + m.value, 0)
    const totalLoad = loadDemandSeries.reduce((s: number, m: any) => s + m.value, 0)
    const avgPv = pvOutputSeries.length > 0 ? totalPv / pvOutputSeries.length : 0
    const avgLoad = loadDemandSeries.length > 0 ? totalLoad / loadDemandSeries.length : 0
    const gridImport = Math.max(0, avgLoad - avgPv)
    const pvExport = Math.max(0, avgPv - avgLoad)
    const buyCost = gridImport * 0.42
    const sellIncome = pvExport * 0.25
    const storageLoss = Math.abs(avgPv - avgLoad) * 0.05
    const netBenefit = sellIncome - buyCost - storageLoss

    const economicDetails = {
      totalBuyCost: Math.round(buyCost * 100) / 100,
      totalSellIncome: Math.round(sellIncome * 100) / 100,
      storageLoss: Math.round(storageLoss * 100) / 100,
      netBenefit: Math.round(netBenefit * 100) / 100,
      avgCostPerKwh: Math.round(avgCost * 1000) / 1000,
    }

    // 越限详情（含推断原因）
    const violationDetails = results.violations.map((v: any) => {
      let cause = '未知原因'
      if (v.metric_type === 'voltage' || v.metric_type.startsWith('voltage:')) {
        cause = v.value > 1.07 ? '光伏出力突增，储能/无功补偿响应不及时' : '负荷突增或光伏骤降，无功支撑不足'
      } else if (v.metric_type === 'frequency') {
        cause = '功率不平衡超过调节能力'
      } else if (v.metric_type === 'load_rate' || v.metric_type.startsWith('load_rate:')) {
        cause = '线路/变压器过载，建议扩容或分流'
      } else if (v.metric_type === 'consumption_rate') {
        cause = '光伏出力超过负荷+储能消纳能力，建议增加储能配置或调整充电策略'
      }
      return {
        timestamp: v.timestamp,
        metricType: v.metric_type,
        value: v.value,
        threshold: v.threshold,
        description: `${v.metric_type} 越限: ${v.value} (阈值: ${v.threshold})`,
        cause,
      }
    })

    // 改进建议
    const suggestions: string[] = []
    if (avgLoadRate > 80) suggestions.push('负载率偏高，建议扩容线路或增加分布式储能削峰')
    if (avgConsumptionRate < 90) suggestions.push('消纳率偏低，建议增加储能容量或调整充放电时间窗口')
    if (avgCost > 0.42) suggestions.push('运营成本偏高，建议提高光伏自用比例，减少高峰购电')
    const voltageViolations = results.violations.filter((v: any) => v.metric_type.startsWith('voltage'))
    if (voltageViolations.length > 0) {
      const vThreshold = voltageViolations[0]?.threshold || 235
      const highCount = voltageViolations.filter((v: any) => v.value > vThreshold).length
      const lowCount = voltageViolations.length - highCount
      if (highCount > 0) suggestions.push(`电压越上限${highCount}次，建议缩短储能充电响应时间或限制光伏出力上限`)
      if (lowCount > 0) suggestions.push(`电压越下限${lowCount}次，建议增加无功补偿容量或储能放电支撑`)
    }
    if (suggestions.length === 0) suggestions.push('当前策略效果良好，各项指标均在安全范围内')

    const effectivenessScore = Math.max(0, Math.min(100, passRate - Math.random() * 3))

    const executionLog = {
      startTime: sim.started_at,
      endTime: sim.completed_at || now,
      totalSteps: sim.current_step || 0,
      completedSteps: sim.current_step || 0,
      metricsGenerated: totalMetrics,
      violationsDetected: violationCount,
      events: [
        { time: sim.started_at, event: '模拟启动', level: 'info' },
        ...violationDetails.slice(0, 20).map((v: any) => ({ time: v.timestamp, event: v.description, level: 'warning' })),
        { time: sim.completed_at || now, event: '模拟完成', level: 'info' },
      ],
    }

    const evaluationReport = {
      summary: `模拟共产生 ${totalMetrics} 个指标数据，其中 ${violationCount} 个越限，综合通过率 ${passRate}%`,
      passRate,
      violationCount,
      effectivenessScore: Math.round(effectivenessScore),
      securityAssessment: passRate >= 90 ? '安全' : passRate >= 70 ? '基本安全' : '不满足安全要求',
      economicAssessment: effectivenessScore >= 80 ? '经济性良好' : '经济性一般，建议优化',
      targetAchievement: {
        consumptionRate: { target: Math.round(targetConsumptionRate * 100), actual: Math.round(avgConsumptionRate), achievement: consumptionAchievement },
        operationCost: { target: maxOperationCost, actual: Math.round(avgCost * 1000) / 1000, achievement: costAchievement },
      },
      economicDetails,
      avgMetrics: {
        voltage: Math.round(avgVoltage * 1000) / 1000,
        loadRate: Math.round(avgLoadRate * 10) / 10,
        consumptionRate: Math.round(avgConsumptionRate * 10) / 10,
      },
    }

    const row = {
      id,
      simulation_id: simulationId,
      strategy_id: sim.strategy_id,
      execution_log: JSON.stringify(executionLog),
      evaluation_report: JSON.stringify(evaluationReport),
      effectiveness_score: effectivenessScore,
      issues: JSON.stringify(violationDetails),
      suggestions: suggestions.join('; '),
      created_at: now,
    }
    await db('scenario_evaluations').insert(row)
    return this.getEvaluation(id)
  }

  async exportEvaluation(evaluationId: string, format: 'word' | 'pdf' = 'word') {
    const evaluation = await this.getEvaluation(evaluationId)
    if (!evaluation) throw new Error('评估记录不存在')

    const report = evaluation.evaluation_report || {}
    const issues = evaluation.issues || []

    if (format === 'word') {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel } = await import('docx')
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: '场景执行效果评估报告', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `评估时间: ${evaluation.created_at}`, spacing: { after: 200 } }),
            new Paragraph({ text: `综合评分: ${evaluation.effectiveness_score}分`, heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `安全性评估: ${report.securityAssessment}` }),
            new Paragraph({ text: `经济性评估: ${report.economicAssessment}` }),
            new Paragraph({ text: `安全通过率: ${report.passRate}%` }),
            new Paragraph({ text: `越限项数: ${report.violationCount}` }),
            new Paragraph({ text: '', spacing: { after: 200 } }),
            new Paragraph({ text: '经济明细', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `总购电成本: ¥${report.economicDetails?.totalBuyCost || 0}` }),
            new Paragraph({ text: `总售电收入: ¥${report.economicDetails?.totalSellIncome || 0}` }),
            new Paragraph({ text: `储能损耗: ¥${report.economicDetails?.storageLoss || 0}` }),
            new Paragraph({ text: `净收益: ¥${report.economicDetails?.netBenefit || 0}` }),
            new Paragraph({ text: `平均运营成本: ¥${report.economicDetails?.avgCostPerKwh || 0}/kWh` }),
            new Paragraph({ text: '', spacing: { after: 200 } }),
            new Paragraph({ text: `改进建议: ${evaluation.suggestions || '无'}` }),
            ...(issues.length > 0 ? [
              new Paragraph({ text: '越限详情', heading: HeadingLevel.HEADING_2 }),
              ...issues.map((v: any) => new Paragraph({ text: `${v.timestamp}: ${v.description} — 原因: ${v.cause}` })),
            ] : []),
          ],
        }],
      })
      const buffer = await Packer.toBuffer(doc)
      return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: `评估报告_${evaluationId.slice(0, 8)}.docx` }
    } else {
      const PDFDocument = (await import('pdfkit')).default
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers: Buffer[] = []
      doc.on('data', (chunk: Buffer) => buffers.push(chunk))
      const endPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)))
      })
      doc.fontSize(20).text('场景执行效果评估报告', { align: 'center' })
      doc.moveDown()
      doc.fontSize(12).text(`评估时间: ${evaluation.created_at}`)
      doc.text(`综合评分: ${evaluation.effectiveness_score}分 (${report.securityAssessment})`)
      doc.text(`安全通过率: ${report.passRate}%  |  越限项数: ${report.violationCount}`)
      doc.moveDown()
      doc.fontSize(14).text('经济明细')
      doc.fontSize(11).text(`总购电成本: ¥${report.economicDetails?.totalBuyCost || 0}`)
      doc.text(`总售电收入: ¥${report.economicDetails?.totalSellIncome || 0}`)
      doc.text(`储能损耗: ¥${report.economicDetails?.storageLoss || 0}`)
      doc.text(`净收益: ¥${report.economicDetails?.netBenefit || 0}`)
      doc.moveDown()
      doc.fontSize(14).text('改进建议')
      doc.fontSize(11).text(evaluation.suggestions || '无')
      if (issues.length > 0) {
        doc.moveDown()
        doc.fontSize(14).text('越限详情')
        for (const v of issues) {
          doc.fontSize(10).text(`${v.timestamp}: ${v.description}`)
        }
      }
      doc.end()
      const buffer = await endPromise
      return { buffer, contentType: 'application/pdf', filename: `评估报告_${evaluationId.slice(0, 8)}.pdf` }
    }
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

  async createIntervention(data: {
    scenario_id?: string
    simulation_id?: string
    operation_type: string
    operation_params?: any
    reason?: string
  }, userId: string) {
    const id = uuidv4()
    const now = new Date().toISOString()

    // 若未传 scenario_id，从仿真记录中提取
    let scenarioId = data.scenario_id
    if (!scenarioId && data.simulation_id) {
      const sim = await db('scenario_simulations').where('id', data.simulation_id).first()
      scenarioId = sim?.scenario_id || ''
    }

    // 获取修改前的参数快照
    let paramsBefore: any = null
    let paramsAfter: any = data.operation_params || null
    if (data.simulation_id) {
      const sim = await db('scenario_simulations').where('id', data.simulation_id).first()
      if (sim) {
        paramsBefore = {
          boundary_conditions: sim.boundary_conditions ? JSON.parse(sim.boundary_conditions) : null,
          paused_params: sim.paused_params ? JSON.parse(sim.paused_params) : null,
          status: sim.status,
          progress: sim.progress,
        }
      }
    }

    const row = {
      id,
      scenario_id: scenarioId,
      simulation_id: data.simulation_id || null,
      operation_type: data.operation_type,
      operation_params: data.operation_params ? JSON.stringify(data.operation_params) : null,
      params_before: paramsBefore ? JSON.stringify(paramsBefore) : null,
      params_after: paramsAfter ? JSON.stringify(paramsAfter) : null,
      operator: userId,
      reason: data.reason || '',
      operated_at: now,
    }
    await db('scenario_interventions').insert(row)

    // 操作类型对应动作
    if (data.operation_type === 'emergency_stop' && data.simulation_id) {
      // 紧急停止指定仿真
      await db('scenario_simulations').where('id', data.simulation_id).update({ status: 'stopped' })
      // 写入事件指标
      const eventId = uuidv4()
      await db('simulation_metrics').insert({
        id: eventId, simulation_id: data.simulation_id, timestamp: now,
        metric_type: 'strategy_event', unit: `[紧急干预] 紧急停止 | ${data.reason || '人工干预'}`, value: 1, threshold: 0, is_violation: 2,
      })
    } else if (data.operation_type === 'pause' && data.simulation_id) {
      await db('scenario_simulations').where('id', data.simulation_id).update({ status: 'paused' })
      const eventId = uuidv4()
      await db('simulation_metrics').insert({
        id: eventId, simulation_id: data.simulation_id, timestamp: now,
        metric_type: 'strategy_event', unit: `[人工干预] 暂停仿真 | ${data.reason || '人工干预'}`, value: 0, threshold: 0, is_violation: 1,
      })
    } else if (data.operation_type === 'force_control' && data.simulation_id) {
      // 写入 paused_params — 运行中仿真下一步会读取，暂停的也会在下一次恢复时生效
      const sim = await db('scenario_simulations').where('id', data.simulation_id).first()
      const prevStatus = sim?.status
      console.log(`[Intervention] force_control sim=${data.simulation_id} prevStatus=${prevStatus}`)
      const existing = sim?.paused_params ? JSON.parse(sim.paused_params) : {}
      const merged = { ...existing, ...data.operation_params, _applied: false }
      await db('scenario_simulations').where('id', data.simulation_id).update({
        paused_params: JSON.stringify(merged),
      })
      // 防御：若状态被意外改变，恢复为原状态
      if (prevStatus === 'running') {
        const after = await db('scenario_simulations').where('id', data.simulation_id).first()
        if (after?.status !== 'running') {
          console.warn(`[Intervention] 状态异常变更: ${prevStatus} → ${after?.status}，恢复为 running`)
          await db('scenario_simulations').where('id', data.simulation_id).update({ status: 'running' })
        }
      }
      // 写入事件指标 (level=2 红色高亮)
      const descParts: string[] = []
      if (data.operation_params?.pvOutputLimit !== undefined) descParts.push(`光伏上限→${data.operation_params.pvOutputLimit}%`)
      if (data.operation_params?.chargePower !== undefined) descParts.push(`储能充电→${data.operation_params.chargePower}kW`)
      if (data.operation_params?.loadShedRatio !== undefined) descParts.push(`负荷切除→${data.operation_params.loadShedRatio}%`)
      const eventId = uuidv4()
      await db('simulation_metrics').insert({
        id: eventId, simulation_id: data.simulation_id, timestamp: now,
        metric_type: 'strategy_event', unit: `[紧急干预] 强制控制 | ${descParts.join('，')}`, value: 1, threshold: 0, is_violation: 2,
      })
      console.log(`[Intervention] force_control done, status=${after?.status || prevStatus}`)
    }

    return {
      ...row,
      operation_params: data.operation_params || null,
      params_before: paramsBefore,
      params_after: paramsAfter,
    }
  }

  async exportInterventions(query: { scenario_id?: string; operation_type?: string; start_date?: string; end_date?: string }) {
    const list = await this.listInterventions(query)
    return (list || []).map((r: any) => ({
      操作人: r.operator,
      操作类型: r.operation_type,
      操作参数: JSON.stringify(r.operation_params || {}),
      操作前状态: r.params_before ? JSON.stringify(r.params_before) : '',
      操作后状态: r.params_after ? JSON.stringify(r.params_after) : '',
      原因: r.reason,
      操作时间: r.operated_at,
    }))
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

  async getSimulationLive(simulationId: string, sinceStep: number = 0) {
    const sim = await this.getSimulation(simulationId)
    if (!sim) return null

    const allMetrics = await db('simulation_metrics')
      .where('simulation_id', simulationId)
      .orderBy('timestamp', 'asc')

    // 按 step 分组 (通过 timestamp 去重+排序推断 step)
    const seenTimestamps = new Set<string>()
    let stepIndex = -1
    const stepMap = new Map<number, any[]>()
    for (const m of allMetrics) {
      if (!seenTimestamps.has(m.timestamp)) {
        seenTimestamps.add(m.timestamp)
        stepIndex++
        stepMap.set(stepIndex, [])
      }
      stepMap.get(stepIndex)!.push(m)
    }

    // 提取 sinceStep 之后的新数据
    const newMetrics: any[] = []
    const events: { step: number; time: string; description: string; level: number }[] = []
    const latestStep = stepIndex

    for (let s = sinceStep + 1; s <= stepIndex; s++) {
      const stepMetrics = stepMap.get(s) || []
      for (const m of stepMetrics) {
        newMetrics.push(m)
        if (m.metric_type === 'strategy_event') {
          events.push({ step: s, time: m.timestamp, description: m.unit, level: m.is_violation })
        }
      }
    }

    // 最新快照
    const latestMetrics = stepMap.get(stepIndex) || []
    const getLatest = (type: string) => {
      const m = latestMetrics.find((x: any) => x.metric_type === type)
      return m ? m.value : 0
    }
    const violationCount = newMetrics.filter((m: any) => m.is_violation && m.metric_type !== 'strategy_event').length
    const totalMetrics = newMetrics.filter((m: any) => m.metric_type !== 'strategy_event').length

    return {
      progress: sim.progress,
      status: sim.status,
      step: latestStep,
      newMetrics,
      events,
      paused_params: sim.paused_params ? JSON.parse(sim.paused_params) : null,
      summary: {
        voltage: getLatest('voltage'),
        frequency: getLatest('frequency'),
        loadRate: getLatest('load_rate'),
        consumptionRate: getLatest('consumption_rate'),
        pvOutput: getLatest('pv_output'),
        loadDemand: getLatest('load_demand'),
        storageSoc: getLatest('storage_soc'),
        operationCost: getLatest('operation_cost'),
        violationCount,
        totalMetrics,
        passRate: totalMetrics > 0 ? Math.round(((totalMetrics - violationCount) / totalMetrics) * 100) : 100,
      },
    }
  }
}

function getNodeNameById(nodes: any[], id: string): string {
  const n = nodes.find((x: any) => x.id === id)
  return n?.nodeName || id?.slice(0, 6) || '?'
}
