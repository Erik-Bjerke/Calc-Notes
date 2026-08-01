/**
 * Unit tests for server/api/share/[hash].get.js
 *
 * Focuses on the encrypted flag being returned correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
const mockOptionalAuth = vi.fn()

vi.mock('../../../utils/db.js', () => ({ query: (...args) => mockQuery(...args) }))
vi.mock('../../../utils/auth.js', () => ({
  optionalAuth: (...args) => mockOptionalAuth(...args),
}))
// Encode the token's key options into its string so tests can assert on them.
vi.mock('../../../utils/collabToken.js', () => ({
  signCollabToken: vi.fn(
    async (o) => `T:${o.access}:${o.kind}:${o.userId ?? ''}:${o.sid ? 'sid' : ''}`,
  ),
  toDocumentId: (url) => String(url).replace(/^automerge:/, ''),
}))
vi.mock('../../../utils/shareMembers.js', () => ({
  ensureShareMembersTable: vi.fn(async () => {}),
}))

globalThis.defineEventHandler = (handler) => handler
globalThis.getRouterParam = vi.fn()
globalThis.getHeader = vi.fn().mockReturnValue(null)
globalThis.createError = (opts) => {
  const err = new Error(opts.statusMessage)
  err.statusCode = opts.statusCode
  return err
}

const handler = (await import('../[hash].get.js')).default

beforeEach(() => {
  vi.clearAllMocks()
  mockOptionalAuth.mockResolvedValue(null)
})

// Helper: queue ALTER TABLE response, then the actual SELECT response
const mockSelectResult = (result) => {
  mockQuery
    .mockResolvedValueOnce({ rows: [] }) // ALTER TABLE ensurePasswordHintColumn
    .mockResolvedValueOnce(result) // SELECT shared_notes
}

describe('GET /api/share/:hash', () => {
  it('rejects invalid hash length', async () => {
    getRouterParam.mockReturnValue('short')
    await expect(handler({})).rejects.toThrow('Invalid share link')
  })

  it('rejects missing hash', async () => {
    getRouterParam.mockReturnValue(null)
    await expect(handler({})).rejects.toThrow('Invalid share link')
  })

  it('returns 404 for non-existent hash', async () => {
    getRouterParam.mockReturnValue('a'.repeat(32))
    mockSelectResult({ rows: [] })
    await expect(handler({})).rejects.toThrow('Shared note not found')
  })

  it('returns 410 for soft-deleted share', async () => {
    getRouterParam.mockReturnValue('a'.repeat(32))
    mockSelectResult({
      rows: [
        {
          id: 1,
          hash: 'a'.repeat(32),
          title: 't',
          description: '',
          tags: '[]',
          content: 'c',
          sharer_name: null,
          sharer_email: null,
          anonymous: true,
          expires_at: null,
          created_at: '2025-01-01',
          collect_analytics: false,
          deleted_at: '2025-01-02',
          encrypted: false,
        },
      ],
    })
    await expect(handler({})).rejects.toThrow('no longer available')
  })

  it('returns 410 for expired share', async () => {
    getRouterParam.mockReturnValue('a'.repeat(32))
    mockSelectResult({
      rows: [
        {
          id: 1,
          hash: 'a'.repeat(32),
          title: 't',
          description: '',
          tags: '[]',
          content: 'c',
          sharer_name: null,
          sharer_email: null,
          anonymous: true,
          expires_at: '2020-01-01T00:00:00Z',
          created_at: '2020-01-01',
          collect_analytics: false,
          deleted_at: null,
          encrypted: false,
        },
      ],
    })
    await expect(handler({})).rejects.toThrow('expired')
  })

  it('returns encrypted=true for encrypted shares', async () => {
    getRouterParam.mockReturnValue('b'.repeat(32))
    mockSelectResult({
      rows: [
        {
          id: 1,
          hash: 'b'.repeat(32),
          title: '{"iv":"a","ct":"b"}',
          description: '{"iv":"c","ct":"d"}',
          tags: '{"iv":"e","ct":"f"}',
          content: '{"iv":"g","ct":"h"}',
          sharer_name: null,
          sharer_email: null,
          anonymous: true,
          expires_at: '2099-01-01T00:00:00Z',
          created_at: '2025-01-01',
          collect_analytics: false,
          deleted_at: null,
          encrypted: true,
        },
      ],
    })

    const result = await handler({})
    expect(result.encrypted).toBe(true)
    expect(result.title).toBe('{"iv":"a","ct":"b"}')
    expect(result.content).toBe('{"iv":"g","ct":"h"}')
  })

  it('returns encrypted=false for legacy shares', async () => {
    getRouterParam.mockReturnValue('c'.repeat(32))
    mockSelectResult({
      rows: [
        {
          id: 1,
          hash: 'c'.repeat(32),
          title: 'Plain Title',
          description: 'desc',
          tags: '["tag"]',
          content: 'plain content',
          sharer_name: 'Alice',
          sharer_email: 'alice@example.com',
          anonymous: false,
          expires_at: '2099-01-01T00:00:00Z',
          created_at: '2025-01-01',
          collect_analytics: false,
          deleted_at: null,
          encrypted: false,
        },
      ],
    })

    const result = await handler({})
    expect(result.encrypted).toBe(false)
    expect(result.title).toBe('Plain Title')
    expect(result.sharer).toEqual({ name: 'Alice', email: 'alice@example.com' })
  })

  it('hides sharer info for anonymous shares', async () => {
    getRouterParam.mockReturnValue('d'.repeat(32))
    mockSelectResult({
      rows: [
        {
          id: 1,
          hash: 'd'.repeat(32),
          title: 'Anon',
          description: '',
          tags: '[]',
          content: 'c',
          sharer_name: 'Secret',
          sharer_email: 'secret@example.com',
          anonymous: true,
          expires_at: '2099-01-01T00:00:00Z',
          created_at: '2025-01-01',
          collect_analytics: false,
          deleted_at: null,
          encrypted: false,
        },
      ],
    })

    const result = await handler({})
    expect(result.sharer).toBeNull()
  })
})

describe('GET /api/share/:hash — collaborative access enforcement', () => {
  const baseCollabRow = {
    id: 1,
    hash: 'e'.repeat(32),
    user_id: 1,
    title: 't',
    description: '',
    tags: '[]',
    content: 'c',
    sharer_name: null,
    sharer_email: null,
    anonymous: true,
    expires_at: '2099-01-01T00:00:00Z',
    created_at: '2025-01-01',
    collect_analytics: false,
    deleted_at: null,
    encrypted: false,
    password_hint: null,
    mode: 'collaborative',
    allow_guests: false,
    automerge_url: 'automerge:doc123',
    access: 'public',
  }

  // SQL-matching mock so the collaborative branch's extra queries resolve.
  const routeCollab = ({ row, member = null, userName = 'User' }) => {
    mockQuery.mockImplementation((sql) => {
      if (sql.includes('FROM shared_notes')) return Promise.resolve({ rows: [row] })
      if (sql.includes('FROM share_members'))
        return Promise.resolve({ rows: member ? [member] : [] })
      if (sql.includes('FROM users')) return Promise.resolve({ rows: [{ name: userName }] })
      return Promise.resolve({ rows: [] })
    })
  }

  beforeEach(() => getRouterParam.mockReturnValue('e'.repeat(32)))

  it('owner gets a write token even on a private share', async () => {
    mockOptionalAuth.mockResolvedValue({ userId: 1 }) // == row.user_id
    routeCollab({ row: { ...baseCollabRow, access: 'private' } })
    const result = await handler({})
    expect(result.collabToken).toBe('T:write:user:1:')
    expect(result.accessDenied).toBeUndefined()
  })

  it('private share denies a non-member account', async () => {
    mockOptionalAuth.mockResolvedValue({ userId: 5 })
    routeCollab({ row: { ...baseCollabRow, access: 'private' }, member: null })
    const result = await handler({})
    expect(result.collabToken).toBeNull()
    expect(result.accessDenied).toBe(true)
  })

  it('private share grants an active viewer member a read token', async () => {
    mockOptionalAuth.mockResolvedValue({ userId: 5 })
    routeCollab({
      row: { ...baseCollabRow, access: 'private' },
      member: { id: 9, role: 'viewer', status: 'active' },
    })
    const result = await handler({})
    expect(result.role).toBe('viewer')
    expect(result.collabToken).toBe('T:read:user:5:')
  })

  it('public share issues a guest token with a session id when guests allowed', async () => {
    mockOptionalAuth.mockResolvedValue(null)
    routeCollab({ row: { ...baseCollabRow, access: 'public', allow_guests: true } })
    const result = await handler({})
    expect(result.guestSid).toMatch(/^[a-f0-9]{16}$/)
    expect(result.collabToken).toBe('T:write:guest::sid')
  })

  it('public share without guests requires an account for anonymous visitors', async () => {
    mockOptionalAuth.mockResolvedValue(null)
    routeCollab({ row: { ...baseCollabRow, access: 'public', allow_guests: false } })
    const result = await handler({})
    expect(result.collabToken).toBeNull()
    expect(result.requiresAccount).toBe(true)
  })

  it('public share auto-admits a signed-in non-member as editor', async () => {
    mockOptionalAuth.mockResolvedValue({ userId: 5 })
    routeCollab({ row: { ...baseCollabRow, access: 'public' }, member: null })
    const result = await handler({})
    expect(result.role).toBe('editor')
    expect(result.collabToken).toBe('T:write:user:5:')
    // an INSERT into share_members (auto-add) should have been issued
    const inserted = mockQuery.mock.calls.some((c) => c[0].includes('INSERT INTO share_members'))
    expect(inserted).toBe(true)
  })
})
