import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyCollabRevoke } from '../collabRevoke.js'

const mockQuery = vi.fn()
vi.mock('../db.js', () => ({ query: (...args) => mockQuery(...args) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ rows: [] })
})

describe('notifyCollabRevoke', () => {
  it('does nothing without an automergeUrl', async () => {
    await notifyCollabRevoke({ automergeUrl: null, userId: 5 })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('emits pg_notify with a documentId stripped of the automerge: scheme', async () => {
    await notifyCollabRevoke({ automergeUrl: 'automerge:doc123', userId: 5 })
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain("pg_notify('collab_revoke'")
    expect(JSON.parse(params[0])).toEqual({
      documentId: 'doc123',
      userId: 5,
      sid: null,
      kind: null,
    })
  })

  it('passes guest sid and kind targets through', async () => {
    await notifyCollabRevoke({ automergeUrl: 'doc123', sid: 'g1', kind: 'guest' })
    const payload = JSON.parse(mockQuery.mock.calls[0][1][0])
    expect(payload).toEqual({ documentId: 'doc123', userId: null, sid: 'g1', kind: 'guest' })
  })

  it('swallows DB errors (best-effort)', async () => {
    mockQuery.mockRejectedValue(new Error('down'))
    await expect(notifyCollabRevoke({ automergeUrl: 'doc123' })).resolves.toBeUndefined()
  })
})
