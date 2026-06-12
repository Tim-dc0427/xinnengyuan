import { Request, Response, NextFunction } from 'express'
import { logger } from '../common/utils/logger.js'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', { error: err.message, stack: err.stack })

  // 支持业务层通过 err.statusCode 指定 HTTP 状态码
  if (err.statusCode) {
    return res.status(err.statusCode).json({ code: err.statusCode, message: err.message, data: null })
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({ code: 400, message: '文件上传失败: ' + err.message, data: null })
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ code: 400, message: err.message, data: null })
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ code: 401, message: '认证失败', data: null })
  }

  const message = process.env.NODE_ENV !== 'production' ? err.message : '服务器内部错误'
  res.status(500).json({ code: 500, message, data: null })
}
