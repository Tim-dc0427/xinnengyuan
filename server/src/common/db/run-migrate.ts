import { db } from '../../config/database.js'

async function main() {
  try {
    await db.migrate.latest()
    console.log('Migrations completed successfully.')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
