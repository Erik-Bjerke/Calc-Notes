import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Repo } from '@automerge/automerge-repo'
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import * as A from '@automerge/automerge/slim'
import { WebSocket } from 'ws'
import { verifyJwt } from '../jwt.mjs'
import { createAuth } from '../auth.mjs'
import { createCollabServer } from '../server.mjs'
// Reuse the API's real signer to prove cross-service wire compatibility.
import { signCollabToken } from '../../server/utils/collabToken.js'
import { signJwt } from '../../server/utils/auth.js'

const SECRET = 'test-collab-secret'

const waitFor = async (p, ms = 3000) => {
  const s = Date.now()
  while (Date.now() - s < ms) {
    if (await p()) return true
    await new Promise((r) => setTimeout(r, 25))
  }
  return p()
}

describe('collab JWT verification (wire compatibility with the API)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET
  })

  it('verifies a token minted by the API signer', async () => {
    const token = await signCollabToken({ documentId: 'doc-1', name: 'X' })
    const payload = verifyJwt(token, SECRET)
    expect(payload.documentId).toBe('doc-1')
    expect(payload.purpose).toBe('collab')
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signJwt({ purpose: 'collab' }, 'wrong-secret', 60)
    expect(() => verifyJwt(token, SECRET)).toThrow(/signature/i)
  })

  it('rejects an expired token', async () => {
    const token = await signJwt({ purpose: 'collab' }, SECRET, -10)
    expect(() => verifyJwt(token, SECRET)).toThrow(/expired/i)
  })
})

describe('authenticate() gate', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET
    delete process.env.COLLAB_REQUIRE_AUTH
  })

  const reqWith = (query) => ({ url: `/collab${query}` })

  it('accepts a valid collab token in the query', async () => {
    const { authenticate } = await createAuth()
    const token = await signCollabToken({ documentId: 'd' })
    expect(authenticate(reqWith(`?token=${encodeURIComponent(token)}`))).toBe(true)
  })

  it('rejects a missing token', async () => {
    const { authenticate } = await createAuth()
    expect(authenticate(reqWith(''))).toBe(false)
  })

  it('rejects a non-collab JWT', async () => {
    const { authenticate } = await createAuth()
    const token = await signJwt({ userId: 1 }, SECRET, 60)
    expect(authenticate(reqWith(`?token=${token}`))).toBe(false)
  })

  it('is open when COLLAB_REQUIRE_AUTH=false', async () => {
    process.env.COLLAB_REQUIRE_AUTH = 'false'
    try {
      const { authenticate } = await createAuth()
      expect(authenticate(reqWith(''))).toBe(true)
    } finally {
      delete process.env.COLLAB_REQUIRE_AUTH
    }
  })
})

describe('authenticated sync end-to-end', () => {
  let server
  let port
  const adapters = []

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET
    delete process.env.COLLAB_REQUIRE_AUTH
    const { authenticate, sharePolicy } = await createAuth()
    server = createCollabServer({ authenticate, sharePolicy })
    const addr = await server.listen(0, '127.0.0.1')
    port = addr.port
  })

  afterAll(async () => {
    for (const a of adapters) {
      try {
        a.disconnect()
      } catch {
        /* ignore */
      }
    }
    await server.close()
  })

  it('admits authenticated clients and denies data to unauthenticated ones', async () => {
    // Two authenticated clients converge on a shared document.
    const tokenA = await signCollabToken({ documentId: 'room', name: 'A' })
    const tokenB = await signCollabToken({ documentId: 'room', name: 'B' })
    const adA = new WebSocketClientAdapter(
      `ws://localhost:${port}?token=${encodeURIComponent(tokenA)}`,
    )
    const adB = new WebSocketClientAdapter(
      `ws://localhost:${port}?token=${encodeURIComponent(tokenB)}`,
    )
    adapters.push(adA, adB)
    const repoA = new Repo({ network: [adA] })
    const repoB = new Repo({ network: [adB] })

    const handleA = repoA.create({ text: '' })
    handleA.change((d) => A.splice(d, ['text'], 0, 0, 'secure'))
    const url = handleA.url
    const handleB = await repoB.find(url)
    const ok = await waitFor(() => handleB.doc()?.text === 'secure')
    expect(ok).toBe(true)
  })

  it('refuses the WebSocket upgrade for a connection with no token', async () => {
    const outcome = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`)
      ws.on('open', () => resolve('opened'))
      ws.on('unexpected-response', (_req, res) => resolve(`status:${res.statusCode}`))
      ws.on('error', () => resolve('error'))
      setTimeout(() => resolve('timeout'), 1500)
    })
    // The upgrade is rejected with 401 (never "opened").
    expect(outcome).toBe('status:401')
  })

  it('accepts the WebSocket upgrade for a connection with a valid token', async () => {
    const token = await signCollabToken({ documentId: 'room', name: 'C' })
    const outcome = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${encodeURIComponent(token)}`)
      ws.on('open', () => {
        ws.close()
        resolve('opened')
      })
      ws.on('unexpected-response', (_req, res) => resolve(`status:${res.statusCode}`))
      ws.on('error', () => resolve('error'))
      setTimeout(() => resolve('timeout'), 1500)
    })
    expect(outcome).toBe('opened')
  })
})
