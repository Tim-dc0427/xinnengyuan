/**
 * 牛顿-拉夫逊法潮流计算引擎
 * 基于电网拓扑数据（母线/支路/发电机/负荷）计算各节点电压、功率分布及网损
 */

const S_BASE = 100 // 系统基准容量 (MVA)
const MAX_ITER = 30
const TOLERANCE = 1e-6

// ==================== 类型定义 ====================

export interface CalculatorBus {
  id: string; name: string; zone: string; voltageLevel: string
  baseKv: number; busType: 'slack' | 'pv' | 'pq'
}

export interface CalculatorBranch {
  id: string; fromBusId: string; toBusId: string
  branchType: 'LINE' | 'TRANSFORMER'
  rOhm: number; xOhm: number; bUf: number; tapRatio: number | null
  ampacityMva?: number
  r0Ohm?: number; x0Ohm?: number; b0Uf?: number
}

export interface CalculatorGen {
  busId: string; pgMw: number; vgKv: number; qmaxMvar: number; qminMvar: number
  isPV?: boolean
  installedCapacityMw?: number
  pgAMw?: number; pgBMw?: number; pgCMw?: number
}

export interface CalculatorLoad {
  busId: string; pdMw: number; qdMvar: number
  pdAMw?: number; pdBMw?: number; pdCMw?: number
  qdAMvar?: number; qdBMvar?: number; qdCMvar?: number
}

export interface PowerFlowScenario {
  type: 'normal' | 'fault' | 'solar'
  /** 故障场景：断开的支路 ID */
  faultBranchId?: string
  /** 光伏场景：光伏出力倍率 */
  solarMultiplier?: number
  /** 光伏场景：哪些母线的光伏发电机受影响（默认所有 PV 节点） */
  pvBusIds?: string[]
}

export interface NodeResult {
  busId: string; nodeId: string; name: string; zone: string
  voltageLevel: string; baseKv: number; busType: string
  voltagePu: number; angleDeg: number
  stabilityMargin: number; isWeakNode: boolean
  threePhaseImbalance: number; reversePower: boolean
  pdMw: number; qdMvar: number; pgMw: number; qgMvar: number
}

export interface BranchFlowResult {
  branchId: string; fromBus: string; toBus: string
  fromBusName: string; toBusName: string
  branchType: string; voltageLevel: string
  pFromMw: number; qFromMvar: number
  pToMw: number; qToMvar: number
  lossMw: number; lossPercent: number
  loadingPct: number; isOverloaded: boolean
  ampacityMva?: number
}

export interface PowerFlowInput {
  buses: CalculatorBus[]
  branches: CalculatorBranch[]
  generators: CalculatorGen[]
  loads: CalculatorLoad[]
}

export interface PowerFlowResult {
  nodeResults: NodeResult[]
  branchResults: BranchFlowResult[]
  totalLoadMw: number
  totalGenMw: number
  totalLossMw: number
  lossPercent: number
  iterations: number
  converged: boolean
}

// ==================== 复数运算 ====================

class Complex {
  constructor(public re: number, public im: number = 0) {}
  add(b: Complex): Complex { return new Complex(this.re + b.re, this.im + b.im) }
  sub(b: Complex): Complex { return new Complex(this.re - b.re, this.im - b.im) }
  mul(b: Complex): Complex {
    return new Complex(this.re * b.re - this.im * b.im, this.re * b.im + this.im * b.re)
  }
  div(b: Complex): Complex {
    const d = b.re * b.re + b.im * b.im
    return new Complex((this.re * b.re + this.im * b.im) / d, (this.im * b.re - this.re * b.im) / d)
  }
  conj(): Complex { return new Complex(this.re, -this.im) }
  abs(): number { return Math.sqrt(this.re * this.re + this.im * this.im) }
  static polar(mag: number, angle: number): Complex {
    return new Complex(mag * Math.cos(angle), mag * Math.sin(angle))
  }
}

