import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { loginRateLimiter } from '../middleware/login-rate-limit.js'
import { AuthService, getPublicKey } from './services/auth.service.js'

export const authRoutes = Router()
const authService = new AuthService()

// 获取 RSA 公钥（前端用于加密密码）
authRoutes.get('/public-key', (_req, res) => {
  res.json({ code: 200, message: 'ok', data: { publicKey: getPublicKey() } })
})

authRoutes.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, encryptedPassword } = req.body
    const result = await authService.login(username, encryptedPassword)
    res.json({ code: 200, message: '登录成功', data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '登录失败'
    res.status(401).json({ code: 401, message, data: null })
  }
})

authRoutes.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    const result = await authService.refresh(refreshToken)
    res.json({ code: 200, message: '令牌刷新成功', data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '刷新失败'
    res.status(401).json({ code: 401, message, data: null })
  }
})

authRoutes.get('/me', auth(['admin', 'planner', 'operator', 'viewer']), (req, res) => {
  res.json({ code: 200, message: 'ok', data: req.user })
})
