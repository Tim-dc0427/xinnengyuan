import { Request, Response, NextFunction } from 'express'

const requestCounts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = process.env.NODE_ENV === 'production' ? 100 : 500

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown'
  const now = Date.now()
  const entry = requestCounts.get(key)

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ code: 429, message: '请求过于频繁，请稍后重试', data: null })
  }

  next()
}
