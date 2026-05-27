/**
 * 4.3.4 三相潮流计算器
 *
 * 针对三相不对称电网系统，通过三次独立 NR 计算（每相分别施加不对称负荷/发电比例 +
 * 配网线路阻抗不对称扰动），使用对称分量法（Fortescue 变换）计算电压不平衡度 VUF，
 * 识别电压越限、三相不平衡度超标、单相过载等问题。
 */
import { calculatePowerFlow } from './power-flow-calculator.js'
import type { PowerFlowInput, PowerFlowScenario, NodeResult, BranchFlowResult } from './power-flow-calculator.js'

export interface PhaseNodeResult {
  busId: string
  name: string
  zone: string
  voltageLevel: string
  baseKv: number
  phaseA: number
  phaseB: number
  phaseC: number
  angleA: number
  angleB: number
  angleC: number
  // 各相净注入功率（Pg - Pd）
  phaseAPMw: number; phaseAQMvar: number
  phaseBPMw: number; phaseBQMvar: number
  phaseCPMw: number; phaseCQMvar: number
  vuf: number
  isViolation: boolean
  pvRelated: boolean
  loadType: string
}

export interface PhaseBranchResult {
  branchId: string
  fromBus: string
  toBus: string
  fromBusName: string
  toBusName: string
  branchType: string
  voltageLevel: string
  // A相
  phaseAPFromMw: number;  phaseAQFromMvar: number
  phaseALoadingPct: number; phaseAIsOverloaded: boolean
  // B相
  phaseBPFromMw: number;  phaseBQFromMvar: number
  phaseBLoadingPct: number; phaseBIsOverloaded: boolean
  // C相
  phaseCPFromMw: number;  phaseCQFromMvar: number
  phaseCLoadingPct: number; phaseCIsOverloaded: boolean
  // 损耗
  phaseALossMw: number; phaseBLossMw: number; phaseCLossMw: number
  ampacityMva: number
  isOverloaded: boolean
}

export interface ThreePhasePFOutput {
  nodeResults: PhaseNodeResult[]
  phaseBranchResults: PhaseBranchResult[]
  totalLossMw: number
  maxVuf: number
  avgVuf: number
  violationCount: number
  violationRate: number
  phaseALossMw: number
  phaseBLossMw: number
  phaseCLossMw: number
  phaseResults: {
    phaseA: { nodeResults: NodeResult[]; branchResults: BranchFlowResult[] }
    phaseB: { nodeResults: NodeResult[]; branchResults: BranchFlowResult[] }
    phaseC: { nodeResults: NodeResult[]; branchResults: BranchFlowResult[] }
  }
}

interface PhaseRatios {
  a: { loadRatio: number; genRatio: number }
  b: { loadRatio: number; genRatio: number }
  c: { loadRatio: number; genRatio: number }
}

/**
 * 计算电压不平衡度 VUF（对称分量法）
 * VUF = |V_negative| / |V_positive| * 100%
 */
function computeVUF(va: number, vb: number, vc: number): number {
  const vaPhasor = new Complex(va, 0)
  const vbPhasor = Complex.fromPolar(vb, -2 * Math.PI / 3)
  const vcPhasor = Complex.fromPolar(vc, 2 * Math.PI / 3)

  const a120 = Complex.fromPolar(1, 2 * Math.PI / 3)
  const a240 = Complex.fromPolar(1, 4 * Math.PI / 3)

  const v1 = vaPhasor
    .add(a120.mul(vbPhasor))
    .add(a240.mul(vcPhasor))
    .div(new Complex(3, 0))

  const v2 = vaPhasor
    .add(a240.mul(vbPhasor))
    .add(a120.mul(vcPhasor))
    .div(new Complex(3, 0))

  const v1mag = v1.abs()
  if (v1mag < 1e-10) return 0
  return (v2.abs() / v1mag) * 100
}

