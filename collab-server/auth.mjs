/**
 * Authentication + authorization for the collab sync service.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY MODEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. Connection auth (enforced): every WebSocket upgrade must present a valid,
 *    unexpired collab capability token (`?token=<jwt>`), signed by the API with
 *    the shared JWT_SECRET and carrying `purpose: 'collab'`. Sockets without a
 *    valid token are rejected before joining the repo.
 *
 * 2. Room access (capability-based): Automerge documentIds are unguessable
 *    128-bit identifiers that are only revealed through a share link. Combined
 *    with the token gate above, "knowing the documentId" is the capability to
 *    access it — the same posture as the app's existing share-hash links. The
 *    sharePolicy therefore admits any document an authenticated peer can name.
 *
 * A single client keeps one connection (one token) but may legitimately sync
 * several collaborative documents it owns/joined; the capability model handles
 * that naturally. A future hardening could bind tokens to specific rooms via a
 * server-side membership table.
 *
 * Set COLLAB_REQUIRE_AUTH=false to run an open server (development / the
 * no-auth relay tests).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { verifyJwt } from './jwt.mjs'

function tokenFromRequest(req) {
  try {
    const url = new URL(req.url, 'http://localhost')
    return url.searchParams.get('token')
  } catch {
    return null
  }
}

export async function createAuth() {
  const secret = process.env.JWT_SECRET
  const requireAuth = process.env.COLLAB_REQUIRE_AUTH !== 'false'

  if (requireAuth && !secret) {
    console.warn('[collab] JWT_SECRET not set — refusing all connections until configured')
  }

  const authenticate = (req) => {
    if (!requireAuth) return true
    if (!secret) return false
    const token = tokenFromRequest(req)
    if (!token) return false
    try {
      const payload = verifyJwt(token, secret)
      return payload.purpose === 'collab'
    } catch {
      return false
    }
  }

  const sharePolicy = async () => true

  return { authenticate, sharePolicy }
}
