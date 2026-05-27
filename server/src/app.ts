import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config/index.js'
import { rateLimiter } from './middleware/rate-limit.js'
import { errorHandler } from './middleware/error-handler.js'
import { registerRoutes } from './common/routes.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({
    origin: (origin, cb) => {
      const allowed = [config.cors.origin, 'https://tim-dc0427.github.io']
      if (!origin || allowed.includes(origin)) {
        cb(null, true)
      } else {
        cb(new Error('CORS not allowed'))
      }
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '10mb' }))
  app.use(rateLimiter)

  registerRoutes(app)

  app.use(errorHandler)

  return app
}