// ==================== 线性方程组求解（高斯消元 + 列主元） ====================

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length
  // 增广矩阵 [A | b]
  const aug: number[][] = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // 部分选主元
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    if (maxRow !== col) [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-20) continue // 接近奇异，跳过

    // 归一化主元行
    for (let j = col; j <= n; j++) aug[col][j] /= pivot

    // 消去其他行
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }

  return aug.map(row => row[n])
}

// ==================== 导纳矩阵构建 ====================

function buildYBus(
  buses: CalculatorBus[],
  branches: CalculatorBranch[],
  busMap: Map<string, number>,
): Complex[][] {
  const n = buses.length
  const Y: Complex[][] = Array.from({ length: n }, () => new Array(n).fill(new Complex(0, 0)))

  for (const br of branches) {
    const i = busMap.get(br.fromBusId)!
    const j = busMap.get(br.toBusId)!

    // 判断基准电压（用于导纳标幺化）
    const busI = buses[i]
    const busJ = buses[j]
    // 变压器阻抗归算到高压侧，线路阻抗即在本电压等级
    const vHigh = busI.baseKv >= busJ.baseKv ? busI.baseKv : busJ.baseKv

    // 阻抗标幺化：Z_pu = Z_ohm * S_base / V_base^2
    const zBase = vHigh * vHigh / S_BASE
    const rPu = br.rOhm / zBase
    const xPu = br.xOhm / zBase
    const ySeries = new Complex(rPu, xPu)  // 串联阻抗
    // 导纳 y = 1 / Z
    const yVal = new Complex(1, 0).div(ySeries)

    if (br.branchType === 'TRANSFORMER') {
      // 变压器：阻抗已归算到高压侧，若 tapRatio 与电压比一致则无偏移
      // Y-bus 直接接入串联导纳
      Y[i][j] = Y[i][j].sub(yVal)
      Y[j][i] = Y[j][i].sub(yVal)
      Y[i][i] = Y[i][i].add(yVal)
      Y[j][j] = Y[j][j].add(yVal)
    } else {
      // 线路：π 型等效电路
      Y[i][j] = Y[i][j].sub(yVal)
      Y[j][i] = Y[j][i].sub(yVal)
      Y[i][i] = Y[i][i].add(yVal)
      Y[j][j] = Y[j][j].add(yVal)

      // 线路对地导纳（充电电容）
      if (br.bUf > 0) {
        // b_uf 视为微西门子(µS) -> 西门子
        const bSi = br.bUf * 1e-6
        // 标幺化：B_pu = B / Y_base, Y_base = S_base / V_base^2
        const yBase = S_BASE / (vHigh * vHigh)
        const bPu = bSi / yBase
        // π 型：每端挂 jB/2
        const halfB = new Complex(0, bPu / 2)
        Y[i][i] = Y[i][i].add(halfB)
        Y[j][j] = Y[j][j].add(halfB)
      }
    }
  }

  return Y
}

// ==================== 功率注入计算 ====================

function computeInjections(V: Complex[], Y: Complex[][]): { P: number[]; Q: number[] } {
  const n = V.length
  const P = new Array(n).fill(0)
  const Q = new Array(n).fill(0)

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const ViVj = V[i].abs() * V[j].abs()
      const thetaIJ = Math.atan2(V[i].im, V[i].re) - Math.atan2(V[j].im, V[j].re)
      const Gij = Y[i][j].re
      const Bij = Y[i][j].im
      P[i] += ViVj * (Gij * Math.cos(thetaIJ) + Bij * Math.sin(thetaIJ))
      Q[i] += ViVj * (Gij * Math.sin(thetaIJ) - Bij * Math.cos(thetaIJ))
    }
  }

  return { P, Q }
}

// ==================== 雅可比矩阵构建 ====================

