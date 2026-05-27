import { createApp } from './app.js'
import { config } from './config/index.js'
import { logger } from './common/utils/logger.js'
import { initWebSocket } from './common/ws.js'
import http from 'node:http'

const app = createApp()
const server = http.createServer(app)

initWebSocket(server)

server.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`)
  logger.info(`Environment: ${config.nodeEnv}`)
})
