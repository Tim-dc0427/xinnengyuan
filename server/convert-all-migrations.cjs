/**
 * 从 SQLite PRAGMA table_info 生成准确 MySQL DDL
 * 比 sqlite_master.sql 更准确（包含所有后期 ALTER TABLE 加的列）
 */
const db = require('better-sqlite3')('data.db');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'e:/新能源项目/new-energy-server/src/main/resources/db/migration';

function sqliteTypeToMySQL(type, name, isPK) {
  const t = (type || '').toUpperCase();
  if (isPK) return 'VARCHAR(36)';
  if (t.includes('INT')) return 'BIGINT';
  if (t.includes('FLOAT') || t.includes('REAL') || t.includes('DOUBLE') || t.includes('NUMERIC')) return 'DOUBLE';
  if (name === 'id' || name.endsWith('_id')) return 'VARCHAR(36)';
  if (/config|results|json|parameters|custom_fields/.test(name)) return 'JSON';
  if (/remark|description|conditions|notes|permissions/.test(name)) return 'TEXT';
  return 'VARCHAR(500)';
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%' ORDER BY name").all();

// 检查外键依赖，排序（粗略：无FK的表先创建）
const tableInfo = [];
for (const {name} of tables) {
  const cols = db.prepare(`PRAGMA table_info('${name}')`).all();
  const fks = db.prepare(`PRAGMA foreign_key_list('${name}')`).all();
  tableInfo.push({name, cols, fks});
}

// FK引用先于被引用表 → 移到后面
const withFK = tableInfo.filter(t => t.fks.length > 0);
const withoutFK = tableInfo.filter(t => t.fks.length === 0);
const ordered = [...withoutFK, ...withFK];

let ddl = `-- ============================================\n`;
ddl += `-- 所有数据库表 DDL（从 SQLite PRAGMA 生成）\n`;
ddl += `-- 表数: ${tables.length}，生成: ${new Date().toISOString()}\n`;
ddl += `-- ============================================\n\n`;
ddl += `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

for (const {name, cols} of ordered) {
  ddl += `-- Table: ${name}\n`;
  ddl += `DROP TABLE IF EXISTS \`${name}\`;\n`;

  const colDefs = cols.map(c => {
    const mysqlType = sqliteTypeToMySQL(c.type, c.name, c.pk === 1);
    let def = `  \`${c.name}\` ${mysqlType}`;
    if (c.pk === 1) def += ' PRIMARY KEY';
    if (c.notnull === 1 && c.pk !== 1 && c.name !== 'id') def += ' NOT NULL';
    if (c.dflt_value !== null && !mysqlType.includes('TEXT') && !mysqlType.includes('JSON')) {
      let val = c.dflt_value;
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/'/g, "''");
      def += ` DEFAULT '${val}'`;
    }
    return def;
  });

  ddl += `CREATE TABLE \`${name}\` (\n${colDefs.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;
}

ddl += `SET FOREIGN_KEY_CHECKS = 1;\n`;
fs.writeFileSync(path.join(OUT_DIR, 'V2__all_tables.sql'), ddl, 'utf-8');
console.log(`Generated V2 with ${ordered.length} tables`);

// ============ 种子数据 ============
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
  if (typeof v === 'string') {
    return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
  }
  return String(v);
}

let seedSQL = `-- ============================================\n`;
seedSQL += `-- 种子数据（从 SQLite data.db 导出）\n`;
seedSQL += `-- ============================================\n\n`;
seedSQL += `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

let totalSeedRows = 0;
// 按FK反向顺序（子表优先插入，外键引用父表）
const reversed = [...ordered].reverse();
for (const {name, cols} of reversed) {
  try {
    const rows = db.prepare(`SELECT * FROM \`${name}\``).all();
    if (rows.length === 0) continue;
    const colNames = cols.map(c => c.name);
    seedSQL += `-- ${name}: ${rows.length} rows\n`;
    for (const row of rows) {
      const vals = colNames.map(cn => esc(row[cn]));
      seedSQL += `INSERT INTO \`${name}\` (\`${colNames.join('`, `')}\`) VALUES (${vals.join(', ')});\n`;
      totalSeedRows++;
    }
    seedSQL += '\n';
  } catch (e) {
    seedSQL += `-- SKIP ${name}: ${e.message}\n\n`;
  }
}

seedSQL += `SET FOREIGN_KEY_CHECKS = 1;\n`;
fs.writeFileSync(path.join(OUT_DIR, 'V99__seed_data.sql'), seedSQL, 'utf-8');
console.log(`Generated V99 with ${totalSeedRows} seed rows`);
