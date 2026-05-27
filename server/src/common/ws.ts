import { Server as HttpServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { authConfig } from '../config/auth.js'
import { logger } from './utils/logger.js'
import type { AuthUser } from '../middleware/auth.js'

const clients = new Map<string, Set<WebSocket>>()

export function initWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.close(4001, '未提供认证令牌')
      return
    }

    try {
      const user = jwt.verify(token, authConfig.accessTokenSecret) as AuthUser
      if (!clients.has(user.id)) {
        clients.set(user.id, new Set())
      }
      clients.get(user.id)!.add(ws)

      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'WebSocket connected' }))

      ws.on('close', () => {
        clients.get(user.id)?.delete(ws)
      })

      ws.on('error', () => {
        clients.get(user.id)?.delete(ws)
      })
    } catch {
      ws.close(4001, '令牌无效')
    }
  })

  // Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping()
      }
    })
  }, 30000)

  wss.on('close', () => clearInterval(interval))

  logger.info('WebSocket server initialized')
}

export function sendNotification(userId: string, data: Record<string, unknown>) {
  const userSockets = clients.get(userId)
  if (userSockets) {
    const message = JSON.stringify(data)
    userSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })
  }
}

export function broadcastToRole(role: string, data: Record<string, unknown>) {
  // In production, look up users by role and send
  const message = JSON.stringify(data)
  clients.forEach((sockets) => {
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })
  })
}
