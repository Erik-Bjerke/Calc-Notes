/**
 * Minimal, dependency-free HS256 JWT verification for the collab sync service.
 *
 * Must stay wire-compatible with the tokens minted by the Nitro API
 * (server/utils/auth.js signJwt + server/utils/collabToken.js). Both sign with
 * HMAC-SHA256 over `base64url(header).base64url(payload)` using JWT_SECRET, so
 * verifying here with Node's crypto.createHmac produces identical bytes.
 */
import crypto from 'node:crypto'

export function verifyJwt(token, secret) {
  const parts = String(token).split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [headerB64, payloadB64, signatureB64] = parts

  const data = `${headerB64}.${payloadB64}`
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')

  const given = Buffer.from(signatureB64)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new Error('Invalid signature')
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return payload
}
