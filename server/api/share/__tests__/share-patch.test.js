/**
 * Unit tests for server/api/share/[hash].patch.js — owner updates share settings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
const mockOptionalAuth = vi.fn()

vi.mock('../../../utils/db.js', () => ({ query: (...args) => mockQuery(...args) }))
vi.mock('../../../utils/auth.js', () => ({
  optionalAuth: (...args) => mockOptionalAuth(...args),
}))

globalThis.defineEventHandler = (handler) => handler
globalThis.readBody = vi.fn()
globalThis.getRouterParam = vi.fn(() => 'a'.repeat(32))
globalThis.getQuery = vi.fn(() => ({}))
globalThis.getHeader = vi.fn(() => null)
globalThis.createError = (opts) => {
  const err = new Error(opts.statusMessage)
  err.statusCode = opts.statusCode
  return err
}

const handler = (await import('../[hash].patch.js')).default

// Find the UPDATE call (skips the idempotent ALTER TABLE).
const findUpdateCall = () =>
  mockQuery.mock.calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE shared_notes'))

beforeEach(() => {
  vi.clearAllMocks()
  mockOptionalAuth.mockResolvedValue({ userId: 7 })
  getRouterParam.mockReturnValue('a'.repeat(32))
  getQuery.mockReturnValue({})
  getHeader.mockReturnValue(null)
  // ALTER TABLE + UPDATE both resolve; UPDATE returns an updated row by default
  mockQuery.mockResolvedValue({
    rows: [
      {
        hash: 'a'.repeat(32),
        mode: 'collaborative',
        allow_guests: true,
        access: 'public',
        expires_at: null,
      },
    ],
  })
})

describe('PATCH /api/share/:hash', () => {
  it('rejects when neither auth nor delete token is present', async () => {
    mockOptionalAuth.mockResolvedValue(null)
    readBody.mockResolvedValue({ allowGuests: true })
    await expect(handler({})).rejects.toThrow('Authentication or delete token required')
  })

  it('rejects an empty update', async () => {
    readBody.mockResolvedValue({})
    await expect(handler({})).rejects.toThrow('No settings to update')
  })

  it('updates allowGuests and access, scoped to the owner', async () => {
    readBody.mockResolvedValue({ allowGuests: false, access: 'private' })

    const result = await handler({})

    const [sql, params] = findUpdateCall()
    expect(sql).toContain('allow_guests = $2')
    expect(sql).toContain('access = $3')
    expect(sql).toContain('user_id = $4')
    expect(params).toEqual(['a'.repeat(32), false, 'private', 7])
    expect(result.access).toBe('public') // from mocked RETURNING row
  })

  it('clears expiry when expiresInDays is null', async () => {
    readBody.mockResolvedValue({ expiresInDays: null })

    await handler({})

    const [sql, params] = findUpdateCall()
    expect(sql).toContain('expires_at = $2')
    expect(params[1]).toBeNull()
  })

  it('sets an expiry from a positive expiresInDays (no 30-day cap)', async () => {
    readBody.mockResolvedValue({ expiresInDays: 120 })

    await handler({})

    const params = findUpdateCall()[1]
    const diffDays = (new Date(params[1]) - new Date()) / 86400000
    expect(diffDays).toBeGreaterThan(119)
    expect(diffDays).toBeLessThanOrEqual(121)
  })

  it('authorizes anonymous owners via the delete token hash', async () => {
    mockOptionalAuth.mockResolvedValue(null)
    getHeader.mockReturnValue('secret-delete-token')
    readBody.mockResolvedValue({ allowGuests: true })

    await handler({})

    const [sql, params] = findUpdateCall()
    expect(sql).toContain('delete_token_hash = $3')
    // sha256('secret-delete-token'), not the raw token
    expect(params[2]).toMatch(/^[a-f0-9]{64}$/)
    expect(params[2]).not.toBe('secret-delete-token')
  })

  it('sets automerge_url when switching to collaborative', async () => {
    readBody.mockResolvedValue({ mode: 'collaborative', automergeUrl: 'automerge:doc9' })

    await handler({})

    const [sql, params] = findUpdateCall()
    expect(sql).toContain('mode = $2')
    expect(sql).toContain('automerge_url = $3')
    expect(params).toEqual(['a'.repeat(32), 'collaborative', 'automerge:doc9', 7])
  })

  it('freezes content when switching to read-only', async () => {
    readBody.mockResolvedValue({ mode: 'read-only', content: 'frozen snapshot' })

    await handler({})

    const [sql, params] = findUpdateCall()
    expect(sql).toContain('content = $3')
    expect(params[2]).toBe('frozen snapshot')
  })

  it('404s when no owned, active row matches', async () => {
    readBody.mockResolvedValue({ allowGuests: true })
    // ALTER resolves, UPDATE returns no rows
    mockQuery.mockReset()
    mockQuery.mockResolvedValueOnce({ rows: [] }) // ALTER TABLE
    mockQuery.mockResolvedValueOnce({ rows: [] }) // UPDATE — no match
    await expect(handler({})).rejects.toThrow('not found or not owned')
  })
})
