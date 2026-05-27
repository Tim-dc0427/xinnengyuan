/**
 * 4.3.3 概率潮流计算器 — 蒙特卡洛模拟
 *
 * 考虑负荷波动、光伏出力等不确定性因素，建立输入参数的概率分布模型，
 * 采用蒙特卡洛模拟生成大量随机场景，输出节点电压、线路功率等指标的概率分布结果，
 * 识别电压越限风险节点及线路过载概率。
 */
import { calculatePowerFlow } from './power-flow-calculator.js'
import type { PowerFlowInput, PowerFlowScenario, NodeResult, BranchFlowResult } from './power-flow-calculator.js'

export interface ProbabilisticPFConfig {
  loadVariationPct: number
  pvConcentration: number
}

export interface ProbabilisticPFOutput {
  nodeResults: Array<{
    busId: string
    name: string
    baseKv: number
    expectedKv: number
    stdDevKv: number
    p5Kv: number
    p95Kv: number
    violationProbabilityLower: number
    violationProbabilityUpper: number
    histogram: Array<{ voltageKv: number; count: number }>
  }>
  branchResults: Array<{
    branchId: string
    name: string
    ampacityMva: number
    expectedLoadingPct: number
    expectedPowerMw: number
    overloadProbability: number
    histogram: Array<{ powerMw: number; count: number }>
  }>
  voltageViolationNodes: Array<{ busId: string; name: string; probabilityLower: number; probabilityUpper: number }>
  overloadBranches: Array<{ branchId: string; name: string; probability: number }>
  expectedLossMw: number
  p95LossMw: number
  lossSamples: number[]
}

/**
 * 正态分布采样（Box-Muller 变换）
 */
function sampleNormal(mu: number, sigma: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mu + sigma * z
}

/**
 * Gamma 分布采样（Marsaglia-Tsang 方法，shape ≥ 1；附递归处理 shape < 1）
 */
function sampleGamma(shape: number): number {
  if (shape >= 1) {
    const d = shape - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    while (true) {
      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const v = (1 + c * z) ** 3
      if (v <= 0) continue
      const u = Math.random()
      const x = d * v
      if (u < 1 - 0.0331 * z ** 4) return x
      if (Math.log(u) < 0.5 * z ** 2 + d * (1 - v + Math.log(v))) return x
    }
  }
  // shape < 1: Gamma(shape+1) * U^(1/shape)
  return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape)
}

/**
 * Beta 分布采样 B(α, β)，值域 [0, 1]
 * 天然适合描述光伏出力比等有界随机变量
 */
function sampleBeta(alpha: number, beta: number): number {
  const g1 = sampleGamma(alpha)
  const g2 = sampleGamma(beta)
  return g1 / (g1 + g2)
}

