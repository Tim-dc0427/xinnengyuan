const mysql = require('mysql2/promise');
const fs = require('fs');

async function importAll() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: 'admin123',
    database: 'new_energy', charset: 'utf8mb4',
    multipleStatements: true
  });

  console.log('Connected to MySQL');

  // 禁用外键检查
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  // 重建数据库（清空所有表）
  const [tables] = await conn.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='new_energy'");
  for (const {TABLE_NAME} of tables) {
    await conn.query('DROP TABLE IF EXISTS `' + TABLE_NAME + '`').catch(() => {});
  }
  console.log('Cleared ' + tables.length + ' existing tables');

  // 读DDL，分割成单个CREATE TABLE语句
  const ddl = fs.readFileSync('e:/新能源项目/new-energy-server/src/main/resources/db/migration/V2__all_tables.sql', 'utf-8');
  const ddlStatements = ddl.split(/;(?=\r?\n)/).filter(s => s.trim());

  let tablesOk = 0, tablesFail = 0;
  for (const stmt of ddlStatements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('SET ')) continue;
    try {
      await conn.query(trimmed);
      tablesOk++;
    } catch (e) {
      tablesFail++;
      console.log(`  DDL Fail: ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`DDL: ${tablesOk} OK, ${tablesFail} failed`);

  // 导入种子
  console.log('Importing seed...');
  const seed = fs.readFileSync('e:/新能源项目/new-energy-server/src/main/resources/db/migration/V99__seed_data.sql', 'utf-8');
  const statements = seed.split(/;\s*\n/).filter(s => s.trim().startsWith('INSERT'));
  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 5) console.log(`  Skip: ${e.message.substring(0, 100)}`);
    }
  }
  console.log(`Seed: ${ok} OK, ${fail} skipped`);

  // 验证
  console.log('\n=== Table Row Counts ===');
  const [tableStats] = await conn.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='new_energy' ORDER BY table_rows DESC LIMIT 30");
  for (const {TABLE_NAME} of tableStats) {
    const [[{cnt}]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${TABLE_NAME}\``);
    if (cnt > 0) console.log(`  ${TABLE_NAME}: ${cnt} rows`);
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  console.log('\nImport done!');
}

importAll().catch(e => console.error(e));
