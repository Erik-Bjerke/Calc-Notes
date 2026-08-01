import { describe, it, expect } from 'vitest'
import { isCollabTokenExpired } from '../collabToken.js'

// Build a fake JWT (header.payload.signature) with the given payload. Only the
// payload segment matters to the helper; the signature is never verified here.
function makeToken(payload) {
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`
}

const NOW = 1_000_000_000_000 // fixed clock (ms)

describe('isCollabTokenExpired', () => {
  it('treats missing/empty tokens as expired', () => {
    expect(isCollabTokenExpired(null, 60, NOW)).toBe(true)
    expect(isCollabTokenExpired(undefined, 60, NOW)).toBe(true)
    expect(isCollabTokenExpired('', 60, NOW)).toBe(true)
  })

  it('treats malformed (non-3-part) tokens as expired', () => {
    expect(isCollabTokenExpired('not-a-jwt', 60, NOW)).toBe(true)
    expect(isCollabTokenExpired('a.b', 60, NOW)).toBe(true)
  })

  it('treats a token without a numeric exp as expired', () => {
    expect(isCollabTokenExpired(makeToken({ documentId: 'd' }), 60, NOW)).toBe(true)
  })

  it('returns false for a token whose exp is comfortably in the future', () => {
    const exp = Math.floor(NOW / 1000) + 3600 // +1h
    expect(isCollabTokenExpired(makeToken({ exp }), 60, NOW)).toBe(false)
  })

  it('returns true for a token that already expired', () => {
    const exp = Math.floor(NOW / 1000) - 10
    expect(isCollabTokenExpired(makeToken({ exp }), 60, NOW)).toBe(true)
  })

  it('returns true within the skew window (about to expire)', () => {
    const exp = Math.floor(NOW / 1000) + 30 // +30s, inside the 60s skew
    expect(isCollabTokenExpired(makeToken({ exp }), 60, NOW)).toBe(true)
  })

  it('respects a custom skew', () => {
    const exp = Math.floor(NOW / 1000) + 30
    expect(isCollabTokenExpired(makeToken({ exp }), 10, NOW)).toBe(false)
  })
})
