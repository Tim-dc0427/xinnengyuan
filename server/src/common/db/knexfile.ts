import type { Knex } from 'knex'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: path.join(__dirname, '..', '..', '..', 'data.db'),
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
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'ts',
  },
}

export default config