export async function calculateProbabilisticPowerFlow(
  input: PowerFlowInput,
  sampleCount: number,
  config: ProbabilisticPFConfig,
  onProgress?: (current: number, total: number, msg?: string) => Promise<void>,
): Promise<ProbabilisticPFOutput> {
  const checkpointInterval = Math.max(50, Math.floor(sampleCount / 10))

  // 累加器
  const nodeAccum: Record<string, {
    name: string; baseKv: number; vSum: number; vSumSq: number; minV: number; maxV: number
    violationCountLower: number; violationCountUpper: number; allSamples: number[]
  }> = {}

  const branchAccum: Record<string, {
    name: string; ampacityMva: number; loadingSum: number; overloadCount: number; allSamples: number[]
  }> = {}

  const lossSamples: number[] = []

  for (let i = 0; i < sampleCount; i++) {
    // 深拷贝输入
    const modifiedInput: PowerFlowInput = JSON.parse(JSON.stringify(input))

    // 对每个负荷施加随机波动（正态分布 N(预测值, 预测值×变异系数)）
    for (const load of modifiedInput.loads) {
      const sigma = config.loadVariationPct / 100
      const factor = Math.max(0.1, sampleNormal(1, sigma))
      load.pdMw = Math.max(0, load.pdMw * factor)
      load.qdMvar = Math.max(0, load.qdMvar * factor)
    }

    // 光伏出力采样（Beta 分布，出力比天然约束在 [0, 1]）
    for (const gen of modifiedInput.generators) {
      if (gen.isPV && gen.installedCapacityMw && gen.installedCapacityMw > 0) {
        const mu = Math.max(0.01, Math.min(0.99, gen.pgMw / gen.installedCapacityMw))
        const nu = config.pvConcentration
        const alpha = mu * nu
        const beta = (1 - mu) * nu
        const ratio = sampleBeta(Math.max(0.01, alpha), Math.max(0.01, beta))
        gen.pgMw = ratio * gen.installedCapacityMw
      } else if (!gen.isPV) {
        // 等值电源：小幅正态波动（变异系数 2%），模拟上级电网注入偏差
        const factor = Math.max(0.8, sampleNormal(1, 0.02))
        gen.pgMw = Math.max(0, gen.pgMw * factor)
      }
    }

    // 执行潮流计算
    const scenario: PowerFlowScenario = { type: 'normal' }
    const result = calculatePowerFlow(modifiedInput, scenario)

    // 累加节点结果
    for (const node of result.nodeResults) {
      if (!nodeAccum[node.busId]) {
        nodeAccum[node.busId] = {
          name: node.name,
          baseKv: node.baseKv,
          vSum: 0, vSumSq: 0, minV: Infinity, maxV: -Infinity,
          violationCountLower: 0, violationCountUpper: 0, allSamples: [],
        }
      }
      const acc = nodeAccum[node.busId]
      acc.vSum += node.voltagePu
      acc.vSumSq += node.voltagePu * node.voltagePu
      acc.minV = Math.min(acc.minV, node.voltagePu)
      acc.maxV = Math.max(acc.maxV, node.voltagePu)
      if (node.voltagePu < 0.95) acc.violationCountLower++
      if (node.voltagePu > 1.05) acc.violationCountUpper++
      acc.allSamples.push(node.voltagePu)
    }

    // 累加支路结果
    for (const branch of result.branchResults) {
      if (!branchAccum[branch.branchId]) {
        branchAccum[branch.branchId] = {
          name: `${branch.fromBusName}→${branch.toBusName}`,
          ampacityMva: branch.ampacityMva || 0,
          loadingSum: 0, overloadCount: 0, allSamples: [],
        }
      }
      const acc = branchAccum[branch.branchId]
      acc.loadingSum += branch.loadingPct
      if (branch.loadingPct > 100) acc.overloadCount++
      acc.allSamples.push(branch.pFromMw)
    }

    // 网损
    lossSamples.push(result.totalLossMw)

    // 进度回调
    if (onProgress && (i % checkpointInterval === 0 || i === sampleCount - 1)) {
      await onProgress(i + 1, sampleCount,
        `蒙特卡洛采样 ${i + 1}/${sampleCount}...`,
      )
    }

    // 让事件循环有机会处理其他请求
    if (i % 50 === 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }

  // 后处理：计算统计量
  const nodeResults = Object.entries(nodeAccum).map(([busId, acc]) => {
    const n = acc.allSamples.length
    const expectedV = acc.vSum / n
    const variance = acc.vSumSq / n - expectedV * expectedV
    const stdDevV = Math.sqrt(Math.max(0, variance))
    const sorted = [...acc.allSamples].sort((a, b) => a - b)
    const p5V = sorted[Math.floor(n * 0.05)]
    const p95V = sorted[Math.floor(n * 0.95)]

    // 直方图：20 个桶，使用实际 kV
    const binCount = 20
    const vMin = acc.minV * acc.baseKv
    const vMax = acc.maxV * acc.baseKv
    const binWidth = (vMax - vMin) / binCount || 0.001
    const histogram = Array.from({ length: binCount }, (_, i) => {
      const lower = vMin + i * binWidth
      const upper = lower + binWidth
      const count = acc.allSamples.filter(v => {
        const kv = v * acc.baseKv
        return kv >= lower && kv < upper
      }).length
      return { voltageKv: Number((lower + binWidth / 2).toFixed(2)), count }
    })

    return {
      busId,
      name: acc.name,
      baseKv: acc.baseKv,
      expectedKv: Number((expectedV * acc.baseKv).toFixed(2)),
      stdDevKv: Number((stdDevV * acc.baseKv).toFixed(2)),
      p5Kv: Number((p5V * acc.baseKv).toFixed(2)),
      p95Kv: Number((p95V * acc.baseKv).toFixed(2)),
      violationProbabilityLower: Number((acc.violationCountLower / n * 100).toFixed(1)),
      violationProbabilityUpper: Number((acc.violationCountUpper / n * 100).toFixed(1)),
      histogram,
    }
  })

  const branchResults = Object.entries(branchAccum).map(([branchId, acc]) => {
    const n = acc.allSamples.length
    const sorted = [...acc.allSamples].sort((a, b) => a - b)

    const binCount = 20
    const lMin = Math.min(...acc.allSamples)
    const lMax = Math.max(...acc.allSamples)
    const binWidth = (lMax - lMin) / binCount || 0.5
    const histogram = Array.from({ length: binCount }, (_, i) => {
      const lower = lMin + i * binWidth
      const upper = lower + binWidth
      const count = acc.allSamples.filter(v => v >= lower && v < upper).length
      return { powerMw: Number((lower + binWidth / 2).toFixed(2)), count }
    })

    return {
      branchId,
      name: acc.name,
      ampacityMva: acc.ampacityMva,
      expectedLoadingPct: Number((acc.loadingSum / n).toFixed(1)),
      expectedPowerMw: Number((acc.allSamples.reduce((s, v) => s + v, 0) / n).toFixed(2)),
      overloadProbability: Number((acc.overloadCount / n * 100).toFixed(1)),
      histogram,
    }
  })

  // 电压越限风险节点（上限或下限越限概率 > 5%）
  const voltageViolationNodes = nodeResults
    .filter(n => n.violationProbabilityLower > 5 || n.violationProbabilityUpper > 5)
    .map(n => ({ busId: n.busId, name: n.name, probabilityLower: n.violationProbabilityLower, probabilityUpper: n.violationProbabilityUpper }))

  // 过载风险线路（概率 > 1%）
  const overloadBranches = branchResults
    .filter(b => b.overloadProbability > 1)
    .map(b => ({ branchId: b.branchId, name: b.name, probability: b.overloadProbability }))

  // 网损统计
  const expectedLossMw = lossSamples.reduce((s, v) => s + v, 0) / lossSamples.length
  const sortedLoss = [...lossSamples].sort((a, b) => a - b)
  const p95LossMw = sortedLoss[Math.floor(sortedLoss.length * 0.95)]

  return {
    nodeResults,
    branchResults,
    voltageViolationNodes,
    overloadBranches,
    expectedLossMw: Number(expectedLossMw.toFixed(2)),
    p95LossMw: Number(p95LossMw.toFixed(2)),
    lossSamples,
  }
}
