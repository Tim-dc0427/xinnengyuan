import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, '..', 'data.db'))
const rows = db.prepare(`SELECT task_id, substr(node_results, 1, 300) as node_preview, substr(branch_results, 1, 300) as branch_preview FROM calc_results WHERE is_latest = 1 LIMIT 2`).all()
console.log(JSON.stringify(rows, null, 2))
db.close()
