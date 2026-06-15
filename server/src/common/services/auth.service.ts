import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '../../config/database.js'
import { authConfig } from '../../config/auth.js'
import type { LoginResponse, UserInfo, UserRole } from '@new-energy/shared'

export class AuthService {
  async login(username: string, password: string): Promise<LoginResponse> {
    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.username', username)
      .where('users.is_active', true)
      .select('users.*', 'roles.name as role_name')
      .first()

    if (!user) {
      throw new Error('用户名或密码错误')
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      throw new Error('用户名或密码错误')
    }

    await db('users').where('id', user.id).update({ last_login_at: new Date().toISOString() })

    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role_name as UserRole,
      department: user.department,
    }

    const accessToken = jwt.sign(userInfo, authConfig.accessTokenSecret, {
      expiresIn: authConfig.accessTokenExpiresIn,
    } as jwt.SignOptions)

    const refreshToken = jwt.sign(
      { id: user.id },
      authConfig.refreshTokenSecret,
      { expiresIn: authConfig.refreshTokenExpiresIn } as jwt.SignOptions,
    )

    return { accessToken, refreshToken, user: userInfo }
  }

  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = jwt.verify(token, authConfig.refreshTokenSecret) as { id: string }
      const user = await db('users')
        .join('roles', 'users.role_id', 'roles.id')
        .where('users.id', payload.id)
        .where('users.is_active', true)
        .select('users.*', 'roles.name as role_name')
        .first()

      if (!user) throw new Error('用户不存在')

      const userInfo: UserInfo = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role_name as UserRole,
        department: user.department,
      }

      const accessToken = jwt.sign(userInfo, authConfig.accessTokenSecret, {
        expiresIn: authConfig.accessTokenExpiresIn,
      } as jwt.SignOptions)

      // 轮换 refresh token：每次刷新签发新的 refresh token
      const newRefreshToken = jwt.sign(
        { id: user.id },
        authConfig.refreshTokenSecret,
        { expiresIn: authConfig.refreshTokenExpiresIn } as jwt.SignOptions,
      )

      return { accessToken, refreshToken: newRefreshToken }
    } catch {
      throw new Error('刷新令牌无效')
    }
  }
}
