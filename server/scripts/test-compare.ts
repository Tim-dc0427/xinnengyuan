import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 用 knex 连接数据库，跟实际服务一致
import knexLib from 'knex'
const db = knexLib({
  client: 'better-sqlite3',
  connection: { filename: path.join(__dirname, '..', 'data.db') },
  useNullAsDefault: true,
})

const parseJson = (v: any) => {
  if (!v) return null
  return typeof v === 'string' ? JSON.parse(v) : v
}

// 找两个有结果的 task
const tasks = await db('calc_tasks')
  .join('calc_results', function() { this.on('calc_tasks.id', 'calc_results.task_id').andOn('calc_results.is_latest', db.raw('1')) })
  .select('calc_tasks.id as task_id', 'calc_tasks.task_type')
  .where('calc_tasks.status', 'completed')
  .limit(2)

console.log('找到 ' + tasks.length + ' 个已完成任务')
if (tasks.length < 2) { console.log('不够2个'); process.exit(0) }

const [rA, rB] = await Promise.all([
  db('calc_results').where('task_id', tasks[0].task_id).where('is_latest', 1).first(),
  db('calc_results').where('task_id', tasks[1].task_id).where('is_latest', 1).first(),
])

const nodesA = parseJson(rA.node_results) || []
const nodesB = parseJson(rB.node_results) || []
const branchesA = parseJson(rA.branch_results) || []
const branchesB = parseJson(rB.branch_results) || []

console.log('nodesA:', nodesA.length, 'nodesB:', nodesB.length)
console.log('branchesA:', branchesA.length, 'branchesB:', branchesB.length)

if (nodesA.length > 0) {
  console.log('nodeA[0] keys:', Object.keys(nodesA[0]))
  console.log('nodeA[0]:', JSON.stringify(nodesA[0]).slice(0, 200))
}
if (branchesA.length > 0) {
  console.log('branchA[0] keys:', Object.keys(branchesA[0]))
  console.log('branchA[0]:', JSON.stringify(branchesA[0]).slice(0, 200))
}

// 试试匹配
const nodeMap = new Map()
for (const n of nodesB) nodeMap.set(n.busId || n.name, n)
let matched = 0, unmatched = 0
for (const na of nodesA) {
  const key = na.busId || na.name
  const nb = nodeMap.get(key)
  if (nb) matched++; else unmatched++
}
console.log(`节点匹配: ${matched}, 未匹配: ${unmatched}`)

const branchMap = new Map()
for (const b of branchesB) branchMap.set(b.branchId || b.id || `${b.fromBus}-${b.toBus}`, b)
let bMatched = 0, bUnmatched = 0
for (const ba of branchesA) {
  const key = ba.branchId || ba.id || `${ba.fromBus}-${ba.toBus}`
  const bb = branchMap.get(key)
  if (bb) bMatched++; else bUnmatched++
}
console.log(`支路匹配: ${bMatched}, 未匹配: ${bUnmatched}`)

await db.destroy()
