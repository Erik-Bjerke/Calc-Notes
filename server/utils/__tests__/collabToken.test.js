import { describe, it, expect, beforeAll } from 'vitest'
import { signCollabToken, verifyCollabToken, toDocumentId } from '../collabToken.js'
import { signJwt } from '../auth.js'

/**
 * Task 6 verification: collaboration capability tokens round-trip and are
 * scoped to a single document, and non-collab JWTs are rejected. The collab
 * sync service (Task 7) relies on exactly this verification.
 */
describe('collab capability tokens', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-collab-secret'
  })

  it('strips the automerge scheme to a bare documentId', () => {
    expect(toDocumentId('automerge:abc123')).toBe('abc123')
    expect(toDocumentId('abc123')).toBe('abc123')
    expect(toDocumentId(null)).toBeNull()
  })

  it('signs and verifies a token carrying room + identity', async () => {
    const token = await signCollabToken({
      documentId: 'doc-xyz',
      access: 'write',
      kind: 'guest',
      name: 'Ada',
    })
    const payload = await verifyCollabToken(token)
    expect(payload.documentId).toBe('doc-xyz')
    expect(payload.access).toBe('write')
    expect(payload.kind).toBe('guest')
    expect(payload.name).toBe('Ada')
    expect(payload.purpose).toBe('collab')
  })

  it('rejects a JWT that is not a collab token', async () => {
    const notCollab = await signJwt({ userId: 1 }, process.env.JWT_SECRET, 60)
    await expect(verifyCollabToken(notCollab)).rejects.toThrow('Not a collab token')
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signJwt({ documentId: 'd', purpose: 'collab' }, 'some-other-secret', 60)
    await expect(verifyCollabToken(token)).rejects.toThrow()
  })

  it('requires a documentId', async () => {
    await expect(signCollabToken({ documentId: '' })).rejects.toThrow('documentId is required')
  })
})
