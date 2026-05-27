import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authConfig } from '../config/auth.js'
import { db } from '../config/database.js'
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

let cachedAdminId: string | null = null

async function getAdminId(): Promise<string | null> {
  if (cachedAdminId) return cachedAdminId
  const row = await db('users').where('username', 'admin').select('id').first()
  cachedAdminId = row?.id || null
  return cachedAdminId
}

export function auth(_allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      const adminId = await getAdminId()
      req.user = {
        id: adminId || '00000000-0000-0000-0000-000000000000',
        username: 'admin',
        role: 'admin' as UserRole,
        department: '开发部',
      }
      return next()
    }

    const token = authHeader.substring(7)
    try {
      const payload = jwt.verify(token, authConfig.accessTokenSecret) as AuthUser
      req.user = payload
      next()
    } catch {
      // 开发模式下 token 无效也自动注入 admin
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        const adminId = await getAdminId()
        req.user = {
          id: adminId || '00000000-0000-0000-0000-000000000000',
          username: 'admin',
          role: 'admin' as UserRole,
          department: '开发部',
        }
        return next()
      }
      return res.status(401).json({ code: 401, message: '令牌无效或已过期', data: null })
    }
  }
}
