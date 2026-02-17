import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

function createDb() {
  const client = postgres(process.env.POSTGRES_URL!)
  return drizzle(client, { schema })
}

type DB = ReturnType<typeof createDb>

let _db: DB | undefined

// Lazy-initialized proxy: defers postgres() connection from module-load time
// to first property access. This allows next build to import the module
// without requiring POSTGRES_URL at build time.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    if (!_db) _db = createDb()
    return Reflect.get(_db, prop, receiver)
  },
})

export type DbClient = typeof db
