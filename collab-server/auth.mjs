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
import { query } from './db.mjs'

function tokenFromRequest(req) {
  try {
    const url = new URL(req.url, 'http://localhost')
    return url.searchParams.get('token')
  } catch {
    return null
  }
}

/**
 * Validate a verified collab token against the current database state.
 *
 * The token proves the API minted it, but the share's state may have changed
 * since (unshared, expired, member revoked, guests disabled, switched to
 * private). Re-checking on connect enforces the live state — and, paired with
 * the revocation signal, lets a booted peer's reconnection be refused.
 *
 * Fails OPEN on an unexpected DB error (the token is still a valid capability
 * and a DB outage shouldn't sever all collaboration); fails CLOSED on any
 * definitive negative (missing/deleted/expired share, non-member, guest when
 * disallowed).
 *
 * @returns {Promise<boolean>}
 */
async function authorizeAgainstDb(payload) {
  const { documentId, userId, kind } = payload
  if (!documentId) return false
  try {
    const res = await query(
      `SELECT id, user_id, access, allow_guests, expires_at, deleted_at
       FROM shared_notes
       WHERE automerge_url = $1 OR automerge_url = $2
       LIMIT 1`,
      [`automerge:${documentId}`, documentId],
    )
    const share = res.rows[0]
    if (!share) return false
    if (share.deleted_at) return false
    if (share.expires_at && new Date(share.expires_at) < new Date()) return false

    const isOwner = kind === 'user' && userId != null && share.user_id === userId
    if (isOwner) return true

    if (share.access === 'private') {
      // Private: only an active allowlisted account may join.
      if (kind !== 'user' || userId == null) return false
      const mem = await query(
        `SELECT status FROM share_members WHERE shared_note_id = $1 AND user_id = $2`,
        [share.id, userId],
      )
      return mem.rows[0]?.status === 'active'
    }

    // Public: guests need allow_guests; any account may join (revoked accounts
    // can rejoin — kick is best-effort on public shares by design).
    if (kind === 'guest') return share.allow_guests === true
    return true
  } catch (err) {
    console.warn('[collab] auth: DB authorization error, failing open:', err?.message)
    return true
  }
}

export async function createAuth() {
  const secret = process.env.JWT_SECRET
  const requireAuth = process.env.COLLAB_REQUIRE_AUTH !== 'false'
  // DB-backed authorization (access model, expiry, membership, revocation) is
  // opt-in so token-only deployments and unit tests keep working. Enable it in
  // production (COLLAB_DB_AUTHZ=true) once POSTGRES_* is configured.
  const dbAuthz = process.env.COLLAB_DB_AUTHZ === 'true'

  if (requireAuth && !secret) {
    console.warn('[collab] JWT_SECRET not set — refusing all connections until configured')
  }

  // Returns a boolean synchronously when DB authz is off, or a Promise<boolean>
  // when on. server.mjs `await`s the result, so both are handled.
  const authenticate = (req) => {
    if (!requireAuth) {
      console.warn('[collab] auth: disabled (COLLAB_REQUIRE_AUTH=false), accepting')
      return true
    }
    if (!secret) {
      console.warn('[collab] auth: no JWT_SECRET configured, rejecting')
      return false
    }
    const token = tokenFromRequest(req)
    if (!token) {
      console.warn('[collab] auth: no ?token= in request, rejecting')
      return false
    }

    let payload
    try {
      payload = verifyJwt(token, secret)
    } catch (err) {
      console.warn('[collab] auth: token verification failed:', err?.message)
      return false
    }
    if (payload.purpose !== 'collab') {
      console.warn('[collab] auth: token purpose is not "collab", rejecting')
      return false
    }

    // Tag the request so the connection can later be targeted for revocation
    // (owner userId, guest sid, room documentId, kind).
    const tag = () => {
      req.collab = {
        documentId: payload.documentId,
        userId: payload.userId ?? null,
        sid: payload.sid ?? null,
        kind: payload.kind,
        access: payload.access || 'write',
      }
    }

    if (!dbAuthz) {
      console.warn('[collab] auth: token accepted for document', payload.documentId)
      tag()
      return true
    }

    return authorizeAgainstDb(payload).then((ok) => {
      if (!ok) {
        console.warn('[collab] auth: DB authorization denied for document', payload.documentId)
        return false
      }
      console.warn('[collab] auth: token + DB authorized for document', payload.documentId)
      tag()
      return true
    })
  }

  const sharePolicy = async () => true

  return { authenticate, sharePolicy }
}
