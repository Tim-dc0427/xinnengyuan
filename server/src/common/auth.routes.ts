import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { AuthService } from './services/auth.service.js'

export const authRoutes = Router()
const authService = new AuthService()

authRoutes.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const result = await authService.login(username, password)
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