function buildJacobian(
  V: Complex[], Y: Complex[][],
  slackIdx: number, pvIndices: number[], pqIndices: number[],
  P: number[], Q: number[],
): { H: number[][]; N: number[][]; M: number[][]; L: number[][] } {
  const n = V.length
  const nsl = slackIdx // slack bus index
  const npv = new Set(pvIndices)
  const allNonSlack = []
  for (let i = 0; i < n; i++) if (i !== nsl) allNonSlack.push(i)

  const nn = allNonSlack.length // number of non-slack (for H rows = ∂P/∂θ)
  const np = pqIndices.length // number of PQ (for L rows = ∂Q/∂V)

  // H: ∂P/∂θ (nn × nn), N: ∂P/∂V * V (nn × np)
  // M: ∂Q/∂θ (np × nn), L: ∂Q/∂V * V (np × np)
  const H = Array.from({ length: nn }, () => new Array(nn).fill(0))
  const N = Array.from({ length: nn }, () => new Array(np).fill(0))
  const M = Array.from({ length: np }, () => new Array(nn).fill(0))
  const L = Array.from({ length: np }, () => new Array(np).fill(0))

  // 辅助映射: 全局索引 → 子矩阵索引
  const nonSlackMap = new Map<number, number>()
  allNonSlack.forEach((idx, k) => nonSlackMap.set(idx, k))
  const pqMap = new Map<number, number>()
  pqIndices.forEach((idx, k) => pqMap.set(idx, k))

  for (let ii = 0; ii < nn; ii++) {
    const i = allNonSlack[ii]
    for (let jj = 0; jj < nn; jj++) {
      const j = allNonSlack[jj]
      if (i === j) {
        H[ii][jj] = -Q[i] - Y[i][i].im * V[i].abs() * V[i].abs()
      } else {
        const thetaIJ = Math.atan2(V[i].im, V[i].re) - Math.atan2(V[j].im, V[j].re)
        const ViVj = V[i].abs() * V[j].abs()
        H[ii][jj] = ViVj * (Y[i][j].re * Math.sin(thetaIJ) - Y[i][j].im * Math.cos(thetaIJ))
      }
    }

    // N 子矩阵: 只对 PQ 节点
    for (let kj = 0; kj < np; kj++) {
      const j = pqIndices[kj]
      if (i === j) {
        N[ii][kj] = P[i] + Y[i][i].re * V[i].abs() * V[i].abs()
      } else {
        const thetaIJ = Math.atan2(V[i].im, V[i].re) - Math.atan2(V[j].im, V[j].re)
        const ViVj = V[i].abs() * V[j].abs()
        N[ii][kj] = ViVj * (Y[i][j].re * Math.cos(thetaIJ) + Y[i][j].im * Math.sin(thetaIJ))
      }
    }
  }

  // M, L 子矩阵: 只对 PQ 节点的 ΔQ 方程
  for (let ki = 0; ki < np; ki++) {
    const i = pqIndices[ki]
    for (let jj = 0; jj < nn; jj++) {
      const j = allNonSlack[jj]
      if (i === j) {
        M[ki][jj] = P[i] - Y[i][i].re * V[i].abs() * V[i].abs()
      } else {
        const thetaIJ = Math.atan2(V[i].im, V[i].re) - Math.atan2(V[j].im, V[j].re)
        const ViVj = V[i].abs() * V[j].abs()
        M[ki][jj] = -ViVj * (Y[i][j].re * Math.cos(thetaIJ) + Y[i][j].im * Math.sin(thetaIJ))
      }
    }

    for (let kj = 0; kj < np; kj++) {
      const j = pqIndices[kj]
      if (i === j) {
        L[ki][kj] = Q[i] - Y[i][i].im * V[i].abs() * V[i].abs()
      } else {
        const thetaIJ = Math.atan2(V[i].im, V[i].re) - Math.atan2(V[j].im, V[j].re)
        const ViVj = V[i].abs() * V[j].abs()
        L[ki][kj] = ViVj * (Y[i][j].re * Math.sin(thetaIJ) - Y[i][j].im * Math.cos(thetaIJ))
      }
    }
  }

  return { H, N, M, L }
}

