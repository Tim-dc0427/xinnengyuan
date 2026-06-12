import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  // 按外键依赖反向删除
  await knex('scenario_interventions').del()
  await knex('scenario_evaluations').del()
  await knex('simulation_metrics').del()
  await knex('scenario_simulations').del()
  await knex('scenario_strategies').del()
  await knex('scenario_versions').del()
  await knex('interactive_scenarios').del()

  // ========================
  // 场景 1：夏季高峰负荷场景
  // ========================
  const s1Id = uuid()
  const s1Config = {
    accessPoints: [
      { nodeType: 'GRID', nodeId: 'bus-yuhang-220', nodeName: '仓前变', connectedCapacity: 360, voltageLevel: 220, connectionType: 'AC', params: { tapRegulation: true, reactiveCompensation: true } },
      { nodeType: 'SOURCE', nodeId: 'pv-shuneng', nodeName: '舒能渔光互补400MW', connectedCapacity: 400, voltageLevel: 220, connectionType: 'AC', params: { outputUpperLimit: 95, outputLowerLimit: 10, powerFactor: 0.95, regulationDelay: 30 } },
      { nodeType: 'SOURCE', nodeId: 'pv-lingneng', nodeName: '凌能渔光互补250MW', connectedCapacity: 250, voltageLevel: 220, connectionType: 'AC', params: { outputUpperLimit: 95, outputLowerLimit: 10, powerFactor: 0.93, regulationDelay: 30 } },
      { nodeType: 'LOAD', nodeId: 'load-qiantang', nodeName: '钱塘区临江工业园负荷', connectedCapacity: 80, voltageLevel: 220, connectionType: 'AC', params: { peakClippingRate: 20, valleyFillingRate: 15, interruptibleLoadRatio: 8 } },
      { nodeType: 'STORAGE', nodeId: 'storage-qiantang', nodeName: '钱塘储能站一期', connectedCapacity: 50, voltageLevel: 220, connectionType: 'DC', params: { chargeSchedule: '00:00-05:00', dischargeSchedule: '09:00-12:00,18:00-22:00', socUpper: 95, socLower: 15, ratedPowerKw: 50000, ratedCapacityKwh: 200000 } },
    ],
    controlRules: [
      { name: '削峰控制', condition: '负载率 > 85% 且光伏出力 < 30%', action: '启用储能放电 + 工业负荷中断5%', priority: 1 },
      { name: '电压调节', condition: '220kV母线电压 > 235kV', action: '降低光伏无功输出 + 投入电抗器', priority: 2 },
      { name: '频率响应', condition: '系统频率偏差 > 0.2Hz', action: '储能参与一次调频', priority: 3 },
    ],
    dataSource: { type: 'hybrid', frequency: '15min', startDate: '2026-07-01', endDate: '2026-08-31' },
  }
  await knex('interactive_scenarios').insert({
    id: s1Id, name: '夏季高峰负荷场景', type: 'industrial_park', scenario_condition: 'peak_load', version_limit: 10,
    description: '模拟7-8月夏季高温天气下，钱塘工业园满负荷运行、光伏高出力、储能削峰填谷的综合场景。验证系统在极端负荷条件下的电压稳定性和设备负载率。',
    config: JSON.stringify(s1Config), control_logic: JSON.stringify({ mode: 'auto_peak_shaving', safetyCheck: true, fallbackStrategy: 'load_shedding' }),
    tags: JSON.stringify(['夏季', '高峰负荷', '储能调度', '削峰填谷']),
    status: 'active', created_by: '张工',
    created_at: '2026-04-10T09:00:00.000Z', updated_at: '2026-05-18T14:30:00.000Z',
  })

  // 场景1 版本历史
  const s1v1Id = uuid()
  await knex('scenario_versions').insert({ id: s1v1Id, scenario_id: s1Id, version_number: 1, config_snapshot: JSON.stringify(s1Config), control_logic_snapshot: JSON.stringify({ mode: 'auto_peak_shaving', safetyCheck: false }), changelog: '初始创建，控制逻辑为基础削峰模式', created_by: '张工', created_at: '2026-04-10T09:00:00.000Z' })
  await knex('scenario_versions').insert({ id: uuid(), scenario_id: s1Id, version_number: 2, config_snapshot: JSON.stringify(s1Config), control_logic_snapshot: JSON.stringify({ mode: 'auto_peak_shaving', safetyCheck: false }), changelog: '新增凌能250MW光伏接入点，增加工业负荷中断策略', created_by: '李工', created_at: '2026-04-25T16:00:00.000Z' })
  await knex('scenario_versions').insert({ id: uuid(), scenario_id: s1Id, version_number: 3, config_snapshot: JSON.stringify(s1Config), control_logic_snapshot: JSON.stringify({ mode: 'auto_peak_shaving', safetyCheck: true, fallbackStrategy: 'load_shedding' }), changelog: '启用安全校验和负荷脱落后备策略，通过验证后设为active', created_by: '张工', created_at: '2026-05-18T14:30:00.000Z' })

  // 场景1 策略
  const s1St1Id = uuid()
  await knex('scenario_strategies').insert({ id: s1St1Id, scenario_id: s1Id, name: '夏季高峰综合调控', strategy_type: 'comprehensive', config: JSON.stringify({ sourceRegulation: { pvOutputUpperLimit: 0.90, pvOutputLowerLimit: 0.10 }, gridRegulation: { tapRegulationEnabled: true, reactivePowerCompensation: true }, loadRegulation: { peakClippingRate: 0.20, valleyFillingRate: 0.15, interruptibleLoadRatio: 0.08 }, storageRegulation: { chargeSchedule: '00:00-05:00', dischargeSchedule: '09:00-12:00,18:00-22:00', socUpperLimit: 0.95, socLowerLimit: 0.15 } }), constraints: JSON.stringify({ voltageUpperLimit: 231, voltageLowerLimit: 209, frequencyUpperLimit: 50.3, frequencyLowerLimit: 49.7, lineLoadRateLimit: 0.85 }), economic_targets: JSON.stringify({ targetConsumptionRate: 0.92, maxOperationCostPerKwh: 0.45, minComprehensiveEfficiency: 0.85 }), generated_by_algorithm: '0', status: 'active', created_at: '2026-05-20T10:00:00.000Z', updated_at: '2026-05-20T10:00:00.000Z' })
  const s1St2Id = uuid()
  await knex('scenario_strategies').insert({ id: s1St2Id, scenario_id: s1Id, name: '夏季经济型策略', strategy_type: 'economic', config: JSON.stringify({ sourceRegulation: { pvOutputUpperLimit: 0.95, pvOutputLowerLimit: 0.05 }, gridRegulation: { tapRegulationEnabled: false, reactivePowerCompensation: true }, loadRegulation: { peakClippingRate: 0.10, valleyFillingRate: 0.08, interruptibleLoadRatio: 0.03 }, storageRegulation: { chargeSchedule: '02:00-06:00', dischargeSchedule: '10:00-12:00,18:00-20:00', socUpperLimit: 0.90, socLowerLimit: 0.20 } }), constraints: JSON.stringify({ voltageUpperLimit: 235, voltageLowerLimit: 205, frequencyUpperLimit: 50.5, frequencyLowerLimit: 49.5, lineLoadRateLimit: 0.90 }), economic_targets: JSON.stringify({ targetConsumptionRate: 0.90, maxOperationCostPerKwh: 0.38, minComprehensiveEfficiency: 0.82 }), generated_by_algorithm: '1', status: 'draft', created_at: '2026-05-21T08:00:00.000Z', updated_at: '2026-05-21T08:00:00.000Z' })

  // 场景1 模拟
  const s1Sim1Id = uuid()
  await knex('scenario_simulations').insert({ id: s1Sim1Id, scenario_id: s1Id, strategy_id: s1St1Id, status: 'completed', boundary_conditions: JSON.stringify({ startDemand: 320, pvOutputStart: 280, gridVoltage: 1.02 }), time_range: JSON.stringify({ start: '2026-07-15T00:00:00', end: '2026-07-15T23:59:59', step: '15min' }), step_interval_minutes: 15, speed_multiplier: 1, current_step: 96, progress: 100, started_at: '2026-06-01T08:00:00.000Z', completed_at: '2026-06-01T08:05:30.000Z', created_by: '张工' })
  // 场景1 模拟指标
  await knex('simulation_metrics').insert([
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:01:00.000Z', metric_type: 'voltage', unit: 'kV', value: 227.0, threshold: 231, is_violation: 0 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:02:00.000Z', metric_type: 'voltage', unit: 'kV', value: 232.8, threshold: 231, is_violation: 1 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:03:00.000Z', metric_type: 'voltage', unit: 'kV', value: 229.0, threshold: 231, is_violation: 0 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:01:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 50.12, threshold: 50.3, is_violation: 0 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:02:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 50.38, threshold: 50.3, is_violation: 1 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:03:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 50.05, threshold: 50.3, is_violation: 0 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:01:00.000Z', metric_type: 'load_rate', unit: '%', value: 78.4, threshold: 85, is_violation: 0 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:02:00.000Z', metric_type: 'load_rate', unit: '%', value: 88.2, threshold: 85, is_violation: 1 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:03:00.000Z', metric_type: 'load_rate', unit: '%', value: 83.1, threshold: 85, is_violation: 0 },
    { id: uuid(), simulation_id: s1Sim1Id, timestamp: '2026-06-01T08:01:00.000Z', metric_type: 'consumption_rate', unit: '%', value: 91.5, threshold: 95, is_violation: 0 },
  ])
  // 场景1 评估
  await knex('scenario_evaluations').insert({
    id: uuid(), simulation_id: s1Sim1Id, strategy_id: s1St1Id,
    execution_log: JSON.stringify({ startTime: '2026-06-01T08:00:00Z', endTime: '2026-06-01T08:05:30Z', totalSteps: 5, completedSteps: 5, metricsGenerated: 10, violationsDetected: 3 }),
    evaluation_report: JSON.stringify({ summary: '综合策略有效控制高峰负荷，电压和负载率在85%时间内正常。频率偶发越限建议优化储能调频参数。', passRate: 70, violationCount: 3, effectivenessScore: 78, securityAssessment: '基本安全', economicAssessment: '经济性良好' }),
    effectiveness_score: 78, issues: JSON.stringify([{ type: 'frequency', value: 50.38, threshold: 50.3, description: '12:30-13:00时段频率越上限50.3Hz' }, { type: 'voltage', value: '232.8kV', threshold: '231kV', description: '午后光伏高出力导致220kV母线电压越限' }, { type: 'load_rate', value: '88.2%', threshold: '85%', description: '14:00-15:00工业负荷高峰使线路负载率达88.2%' }]),
    suggestions: '优化储能调频死区参数; 午后光伏限出力5%降低电压; 工业负荷再分配避开14:00-15:00高峰',
    created_at: '2026-06-01T08:06:00.000Z',
  })
  // 场景1 干预记录
  await knex('scenario_interventions').insert([
    { id: uuid(), scenario_id: s1Id, simulation_id: s1Sim1Id, operation_type: 'adjust_strategy', operation_params: JSON.stringify({ rule: '削峰控制', adjustment: '储能放电功率 50000→60000kW' }), operator: '张工', reason: '午间峰值负载超出预期5%，临时增加储能出力', operated_at: '2026-06-01T08:02:30.000Z' },
    { id: uuid(), scenario_id: s1Id, operation_type: 'archive', operation_params: null, operator: '张工', reason: '场景已通过评审，归档为夏季标准方案', operated_at: '2026-06-10T17:00:00.000Z' },
  ])

  // ========================
  // 场景 2：台风极端天气场景
  // ========================
  const s2Id = uuid()
  const s2Config = {
    accessPoints: [
      { nodeType: 'GRID', nodeId: 'bus-jiande-110', nodeName: '寿昌变', connectedCapacity: 126, voltageLevel: 110, connectionType: 'AC', params: { tapRegulation: true, reactiveCompensation: false } },
      { nodeType: 'SOURCE', nodeId: 'pv-huayang', nodeName: '华洋山地光伏155MW', connectedCapacity: 155, voltageLevel: 110, connectionType: 'AC', params: { outputUpperLimit: 80, outputLowerLimit: 0, powerFactor: 0.95, regulationDelay: 10 } },
      { nodeType: 'LOAD', nodeId: 'load-linan', nodeName: '临安区农业灌溉负荷', connectedCapacity: 5, voltageLevel: 110, connectionType: 'AC', params: { peakClippingRate: 30, valleyFillingRate: 20, interruptibleLoadRatio: 50 } },
      { nodeType: 'STORAGE', nodeId: 'storage-linan', nodeName: '临安抽水蓄能站', connectedCapacity: 100, voltageLevel: 110, connectionType: 'AC', params: { chargeSchedule: '22:00-06:00', dischargeSchedule: '按需调度', socUpper: 100, socLower: 0, ratedPowerKw: 100000, ratedCapacityKwh: 800000 } },
    ],
    controlRules: [
      { name: '极端天气应急', condition: '风速 > 30m/s 或 辐照度骤降 > 60%', action: '光伏切出 + 抽蓄满发 + 农业负荷最低保障', priority: 1 },
      { name: '孤岛保护', condition: '并网点电压/频率越限', action: '建德变解列孤岛运行', priority: 2 },
    ],
    dataSource: { type: 'realtime', frequency: '1min', startDate: '2026-08-20', endDate: '2026-08-22' },
  }
  await knex('interactive_scenarios').insert({
    id: s2Id, name: '台风极端天气场景', type: 'residential', scenario_condition: 'extreme_weather', version_limit: 10,
    description: '模拟台风登陆期间，山地光伏出力骤降、抽水蓄能紧急调度的极端场景。验证电网在恶劣天气下的应急响应能力和供电可靠性。',
    config: JSON.stringify(s2Config), control_logic: JSON.stringify({ mode: 'emergency', safetyCheck: true, fallbackStrategy: 'island_operation' }),
    tags: JSON.stringify(['台风', '极端天气', '应急响应', '孤岛运行']),
    status: 'active', created_by: '王工',
    created_at: '2026-03-22T11:00:00.000Z', updated_at: '2026-04-28T09:00:00.000Z',
  })
  await knex('scenario_versions').insert([
    { id: uuid(), scenario_id: s2Id, version_number: 1, config_snapshot: JSON.stringify(s2Config), control_logic_snapshot: JSON.stringify({ mode: 'emergency', safetyCheck: false }), changelog: '初始创建，基于历史台风路径和山地光伏脆弱性分析', created_by: '王工', created_at: '2026-03-22T11:00:00.000Z' },
    { id: uuid(), scenario_id: s2Id, version_number: 2, config_snapshot: JSON.stringify(s2Config), control_logic_snapshot: JSON.stringify({ mode: 'emergency', safetyCheck: true, fallbackStrategy: 'island_operation' }), changelog: '新增孤岛运行后备策略，光伏切出阈值从50%调整为60%辐照度骤降', created_by: '张工', created_at: '2026-04-28T09:00:00.000Z' },
  ])

  // 场景2 策略
  const s2St1Id = uuid()
  await knex('scenario_strategies').insert({ id: s2St1Id, scenario_id: s2Id, name: '台风应急安全策略', strategy_type: 'safety', config: JSON.stringify({ sourceRegulation: { pvOutputUpperLimit: 0.80, pvOutputLowerLimit: 0, immediateCutoff: true }, gridRegulation: { tapRegulationEnabled: false, reactivePowerCompensation: false }, loadRegulation: { peakClippingRate: 0.30, valleyFillingRate: 0.20, interruptibleLoadRatio: 0.50 }, storageRegulation: { chargeSchedule: '', dischargeSchedule: 'emergency_only', socUpperLimit: 1.0, socLowerLimit: 0 } }), constraints: JSON.stringify({ voltageUpperLimit: 121, voltageLowerLimit: 99, frequencyUpperLimit: 51.0, frequencyLowerLimit: 49.0, lineLoadRateLimit: 1.0 }), economic_targets: JSON.stringify({ targetConsumptionRate: 0.80, maxOperationCostPerKwh: 1.20, minComprehensiveEfficiency: 0.70 }), generated_by_algorithm: '0', status: 'active', created_at: '2026-05-01T14:00:00.000Z', updated_at: '2026-05-01T14:00:00.000Z' })

  // 场景2 模拟
  const s2Sim1Id = uuid()
  await knex('scenario_simulations').insert({ id: s2Sim1Id, scenario_id: s2Id, strategy_id: s2St1Id, status: 'completed', boundary_conditions: JSON.stringify({ startDemand: 110, pvOutputStart: 0, gridVoltage: 0.96, windSpeed: 35 }), time_range: JSON.stringify({ start: '2026-08-21T06:00:00', end: '2026-08-21T18:00:00', step: '5min' }), step_interval_minutes: 5, speed_multiplier: 1, current_step: 144, progress: 100, started_at: '2026-06-05T10:00:00.000Z', completed_at: '2026-06-05T10:04:00.000Z', created_by: '王工' })
  await knex('simulation_metrics').insert([
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:01:00.000Z', metric_type: 'voltage', unit: 'kV', value: 104.0, threshold: 99, is_violation: 0 },
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:02:00.000Z', metric_type: 'voltage', unit: 'kV', value: 100.3, threshold: 99, is_violation: 0 },
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:03:00.000Z', metric_type: 'voltage', unit: 'kV', value: 105.7, threshold: 99, is_violation: 0 },
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:01:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 49.55, threshold: 49.0, is_violation: 0 },
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:02:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 49.35, threshold: 49.0, is_violation: 0 },
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:01:00.000Z', metric_type: 'load_rate', unit: '%', value: 65.3, threshold: 100, is_violation: 0 },
    { id: uuid(), simulation_id: s2Sim1Id, timestamp: '2026-06-05T10:01:00.000Z', metric_type: 'consumption_rate', unit: '%', value: 82.1, threshold: 80, is_violation: 0 },
  ])
  await knex('scenario_evaluations').insert({
    id: uuid(), simulation_id: s2Sim1Id, strategy_id: s2St1Id,
    execution_log: JSON.stringify({ startTime: '2026-06-05T10:00:00Z', endTime: '2026-06-05T10:04:00Z', totalSteps: 5, completedSteps: 5, metricsGenerated: 7, violationsDetected: 0 }),
    evaluation_report: JSON.stringify({ summary: '极端天气安全策略有效保障供电。抽蓄满发补偿光伏全切出力，电压和频率均维持在安全范围内。', passRate: 100, violationCount: 0, effectivenessScore: 92, securityAssessment: '安全', economicAssessment: '应急经济性可接受' }),
    effectiveness_score: 92, issues: '[]',
    suggestions: '可适当提高抽蓄放电速率以加速电压恢复; 建议在台风预警发布后提前2小时启动抽蓄预充电',
    created_at: '2026-06-05T10:05:00.000Z',
  })
  await knex('scenario_interventions').insert({ id: uuid(), scenario_id: s2Id, simulation_id: s2Sim1Id, operation_type: 'manual_start', operation_params: JSON.stringify({ action: '紧急启动抽水蓄能100%出力' }), operator: '王工', reason: '台风8时登陆，辐照度降至0，光伏全切后启动应急供电', operated_at: '2026-06-05T10:00:10.000Z' })

  // ========================
  // 场景 3：线路检修N-1场景
  // ========================
  const s3Id = uuid()
  const s3Config = {
    accessPoints: [
      { nodeType: 'GRID', nodeId: 'bus-xiaoshan-110', nodeName: '光明变', connectedCapacity: 100, voltageLevel: 110, connectionType: 'AC', params: { tapRegulation: true, reactiveCompensation: true } },
      { nodeType: 'SOURCE', nodeId: 'pv-xiaoshanny', nodeName: '萧山南阳集中式光伏50MW', connectedCapacity: 50, voltageLevel: 110, connectionType: 'AC', params: { outputUpperLimit: 95, outputLowerLimit: 10, powerFactor: 0.93, regulationDelay: 30 } },
      { nodeType: 'LOAD', nodeId: 'load-xiaoshan', nodeName: '萧山区居民负荷聚合', connectedCapacity: 30, voltageLevel: 110, connectionType: 'AC', params: { peakClippingRate: 10, valleyFillingRate: 8, interruptibleLoadRatio: 3 } },
    ],
    controlRules: [
      { name: 'N-1转供', condition: '萧山变主变检修退出', action: '负荷转由航坞变供电 + 光伏限出力50%', priority: 1 },
      { name: '过载保护', condition: '萧山东变负载率 > 90%', action: '降低光伏出力 + 启动居民可中断负荷', priority: 2 },
    ],
    dataSource: { type: 'history', frequency: '30min', startDate: '2026-09-01', endDate: '2026-09-07' },
  }
  await knex('interactive_scenarios').insert({
    id: s3Id, name: '线路检修N-1场景', type: 'industrial_park', scenario_condition: 'maintenance', version_limit: 10,
    description: '模拟光明变主变检修期间，负荷转供至萧山东变。验证N-1条件下转供方案是否导致设备过载和电压越限。',
    config: JSON.stringify(s3Config), control_logic: JSON.stringify({ mode: 'n1_transfer', safetyCheck: true, fallbackStrategy: 'generation_curtailment' }),
    tags: JSON.stringify(['检修', 'N-1', '负荷转供', '萧山']),
    status: 'active', created_by: '李工',
    created_at: '2026-05-05T13:00:00.000Z', updated_at: '2026-05-05T13:00:00.000Z',
  })
  await knex('scenario_versions').insert({ id: uuid(), scenario_id: s3Id, version_number: 1, config_snapshot: JSON.stringify(s3Config), control_logic_snapshot: JSON.stringify({ mode: 'n1_transfer', safetyCheck: true, fallbackStrategy: 'generation_curtailment' }), changelog: '初始创建，基于9月萧山变计划检修安排', created_by: '李工', created_at: '2026-05-05T13:00:00.000Z' })

  const s3St1Id = uuid()
  await knex('scenario_strategies').insert({ id: s3St1Id, scenario_id: s3Id, name: 'N-1负荷转供方案', strategy_type: 'comprehensive', config: JSON.stringify({ sourceRegulation: { pvOutputUpperLimit: 0.50, pvOutputLowerLimit: 0.10 }, gridRegulation: { tapRegulationEnabled: true, reactivePowerCompensation: true }, loadRegulation: { peakClippingRate: 0.10, valleyFillingRate: 0.08, interruptibleLoadRatio: 0.03 }, storageRegulation: null }), constraints: JSON.stringify({ voltageUpperLimit: 116, voltageLowerLimit: 105, frequencyUpperLimit: 50.3, frequencyLowerLimit: 49.7, lineLoadRateLimit: 0.90 }), economic_targets: JSON.stringify({ targetConsumptionRate: 0.95, maxOperationCostPerKwh: 0.40, minComprehensiveEfficiency: 0.90 }), generated_by_algorithm: '0', status: 'active', created_at: '2026-05-10T09:00:00.000Z', updated_at: '2026-05-10T09:00:00.000Z' })

  const s3Sim1Id = uuid()
  await knex('scenario_simulations').insert({ id: s3Sim1Id, scenario_id: s3Id, strategy_id: s3St1Id, status: 'completed', boundary_conditions: JSON.stringify({ startDemand: 85, pvOutputStart: 45, gridVoltage: 1.01 }), time_range: JSON.stringify({ start: '2026-09-02T00:00:00', end: '2026-09-02T23:59:59', step: '30min' }), step_interval_minutes: 30, speed_multiplier: 1, current_step: 48, progress: 100, started_at: '2026-06-10T15:00:00.000Z', completed_at: '2026-06-10T15:06:00.000Z', created_by: '李工' })
  await knex('simulation_metrics').insert([
    { id: uuid(), simulation_id: s3Sim1Id, timestamp: '2026-06-10T15:02:00.000Z', metric_type: 'voltage', unit: 'kV', value: 111.7, threshold: 116, is_violation: 0 },
    { id: uuid(), simulation_id: s3Sim1Id, timestamp: '2026-06-10T15:02:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 50.02, threshold: 50.3, is_violation: 0 },
    { id: uuid(), simulation_id: s3Sim1Id, timestamp: '2026-06-10T15:02:00.000Z', metric_type: 'load_rate', unit: '%', value: 87.6, threshold: 90, is_violation: 0 },
    { id: uuid(), simulation_id: s3Sim1Id, timestamp: '2026-06-10T15:02:00.000Z', metric_type: 'consumption_rate', unit: '%', value: 94.2, threshold: 95, is_violation: 0 },
  ])
  await knex('scenario_evaluations').insert({
    id: uuid(), simulation_id: s3Sim1Id, strategy_id: s3St1Id,
    execution_log: JSON.stringify({ startTime: '2026-06-10T15:00:00Z', endTime: '2026-06-10T15:06:00Z', totalSteps: 5, completedSteps: 5, metricsGenerated: 4, violationsDetected: 0 }),
    evaluation_report: JSON.stringify({ summary: 'N-1转供方案可行。萧山东变负载率峰值87.6%在安全范围内，电压频率正常。光伏限出力50%后消纳率仍有94.2%。', passRate: 100, violationCount: 0, effectivenessScore: 88, securityAssessment: '安全', economicAssessment: '经济性良好' }),
    effectiveness_score: 88, issues: '[]',
    suggestions: '检修期间可考虑临时启用无功补偿装置提升电压裕度',
    created_at: '2026-06-10T15:07:00.000Z',
  })

  // ========================
  // 场景 4：光伏高发消纳场景（草稿态）
  // ========================
  const s4Id = uuid()
  const s4Config = {
    accessPoints: [
      { nodeType: 'GRID', nodeId: 'bus-qiantang-220', nodeName: '义蓬变', connectedCapacity: 720, voltageLevel: 220, connectionType: 'AC', params: { tapRegulation: true, reactiveCompensation: true } },
      { nodeType: 'SOURCE', nodeId: 'pv-shuneng', nodeName: '舒能渔光互补400MW', connectedCapacity: 400, voltageLevel: 220, connectionType: 'AC', params: { outputUpperLimit: 100, outputLowerLimit: 5, powerFactor: 0.95, regulationDelay: 30 } },
      { nodeType: 'SOURCE', nodeId: 'pv-jiada', nodeName: '嘉达渔光互补350MW', connectedCapacity: 350, voltageLevel: 220, connectionType: 'AC', params: { outputUpperLimit: 100, outputLowerLimit: 5, powerFactor: 0.95, regulationDelay: 30 } },
      { nodeType: 'SOURCE', nodeId: 'pv-lingneng', nodeName: '凌能渔光互补250MW', connectedCapacity: 250, voltageLevel: 220, connectionType: 'AC', params: { outputUpperLimit: 100, outputLowerLimit: 5, powerFactor: 0.93, regulationDelay: 30 } },
      { nodeType: 'STORAGE', nodeId: 'storage-qiantang', nodeName: '钱塘储能站一期', connectedCapacity: 50, voltageLevel: 220, connectionType: 'DC', params: { chargeSchedule: '10:00-15:00', dischargeSchedule: '18:00-22:00', socUpper: 95, socLower: 10, ratedPowerKw: 50000, ratedCapacityKwh: 200000 } },
    ],
    controlRules: [
      { name: '光伏消纳优化', condition: '光伏总出力 > 800MW 且 负荷 < 600MW', action: '储能充电吸收盈余 + 上调无功补偿', priority: 1 },
      { name: '反向潮流保护', condition: '220kV母线反向功率 > 100MW', action: '限制光伏出力至消纳上限', priority: 2 },
    ],
    dataSource: { type: 'history', frequency: '15min', startDate: '2026-04-01', endDate: '2026-04-30' },
  }
  await knex('interactive_scenarios').insert({
    id: s4Id, name: '光伏高发消纳场景', type: 'commercial', scenario_condition: 'solar_high', version_limit: 10,
    description: '模拟4月春季光伏高发时段，钱塘变三座大型渔光互补电站满发，验证储能消纳能力和反向潮流风险。',
    config: JSON.stringify(s4Config), control_logic: JSON.stringify({ mode: 'consumption_priority', safetyCheck: true, fallbackStrategy: 'pv_curtailment' }),
    tags: JSON.stringify(['光伏', '消纳', '储能', '反向潮流']),
    status: 'draft', created_by: '张工',
    created_at: '2026-06-15T11:00:00.000Z', updated_at: '2026-06-15T11:00:00.000Z',
  })
  await knex('scenario_versions').insert({ id: uuid(), scenario_id: s4Id, version_number: 1, config_snapshot: JSON.stringify(s4Config), control_logic_snapshot: JSON.stringify({ mode: 'consumption_priority', safetyCheck: false }), changelog: '初始草稿，待补充储能策略后提交评审', created_by: '张工', created_at: '2026-06-15T11:00:00.000Z' })

  // 场景4 策略 (仅一条，草稿态)
  const s4St1Id = uuid()
  await knex('scenario_strategies').insert({ id: s4St1Id, scenario_id: s4Id, name: '光伏消纳优先策略(草案)', strategy_type: 'economic', config: JSON.stringify({ sourceRegulation: { pvOutputUpperLimit: 1.0, pvOutputLowerLimit: 0.05 }, gridRegulation: { tapRegulationEnabled: true, reactivePowerCompensation: true }, loadRegulation: { peakClippingRate: 0.05, valleyFillingRate: 0.05, interruptibleLoadRatio: 0.02 }, storageRegulation: { chargeSchedule: '10:00-15:00', dischargeSchedule: '18:00-22:00', socUpperLimit: 0.95, socLowerLimit: 0.10 } }), constraints: JSON.stringify({ voltageUpperLimit: 231, voltageLowerLimit: 209, frequencyUpperLimit: 50.3, frequencyLowerLimit: 49.7, lineLoadRateLimit: 0.85 }), economic_targets: JSON.stringify({ targetConsumptionRate: 0.98, maxOperationCostPerKwh: 0.35, minComprehensiveEfficiency: 0.90 }), generated_by_algorithm: '1', status: 'draft', created_at: '2026-06-15T11:30:00.000Z', updated_at: '2026-06-15T11:30:00.000Z' })

  // 场景4 模拟 (仅一次，running→completed)
  const s4Sim1Id = uuid()
  await knex('scenario_simulations').insert({ id: s4Sim1Id, scenario_id: s4Id, strategy_id: s4St1Id, status: 'completed', boundary_conditions: JSON.stringify({ startDemand: 480, pvOutputStart: 920, gridVoltage: 1.04 }), time_range: JSON.stringify({ start: '2026-04-15T10:00:00', end: '2026-04-15T16:00:00', step: '15min' }), step_interval_minutes: 15, speed_multiplier: 1, current_step: 24, progress: 100, started_at: '2026-06-18T09:00:00.000Z', completed_at: '2026-06-18T09:07:00.000Z', created_by: '张工' })
  await knex('simulation_metrics').insert([
    { id: uuid(), simulation_id: s4Sim1Id, timestamp: '2026-06-18T09:03:00.000Z', metric_type: 'voltage', unit: 'kV', value: 233.6, threshold: 231, is_violation: 1 },
    { id: uuid(), simulation_id: s4Sim1Id, timestamp: '2026-06-18T09:04:00.000Z', metric_type: 'voltage', unit: 'kV', value: 230.6, threshold: 231, is_violation: 0 },
    { id: uuid(), simulation_id: s4Sim1Id, timestamp: '2026-06-18T09:03:00.000Z', metric_type: 'frequency', unit: 'Hz', value: 50.18, threshold: 50.3, is_violation: 0 },
    { id: uuid(), simulation_id: s4Sim1Id, timestamp: '2026-06-18T09:03:00.000Z', metric_type: 'load_rate', unit: '%', value: 58.2, threshold: 85, is_violation: 0 },
    { id: uuid(), simulation_id: s4Sim1Id, timestamp: '2026-06-18T09:03:00.000Z', metric_type: 'consumption_rate', unit: '%', value: 88.7, threshold: 98, is_violation: 1 },
  ])
  await knex('scenario_evaluations').insert({
    id: uuid(), simulation_id: s4Sim1Id, strategy_id: s4St1Id,
    execution_log: JSON.stringify({ startTime: '2026-06-18T09:00:00Z', endTime: '2026-06-18T09:07:00Z', totalSteps: 5, completedSteps: 5, metricsGenerated: 5, violationsDetected: 2 }),
    evaluation_report: JSON.stringify({ summary: '光伏高发时段电压越上限、消纳率不足。当前储能容量（50MW/200MWh）无法完全消纳1000MW光伏盈余，建议扩容或增加负荷侧调节。', passRate: 60, violationCount: 2, effectivenessScore: 55, securityAssessment: '基本安全', economicAssessment: '经济性差，消纳不足导致弃光' }),
    effectiveness_score: 55, issues: JSON.stringify([{ type: 'voltage', value: '233.6kV', threshold: '231kV', description: '光伏满发时220kV母线电压越上限' }, { type: 'consumption_rate', value: '88.7%', threshold: '98%', description: '消纳率严重偏低，预计弃光约110MW' }]),
    suggestions: '建议钱塘储能站二期扩容至100MW/400MWh; 引入需求侧响应增加午间负荷; 春季午间光伏限出力至85%',
    created_at: '2026-06-18T09:08:00.000Z',
  })

  console.log('  ✓ 场景1：夏季高峰负荷场景 (active, 3版本, 2策略, 1模拟, 1评估, 2干预)')
  console.log('  ✓ 场景2：台风极端天气场景 (active, 2版本, 1策略, 1模拟, 1评估, 1干预)')
  console.log('  ✓ 场景3：线路检修N-1场景 (active, 1版本, 1策略, 1模拟, 1评估)')
  console.log('  ✓ 场景4：光伏高发消纳场景 (draft, 1版本, 1策略, 1模拟, 1评估)')
}
