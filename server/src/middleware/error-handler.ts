import { Request, Response, NextFunction } from 'express'
import { logger } from '../common/utils/logger.js'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', { error: err.message, stack: err.stack })

  if (err.name === 'ValidationError') {
    return res.status(400).json({ code: 400, message: err.message, data: null })
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ code: 401, message: '认证失败', data: null })
  }

  res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
}
