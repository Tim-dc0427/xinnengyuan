/**
 * 4.3.2 反向潮流计算器
 *
 * 构建含光伏接入的电网模型，输入光伏出力曲线、负荷分布及设备参数，
 * 输出节点电压幅值/相角、线路反向电流及负载率、网损变化趋势。
 * 支持多光伏接入点联合倒送场景。
 *
 * 算法原理：
 * 分布式光伏接入负荷母线后，净负荷 = 原始负荷 - 光伏出力。
 * 当光伏出力 > 本地负荷时，净负荷为负（即向电网倒送功率），
 * 连接该母线的支路会出现 pFromMw < 0（功率反向）。
 * NR 法中 PQ 节点的 P_sch = Pg - Pd，负数 Pd 等同于正注入。
 */
import { calculatePowerFlow } from './power-flow-calculator.js'
import type { PowerFlowInput, PowerFlowResult, PowerFlowScenario, NodeResult, BranchFlowResult } from './power-flow-calculator.js'

export interface ReversePFTimePoint {
  time: string
  reversePowerMw: number
  lossMw: number
  avgVoltagePu: number
  minVoltagePu: number
  converged: boolean
  nodeResults: NodeResult[]
  branchResults: BranchFlowResult[]
}

export interface ReversePFOutput {
  timePoints: ReversePFTimePoint[]
  maxReversePowerMw: number
  maxReverseTime: string
  reverseBranchCount: number
  totalReverseEnergyMwh: number
  convergedTimePoints: number
  divergedTimePoints: number
  aggregatedNodeResults: NodeResult[]
  aggregatedBranchResults: BranchFlowResult[]
}

/**
 * 执行反向潮流计算
 * @param input 基准潮流输入
 * @param pvBusIds 光伏接入母线 ID 列表
 * @param pvOutputsMw 各时间点光伏总出力 (MW)
 * @param localLoadMw 各接入点的本地负荷 (MW)，key 为 busId
 * @param jointInjection 是否联合倒送（多接入点均分出力）
 */
export function calculateReversePowerFlow(
  input: PowerFlowInput,
  pvBusIds: string[],
  pvOutputsMw: number[],
  localLoadMw: Record<string, number> = {},
  jointInjection: boolean = false,
): ReversePFOutput {
  const timePoints: ReversePFTimePoint[] = []
  let maxReversePowerMw = 0
  let maxReverseTime = ''
  let totalReverseEnergyMwh = 0

  // 无光伏接入时只做一次潮流计算，不需要时间维度
  const iterations = pvBusIds.length > 0 ? pvOutputsMw.length : 1

  for (let t = 0; t < iterations; t++) {
    const modifiedInput: PowerFlowInput = JSON.parse(JSON.stringify(input))
    const pvTotalOutput = pvOutputsMw[t] || 0

    if (pvBusIds.length > 0 && pvTotalOutput > 0) {
      // 均分光伏出力到各接入点
      const outputPerBus = jointInjection
        ? pvTotalOutput / pvBusIds.length
        : pvTotalOutput

      // 关闭接入点母线原有的发电机（光伏替代大电源）
      modifiedInput.generators = modifiedInput.generators.map(g => {
        if (pvBusIds.includes(g.busId)) {
          return { ...g, pgMw: 0, qgMvar: 0, qmaxMvar: 0 }
        }
        return g
      })

      // 核心：光伏出力直接抵消负荷，净负荷可能为负（倒送）
      for (const load of modifiedInput.loads) {
        if (pvBusIds.includes(load.busId)) {
          const busLocalLoad = localLoadMw[load.busId] ?? load.pdMw
          const pvOutput = jointInjection ? outputPerBus : pvTotalOutput
          const originalPd = busLocalLoad
          // 净负荷 = 原始负荷 - 光伏出力
          const netLoad = originalPd - pvOutput
          // 允许负数：负数表示向电网倒送功率
          load.pdMw = netLoad
          // 倒送时无功置零；否则按比例缩减
          if (netLoad < 0) {
            load.qdMvar = 0
          } else if (originalPd > 0) {
            load.qdMvar = load.qdMvar * (netLoad / originalPd)
          }
        }
      }
    }

    // 执行潮流计算
    const scenario: PowerFlowScenario = { type: 'normal' }
    const result = calculatePowerFlow(modifiedInput, scenario)

    // 检测反向潮流：pFromMw < 0 即为反向。
    // 不仅光伏倒送会导致反向，环网、双电源、转供电等传统场景也会产生反向潮流。
    let reversePowerMw = 0
    let reverseCount = 0
    for (const branch of result.branchResults) {
      if (branch.pFromMw < 0) {
        reversePowerMw += Math.abs(branch.pFromMw)
        reverseCount++
      }
    }

    // 聚合统计
    const voltages = result.nodeResults.map(n => n.voltagePu)
    const avgV = voltages.length ? voltages.reduce((s, v) => s + v, 0) / voltages.length : 1
    const minV = voltages.length ? Math.min(...voltages) : 1
    const timeLabel = pvBusIds.length > 0 ? `T+${t}h` : '稳态'

    if (reversePowerMw > maxReversePowerMw) {
      maxReversePowerMw = reversePowerMw
      maxReverseTime = timeLabel
    }
    totalReverseEnergyMwh += reversePowerMw * 0.25 // 15min

    timePoints.push({
      time: timeLabel,
      reversePowerMw: Number(reversePowerMw.toFixed(2)),
      lossMw: Number((result.totalLossMw || 0).toFixed(2)),
      avgVoltagePu: Number(avgV.toFixed(4)),
      minVoltagePu: Number(minV.toFixed(4)),
      converged: result.converged,
      nodeResults: result.nodeResults,
      branchResults: result.branchResults,
    })
  }

  const convergedCount = timePoints.filter(tp => tp.converged).length
  const last = timePoints[timePoints.length - 1]

  return {
    timePoints,
    maxReversePowerMw: Number(maxReversePowerMw.toFixed(2)),
    maxReverseTime,
    reverseBranchCount: last?.branchResults.filter((b: BranchFlowResult) => b.pFromMw < 0).length || 0,
    totalReverseEnergyMwh: Number(totalReverseEnergyMwh.toFixed(2)),
    convergedTimePoints: convergedCount,
    divergedTimePoints: timePoints.length - convergedCount,
    aggregatedNodeResults: last?.nodeResults || [],
    aggregatedBranchResults: last?.branchResults || [],
  }
}