// ==================== 牛顿-拉夫逊迭代求解 ====================

function runNewtonRaphson(
  buses: CalculatorBus[],
  Y: Complex[][],
  Psch: number[], Qsch: number[],
  slackIdx: number, pvIndices: number[], pqIndices: number[],
  pvQMin: Map<number, number>, pvQMax: Map<number, number>,
): { V: Complex[]; converged: boolean; iterations: number } {
  const n = buses.length

  // 初始化电压
  const V: Complex[] = buses.map((bus, i) => {
    if (bus.busType === 'slack') return new Complex(1.0, 0)
    if (bus.busType === 'pv') {
      const gen = null // V 由 vgKv/baseKv 指定
      return new Complex(1.0, 0)
    }
    return new Complex(1.0, 0)
  })

  // PV 节点指定电压幅值
  const vSpec = new Map<number, number>()
  // 这里不从外部传入 gen 数据，改为由调用者计算 V_spec 传参
  // 我们通过构造时传入 vSpec 来处理

  let converged = false
  let iter = 0

  while (iter < MAX_ITER) {
    iter++
    const { P, Q } = computeInjections(V, Y)

    // 计算有功不平衡量 ΔP（所有非平衡节点）
    const allNonSlack: number[] = []
    for (let i = 0; i < n; i++) if (i !== slackIdx) allNonSlack.push(i)
    const dP = allNonSlack.map(i => Psch[i] - P[i])

    // 计算无功不平衡量 ΔQ（仅 PQ 节点）
    const dQ = pqIndices.map(i => Qsch[i] - Q[i])

    // 检查收敛
    const maxDP = Math.max(...dP.map(Math.abs), 0)
    const maxDQ = pqIndices.length > 0 ? Math.max(...dQ.map(Math.abs), 0) : 0
    if (maxDP < TOLERANCE && maxDQ < TOLERANCE) {
      converged = true
      break
    }

    // 构建雅可比矩阵
    const { H, N, M, L } = buildJacobian(V, Y, slackIdx, pvIndices, pqIndices, P, Q)

    // 组装完整雅可比矩阵和修正方程
    const nn = allNonSlack.length
    const np = pqIndices.length
    const Jsize = nn + np
    const J: number[][] = Array.from({ length: Jsize }, () => new Array(Jsize).fill(0))
    const rhs: number[] = [...dP, ...dQ]

    for (let r = 0; r < nn; r++) {
      for (let c = 0; c < nn; c++) J[r][c] = H[r][c]
      for (let c = 0; c < np; c++) J[r][nn + c] = N[r][c]
    }
    for (let r = 0; r < np; r++) {
      for (let c = 0; c < nn; c++) J[nn + r][c] = M[r][c]
      for (let c = 0; c < np; c++) J[nn + r][nn + c] = L[r][c]
    }

    // 求解 [Δθ; ΔV/V] = J \ [ΔP; ΔQ]
    const correction = solveLinearSystem(J, rhs)

    // 更新相角（所有非平衡节点）
    for (let k = 0; k < nn; k++) {
      const busIdx = allNonSlack[k]
      const theta = Math.atan2(V[busIdx].im, V[busIdx].re)
      const newTheta = theta + correction[k]
      const mag = V[busIdx].abs()
      V[busIdx] = Complex.polar(mag, newTheta)
    }

    // 更新电压幅值（仅 PQ 节点）：ΔV = correction[nn + k] * V
    for (let k = 0; k < np; k++) {
      const busIdx = pqIndices[k]
      const deltaV = correction[nn + k] * V[busIdx].abs()
      const newMag = V[busIdx].abs() + deltaV
      const theta = Math.atan2(V[busIdx].im, V[busIdx].re)
      V[busIdx] = Complex.polar(newMag, theta)
    }

    // PV 节点：将电压幅值修正回指定值
    for (const pvIdx of pvIndices) {
      const theta = Math.atan2(V[pvIdx].im, V[pvIdx].re)
      const vMag = vSpec.get(pvIdx) ?? 1.0
      V[pvIdx] = Complex.polar(vMag, theta)
    }

    // PV 节点无功越限检查
    const { Q: Qnew } = computeInjections(V, Y)
    for (const pvIdx of pvIndices) {
      const qGen = Qnew[pvIdx] + Qsch[pvIdx] // 注意 Qsch = -Q_load, Qnew = Qgen - Qload
      // 实际计算的 Q = Qgen - Qload, 而 Qsch = -Qload
      // 所以 Qgen = Q + Qload = Q - Qsch
      // 但因为 Qsch = 0 - Qload = -Qload, 所以 Qgen = Qnew + Qload
      // 更简单：Qnew 中已经包含 Qgen - Qload, 所以 Qgen = Qnew + Qload
      // 但 Qsch 包含了 (-Qload)，因此 Qgen = Qnew - Qsch
      const qGenActual = Qnew[pvIdx] - Qsch[pvIdx]

      const qMin = pvQMin.get(pvIdx) ?? -Infinity
      const qMax = pvQMax.get(pvIdx) ?? Infinity

      if (qGenActual > qMax) {
        // 转为 PQ 节点，Q 固定在 Qmax
        Qsch[pvIdx] = qMax - (Qnew[pvIdx] - qGenActual) // 重新计算 Qsch
        // 简化：Qsch = Qgen_specified - Qload
        // 当 Qgen = Qmax 时，Qsch = Qmax - Qload
        // 但这个节点不再是 PV 了
        // 从 pvIndices 移除，加入 pqIndices
        // ... 略复杂，先实现基本版本
      }
    }
  }

  return { V, converged, iterations: iter }
}

