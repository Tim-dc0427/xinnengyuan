const fs = require('fs');
const sqlite = require('better-sqlite3')('data.db');
let ddl = fs.readFileSync('e:/新能源项目/new-energy-server/src/main/resources/db/migration/V2__all_tables.sql', 'utf-8');

// 找access_point_resources的SQL并替换
const old = ddl.match(/-- Table: access_point_resources[\s\S]*?(?=-- Table:|$)/)[0];

// 从SQLite获取完整列定义
const pragma = sqlite.prepare("PRAGMA table_info('access_point_resources')").all();
const cols = pragma.map(c => {
  let t = c.type.toUpperCase();
  if (t === 'TEXT') t = 'VARCHAR(500)';
  else if (t === 'INTEGER' || t === 'INT') t = 'INT';
  else if (t === 'FLOAT' || t === 'REAL') t = 'DOUBLE';
  return '  `' + c.name + '` ' + t + (c.pk ? ' PRIMARY KEY' : '');
});

const fixed = '-- Table: access_point_resources\nDROP TABLE IF EXISTS `access_point_resources`;\nCREATE TABLE `access_point_resources` (\n' + cols.join(',\n') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n';
ddl = ddl.replace(old, fixed);

// 同样处理其他可能有问题的表
const broken = ddl.match(/`id` text PRIMARY KEY/gi);
if (broken) {
  console.log('Found ' + broken.length + ' remaining TEXT id issues');
  ddl = ddl.replace(/`id` text PRIMARY KEY/gi, '`id` VARCHAR(36) PRIMARY KEY');
}

fs.writeFileSync('e:/新能源项目/new-energy-server/src/main/resources/db/migration/V2__all_tables.sql', ddl, 'utf-8');
console.log('Fixed DDL');
