/**
 * Numori — Automerge collaborative sync service (CLI entrypoint).
 *
 * Reads configuration from the environment and starts the sync server.
 *
 *   COLLAB_PORT   port to listen on (default 3030)
 *   COLLAB_HOST   interface to bind (default 0.0.0.0)
 *
 * Storage and authorization are wired in by later tasks:
 *   - Task 5 attaches a PostgreSQL storage adapter for durability.
 *   - Task 7 attaches token/room-based authentication + sharePolicy.
 */
import { createCollabServer } from './server.mjs'
import { createStorage } from './storage/index.mjs'
import { createAuth } from './auth.mjs'

const PORT = parseInt(process.env.COLLAB_PORT || '3030', 10)
const HOST = process.env.COLLAB_HOST || '0.0.0.0'

async function main() {
  const storage = await createStorage()
  const { sharePolicy, authenticate } = await createAuth()

  const evictIdleAfterMs = parseInt(process.env.COLLAB_IDLE_EVICT_MS || '300000', 10)
  const { listen, close } = createCollabServer({
    storage,
    sharePolicy,
    authenticate,
    evictIdleAfterMs,
  })
  const addr = await listen(PORT, HOST)
  const where =
    typeof addr === 'object' && addr ? `${addr.address}:${addr.port}` : `${HOST}:${PORT}`
  console.warn(`[collab] Numori sync service listening on ${where}`)

  const shutdown = async (signal) => {
    console.warn(`[collab] ${signal} received, shutting down…`)
    await close()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('[collab] fatal:', err)
  process.exit(1)
})
