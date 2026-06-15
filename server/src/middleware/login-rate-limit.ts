import { Request, Response, NextFunction } from 'express'

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000       // 60秒窗口
const MAX_ATTEMPTS = 5          // 每窗口最多5次
const BLOCK_MS = 300_000        // 超限后封禁5分钟

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown'
  const now = Date.now()
  const entry = attempts.get(key)

  // 定期清理过期条目（约每1000次请求触发一次）
  if (Math.random() < 0.001) {
    for (const [k, v] of attempts) {
      if (now > v.resetAt) attempts.delete(k)
    }
  }

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  entry.count++
  if (entry.count > MAX_ATTEMPTS) {
    // 超限后延长封禁窗口
    entry.resetAt = now + BLOCK_MS
    return res.status(429).json({
      code: 429,
      message: '登录尝试过于频繁，请5分钟后再试',
      data: null,
    })
  }

  next()
}
