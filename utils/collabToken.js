/**
 * Client-side helper for reasoning about a collab capability token (a JWT
 * minted by `GET /api/share/:hash`). We never verify the signature here — that
 * is the sync service's job — we only read the `exp` claim to decide whether to
 * re-mint before connecting.
 *
 * Pure and dependency-free (base64url decode works in both browser and Node),
 * with an injectable clock so it can be unit-tested.
 */

function base64UrlDecode(segment) {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
  if (typeof atob === 'function') return atob(padded)
  return Buffer.from(padded, 'base64').toString('binary')
}

/**
 * Whether a collab token is missing, malformed, or expired (or about to be).
 *
 * A missing/unparseable token, or one without a numeric `exp`, is treated as
 * expired so the caller re-mints. The `skewSeconds` margin covers clock drift
 * and the round-trip needed to actually connect.
 *
 * @param {string|null|undefined} token the JWT
 * @param {number} [skewSeconds=60] treat as expired this many seconds early
 * @param {number} [nowMs=Date.now()] injectable clock for tests
 * @returns {boolean}
 */
export function isCollabTokenExpired(token, skewSeconds = 60, nowMs = Date.now()) {
  if (!token || typeof token !== 'string') return true
  const parts = token.split('.')
  if (parts.length !== 3) return true
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    if (typeof payload.exp !== 'number') return true
    return payload.exp * 1000 <= nowMs + skewSeconds * 1000
  } catch {
    return true
  }
}
