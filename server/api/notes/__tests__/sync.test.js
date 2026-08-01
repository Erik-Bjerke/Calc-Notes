/**
 * Unit tests for server/api/notes/sync.post.js
 *
 * Focuses on encryption-related behavior: opaque field storage,
 * tags handling (string vs array), hard delete with tombstones, and pull responses.
 *
 * Handler query order (each consumes one mockQuery result):
 *   0. SELECT data_wiped_at
 *   1. (if deletes) DELETE FROM notes, then one INSERT tombstone per id
 *   2. (per note) SELECT tombstone, then INSERT/UPSERT
 *   3. (if any client ids) SELECT server-deleted ids
 *   4. SELECT pull
 *   5. SELECT welcome_created
 *   6. DELETE tombstone purge
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
const mockRequireAuth = vi.fn()
const mockNotifySync = vi.fn()

vi.mock('../../../utils/db.js', () => ({ query: (...args) => mockQuery(...args) }))
vi.mock('../../../utils/auth.js', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}))
vi.mock('../../../utils/syncBroadcast.js', () => ({
  notifySync: (...args) => mockNotifySync(...args),
}))

globalThis.defineEventHandler = (handler) => handler
globalThis.readBody = vi.fn()
globalThis.createError = (opts) => {
  const err = new Error(opts.statusMessage)
  err.statusCode = opts.statusCode
  return err
}

const handler = (await import('../sync.post.js')).default

/** Mock the initial `SELECT data_wiped_at` query (always the handler's first). */
const mockDataWipedAt = (value = null) =>
  mockQuery.mockResolvedValueOnce({ rows: [{ data_wiped_at: value }] })

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ userId: 1 })
})

