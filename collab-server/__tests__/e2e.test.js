import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Repo } from '@automerge/automerge-repo'
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import * as A from '@automerge/automerge/slim'

// Point the collab db at the throwaway test Postgres before importing db.mjs.
process.env.POSTGRES_HOST = process.env.TEST_PG_HOST || '127.0.0.1'
process.env.POSTGRES_PORT = process.env.TEST_PG_PORT || '5433'
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'user'
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'password'
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'db'

const { createCollabServer } = await import('../server.mjs')
const { PostgresStorageAdapter, ensureSchema } = await import('../storage/postgres.mjs')
const { query, closeDb } = await import('../db.mjs')

const waitFor = async (p, ms = 5000) => {
  const s = Date.now()
  while (Date.now() - s < ms) {
    if (await p()) return true
    await new Promise((r) => setTimeout(r, 25))
  }
  return p()
}

let pgAvailable = false
try {
  await ensureSchema()
  await query('SELECT 1')
  pgAvailable = true
} catch {
  pgAvailable = false
}

describe('E2E: convergence, offline-reconnect, and idle eviction', () => {
  const adapters = []
  const client = (port) => {
    const a = new WebSocketClientAdapter(`ws://localhost:${port}`)
    adapters.push(a)
    return { repo: new Repo({ network: [a] }), adapter: a }
  }

  // Node's `ws` throws asynchronously when a CONNECTING socket is closed
  // (disconnect during reconnect). This is a Node-only artifact — browsers just
  // fire close/error — so we swallow that specific benign message while still
  // surfacing any genuinely unexpected error.
  const swallowBenignWsClose = (err) => {
    if (/closed before the connection is established/i.test(err?.message || '')) return
    setImmediate(() => {
      throw err
    })
  }

  beforeAll(() => {
    process.on('uncaughtException', swallowBenignWsClose)
  })

  afterAll(async () => {
    for (const a of adapters) {
      try {
        a.disconnect()
      } catch {
        /* ignore */
      }
    }
    process.off('uncaughtException', swallowBenignWsClose)
  })

  it('converges three concurrent editors on one document', async () => {
    const server = createCollabServer()
    const { port } = await server.listen(0, '127.0.0.1')

    const a = client(port)
    const b = client(port)
    const c = client(port)

    const hA = a.repo.create({ text: '' })
    hA.change((d) => A.splice(d, ['text'], 0, 0, 'A'))
    const url = hA.url
    const hB = await b.repo.find(url)
    const hC = await c.repo.find(url)

    hB.change((d) => A.splice(d, ['text'], d.text.length, 0, 'B'))
    hC.change((d) => A.splice(d, ['text'], d.text.length, 0, 'C'))

    const converged = await waitFor(() => {
      const ta = hA.doc()?.text
      return ta && ta.length === 3 && ta === hB.doc()?.text && ta === hC.doc()?.text
    })
    expect(converged).toBe(true)
    for (const ch of ['A', 'B', 'C']) expect(hA.doc().text).toContain(ch)

    await server.close()
  })

  it('merges edits made while a peer was disconnected', async () => {
    const server = createCollabServer()
    const { port } = await server.listen(0, '127.0.0.1')

    const a = client(port)
    const hA = a.repo.create({ text: 'base' })
    const url = hA.url

    const b = client(port)
    const hB = await b.repo.find(url)
    await waitFor(() => hB.doc()?.text === 'base')

    // B goes offline and edits locally.
    b.adapter.disconnect()
    hB.change((d) => A.splice(d, ['text'], 4, 0, '-B'))
    // A edits concurrently while B is away.
    hA.change((d) => A.splice(d, ['text'], 0, 0, 'A-'))

    // B reconnects; both sides converge and neither edit is lost.
    b.repo.networkSubsystem.addNetworkAdapter(new WebSocketClientAdapter(`ws://localhost:${port}`))
    const merged = await waitFor(() => {
      const t = hA.doc()?.text
      return t && t === hB.doc()?.text && t.includes('A-') && t.includes('-B')
    })
    expect(merged).toBe(true)

    await server.close()
  })

  it.skipIf(!pgAvailable)(
    'evicts idle documents from memory but keeps them durable',
    { timeout: 40000 },
    async () => {
      const server = createCollabServer({
        storage: new PostgresStorageAdapter(),
        evictIdleAfterMs: 200,
      })
      const { port } = await server.listen(0, '127.0.0.1')

      const a = client(port)
      const hA = a.repo.create({ text: '' })
      hA.change((d) => A.splice(d, ['text'], 0, 0, 'evict-me'))
      const url = hA.url
      const docId = url.replace('automerge:', '')

      // Wait for the server to hold the doc, then the client leaves.
      await waitFor(async () => {
        const sh = await server.repo.find(url).catch(() => null)
        return sh?.doc()?.text === 'evict-me'
      })
      a.adapter.disconnect()

      // After the idle TTL the document is evicted from the in-memory cache.
      // Generous window: under parallel test load with a shared Postgres the
      // eviction sweep + flush can take longer than in isolation.
      const evicted = await waitFor(() => !(docId in server.repo.handles), 15000)
      expect(evicted).toBe(true)

      // But it is still durable: its chunks remain persisted in Postgres, so a
      // future request can reload it. (We assert storage directly rather than a
      // fresh network round-trip, which is flaky under parallel test load.)
      const rows = await query('SELECT count(*)::int AS n FROM collab_chunks WHERE key[1] = $1', [
        docId,
      ])
      expect(rows.rows[0].n).toBeGreaterThan(0)

      await server.close()
      await closeDb()
    },
  )
})
