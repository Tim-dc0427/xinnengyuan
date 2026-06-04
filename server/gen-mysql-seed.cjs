const db = require('better-sqlite3')('data.db');
const fs = require('fs');

function q(sql) { return db.prepare(sql).all(); }
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
  return String(v);
}

let sql = '-- V99: POC 种子数据（从 SQLite data.db 导出）\n\n';

const buses = q('SELECT * FROM grid_buses');
sql += '-- grid_buses (' + buses.length + ' rows)\n';
for (const b of buses) {
  sql += 'INSERT INTO grid_buses (id, name, zone, voltage_level, base_kv, bus_type, remark, longitude, latitude) VALUES (';
  sql += [esc(b.id), esc(b.name), esc(b.zone), esc(b.voltage_level), esc(b.base_kv), esc(b.bus_type), esc(b.remark), esc(b.longitude), esc(b.latitude)].join(', ');
  sql += ') ON DUPLICATE KEY UPDATE name=VALUES(name);\n';
}

const branches = q('SELECT * FROM grid_branches');
sql += '\n-- grid_branches (' + branches.length + ' rows)\n';
for (const b of branches) {
  sql += 'INSERT INTO grid_branches (id, from_bus_id, to_bus_id, zone, voltage_level, branch_type, r_ohm, x_ohm, b_uf, tap_ratio, remark, ampacity_mva, r0_ohm, x0_ohm, b0_uf) VALUES (';
  sql += [esc(b.id), esc(b.from_bus_id), esc(b.to_bus_id), esc(b.zone), esc(b.voltage_level), esc(b.branch_type), esc(b.r_ohm), esc(b.x_ohm), esc(b.b_uf), esc(b.tap_ratio), esc(b.remark), esc(b.ampacity_mva), esc(b.r0_ohm), esc(b.x0_ohm), esc(b.b0_uf)].join(', ');
  sql += ') ON DUPLICATE KEY UPDATE from_bus_id=VALUES(from_bus_id);\n';
}

const gens = q('SELECT * FROM grid_generators');
sql += '\n-- grid_generators (' + gens.length + ' rows)\n';
for (const g of gens) {
  sql += 'INSERT INTO grid_generators (id, bus_id, pg_mw, vg_kv, qmax_mvar, qmin_mvar, remark, pg_a_mw, pg_b_mw, pg_c_mw) VALUES (';
  sql += [esc(g.id), esc(g.bus_id), esc(g.pg_mw), esc(g.vg_kv), esc(g.qmax_mvar), esc(g.qmin_mvar), esc(g.remark), esc(g.pg_a_mw), esc(g.pg_b_mw), esc(g.pg_c_mw)].join(', ');
  sql += ') ON DUPLICATE KEY UPDATE bus_id=VALUES(bus_id);\n';
}

const loads = q('SELECT * FROM grid_loads');
sql += '\n-- grid_loads (' + loads.length + ' rows)\n';
for (const l of loads) {
  sql += 'INSERT INTO grid_loads (id, bus_id, pd_mw, qd_mvar, remark, pd_a_mw, pd_b_mw, pd_c_mw, qd_a_mvar, qd_b_mvar, qd_c_mvar) VALUES (';
  sql += [esc(l.id), esc(l.bus_id), esc(l.pd_mw), esc(l.qd_mvar), esc(l.remark), esc(l.pd_a_mw), esc(l.pd_b_mw), esc(l.pd_c_mw), esc(l.qd_a_mvar), esc(l.qd_b_mvar), esc(l.qd_c_mvar)].join(', ');
  sql += ') ON DUPLICATE KEY UPDATE bus_id=VALUES(bus_id);\n';
}

var target = 'e:/新能源项目/new-energy-server/src/main/resources/db/migration/V99__poc_seed.sql';
fs.writeFileSync(target, sql, 'utf-8');
console.log('Generated V99__poc_seed.sql: ' + buses.length + ' buses, ' + branches.length + ' branches, ' + gens.length + ' gens, ' + loads.length + ' loads');