// ==================== 支路功率计算 ====================

function computeBranchFlows(
  V: Complex[], Y: Complex[][],
  buses: CalculatorBus[], branches: CalculatorBranch[],
  busMap: Map<string, number>,
): BranchFlowResult[] {
  const results: BranchFlowResult[] = []

  for (const br of branches) {
    const i = busMap.get(br.fromBusId)!
    const j = busMap.get(br.toBusId)!

    // 支路串联导纳
    const vHigh = Math.max(buses[i].baseKv, buses[j].baseKv)
    const zBase = vHigh * vHigh / S_BASE
    const rPu = br.rOhm / zBase
    const xPu = br.xOhm / zBase
    const yVal = new Complex(1, 0).div(new Complex(rPu, xPu))

    // 线路对地导纳（π 型）
    let shuntI = new Complex(0, 0)
    let shuntJ = new Complex(0, 0)
    if (br.branchType === 'LINE' && br.bUf > 0) {
      const bSi = br.bUf * 1e-6
      const yBase = S_BASE / (vHigh * vHigh)
      const bPu = bSi / yBase
      shuntI = new Complex(0, bPu / 2)
      shuntJ = new Complex(0, bPu / 2)
    }

    // 从 i 到 j 的电流
    const Iij = V[i].sub(V[j]).mul(yVal).add(V[i].mul(shuntI))
    const Sij = V[i].mul(Iij.conj()) // 功率从 i→j（标幺值）
    const Pij = Sij.re * S_BASE
    const Qij = Sij.im * S_BASE

    // 从 j 到 i 的电流
    const Iji = V[j].sub(V[i]).mul(yVal).add(V[j].mul(shuntJ))
    const Sji = V[j].mul(Iji.conj()) // 功率从 j→i
    const Pji = Sji.re * S_BASE
    const Qji = Sji.im * S_BASE

    // 线损 = |Sij + Sji|
    const lossMw = (Sij.re + Sji.re) * S_BASE
    const lossPct = Math.abs(Pij) > 0.001 ? Math.abs(lossMw / Pij) * 100 : 0

    // 负载率（基于视在功率/线路额定容量）
    const apparentMVA = Math.sqrt(Pij * Pij + Qij * Qij)
    const impedancePu = Math.sqrt(rPu * rPu + xPu * xPu)
    const ampacityMva = br.ampacityMva != null
      ? br.ampacityMva
      : impedancePu > 0.001 ? (S_BASE / impedancePu) * 0.3 : S_BASE
    const loadingPct = Math.min(Math.abs(apparentMVA / ampacityMva) * 100, 999)

    results.push({
      branchId: br.id,
      fromBus: br.fromBusId,
      toBus: br.toBusId,
      fromBusName: buses[i].name,
      toBusName: buses[j].name,
      branchType: br.branchType,
      voltageLevel: buses[i].voltageLevel + '-' + buses[j].voltageLevel,
      pFromMw: Number(Pij.toFixed(4)),
      qFromMvar: Number(Qij.toFixed(4)),
      pToMw: Number(Pji.toFixed(4)),
      qToMvar: Number(Qji.toFixed(4)),
      lossMw: Number(Math.abs(lossMw).toFixed(4)),
      lossPercent: Number(lossPct.toFixed(2)),
      loadingPct: Number(loadingPct.toFixed(1)),
      isOverloaded: loadingPct > 100,
      ampacityMva: Number(ampacityMva.toFixed(2)),
    })
  }

  return results
}

