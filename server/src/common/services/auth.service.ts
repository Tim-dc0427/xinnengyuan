import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../../config/database.js'
import { authConfig } from '../../config/auth.js'
import type { LoginResponse, UserInfo, UserRole } from '@new-energy/shared'

// ========== RSA 密钥对（启动时生成，进程生命周期内不变） ==========
let rsaPublicKeyPem: string = ''
let rsaPrivateKeyPem: string = ''

function ensureKeyPair(): void {
  if (rsaPrivateKeyPem && rsaPublicKeyPem) return
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  rsaPublicKeyPem = publicKey
  rsaPrivateKeyPem = privateKey
}

/** 获取 RSA 公钥（PEM），供前端加密密码使用 */
export function getPublicKey(): string {
  ensureKeyPair()
  return rsaPublicKeyPem
}

/** 用 RSA 私钥解密前端加密的密码（导出供其他控制器使用） */
export function decryptPassword(encryptedBase64: string): string {
  ensureKeyPair()
  const buffer = Buffer.from(encryptedBase64, 'base64')
  const decrypted = crypto.privateDecrypt(
    { key: rsaPrivateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    buffer,
  )
  return decrypted.toString('utf8')
}

export class AuthService {
  /**
   * 登录
   * @param username 用户名
   * @param encryptedPassword 前端 RSA 加密后的密码（Base64），或明文密码（兼容过渡期）
   */
  async login(username: string, encryptedPassword: string): Promise<LoginResponse> {
    // 解密密码：优先尝试 RSA 解密，失败则视为明文（兼容未升级的客户端）
    let password: string
    try {
      password = decryptPassword(encryptedPassword)
    } catch {
      // 解密失败说明是明文密码（旧客户端），直接使用
      password = encryptedPassword
    }

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
