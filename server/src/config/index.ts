import dotenv from 'dotenv'
dotenv.config()

const nodeEnv = process.env.NODE_ENV || 'production'

// 生产环境禁止使用默认 JWT Secret
const JWT_ACCESS_SECRET_DEFAULT = 'dev-access-secret-change-in-production'
const JWT_REFRESH_SECRET_DEFAULT = 'dev-refresh-secret-change-in-production'
const accessSecret = process.env.JWT_ACCESS_SECRET || (nodeEnv === 'development' ? JWT_ACCESS_SECRET_DEFAULT : '')
const refreshSecret = process.env.JWT_REFRESH_SECRET || (nodeEnv === 'development' ? JWT_REFRESH_SECRET_DEFAULT : '')

if (!accessSecret || accessSecret === JWT_ACCESS_SECRET_DEFAULT) {
  if (nodeEnv !== 'development') {
    console.error('[FATAL] JWT_ACCESS_SECRET 未设置或仍为默认值，生产环境禁止启动')
    process.exit(1)
  }
  console.warn('[WARN] JWT_ACCESS_SECRET 使用默认值，仅限开发环境，切勿用于生产')
}
if (!refreshSecret || refreshSecret === JWT_REFRESH_SECRET_DEFAULT) {
  if (nodeEnv !== 'development') {
    console.error('[FATAL] JWT_REFRESH_SECRET 未设置或仍为默认值，生产环境禁止启动')
    process.exit(1)
  }
  console.warn('[WARN] JWT_REFRESH_SECRET 使用默认值，仅限开发环境，切勿用于生产')
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
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};
