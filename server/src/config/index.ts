import dotenv from 'dotenv'
import crypto from 'crypto'
dotenv.config()

const nodeEnv = process.env.NODE_ENV || 'production'

const accessSecret = process.env.JWT_ACCESS_SECRET ||
  (nodeEnv === 'development' ? crypto.randomBytes(64).toString('hex') : '')
const refreshSecret = process.env.JWT_REFRESH_SECRET ||
  (nodeEnv === 'development' ? crypto.randomBytes(64).toString('hex') : '')

if (!accessSecret) {
  console.error('[FATAL] JWT_ACCESS_SECRET 未设置，生产环境禁止启动')
  process.exit(1)
}
if (!refreshSecret) {
  console.error('[FATAL] JWT_REFRESH_SECRET 未设置，生产环境禁止启动')
  process.exit(1)
}

if (nodeEnv === 'development' && !process.env.JWT_ACCESS_SECRET) {
  console.warn('[WARN] JWT_ACCESS_SECRET 未通过环境变量设置，已自动生成随机密钥（每次重启后失效）。生产环境请务必设置 JWT_ACCESS_SECRET 环境变量。')
}
if (nodeEnv === 'development' && !process.env.JWT_REFRESH_SECRET) {
  console.warn('[WARN] JWT_REFRESH_SECRET 未通过环境变量设置，已自动生成随机密钥（每次重启后失效）。生产环境请务必设置 JWT_REFRESH_SECRET 环境变量。')
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'new_energy_grid',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  jwt: {
    accessSecret,
    refreshSecret,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '8h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5175',
  },
};
