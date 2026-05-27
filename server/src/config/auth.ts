import { config } from './index.js'

export const authConfig = {
  accessTokenSecret: config.jwt.accessSecret,
  refreshTokenSecret: config.jwt.refreshSecret,
  accessTokenExpiresIn: config.jwt.accessExpiresIn,
  refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
  saltRounds: 10,
}
