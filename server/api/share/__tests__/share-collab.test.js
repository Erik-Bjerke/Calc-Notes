/**
 * Task 6 verification: collaborative share creation + join-token issuance.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

const mockQuery = vi.fn()
const mockOptionalAuth = vi.fn()

vi.mock('../../../utils/db.js', () => ({ query: (...args) => mockQuery(...args) }))
vi.mock('../../../utils/auth.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, optionalAuth: (...args) => mockOptionalAuth(...args) }
})

globalThis.defineEventHandler = (handler) => handler
globalThis.readBody = vi.fn()
globalThis.getRouterParam = vi.fn()
globalThis.getHeader = vi.fn().mockReturnValue(null)
globalThis.createError = (opts) => {
  const err = new Error(opts.statusMessage)
  err.statusCode = opts.statusCode
  return err
}

const createHandler = (await import('../index.post.js')).default
const getHandler = (await import('../[hash].get.js')).default
const { verifyCollabToken } = await import('../../../utils/collabToken.js')

const findInsertCall = () =>
  mockQuery.mock.calls.find((c) => typeof c[0] === 'string' && c[0].includes('INSERT'))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-collab-secret'
})

beforeEach(() => {
  vi.clearAllMocks()
  mockOptionalAuth.mockResolvedValue(null)
  mockQuery.mockResolvedValue({ rows: [] })
})

describe('collaborative share creation', () => {
  it('stores mode/allow_guests/automerge_url and returns a collab token', async () => {
    readBody.mockResolvedValue({
      title: 'Team note',
      content: 'hello',
      mode: 'collaborative',
      allowGuests: true,
      automergeUrl: 'automerge:doc-1',
    })

    const result = await createHandler({})
    const params = findInsertCall()[1]
    // Appended collaborative columns keep base indices (0-12) intact.
    expect(params[13]).toBe('collaborative') // mode
    expect(params[14]).toBe(true) // allow_guests
    expect(params[15]).toBe('automerge:doc-1') // automerge_url

    expect(result.mode).toBe('collaborative')
    expect(result.automergeUrl).toBe('automerge:doc-1')
    const payload = await verifyCollabToken(result.collabToken)
    expect(payload.documentId).toBe('doc-1')
    expect(payload.access).toBe('write')
  })

  it('defaults to read-only and mints no token', async () => {
    readBody.mockResolvedValue({ title: 'Plain', content: 'x' })
    const result = await createHandler({})
    const params = findInsertCall()[1]
    expect(params[13]).toBe('read-only')
    expect(params[15]).toBeNull()
    expect(result.collabToken).toBeUndefined()
  })
})

describe('joining a collaborative share', () => {
  const collabRow = (overrides = {}) => ({
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
        expires_at: '2099-01-01T00:00:00Z',
        created_at: '2025-01-01',
        collect_analytics: false,
        deleted_at: null,
        encrypted: false,
        mode: 'collaborative',
        allow_guests: true,
        automerge_url: 'automerge:doc-99',
        ...overrides,
      },
    ],
  })

  it('issues a guest token when guests are allowed', async () => {
    getRouterParam.mockReturnValue('a'.repeat(32))
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(collabRow())

    const res = await getHandler({})
    expect(res.mode).toBe('collaborative')
    expect(res.automergeUrl).toBe('automerge:doc-99')
    const payload = await verifyCollabToken(res.collabToken)
    expect(payload.documentId).toBe('doc-99')
    expect(payload.kind).toBe('guest')
  })

  it('requires an account when guests are not allowed', async () => {
    getRouterParam.mockReturnValue('a'.repeat(32))
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(collabRow({ allow_guests: false }))

    const res = await getHandler({})
    expect(res.collabToken).toBeNull()
    expect(res.requiresAccount).toBe(true)
  })
})
