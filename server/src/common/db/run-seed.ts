import { db } from '../../config/database.js'

async function main() {
  try {
    await db.seed.run()
    console.log('Seeds completed successfully.')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
