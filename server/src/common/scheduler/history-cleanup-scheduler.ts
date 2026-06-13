/**
 * 历史记录自动清理调度器
 * 每天凌晨 3:00 运行，清理超过 90 天的未锁定历史记录
 */
import { db } from '../../config/database.js'
import { logger } from '../utils/logger.js'

async function getRetentionDays(): Promise<number> {
  const row = await db('system_config').where('key', 'history_retention_days').first()
  return row ? parseInt(row.value) || 30 : 30
}

async function cleanupOnce(): Promise<number> {
  const retentionDays = await getRetentionDays()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const cutoffStr = cutoff.toISOString()

  const expiredTasks = await db('calc_tasks')
    .where('is_locked', 0)
    .where('created_at', '<', cutoffStr)
    .select('id')

  const ids = expiredTasks.map((t: any) => t.id)
  if (ids.length === 0) return 0

  await db('calc_checkpoints').whereIn('task_id', ids).del()
  await db('calc_results').whereIn('task_id', ids).del()
  await db('calc_tasks').whereIn('id', ids).del()

  return ids.length
}

let timer: ReturnType<typeof setInterval> | null = null

export function startHistoryCleanupScheduler(): void {
  const run = () => {
    cleanupOnce()
      .then((count) => {
        if (count > 0) logger.info(`[历史清理] 自动清理 ${count} 条过期记录`)
      })
      .catch((err) => logger.error('[历史清理] 自动清理失败', err))
  }

  // 计算到下一个凌晨 3:00
  const now = new Date()
  const next3am = new Date(now)
  next3am.setHours(3, 0, 0, 0)
  if (next3am <= now) {
    next3am.setDate(next3am.getDate() + 1)
  }
  const delay = next3am.getTime() - now.getTime()

  // 异步获取保留天数并打日志
  getRetentionDays().then(days => {
    logger.info(`[历史清理] 下次自动清理: ${next3am.toLocaleString('zh-CN')}（${Math.round(delay / 3600000)}小时后），保留期限 ${days} 天`)
  })

  setTimeout(() => {
    run()
    timer = setInterval(run, 86400000)
  }, delay)
}

export function stopHistoryCleanupScheduler(): void {
  if (timer) { clearInterval(timer); timer = null }
}
