const db = require('better-sqlite3')('./data.db');
const fs = require('fs');

function q(sql) { return db.prepare(sql).all(); }
function esc(s) {
  s = String(s || '');
  s = s.replace(/\\/g, '\\\\');
  s = s.replace(/"/g, '\\"');
  return s;
}

const buses = q('SELECT * FROM grid_buses');
const branches = q('SELECT * FROM grid_branches');
const gens = q('SELECT * FROM grid_generators');
const loads = q('SELECT * FROM grid_loads');

let out = 'package com.newenergy.powerflow.calculator;\n\n';
out += 'public class PocHardcodedTest {\n';
out += '    public static void main(String[] args) {\n';
out += '        CalculatorBus[] buses = new CalculatorBus[]{\n';
buses.forEach(function(b, i) {
  out += '            new CalculatorBus("' + b.id + '","' + esc(b.name) + '","' + b.zone + '","' + b.voltage_level + '",' + b.base_kv + ',"' + b.bus_type + '")';
  out += (i < buses.length - 1) ? ',\n' : '\n';
});
out += '        };\n\n';

out += '        CalculatorBranch[] branchArr = new CalculatorBranch[]{\n';
branches.forEach(function(b, i) {
  out += '            new CalculatorBranch("' + b.id + '","' + b.from_bus_id + '","' + b.to_bus_id + '","' + b.branch_type + '",' + b.r_ohm + ',' + b.x_ohm + ',' + (b.b_uf || 0) + ',' + (b.ampacity_mva || 0) + ')';
  out += (i < branches.length - 1) ? ',\n' : '\n';
});
out += '        };\n\n';

out += '        CalculatorGen[] generators = new CalculatorGen[]{\n';
gens.forEach(function(g, i) {
  out += '            new CalculatorGen("' + g.bus_id + '",' + g.pg_mw + ',' + g.vg_kv + ',' + g.qmax_mvar + ',' + g.qmin_mvar + ',false,0)';
  out += (i < gens.length - 1) ? ',\n' : '\n';
});
out += '        };\n\n';

out += '        CalculatorLoad[] loads = new CalculatorLoad[]{\n';
loads.forEach(function(l, i) {
  out += '            new CalculatorLoad("' + l.bus_id + '",' + l.pd_mw + ',' + l.qd_mvar + ',' + (l.pd_a_mw || 0) + ',' + (l.pd_b_mw || 0) + ',' + (l.pd_c_mw || 0) + ')';
  out += (i < loads.length - 1) ? ',\n' : '\n';
});
out += '        };\n\n';

out += '        PowerFlowInput input = new PowerFlowInput();\n';
out += '        input.buses = buses;\n';
out += '        input.branches = branchArr;\n';
out += '        input.generators = generators;\n';
out += '        input.loads = loads;\n\n';

out += '        PowerFlowScenario scenario = new PowerFlowScenario("normal");\n';
out += '        long start = System.currentTimeMillis();\n';
out += '        PowerFlowResult result = PowerFlowCalculator.calculate(input, scenario);\n';
out += '        long elapsed = System.currentTimeMillis() - start;\n\n';

out += '        System.out.println("converged=" + result.converged);\n';
out += '        System.out.println("iterations=" + result.iterations);\n';
out += '        System.out.println("totalGenMw=" + result.totalGenMw);\n';
out += '        System.out.println("totalLoadMw=" + result.totalLoadMw);\n';
out += '        System.out.println("totalLossMw=" + result.totalLossMw);\n';
out += '        System.out.println("lossPercent=" + result.lossPercent);\n';
out += '        System.out.println("elapsed=" + elapsed);\n';
out += '        System.out.println("---NODE_RESULTS---");\n';
out += '        for (NodeResult nr : result.nodeResults) {\n';
out += '            System.out.println(nr.busId + "|" + nr.voltagePu + "|" + nr.angleDeg + "|" + nr.busType + "|" + nr.pgMw + "|" + nr.pdMw);\n';
out += '        }\n';
out += '        System.out.println("---BRANCH_RESULTS---");\n';
out += '        for (BranchFlowResult br : result.branchResults) {\n';
out += '            System.out.println(br.branchId + "|" + br.pFromMw + "|" + br.qFromMvar + "|" + br.pToMw + "|" + br.qToMvar + "|" + br.lossMw);\n';
out += '        }\n';
out += '    }\n';
out += '}\n';

var target = 'e:/新能源项目/new-energy-powerflow/src/main/java/com/newenergy/powerflow/calculator/PocHardcodedTest.java';
fs.writeFileSync(target, out, 'utf-8');
console.log('Generated: ' + target + ' (' + buses.length + ' buses)');
