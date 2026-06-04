const mysql = require('mysql2/promise');
const sqlite = require('better-sqlite3')('data.db');

async function fix() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'admin123',database:'new_energy'});

  await conn.query("ALTER TABLE load_measurements MODIFY COLUMN data_type VARCHAR(50)").catch(() => {});

  const rows = sqlite.prepare('SELECT * FROM load_measurements').all();
  console.log('load_measurements in SQLite: ' + rows.length);

  const cols = Object.keys(rows[0] || {});
  let ok = 0, fail = 0;
  for (const row of rows) {
    const vals = cols.map(c => {
      if (row[c] === null || row[c] === undefined) return 'NULL';
      if (typeof row[c] === 'number') return String(row[c]);
      return "'" + String(row[c]).replace(/\\/g,'\\\\').replace(/'/g,"''") + "'";
    });
    try {
      await conn.query('INSERT INTO load_measurements (' + cols.join(',') + ') VALUES (' + vals.join(',') + ')');
      ok++;
    } catch(e) { if (fail < 3) console.log('Err: ' + e.message.substring(0,100)); fail++; }
  }
  console.log('Imported: ' + ok + '/' + rows.length);

  // 统计最终Total
  const [rc] = await conn.query("SELECT SUM(table_rows) as total FROM information_schema.TABLES WHERE TABLE_SCHEMA='new_energy'");
  const [tc] = await conn.query("SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA='new_energy'");
  console.log('FINAL: ' + tc[0].cnt + ' tables, ' + rc[0].total + ' rows');

  await conn.end();
}
fix();
