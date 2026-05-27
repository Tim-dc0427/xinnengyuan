import knex from 'knex'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV !== 'production'

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data.db')

export const db = knex({
  client: 'better-sqlite3',
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn: any, cb: Function) => {
      conn.pragma('journal_mode = WAL')
      conn.pragma('foreign_keys = ON')
      cb(null, conn)
    },
  },
  migrations: {
    directory: path.join(__dirname, '..', 'common', 'db', 'migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, '..', 'common', 'db', 'seeds'),
    extension: 'ts',
  },
})
