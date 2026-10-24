import { client, db } from './client'
import { migrateAndSeed } from './migrate'

await migrateAndSeed(db)
console.log('migrations applied, presets seeded')
await client.end()
