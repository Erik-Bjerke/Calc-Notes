import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import {
  verifyWebhookSignature,
  authorizeCollabRoom,
  AuthorizeLookupError,
  SIGNATURE_TOLERANCE_SECONDS,
} from '../collabAuthorize.js'

const mockQuery = vi.fn()
vi.mock('../db.js', () => ({ query: (...args) => mockQuery(...args) }))

beforeEach(() => {
  vi.clearAllMocks()
})

const SECRET = 'webhook-signing-secret-value'

const sign = (body, timestamp, secret = SECRET) =>
  `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ documentId: 'doc1', userId: 1 })
  const now = 1_700_000_000

  it('accepts a correctly signed request', () => {
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: String(now),
      signature: sign(body, now),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a signature made with the wrong key', () => {
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: String(now),
      signature: sign(body, now, 'not-the-secret-value-here'),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result).toEqual({ ok: false, reason: 'signature mismatch' })
  })

  it('rejects a tampered body', () => {
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify({ documentId: 'doc1', userId: 999 }),
      timestamp: String(now),
      signature: sign(body, now),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a replayed timestamp, since the signature covers it', () => {
    // Reusing a captured signature with a fresh timestamp must not verify.
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: String(now + 5),
      signature: sign(body, now),
      secret: SECRET,
      nowSeconds: now + 5,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a request older than the tolerance window', () => {
    const stale = now - SIGNATURE_TOLERANCE_SECONDS - 1
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: String(stale),
      signature: sign(body, stale),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result).toEqual({ ok: false, reason: 'timestamp outside the accepted window' })
  })

  it('accepts a request inside the tolerance window', () => {
    const recent = now - SIGNATURE_TOLERANCE_SECONDS + 10
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: String(recent),
      signature: sign(body, recent),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a clock skewed far into the future', () => {
    const future = now + SIGNATURE_TOLERANCE_SECONDS + 1
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: String(future),
      signature: sign(body, future),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects missing headers and a missing secret', () => {
    expect(
      verifyWebhookSignature({ rawBody: body, timestamp: String(now), secret: SECRET }).ok,
    ).toBe(false)
    expect(
      verifyWebhookSignature({ rawBody: body, signature: sign(body, now), secret: SECRET }).ok,
    ).toBe(false)
    expect(
      verifyWebhookSignature({
        rawBody: body,
        timestamp: String(now),
        signature: sign(body, now),
        secret: '',
      }).ok,
    ).toBe(false)
  })

  it('rejects a non-numeric timestamp', () => {
    const result = verifyWebhookSignature({
      rawBody: body,
      timestamp: 'not-a-number',
      signature: sign(body, 'not-a-number'),
      secret: SECRET,
      nowSeconds: now,
    })
    expect(result).toEqual({ ok: false, reason: 'timestamp is not a number' })
  })
})

/** Shape a shared_notes row with sensible collaborative defaults. */
const share = (over = {}) => ({
  id: 10,
  user_id: 1,
  mode: 'collaborative',
  access: 'public',
  allow_guests: false,
  expires_at: null,
  deleted_at: null,
  ...over,
})

/** Queue responses in call order: share lookup, then membership lookup. */
const respond = (...rows) => {
  rows.forEach((r) => mockQuery.mockResolvedValueOnce({ rows: r === null ? [] : [r] }))
}

describe('authorizeCollabRoom', () => {
  it('denies without a documentId', async () => {
    expect(await authorizeCollabRoom({ documentId: '' })).toMatchObject({ allow: false })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('matches the share by either url form', async () => {
    respond(share())
    await authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' })
    expect(mockQuery.mock.calls[0][1]).toEqual(['automerge:doc1', 'doc1'])
  })

  it('denies when no share references the document', async () => {
    respond(null)
    expect(await authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' })).toEqual({
      allow: false,
      reason: 'no share references this document',
    })
  })

  it('denies a deleted share', async () => {
    respond(share({ deleted_at: new Date().toISOString() }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' })
    expect(d).toEqual({ allow: false, reason: 'share has been deleted' })
  })

  it('denies an expired share', async () => {
    respond(share({ expires_at: new Date(Date.now() - 60_000).toISOString() }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' })
    expect(d).toEqual({ allow: false, reason: 'share has expired' })
  })

  it('allows a share whose expiry is still in the future', async () => {
    respond(share({ expires_at: new Date(Date.now() + 60_000).toISOString() }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' })
    expect(d.allow).toBe(true)
  })

  it('denies a read-only share', async () => {
    respond(share({ mode: 'read-only' }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' })
    expect(d).toEqual({ allow: false, reason: 'share is not collaborative' })
  })

  it('always allows the owner', async () => {
    respond(share({ user_id: 7, access: 'private' }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 7, kind: 'user' })
    expect(d).toEqual({ allow: true, reason: 'owner' })
    // Ownership settles it; no membership lookup needed.
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('allows any account on a public share', async () => {
    respond(share({ user_id: 1, access: 'public' }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 42, kind: 'user' })
    expect(d).toEqual({ allow: true, reason: 'public share' })
  })

  it('allows a guest only when the share permits guests', async () => {
    respond(share({ allow_guests: true }))
    expect(await authorizeCollabRoom({ documentId: 'doc1', kind: 'guest' })).toEqual({
      allow: true,
      reason: 'guest access allowed',
    })

    respond(share({ allow_guests: false }))
    expect(await authorizeCollabRoom({ documentId: 'doc1', kind: 'guest' })).toEqual({
      allow: false,
      reason: 'guest access is disabled for this share',
    })
  })

  it('denies a guest on a private share regardless of allow_guests', async () => {
    respond(share({ access: 'private', allow_guests: true }))
    const d = await authorizeCollabRoom({ documentId: 'doc1', kind: 'guest' })
    expect(d).toEqual({ allow: false, reason: 'share is private and requires an account' })
  })

  it('allows an active member of a private share', async () => {
    respond(share({ access: 'private' }), { status: 'active' })
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 42, kind: 'user' })
    expect(d).toEqual({ allow: true, reason: 'active member' })
  })

  it('denies a revoked member of a private share', async () => {
    respond(share({ access: 'private' }), { status: 'revoked' })
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 42, kind: 'user' })
    expect(d).toEqual({ allow: false, reason: 'not an active member of this private share' })
  })

  it('denies a non-member of a private share', async () => {
    respond(share({ access: 'private' }), null)
    const d = await authorizeCollabRoom({ documentId: 'doc1', userId: 42, kind: 'user' })
    expect(d.allow).toBe(false)
  })

  it('scopes the membership lookup to the share and user', async () => {
    respond(share({ access: 'private' }), { status: 'active' })
    await authorizeCollabRoom({ documentId: 'doc1', userId: 42, kind: 'user' })
    expect(mockQuery.mock.calls[1][1]).toEqual([10, 42])
  })

  it('raises rather than denying when the share lookup fails', async () => {
    // An outage must not be reported as a denial: the sync service has its own
    // failure policy and needs to know the difference.
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    await expect(
      authorizeCollabRoom({ documentId: 'doc1', userId: 1, kind: 'user' }),
    ).rejects.toBeInstanceOf(AuthorizeLookupError)
  })

  it('raises when the membership lookup fails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [share({ access: 'private' })] })
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    await expect(
      authorizeCollabRoom({ documentId: 'doc1', userId: 42, kind: 'user' }),
    ).rejects.toBeInstanceOf(AuthorizeLookupError)
  })
})