/** 复数辅助类 */
class Complex {
  constructor(public re: number, public im: number = 0) {}
  add(b: Complex): Complex { return new Complex(this.re + b.re, this.im + b.im) }
  mul(b: Complex): Complex { return new Complex(this.re * b.re - this.im * b.im, this.re * b.im + this.im * b.re) }
  div(b: Complex): Complex {
    const d = b.re * b.re + b.im * b.im
    return new Complex((this.re * b.re + this.im * b.im) / d, (this.im * b.re - this.re * b.im) / d)
  }
  abs(): number { return Math.sqrt(this.re * this.re + this.im * this.im) }
  static fromPolar(mag: number, angle: number): Complex {
    return new Complex(mag * Math.cos(angle), mag * Math.sin(angle))
  }
}

/** 确定性伪随机（基于种子，-1 ~ +1），保证相同参数结果可复现 */
function deterministicNoise(seed: number): number {
  const x = Math.sin(seed) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** 简单字符串哈希 → 数值，用于构建随机种子 */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return h
}

/**
 * 执行三相不平衡潮流计算
 * @param input 基准潮流输入（平衡系统）
 * @param ratios 分相负荷/发电比例
 * @param pvBusIds 光伏相关母线 ID 集合
 * @param impedanceAsymmetryPct 线路阻抗不对称度（%），对 ≤35kV 配网线路的 R/X 施加 ±N% 随机偏差
 */
