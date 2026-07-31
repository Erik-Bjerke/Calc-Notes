import { describe, it, expect, afterAll } from 'vitest'
import { Repo } from '@automerge/automerge-repo'
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import * as A from '@automerge/automerge/slim'

// Point the collab db at the throwaway test Postgres (see README/test setup).
// These are set before any db.mjs query runs (the pool is created lazily).
process.env.POSTGRES_HOST = process.env.TEST_PG_HOST || '127.0.0.1'
process.env.POSTGRES_PORT = process.env.TEST_PG_PORT || '5433'
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'user'
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'password'
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'db'

const { PostgresStorageAdapter, ensureSchema } = await import('../storage/postgres.mjs')
const { query, closeDb } = await import('../db.mjs')
const { createCollabServer } = await import('../server.mjs')

// Detect whether a Postgres is actually reachable; skip the suite if not so the
// wider test run isn't blocked in environments without the test database.
async function detectPg() {
  try {
    await ensureSchema()
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}
const pgAvailable = await detectPg()

const waitFor = async (predicate, timeout = 4000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await predicate()) return true
    await new Promise((r) => setTimeout(r, 25))
  }
  return predicate()
}

describe.skipIf(!pgAvailable)('PostgreSQL storage adapter', () => {
  const adapter = new PostgresStorageAdapter()

  afterAll(async () => {
    await adapter.removeRange(['test-doc'])
    await closeDb()
  })

  it('saves and loads a single chunk', async () => {
    await adapter.save(['test-doc', 'snapshot', 'h1'], new Uint8Array([1, 2, 3]))
    const got = await adapter.load(['test-doc', 'snapshot', 'h1'])
    expect(Array.from(got)).toEqual([1, 2, 3])
  })

  it('loads all chunks under a key prefix', async () => {
    await adapter.save(['test-doc', 'incremental', 'a'], new Uint8Array([10]))
    await adapter.save(['test-doc', 'incremental', 'b'], new Uint8Array([20]))
    const chunks = await adapter.loadRange(['test-doc', 'incremental'])
    const values = chunks.map((c) => Array.from(c.data)[0]).sort((x, y) => x - y)
    expect(values).toEqual([10, 20])
  })

  it('removes a range of chunks', async () => {
    await adapter.save(['test-doc', 'wipe', '1'], new Uint8Array([1]))
    await adapter.save(['test-doc', 'wipe', '2'], new Uint8Array([2]))
    await adapter.removeRange(['test-doc', 'wipe'])
    const chunks = await adapter.loadRange(['test-doc', 'wipe'])
    expect(chunks).toHaveLength(0)
  })

  it('does not leak between sibling prefixes', async () => {
    await adapter.save(['test-doc', 'snapshot', 'x'], new Uint8Array([9]))
    const inc = await adapter.loadRange(['test-doc', 'incremental'])
    // "snapshot" chunk must not appear under the "incremental" prefix.
    expect(inc.every((c) => c.key[1] === 'incremental')).toBe(true)
  })
})

describe.skipIf(!pgAvailable)('document durability across server restart', () => {
  let port
  let expectedText

  afterAll(async () => {
    await closeDb().catch(() => {})
  })

  it(
    'recovers a document from Postgres after the sync server restarts',
    { timeout: 20000 },
    async () => {
      expectedText = `durable-${Date.now()}`

      // ── Session 1: server persists a client's document ──────────────────
      const server1 = createCollabServer({ storage: new PostgresStorageAdapter() })
      const addr = await server1.listen(0, '127.0.0.1')
      port = addr.port

      const adapter1 = new WebSocketClientAdapter(`ws://localhost:${port}`)
      const client1 = new Repo({ network: [adapter1] })
      const handle1 = client1.create({ text: '' })
      handle1.change((d) => A.splice(d, ['text'], 0, 0, expectedText))
      const url = handle1.url

      // Wait until the server has received the document over the network.
      await waitFor(async () => {
        const sh = await server1.repo.find(url).catch(() => null)
        return sh?.doc()?.text === expectedText
      }, 8000)
      await server1.repo.flush()
      adapter1.disconnect()
      await server1.close()

      // ── Session 2: a fresh server + client reconstruct it from storage ──
      const server2 = createCollabServer({ storage: new PostgresStorageAdapter() })
      const addr2 = await server2.listen(0, '127.0.0.1')

      const adapter2 = new WebSocketClientAdapter(`ws://localhost:${addr2.port}`)
      const client2 = new Repo({ network: [adapter2] })
      const handle2 = await client2.find(url)
      const recovered = await waitFor(() => handle2.doc()?.text === expectedText, 8000)

      expect(recovered).toBe(true)
      expect(handle2.doc().text).toBe(expectedText)

      adapter2.disconnect()
      await server2.close()
    },
  )
})
