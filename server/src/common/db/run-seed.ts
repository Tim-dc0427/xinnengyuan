/**
 * 种子运行器 —— 已执行种子自动跳过，保护已有数据不被清空。
 *
 * 用法:
 *   npm run seed              → 仅运行未执行过的新种子
 *   npm run seed -- --force   → 强制运行全部种子（清空 seed_log 后重跑）
 *   单独运行: npx tsx src/common/db/seeds/010_xxx.ts
 */
import { db } from '../../config/database.js'

async function main() {
  const force = process.argv.includes('--force')

  // 确保 seed_log 表存在
  await db.schema.createTableIfNotExists('seed_log', (t) => {
    t.text('name').primary()
    t.text('executed_at').notNullable()
  })

  if (force) {
    await db('seed_log').del()
    console.log('⚡ --force: 已清空种子执行记录，将重跑全部种子')
  }

  // 已执行的种子名集合
  const executed = new Set((await db('seed_log').select('name')).map((r: any) => r.name))

  // Knex 按文件名排序加载种子，拦截已执行的
  const originalRun = (db.seed as any).run
  const skipped: string[] = []
  const ran: string[] = []

  // 包装 _runSeeds 来跳过已执行的种子
  const config = (db as any).client.config
  const seedDir = config.seeds?.directory
  if (!seedDir) {
    console.error('未配置 seeds 目录')
    await db.destroy()
    process.exit(1)
  }

  // 列出种子目录中的文件
  const fs = await import('node:fs')
  const path = await import('node:path')
  const seedFiles = fs.readdirSync(seedDir).filter((f: string) => f.endsWith('.ts') || f.endsWith('.js')).sort()

  for (const file of seedFiles) {
    const seedName = file.replace(/\.(ts|js)$/, '')
    if (executed.has(seedName)) {
      skipped.push(seedName)
      continue
    }
    try {
      console.log(`  ▶ 运行种子: ${seedName}`)
      const mod = await import(path.join(seedDir, file))
      if (typeof mod.seed === 'function') {
        await mod.seed(db)
      }
      await db('seed_log').insert({ name: seedName, executed_at: new Date().toISOString() })
      ran.push(seedName)
    } catch (err: any) {
      console.error(`  ✗ 种子 ${seedName} 失败:`, err.message)
      if (ran.length > 0) {
        console.log(`  已执行: ${ran.join(', ')}`)
        console.log(`  跳过: ${skipped.join(', ')}`)
      }
      await db.destroy()
      process.exit(1)
    }
  }

  console.log(`\n完成: 运行 ${ran.length} 个新种子${skipped.length ? `，跳过 ${skipped.length} 个已执行种子` : ''}`)
  if (skipped.length) console.log(`  已执行: ${skipped.join(', ')}`)

  await db.destroy()
}

main()