export function calculateThreePhasePowerFlow(
  input: PowerFlowInput,
  ratios: PhaseRatios = {
    a: { loadRatio: 1.0, genRatio: 1.0 },
    b: { loadRatio: 0.95, genRatio: 0.9 },
    c: { loadRatio: 0.9, genRatio: 0.85 },
  },
  pvBusIds: Set<string> = new Set(),
  impedanceAsymmetryPct: number = 0,
  useDBPhaseData: boolean = true,
): ThreePhasePFOutput {
  const phases = ['a', 'b', 'c'] as const
  const phaseResults: Record<string, { nodeResults: NodeResult[]; branchResults: BranchFlowResult[] }> = {}
  const lossMw: Record<string, number> = {}

  // 预计算节点电压等级（用于判断是否输电线路）
  const busVoltageMap = new Map<string, number>()
  for (const bus of input.buses) {
    busVoltageMap.set(bus.id, bus.baseKv)
  }

  // 构建原始分相数据查找表
  const origLoadMap = new Map(input.loads.map(l => [l.busId, l]))
  const origGenMap = new Map(input.generators.map(g => [g.busId, g]))
  const origBranchMap = new Map(input.branches.map(b => [b.id, b]))

  for (const phase of phases) {
    const ratio = ratios[phase]
    const modifiedInput: PowerFlowInput = JSON.parse(JSON.stringify(input))

    // 负荷不对称：优先使用 DB 分相数据，无数据时回退到全局比例
    for (const load of modifiedInput.loads) {
      const origLoad = origLoadMap.get(load.busId)
      if (useDBPhaseData && origLoad && origLoad.pdAMw != null) {
        const totalP = origLoad.pdMw
        if (phase === 'a') {
          load.pdMw = origLoad.pdAMw!
          load.qdMvar = origLoad.qdAMvar ?? (totalP > 0 ? origLoad.qdMvar * origLoad.pdAMw! / totalP : 0)
        } else if (phase === 'b') {
          load.pdMw = origLoad.pdBMw!
          load.qdMvar = origLoad.qdBMvar ?? (totalP > 0 ? origLoad.qdMvar * origLoad.pdBMw! / totalP : 0)
        } else {
          load.pdMw = origLoad.pdCMw!
          load.qdMvar = origLoad.qdCMvar ?? (totalP > 0 ? origLoad.qdMvar * origLoad.pdCMw! / totalP : 0)
        }
      } else {
        load.pdMw = load.pdMw * ratio.loadRatio
        load.qdMvar = load.qdMvar * ratio.loadRatio
      }
    }

    // 发电不对称：优先使用 DB 分相数据，无数据时回退到全局比例
    for (const gen of modifiedInput.generators) {
      const origGen = origGenMap.get(gen.busId)
      if (useDBPhaseData && origGen && origGen.pgAMw != null) {
        if (phase === 'a') gen.pgMw = origGen.pgAMw!
        else if (phase === 'b') gen.pgMw = origGen.pgBMw!
        else gen.pgMw = origGen.pgCMw!
      } else {
        gen.pgMw = gen.pgMw * ratio.genRatio
      }
    }

    // 阻抗不对称扰动（仅对配网线路 ±35kV 及以下）
    if (useDBPhaseData) {
      for (const branch of modifiedInput.branches) {
        const origBranch = origBranchMap.get(branch.id)
        if (!origBranch || origBranch.r0Ohm == null || origBranch.rOhm <= 0) continue
        const fromKv = busVoltageMap.get(branch.fromBusId) ?? 0
        const toKv = busVoltageMap.get(branch.toBusId) ?? 0
        const maxKv = Math.max(fromKv, toKv)
        if (maxKv > 35) continue

        const r0r1 = origBranch.r0Ohm / origBranch.rOhm
        const x0x1 = (origBranch.x0Ohm && origBranch.xOhm > 0) ? origBranch.x0Ohm / origBranch.xOhm : r0r1
        const asymFactor = branch.branchType === 'TRANSFORMER' ? 0.3 : 1.0
        const seedBase = hashString(phase + branch.id)
        const rPerturb = (r0r1 - 1) * deterministicNoise(seedBase) * asymFactor
        const xPerturb = (x0x1 - 1) * deterministicNoise(seedBase + 100) * asymFactor
        branch.rOhm *= (1 + rPerturb)
        branch.xOhm *= (1 + xPerturb)
      }
    } else if (impedanceAsymmetryPct > 0) {
      for (const branch of modifiedInput.branches) {
        const fromKv = busVoltageMap.get(branch.fromBusId) ?? 0
        const toKv = busVoltageMap.get(branch.toBusId) ?? 0
        const maxKv = Math.max(fromKv, toKv)
        if (maxKv > 35) continue

        const asymFactor = branch.branchType === 'TRANSFORMER' ? 0.3 : 1.0
        const seedBase = hashString(phase + branch.id)
        const rNoise = deterministicNoise(seedBase) * impedanceAsymmetryPct / 100 * asymFactor
        const xNoise = deterministicNoise(seedBase + 100) * impedanceAsymmetryPct / 100 * asymFactor

        branch.rOhm *= (1 + rNoise)
        branch.xOhm *= (1 + xNoise)
      }
    }

    const scenario: PowerFlowScenario = { type: 'normal' }
    const result = calculatePowerFlow(modifiedInput, scenario)

    phaseResults[phase] = {
      nodeResults: result.nodeResults,
      branchResults: result.branchResults,
    }
    lossMw[phase] = (result.branchResults || []).reduce((s: number, b: BranchFlowResult) => s + Math.abs(b.lossMw || 0), 0)
  }

  // 构造三相节点结果
  const nodeResults: PhaseNodeResult[] = []
  const aNodes = phaseResults.a.nodeResults

  const loadTypeMap = new Map<string, string>()
  for (const load of input.loads) {
    loadTypeMap.set(load.busId, load.pdMw > 50 ? '工业' : load.pdMw > 10 ? '商业' : '居民')
  }

  for (const nodeA of aNodes) {
    const nodeB = phaseResults.b.nodeResults.find((n: NodeResult) => n.busId === nodeA.busId)
    const nodeC = phaseResults.c.nodeResults.find((n: NodeResult) => n.busId === nodeA.busId)

    if (!nodeB || !nodeC) continue

    const vA = nodeA.voltagePu
    const vB = nodeB.voltagePu
    const vC = nodeC.voltagePu
    const vuf = computeVUF(vA, vB, vC)
    const isViolation = vuf > 2

    nodeResults.push({
      busId: nodeA.busId,
      name: nodeA.name,
      zone: nodeA.zone,
      voltageLevel: nodeA.voltageLevel,
      baseKv: nodeA.baseKv,
      phaseA: Number(vA.toFixed(4)),
      phaseB: Number(vB.toFixed(4)),
      phaseC: Number(vC.toFixed(4)),
      angleA: Number(nodeA.angleDeg.toFixed(2)),
      angleB: Number(nodeB.angleDeg.toFixed(2)),
      angleC: Number(nodeC.angleDeg.toFixed(2)),
      phaseAPMw: Number(((nodeA.pgMw || 0) - (nodeA.pdMw || 0)).toFixed(2)),
      phaseAQMvar: Number(((nodeA.qgMvar || 0) - (nodeA.qdMvar || 0)).toFixed(2)),
      phaseBPMw: Number(((nodeB.pgMw || 0) - (nodeB.pdMw || 0)).toFixed(2)),
      phaseBQMvar: Number(((nodeB.qgMvar || 0) - (nodeB.qdMvar || 0)).toFixed(2)),
      phaseCPMw: Number(((nodeC.pgMw || 0) - (nodeC.pdMw || 0)).toFixed(2)),
      phaseCQMvar: Number(((nodeC.qgMvar || 0) - (nodeC.qdMvar || 0)).toFixed(2)),
      vuf: Number(vuf.toFixed(2)),
      isViolation,
      pvRelated: pvBusIds.has(nodeA.busId),
      loadType: loadTypeMap.get(nodeA.busId) || '未知',
    })
  }

  // 合并三相支路结果
  const allBranchIds = [...new Set([
    ...phaseResults.a.branchResults.map(b => b.branchId),
    ...phaseResults.b.branchResults.map(b => b.branchId),
    ...phaseResults.c.branchResults.map(b => b.branchId),
  ])]

  const phaseBranchResults: PhaseBranchResult[] = allBranchIds.map(branchId => {
    const a = phaseResults.a.branchResults.find(b => b.branchId === branchId)
    const b = phaseResults.b.branchResults.find(b => b.branchId === branchId)
    const c = phaseResults.c.branchResults.find(b => b.branchId === branchId)
    const ref = a || b || c

    const isOverloaded = (a?.isOverloaded || b?.isOverloaded || c?.isOverloaded) ?? false

    return {
      branchId,
      fromBus: ref?.fromBus ?? '',
      toBus: ref?.toBus ?? '',
      fromBusName: ref?.fromBusName ?? '',
      toBusName: ref?.toBusName ?? '',
      branchType: ref?.branchType ?? '',
      voltageLevel: ref?.voltageLevel ?? '',
      phaseAPFromMw: a?.pFromMw ?? 0,
      phaseAQFromMvar: a?.qFromMvar ?? 0,
      phaseALoadingPct: a?.loadingPct ?? 0,
      phaseAIsOverloaded: a?.isOverloaded ?? false,
      phaseBPFromMw: b?.pFromMw ?? 0,
      phaseBQFromMvar: b?.qFromMvar ?? 0,
      phaseBLoadingPct: b?.loadingPct ?? 0,
      phaseBIsOverloaded: b?.isOverloaded ?? false,
      phaseCPFromMw: c?.pFromMw ?? 0,
      phaseCQFromMvar: c?.qFromMvar ?? 0,
      phaseCLoadingPct: c?.loadingPct ?? 0,
      phaseCIsOverloaded: c?.isOverloaded ?? false,
      phaseALossMw: a?.lossMw ?? 0,
      phaseBLossMw: b?.lossMw ?? 0,
      phaseCLossMw: c?.lossMw ?? 0,
      ampacityMva: ref?.ampacityMva ?? 0,
      isOverloaded,
    }
  })

  const vufs = nodeResults.map(n => n.vuf)
  const maxVuf = Math.max(...vufs, 0)
  const avgVuf = vufs.length > 0 ? vufs.reduce((s, v) => s + v, 0) / vufs.length : 0
  const violationCount = nodeResults.filter(n => n.isViolation).length

  return {
    nodeResults,
    phaseBranchResults,
    totalLossMw: Number((lossMw.a + lossMw.b + lossMw.c).toFixed(2)),
    maxVuf: Number(maxVuf.toFixed(2)),
    avgVuf: Number(avgVuf.toFixed(2)),
    violationCount,
    violationRate: nodeResults.length > 0
      ? Number((violationCount / nodeResults.length * 100).toFixed(1)) : 0,
    phaseALossMw: Number(lossMw.a.toFixed(2)),
    phaseBLossMw: Number(lossMw.b.toFixed(2)),
    phaseCLossMw: Number(lossMw.c.toFixed(2)),
    phaseResults: {
      phaseA: phaseResults.a,
      phaseB: phaseResults.b,
      phaseC: phaseResults.c,
    },
  }
}
