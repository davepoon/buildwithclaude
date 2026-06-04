import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

function createDb() {
  // Pool size defaults to postgres-js's 10; override with PG_POOL_MAX (e.g. a
  // small value for local scripts so they don't exhaust the shared connection
  // limit while a dev server is running).
  const client = postgres(process.env.POSTGRES_URL!, {
    max: process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : 10,
  })
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
