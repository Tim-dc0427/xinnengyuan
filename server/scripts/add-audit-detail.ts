import knex from 'knex'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data.db')

const db = knex({
  client: 'better-sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true,
})

async function main() {
  const result = await db.raw("SELECT COUNT(*) as cnt FROM pragma_table_info('audit_logs') WHERE name='detail'")
  if (result[0].cnt === 0) {
    await db.schema.alterTable('audit_logs', (t: any) => { t.text('detail').nullable() })
    console.log('detail 列已添加')
  } else {
    console.log('detail 列已存在，跳过')
  }
  await db.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
