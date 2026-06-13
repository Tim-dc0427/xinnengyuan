import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(import.meta.dirname || '.', '..', 'data.db'))

// 找一个有版本的场景
const scenario = db.prepare(`SELECT s.id, s.name FROM interactive_scenarios s
  INNER JOIN scenario_versions v ON v.scenario_id = s.id
  GROUP BY s.id HAVING COUNT(*) > 0 LIMIT 1`).get() as any

if (!scenario) { console.log('没有找到有版本的场景'); process.exit(0) }
console.log('场景:', scenario.id, scenario.name)

// 列出它的版本
const versions = db.prepare('SELECT id, version_number, changelog, name, type FROM scenario_versions WHERE scenario_id = ? ORDER BY version_number').all(scenario.id)
console.log('版本:', JSON.stringify(versions, null, 2))

// 试恢复最新版本前一个版本
if (versions.length < 2) { console.log('只有一个版本，无法测试恢复'); process.exit(0) }

const target = versions[0] as any // 最新版本
console.log('尝试恢复到版本', target.version_number, target.id)

// 模拟 restoreVersion 逻辑
const updated = db.prepare(`UPDATE interactive_scenarios SET
  config = ?, control_logic = ?, name = ?, type = ?, tags = ?, description = ?, status = ?, updated_at = ?, updated_by = ?
  WHERE id = ?`).run(
  target.config_snapshot,
  target.control_logic_snapshot,
  target.name,
  target.type,
  target.tags,
  target.description || '',
  target.status,
  new Date().toISOString(),
  'test-user',
  scenario.id
)
console.log('更新结果:', updated.changes)

// 重新读取
const restored = db.prepare('SELECT name, type, status, updated_by FROM interactive_scenarios WHERE id = ?').get(scenario.id)
console.log('恢复后:', JSON.stringify(restored))

db.close()
