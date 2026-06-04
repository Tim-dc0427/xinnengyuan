/**
 * TypeScript 版 NR 计算参照结果
 * 运行: cd e:/新能源 && npx tsx e:/新能源项目/run-ts-reference.ts
 * 或:   cd e:/新能源/server && npx tsx run-ts-reference.ts (先复制到server目录)
 */
import Database from 'better-sqlite3';
import { calculatePowerFlow } from './server/src/modules/power-flow/power-flow-calculator';
import * as fs from 'fs';

const db = new Database('./server/data.db');

// 读取拓扑
const busRows: any[] = db.prepare('SELECT * FROM grid_buses').all();
const branchRows: any[] = db.prepare('SELECT * FROM grid_branches').all();
const genRows: any[] = db.prepare('SELECT * FROM grid_generators').all();
const loadRows: any[] = db.prepare('SELECT * FROM grid_loads').all();

const input = {
  buses: busRows.map((b: any) => ({
    id: b.id, name: b.name, zone: b.zone,
    voltageLevel: b.voltage_level, baseKv: b.base_kv, busType: b.bus_type
  })),
  branches: branchRows.map((b: any) => ({
    id: b.id, fromBusId: b.from_bus_id, toBusId: b.to_bus_id,
    branchType: b.branch_type,
    rOhm: b.r_ohm, xOhm: b.x_ohm, bUf: b.b_uf || 0,
    ampacityMva: b.ampacity_mva || 0
  })),
  generators: genRows.map((g: any) => ({
    busId: g.bus_id, pgMw: g.pg_mw, vgKv: g.vg_kv,
    qmaxMvar: g.qmax_mvar, qminMvar: g.qmin_mvar,
    isPV: false, installedCapacityMw: 0
  })),
  loads: loadRows.map((l: any) => ({
    busId: l.bus_id, pdMw: l.pd_mw, qdMvar: l.qd_mvar,
    pdAMw: l.pd_a_mw || 0, pdBMw: l.pd_b_mw || 0, pdCMw: l.pd_c_mw || 0
  }))
};

console.log(`Buses: ${input.buses.length}, Branches: ${input.branches.length}`);
console.log(`Generators: ${input.generators.length}, Loads: ${input.loads.length}`);

// 运行正常场景
const start = Date.now();
const result = calculatePowerFlow(input);
const elapsed = Date.now() - start;

console.log(`\nconverged=${result.converged}`);
console.log(`iterations=${result.iterations}`);
console.log(`totalGenMw=${result.totalGenMw}`);
console.log(`totalLoadMw=${result.totalLoadMw}`);
console.log(`totalLossMw=${result.totalLossMw}`);
console.log(`lossPercent=${result.lossPercent}`);
console.log(`elapsed=${elapsed}`);

// 输出节点结果
console.log('---NODE_RESULTS---');
for (const nr of result.nodeResults) {
  console.log(`${nr.busId}|${nr.voltagePu}|${nr.angleDeg}|${nr.busType}|${nr.pgMw}|${nr.pdMw}`);
}

// 输出支路结果
console.log('---BRANCH_RESULTS---');
for (const br of result.branchResults) {
  console.log(`${br.branchId}|${br.pFromMw}|${br.qFromMvar}|${br.pToMw}|${br.qToMvar}|${br.lossMw}`);
}

// 同时保存完整结果 JSON
fs.writeFileSync(
  'e:/新能源项目/ts-reference-result.json',
  JSON.stringify({ nodeResults: result.nodeResults, branchResults: result.branchResults, summary: {
    converged: result.converged, iterations: result.iterations,
    totalGenMw: result.totalGenMw, totalLoadMw: result.totalLoadMw,
    totalLossMw: result.totalLossMw, lossPercent: result.lossPercent
  }}, null, 2),
  'utf-8'
);
console.log('\nSaved reference result to ts-reference-result.json');
