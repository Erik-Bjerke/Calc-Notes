/**
 * DB-backed authorization for the collab server (COLLAB_DB_AUTHZ=true).
 *
 * The db.mjs pool is mocked so we can drive share/member state without a real
 * Postgres. Verifies the access model, expiry, membership and guest rules that
 * gate a WebSocket upgrade.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { createAuth } from '../auth.mjs'
import { signCollabToken } from '../../server/utils/collabToken.js'

const mockQuery = vi.fn()
vi.mock('../db.mjs', () => ({ query: (...args) => mockQuery(...args) }))

const SECRET = 'test-collab-secret'
const DOC = 'doc-xyz'

// Route the two query shapes (share lookup, member lookup) by SQL text.
function dbState({ share, member }) {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM shared_notes')) return Promise.resolve({ rows: share ? [share] : [] })
    if (sql.includes('FROM share_members')) return Promise.resolve({ rows: member ? [member] : [] })
    return Promise.resolve({ rows: [] })
  })
}

const reqWithToken = async (opts) => {
  const token = await signCollabToken({ documentId: DOC, ...opts })
  return { url: `/collab?token=${encodeURIComponent(token)}` }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = SECRET
  process.env.COLLAB_DB_AUTHZ = 'true'
  delete process.env.COLLAB_REQUIRE_AUTH
})

afterAll(() => {
  delete process.env.COLLAB_DB_AUTHZ
})

describe('authenticate() with DB authorization', () => {
  it('accepts the owner even on a private share', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'private',
        allow_guests: false,
        expires_at: null,
        deleted_at: null,
      },
    })
    const { authenticate } = await createAuth()
    const req = await reqWithToken({ kind: 'user', userId: 7 })
    expect(await authenticate(req)).toBe(true)
    expect(req.collab).toMatchObject({ documentId: DOC, userId: 7, kind: 'user' })
  })

  it('rejects a non-member account on a private share', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'private',
        allow_guests: false,
        expires_at: null,
        deleted_at: null,
      },
      member: null,
    })
    const { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 99 }))).toBe(false)
  })

  it('accepts an active member on a private share', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'private',
        allow_guests: false,
        expires_at: null,
        deleted_at: null,
      },
      member: { status: 'active' },
    })
    const { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 99 }))).toBe(true)
  })

  it('rejects a revoked member on a private share', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'private',
        allow_guests: false,
        expires_at: null,
        deleted_at: null,
      },
      member: { status: 'revoked' },
    })
    const { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 99 }))).toBe(false)
  })

  it('rejects a guest on a private share', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'private',
        allow_guests: true,
        expires_at: null,
        deleted_at: null,
      },
    })
    const { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'guest', sid: 'g1' }))).toBe(false)
  })

  it('accepts a guest on a public share only when guests are allowed', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'public',
        allow_guests: true,
        expires_at: null,
        deleted_at: null,
      },
    })
    let { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'guest', sid: 'g1' }))).toBe(true)

    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'public',
        allow_guests: false,
        expires_at: null,
        deleted_at: null,
      },
    })
    ;({ authenticate } = await createAuth())
    expect(await authenticate(await reqWithToken({ kind: 'guest', sid: 'g1' }))).toBe(false)
  })

  it('accepts any account on a public share', async () => {
    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'public',
        allow_guests: false,
        expires_at: null,
        deleted_at: null,
      },
    })
    const { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 99 }))).toBe(true)
  })

  it('rejects when the share is missing, deleted, or expired', async () => {
    const { authenticate } = await createAuth()

    dbState({ share: null })
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 7 }))).toBe(false)

    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'public',
        allow_guests: true,
        expires_at: null,
        deleted_at: '2025-01-01',
      },
    })
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 7 }))).toBe(false)

    dbState({
      share: {
        id: 1,
        user_id: 7,
        access: 'public',
        allow_guests: true,
        expires_at: '2000-01-01T00:00:00Z',
        deleted_at: null,
      },
    })
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 7 }))).toBe(false)
  })

  it('fails open on an unexpected DB error', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'))
    const { authenticate } = await createAuth()
    expect(await authenticate(await reqWithToken({ kind: 'user', userId: 7 }))).toBe(true)
  })
})
