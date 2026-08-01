import { describe, it, expect, vi } from 'vitest'
import { encodeCollabLinkage, decodeCollabLinkage } from '../collabLinkage.js'

// Fake key-bound crypto: "encrypt" wraps, "decrypt" unwraps, so we can assert
// the serialised shape without pulling in Web Crypto.
const fakeEncrypt = (s) => Promise.resolve(`enc(${s})`)
const fakeDecrypt = (s) => Promise.resolve(s.replace(/^enc\((.*)\)$/s, '$1'))

describe('encodeCollabLinkage', () => {
  it('returns null when there is no mapping', async () => {
    expect(await encodeCollabLinkage(null, fakeEncrypt)).toBeNull()
    expect(await encodeCollabLinkage(undefined, fakeEncrypt)).toBeNull()
  })

  it('returns null when the mapping has no automergeUrl', async () => {
    expect(await encodeCollabLinkage({ hash: 'h1' }, fakeEncrypt)).toBeNull()
  })

  it('encrypts only the hash + automergeUrl, never the token', async () => {
    const blob = await encodeCollabLinkage(
      { noteId: 'n1', hash: 'h1', automergeUrl: 'automerge:abc', collabToken: 'SECRET' },
      fakeEncrypt,
    )
    expect(blob).toBe('enc({"hash":"h1","automergeUrl":"automerge:abc"})')
    expect(blob).not.toContain('SECRET')
    expect(blob).not.toContain('collabToken')
  })

  it('normalises a missing hash to null', async () => {
    const blob = await encodeCollabLinkage({ automergeUrl: 'automerge:abc' }, fakeEncrypt)
    expect(blob).toBe('enc({"hash":null,"automergeUrl":"automerge:abc"})')
  })
})

describe('decodeCollabLinkage', () => {
  it('returns null for an absent blob', async () => {
    expect(await decodeCollabLinkage(null, fakeDecrypt)).toBeNull()
    expect(await decodeCollabLinkage(undefined, fakeDecrypt)).toBeNull()
  })

  it('round-trips a linkage produced by encode', async () => {
    const blob = await encodeCollabLinkage(
      { hash: 'h1', automergeUrl: 'automerge:abc' },
      fakeEncrypt,
    )
    expect(await decodeCollabLinkage(blob, fakeDecrypt)).toEqual({
      hash: 'h1',
      automergeUrl: 'automerge:abc',
    })
  })

  it('returns null when decryption throws', async () => {
    const throwing = vi.fn(() => Promise.reject(new Error('bad key')))
    expect(await decodeCollabLinkage('enc(x)', throwing)).toBeNull()
  })

  it('returns null when the decrypted payload lacks automergeUrl', async () => {
    expect(await decodeCollabLinkage('enc({"hash":"h1"})', fakeDecrypt)).toBeNull()
  })
})