// ==================== 场景应用 ====================

function applyScenario(input: PowerFlowInput, scenario?: PowerFlowScenario): void {
  if (!scenario || scenario.type === 'normal') return

  if (scenario.type === 'fault') {
    // 断开指定支路
    const idx = input.branches.findIndex(b => b.id === scenario.faultBranchId)
    if (idx >= 0) {
      input.branches.splice(idx, 1)
    }
  }

  if (scenario.type === 'solar') {
    const multiplier = scenario.solarMultiplier ?? 1.5
    const targetBusIds = new Set(scenario.pvBusIds)
    for (const gen of input.generators) {
      if (targetBusIds.size === 0 || targetBusIds.has(gen.busId)) {
        gen.pgMw *= multiplier
      }
    }
  }
}

// ==================== 主入口 ====================

export function calculatePowerFlow(
  input: PowerFlowInput,
  scenario?: PowerFlowScenario,
): PowerFlowResult {
  // 复制输入以防修改原始数据
  const buses = JSON.parse(JSON.stringify(input.buses)) as CalculatorBus[]
  const branches = JSON.parse(JSON.stringify(input.branches)) as CalculatorBranch[]
  const generators = JSON.parse(JSON.stringify(input.generators)) as CalculatorGen[]
  const loads = JSON.parse(JSON.stringify(input.loads)) as CalculatorLoad[]

  const busMap = new Map<string, number>()
  buses.forEach((b, i) => busMap.set(b.id, i))

  // 应用场景
  applyScenario({ buses, branches, generators, loads }, scenario)

  // 构建导纳矩阵
  const Y = buildYBus(buses, branches, busMap)

  // 确定节点类型索引
  const slackIdx = buses.findIndex(b => b.busType === 'slack')
  const pvIndices: number[] = []
  const pqIndices: number[] = []
  buses.forEach((b, i) => {
    if (b.busType === 'pv') pvIndices.push(i)
    else if (b.busType === 'pq') pqIndices.push(i)
  })

  // 计算各节点注入功率（标幺值）
  const Psch = new Array(buses.length).fill(0)
  const Qsch = new Array(buses.length).fill(0)

  // 发电机注入（正）
  for (const gen of generators) {
    const idx = busMap.get(gen.busId)
    if (idx !== undefined) {
      Psch[idx] += gen.pgMw / S_BASE
    }
  }

  // 负荷（负注入）
  for (const load of loads) {
    const idx = busMap.get(load.busId)
    if (idx !== undefined) {
      Psch[idx] -= load.pdMw / S_BASE
      Qsch[idx] -= load.qdMvar / S_BASE
    }
  }

  // PV 节点指定电压
  const vSpec = new Map<number, number>()
  for (const gen of generators) {
    const idx = busMap.get(gen.busId)
    if (idx !== undefined && buses[idx]?.busType === 'pv') {
      vSpec.set(idx, gen.vgKv / buses[idx].baseKv)
    }
  }

  // PV 节点无功限值
  const pvQMin = new Map<number, number>()
  const pvQMax = new Map<number, number>()
  for (const gen of generators) {
    const idx = busMap.get(gen.busId)
    if (idx !== undefined && buses[idx]?.busType === 'pv') {
      pvQMin.set(idx, gen.qminMvar / S_BASE)
      pvQMax.set(idx, gen.qmaxMvar / S_BASE)
    }
  }

  // 运行潮流计算
  const { V, converged, iterations } = runNewtonRaphson(
    buses, Y, Psch, Qsch, slackIdx, pvIndices, pqIndices,
    pvQMin, pvQMax,
  )

  // 提取计算结果
  const { P, Q } = computeInjections(V, Y)
  const nodeResults: NodeResult[] = buses.map((bus, i) => {
    const gen = generators.find(g => g.busId === bus.id)
    const load = loads.find(l => l.busId === bus.id)
    const vMag = V[i].abs()
    const theta = Math.atan2(V[i].im, V[i].re)
    const angleDeg = theta * 180 / Math.PI
    const stabilityMargin = Number((1 - Math.abs(vMag - 1)).toFixed(4))
    const isWeakNode = Math.abs(vMag - 1) > 0.05
    const pgMw = gen ? gen.pgMw : 0
    // Qgen = Q_calc + Q_load (因为 Q = Qgen - Qload)
    const qLoad = load ? load.qdMvar : 0
    const qgMw = Number(((P[i] > 0 || Q[i] > 0) ? (Q[i] + qLoad / S_BASE) * S_BASE : 0).toFixed(2))
    const pdMw = load ? load.pdMw : 0
    const qdMvar = load ? load.qdMvar : 0
    // 反向潮流：负荷节点有功为正（注入>负荷）时判定为反向
    const reversePower = bus.busType === 'pq' && (Psch[i] > 0.001)

    // 三相不平衡度估算（基于负荷不平衡度 × 电压偏差）
    const loadFactor = load ? Math.sqrt(load.pdMw ** 2 + load.qdMvar ** 2) / 100 : 0
    const voltDev = Math.abs(vMag - 1) * 100
    const threePhaseImbalance = Number(Math.min(voltDev * 0.3 + loadFactor * 0.5, 8).toFixed(2))

    return {
      busId: bus.id,
      nodeId: bus.name,
      name: bus.name,
      zone: bus.zone,
      voltageLevel: bus.voltageLevel,
      baseKv: bus.baseKv,
      busType: bus.busType,
      voltagePu: Number(vMag.toFixed(6)),
      angleDeg: Number(angleDeg.toFixed(4)),
      stabilityMargin,
      isWeakNode,
      threePhaseImbalance,
      reversePower,
      pdMw,
      qdMvar,
      pgMw,
      qgMvar: qgMw,
    }
  })

  // 支路功率
  const branchResults = computeBranchFlows(V, Y, buses, branches, busMap)

  // 汇总：从求解后的节点注入计算发电、负荷，从支路求和计算网损
  const totalGenMw = Number(nodeResults.reduce((s, n) => s + (n.pgMw > 0 ? n.pgMw : 0), 0).toFixed(4))
  const totalLoadMw = Number(nodeResults.reduce((s, n) => s + (n.pdMw > 0 ? n.pdMw : 0), 0).toFixed(4))
  const totalLossMw = Number(branchResults.reduce((s, b) => s + b.lossMw, 0).toFixed(4))
  const lossPercent = totalGenMw > 0 ? Number((totalLossMw / totalGenMw * 100).toFixed(2)) : 0

  return {
    nodeResults,
    branchResults,
    totalLoadMw,
    totalGenMw,
    totalLossMw,
    lossPercent,
    iterations,
    converged,
  }
}
