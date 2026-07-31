/**
 * PostgreSQL connection pool for the collab sync service.
 *
 * Uses the same POSTGRES_* environment variables as the main Nitro API so both
 * services share one database instance. The collab service stores Automerge
 * document chunks (see storage/postgres.mjs); it does not touch the API's
 * tables.
 */
import pg from 'pg'

const { Pool } = pg

let pool

export function useDb() {
  if (!pool) {
    const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB } =
      process.env
    if (!POSTGRES_USER || !POSTGRES_HOST || !POSTGRES_DB) {
      throw new Error('[collab] Missing required POSTGRES_* environment variables')
    }
    pool = new Pool({
      user: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
      host: POSTGRES_HOST,
      port: parseInt(POSTGRES_PORT || '5432', 10),
      database: POSTGRES_DB,
      max: 10,
    })
  }
  return pool
}

export async function query(text, params) {
  return useDb().query(text, params)
}

/** Close the pool (used by tests and graceful shutdown). */
export async function closeDb() {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}
