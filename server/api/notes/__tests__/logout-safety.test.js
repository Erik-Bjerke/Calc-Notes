/**
 * Tests that local data clearing on logout does NOT trigger
 * server-side deletion of notes.
 *
 * The key invariant: the server sync endpoint only deletes notes
 * explicitly listed in `deletedClientIds`. An empty push is harmless.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
const mockRequireAuth = vi.fn()
const mockNotifySync = vi.fn()

vi.mock('../../../utils/db.js', () => ({ query: (...args) => mockQuery(...args) }))
vi.mock('../../../utils/auth.js', () => ({ requireAuth: (...args) => mockRequireAuth(...args) }))
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

const syncHandler = (await import('../sync.post.js')).default

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ userId: 1 })
})

describe('empty push does not delete server notes', () => {
  it('pushing zero notes with empty deletedClientIds preserves all server notes', async () => {
    readBody.mockResolvedValue({
      notes: [],
      deletedClientIds: [],
      broadcast: false,
    })

    // 0. SELECT data_wiped_at (handler's first query)
    mockQuery.mockResolvedValueOnce({ rows: [{ data_wiped_at: null }] })
    // pull
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: 'Note 1',
          description: '',
          tags: '[]',
          content: 'c1',
          sort_order: 0,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 2,
          client_id: 'n2',
          title: 'Note 2',
          description: '',
          tags: '[]',
          content: 'c2',
          sort_order: 1,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 3,
          client_id: 'n3',
          title: 'Note 3',
          description: '',
          tags: '[]',
          content: 'c3',
          sort_order: 2,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    // SELECT welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] })
    // Tombstone purge
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await syncHandler({})

    expect(result.pulled).toHaveLength(3)
    expect(result.deletedClientIds).toEqual([])
    // No DELETE FROM notes query should have been called
    for (const call of mockQuery.mock.calls) {
      expect(call[0]).not.toContain('DELETE FROM notes')
    }
  })

  it('notes absent from the push are not deleted on the server', async () => {
    // Client pushes only n1, server has n1 + n2 + n3
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
      broadcast: false,
    })

    mockQuery.mockResolvedValueOnce({ rows: [{ data_wiped_at: null }] }) // 0. data_wiped_at
    mockQuery.mockResolvedValueOnce({ rows: [] }) // check tombstone
    mockQuery.mockResolvedValueOnce({
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
    }) // upsert
    mockQuery.mockResolvedValueOnce({ rows: [] }) // server-deleted IDs
    mockQuery.mockResolvedValueOnce({
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
        {
          id: 2,
          client_id: 'n2',
          title: 'Note 2',
          description: '',
          tags: '[]',
          content: 'c2',
          sort_order: 1,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 3,
          client_id: 'n3',
          title: 'Note 3',
          description: '',
          tags: '[]',
          content: 'c3',
          sort_order: 2,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    }) // pull
    // SELECT welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] })
    // Tombstone purge
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await syncHandler({})

    expect(result.pulled).toHaveLength(3)
    // No DELETE FROM notes query should have been called
    for (const call of mockQuery.mock.calls) {
      expect(call[0]).not.toContain('DELETE FROM notes')
    }
  })

  it('only notes in deletedClientIds are deleted', async () => {
    readBody.mockResolvedValue({
      notes: [],
      deletedClientIds: ['n2'],
      broadcast: false,
    })

    // 0. SELECT data_wiped_at (handler's first query)
    mockQuery.mockResolvedValueOnce({ rows: [{ data_wiped_at: null }] })
    // 1. DELETE FROM notes
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // 2. INSERT tombstone for n2
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // 3. Pull
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          client_id: 'n1',
          title: 'Note 1',
          description: '',
          tags: '[]',
          content: 'c1',
          sort_order: 0,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 3,
          client_id: 'n3',
          title: 'Note 3',
          description: '',
          tags: '[]',
          content: 'c3',
          sort_order: 2,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    })
    // 4. SELECT welcome_created
    mockQuery.mockResolvedValueOnce({ rows: [{ welcome_created: false }] })
    // 5. Tombstone purge
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await syncHandler({})

    expect(result.pulled).toHaveLength(2)
    // DELETE is the 2nd query (index 1) — data_wiped_at is queried first
    const deleteCall = mockQuery.mock.calls[1]
    expect(deleteCall[0]).toContain('DELETE FROM notes')
    expect(deleteCall[1][1]).toEqual(['n2'])
  })
})
