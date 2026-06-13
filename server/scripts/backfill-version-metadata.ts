import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data.db'))

// 查找所有缺少元数据的版本记录
const versions = db.prepare(`SELECT v.id, v.scenario_id, s.name, s.type, s.tags, s.description, s.status
  FROM scenario_versions v
  JOIN interactive_scenarios s ON s.id = v.scenario_id
  WHERE v.name IS NULL`).all() as any[]

console.log(`找到 ${versions.length} 条需要回填的版本记录`)

let updated = 0
for (const v of versions) {
  db.prepare(`UPDATE scenario_versions SET name=?, type=?, tags=?, description=?, status=? WHERE id=?`)
    .run(v.name, v.type, v.tags, v.description || '', v.status, v.id)
  updated++
}

console.log(`已回填 ${updated} 条记录`)
db.close()
