import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authConfig } from '../config/auth.js'
import type { UserRole } from '@new-energy/shared'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  department: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function auth(allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '未提供认证令牌', data: null })
    }

    const token = authHeader.substring(7)
    try {
      const payload = jwt.verify(token, authConfig.accessTokenSecret) as AuthUser
      req.user = payload
    } catch {
      return res.status(401).json({ code: 401, message: '令牌无效或已过期', data: null })
    }

    // 角色权限校验
    if (req.user && allowedRoles.length > 0) {
      const userRole = req.user.role
      if (userRole !== 'admin' && !allowedRoles.includes(userRole)) {
        return res.status(403).json({ code: 403, message: '无权限访问', data: null })
      }
    }

    next()
  }
}
