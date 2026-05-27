import { Request, Response, NextFunction } from 'express'
import { db } from '../config/database.js'

export function audit(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res)
  res.json = function (body: unknown) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const userId = req.user?.id || 'anonymous'
      db('audit_logs')
        .insert({
          user_id: userId,
          action: req.method,
          resource_type: req.path.split('/')[3] || 'unknown',
          resource_id: req.params.id || null,
          ip_address: req.ip,
          user_agent: req.get('user-agent') || null,
        })
        .then(() => {})
        .catch(() => {}) // fire-and-forget
    }
    return originalJson(body)
  }

  next()
}
