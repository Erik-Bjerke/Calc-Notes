import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notifyCollabRevoke } from '../collabRevoke.js'

/**
 * Revocation reaches the CRDT sync service over its authenticated admin API.
 *
 * The call happens inside the request that changed the share, so the contract
 * that matters is: correct target, correct credentials, and never able to fail or
 * stall the surrounding request.
 */

const ADMIN_URL = 'https://crdt.test'
const ADMIN_SECRET = 'admin-credential-value-123456'

let fetchMock

beforeEach(() => {
  process.env.CRDT_ADMIN_URL = ADMIN_URL
  process.env.CRDT_ADMIN_SECRET = ADMIN_SECRET
  delete process.env.CRDT_APP_ID
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.CRDT_ADMIN_URL
  delete process.env.CRDT_ADMIN_SECRET
  delete process.env.CRDT_APP_ID
})

const bodyOf = (call) => JSON.parse(call[1].body)

describe('notifyCollabRevoke', () => {
  it('does nothing without an automergeUrl', async () => {
    await notifyCollabRevoke({ automergeUrl: null, userId: 5 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to the app-scoped revoke endpoint', async () => {
    await notifyCollabRevoke({ automergeUrl: 'automerge:doc123', userId: 5 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ADMIN_URL}/_admin/apps/notes/revoke`)
    expect(options.method).toBe('POST')
  })

  it('strips the automerge: scheme from the documentId', async () => {
    await notifyCollabRevoke({ automergeUrl: 'automerge:doc123', userId: 5 })
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      documentId: 'doc123',
      userId: 5,
      sid: null,
      kind: null,
    })
  })

  it('passes guest sid and kind targets through', async () => {
    await notifyCollabRevoke({ automergeUrl: 'doc123', sid: 'g1', kind: 'guest' })
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      documentId: 'doc123',
      userId: null,
      sid: 'g1',
      kind: 'guest',
    })
  })

  it('authenticates with the admin secret as a bearer token', async () => {
    await notifyCollabRevoke({ automergeUrl: 'doc123' })
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(`Bearer ${ADMIN_SECRET}`)
  })

  it('honours a custom app id', async () => {
    process.env.CRDT_APP_ID = 'notes-staging'
    await notifyCollabRevoke({ automergeUrl: 'doc123' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${ADMIN_URL}/_admin/apps/notes-staging/revoke`)
  })

  it('tolerates a trailing slash on the configured base url', async () => {
    process.env.CRDT_ADMIN_URL = `${ADMIN_URL}/`
    await notifyCollabRevoke({ automergeUrl: 'doc123' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${ADMIN_URL}/_admin/apps/notes/revoke`)
  })

  it('bounds the request with an abort signal so it cannot stall the API', async () => {
    await notifyCollabRevoke({ automergeUrl: 'doc123' })
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('reports success when the service confirms', async () => {
    await expect(notifyCollabRevoke({ automergeUrl: 'doc123' })).resolves.toBe(true)
  })

  it('swallows a non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 })
    await expect(notifyCollabRevoke({ automergeUrl: 'doc123' })).resolves.toBe(false)
  })

  it('swallows a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(notifyCollabRevoke({ automergeUrl: 'doc123' })).resolves.toBe(false)
  })

  it('swallows a timeout', async () => {
    const err = new Error('timed out')
    err.name = 'TimeoutError'
    fetchMock.mockRejectedValue(err)
    await expect(notifyCollabRevoke({ automergeUrl: 'doc123' })).resolves.toBe(false)
  })

  it('skips the call when the sync service is not configured', async () => {
    delete process.env.CRDT_ADMIN_URL
    delete process.env.CRDT_ADMIN_SECRET
    await expect(notifyCollabRevoke({ automergeUrl: 'doc123' })).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