describe('POST /api/notes/sync', () => {
  it('stores encrypted string tags as-is', async () => {
    const encryptedTags = '{"iv":"abc","ct":"def"}'
    readBody.mockResolvedValue({
      notes: [
        {
          clientId: 'n1',
          title: '{"iv":"t","ct":"t"}',
          description: '',
          tags: encryptedTags,
          content: '{"iv":"c","ct":"c"}',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      deletedClientIds: [],
    })

    mockDataWipedAt() // 0. SELECT data_wiped_at
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. tombstone check for n1
    mockQuery.mockResolvedValueOnce({
      // 2. INSERT/UPSERT
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: '{"iv":"t","ct":"t"}',
          description: '',
          tags: encryptedTags,
          content: '{"iv":"c","ct":"c"}',
          sort_order: 0,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. server-deleted IDs
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 4. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 5. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 6. tombstone purge

    await handler({})

    // INSERT is the 3rd query (index 2); tags is param index 4
    const insertCall = mockQuery.mock.calls[2]
    expect(insertCall[1][4]).toBe(encryptedTags)
  })

  it('JSON.stringifies array tags (legacy)', async () => {
    readBody.mockResolvedValue({
      notes: [
        {
          clientId: 'n1',
          title: 'Plain Title',
          tags: ['tag1', 'tag2'],
          content: 'plain content',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      deletedClientIds: [],
    })

    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. tombstone check
    mockQuery.mockResolvedValueOnce({
      // 2. INSERT
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: 'Plain Title',
          description: '',
          tags: '["tag1","tag2"]',
          content: 'plain content',
          sort_order: 0,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. server-deleted IDs
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 4. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 5. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 6. tombstone purge

    await handler({})

    const insertCall = mockQuery.mock.calls[2]
    expect(insertCall[1][4]).toBe('["tag1","tag2"]')
  })

  it('round-trips the collab linkage blob (push + pull)', async () => {
    const collab = '{"iv":"x","ct":"y"}'
    readBody.mockResolvedValue({
      notes: [
        {
          clientId: 'n1',
          title: 't',
          content: 'c',
          collab,
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      deletedClientIds: [],
    })

    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. tombstone check
    mockQuery.mockResolvedValueOnce({
      // 2. INSERT
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: 't',
          description: '',
          tags: '[]',
          content: 'c',
          sort_order: 0,
          collab,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. server-deleted IDs
    mockQuery.mockResolvedValueOnce({
      // 4. pull
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: 't',
          description: '',
          tags: '[]',
          content: 'c',
          sort_order: 0,
          collab,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 5. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 6. tombstone purge

    const result = await handler({})

    // collab is passed to the INSERT at param index 11
    const insertCall = mockQuery.mock.calls[2]
    expect(insertCall[1][11]).toBe(collab)
    // and surfaced on both pushed and pulled
    expect(result.pushed[0].collab).toBe(collab)
    expect(result.pulled[0].collab).toBe(collab)
  })

  it('hard-deletes notes and records tombstones', async () => {
    readBody.mockResolvedValue({
      notes: [],
      deletedClientIds: ['n1', 'n2'],
    })

    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. DELETE FROM notes
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 2. INSERT tombstone n1
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. INSERT tombstone n2
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 4. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 5. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 6. tombstone purge

    await handler({})

    // DELETE is now the 2nd query (index 1)
    expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM notes')
    expect(mockQuery.mock.calls[1][1]).toEqual([1, ['n1', 'n2']])
    // Tombstone inserts follow
    expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO deleted_notes')
    expect(mockQuery.mock.calls[3][0]).toContain('INSERT INTO deleted_notes')
  })

  it('skips notes that have a tombstone on server', async () => {
    readBody.mockResolvedValue({
      notes: [
        {
          clientId: 'n1',
          title: 'title',
          content: 'content',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      deletedClientIds: [],
    })

    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 1. tombstone check: exists
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'n1' }] }) // 2. server-deleted IDs
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 4. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 5. tombstone purge

    const result = await handler({})

    expect(result.pushed).toEqual([])
  })

  it('returns pulled notes with encrypted fields intact', async () => {
    readBody.mockResolvedValue({ notes: [], deletedClientIds: [] })

    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({
      // 1. pull
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: '{"iv":"a","ct":"b"}',
          description: '{"iv":"c","ct":"d"}',
          tags: '{"iv":"e","ct":"f"}',
          content: '{"iv":"g","ct":"h"}',
          sort_order: 0,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 2. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. tombstone purge

    const result = await handler({})

    expect(result.pulled).toHaveLength(1)
    expect(result.pulled[0].title).toBe('{"iv":"a","ct":"b"}')
    expect(result.pulled[0].tags).toBe('{"iv":"e","ct":"f"}')
  })

  it('notifies other clients via SSE broadcast', async () => {
    readBody.mockResolvedValue({
      notes: [],
      deletedClientIds: [],
      sessionId: 'sess-1',
      broadcast: true,
    })
    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 2. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. tombstone purge

    await handler({})

    expect(mockNotifySync).toHaveBeenCalledWith(1, 'sess-1')
  })

  it('skips broadcast when broadcast=false', async () => {
    readBody.mockResolvedValue({
      notes: [],
      deletedClientIds: [],
      broadcast: false,
    })
    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 2. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 3. tombstone purge

    await handler({})

    expect(mockNotifySync).not.toHaveBeenCalled()
  })

  it('reports server-deleted client IDs via tombstones', async () => {
    readBody.mockResolvedValue({
      notes: [
        {
          clientId: 'n1',
          title: 't',
          content: 'c',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      deletedClientIds: [],
    })

    mockDataWipedAt() // 0
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 1. tombstone check: not deleted
    mockQuery.mockResolvedValueOnce({
      // 2. INSERT
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: 't',
          description: '',
          tags: '[]',
          content: 'c',
          sort_order: 0,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: 'n1' }] }) // 3. server-deleted IDs
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 4. pull
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] }) // 5. welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [] }) // 6. tombstone purge

    const result = await handler({})
    expect(result.deletedClientIds).toEqual(['n1'])
  })
})
