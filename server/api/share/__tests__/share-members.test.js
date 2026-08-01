/**
 * Unit tests for share member endpoints:
 *   GET    /api/share/:hash/members
 *   POST   /api/share/:hash/members
 *   DELETE /api/share/:hash/members/:memberId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
const mockRequireAuth = vi.fn()

vi.mock('../../../utils/db.js', () => ({ query: (...args) => mockQuery(...args) }))
vi.mock('../../../utils/auth.js', () => ({ requireAuth: (...args) => mockRequireAuth(...args) }))

globalThis.defineEventHandler = (handler) => handler
globalThis.readBody = vi.fn()
globalThis.createError = (opts) => {
  const err = new Error(opts.statusMessage)
  err.statusCode = opts.statusCode
  return err
}

let routeParams = { hash: 'a'.repeat(32) }
globalThis.getRouterParam = vi.fn((_event, name) => routeParams[name])

const listHandler = (await import('../[hash]/members.get.js')).default
const addHandler = (await import('../[hash]/members.post.js')).default
const revokeHandler = (await import('../[hash]/members/[memberId].delete.js')).default

// SQL-matching mock so the idempotent ensure* CREATE/INDEX calls don't shift order.
const OWNED_SHARE = { id: 10, user_id: 1, mode: 'collaborative', access: 'private' }
function routeQueries(overrides = {}) {
  const map = {
    ownedShare: { rows: [OWNED_SHARE] },
    members: { rows: [] },
    user: { rows: [] },
    upsert: { rows: [] },
    revoke: { rows: [] },
    ...overrides,
  }
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM shared_notes')) return Promise.resolve(map.ownedShare)
    if (sql.includes('FROM share_members')) return Promise.resolve(map.members)
    if (sql.includes('FROM users')) return Promise.resolve(map.user)
    if (sql.includes('INSERT INTO share_members')) return Promise.resolve(map.upsert)
    if (sql.includes('UPDATE share_members')) return Promise.resolve(map.revoke)
    return Promise.resolve({ rows: [] })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ userId: 1 })
  routeParams = { hash: 'a'.repeat(32), memberId: '5' }
})

describe('GET /api/share/:hash/members', () => {
  it('lists members for the owner', async () => {
    routeQueries({
      members: {
        rows: [
          { id: 1, user_id: 2, email: 'b@x.com', role: 'editor', status: 'active', name: 'Bob' },
        ],
      },
    })
    const result = await listHandler({})
    expect(result).toEqual([
      { id: 1, userId: 2, email: 'b@x.com', name: 'Bob', role: 'editor', status: 'active' },
    ])
  })

  it('404s for a non-owner', async () => {
    routeQueries({ ownedShare: { rows: [{ id: 10, user_id: 999 }] } })
    await expect(listHandler({})).rejects.toThrow('not owned by you')
  })
})

describe('POST /api/share/:hash/members', () => {
  it('requires an email', async () => {
    routeQueries()
    readBody.mockResolvedValue({})
    await expect(addHandler({})).rejects.toThrow('Email is required')
  })

  it('404s when the email has no account', async () => {
    routeQueries({ user: { rows: [] } })
    readBody.mockResolvedValue({ email: 'ghost@x.com' })
    await expect(addHandler({})).rejects.toThrow('No account found')
  })

  it('adds an existing account as an editor by default', async () => {
    routeQueries({
      user: { rows: [{ id: 2, name: 'Bob' }] },
      upsert: { rows: [{ id: 1, user_id: 2, email: 'b@x.com', role: 'editor', status: 'active' }] },
    })
    readBody.mockResolvedValue({ email: 'B@X.com' })
    const result = await addHandler({})
    expect(result).toMatchObject({ userId: 2, role: 'editor', status: 'active', name: 'Bob' })
    // email normalised to lowercase in the INSERT params
    const insertCall = mockQuery.mock.calls.find((c) => c[0].includes('INSERT INTO share_members'))
    expect(insertCall[1]).toEqual([10, 2, 'b@x.com', 'editor'])
  })

  it('honours a viewer role', async () => {
    routeQueries({
      user: { rows: [{ id: 2, name: 'Bob' }] },
      upsert: { rows: [{ id: 1, user_id: 2, email: 'b@x.com', role: 'viewer', status: 'active' }] },
    })
    readBody.mockResolvedValue({ email: 'b@x.com', role: 'viewer' })
    const result = await addHandler({})
    expect(result.role).toBe('viewer')
  })

  it('rejects adding yourself', async () => {
    routeQueries({ user: { rows: [{ id: 1, name: 'Me' }] } })
    readBody.mockResolvedValue({ email: 'me@x.com' })
    await expect(addHandler({})).rejects.toThrow('already own this share')
  })
})

describe('DELETE /api/share/:hash/members/:memberId', () => {
  it('revokes a member', async () => {
    routeQueries({ revoke: { rows: [{ id: 5, user_id: 2 }] } })
    const result = await revokeHandler({})
    expect(result).toEqual({ revoked: true, memberId: 5, userId: 2 })
    const updateCall = mockQuery.mock.calls.find((c) => c[0].includes('UPDATE share_members'))
    expect(updateCall[0]).toContain("status = 'revoked'")
    expect(updateCall[1]).toEqual(['5', 10])
  })

  it('404s when the member does not belong to the share', async () => {
    routeQueries({ revoke: { rows: [] } })
    await expect(revokeHandler({})).rejects.toThrow('Member not found')
  })

  it('404s for a non-owner', async () => {
    routeQueries({ ownedShare: { rows: [{ id: 10, user_id: 999 }] } })
    await expect(revokeHandler({})).rejects.toThrow('not owned by you')
  })
})
