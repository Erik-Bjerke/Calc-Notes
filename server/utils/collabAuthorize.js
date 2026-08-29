import crypto from 'node:crypto'
import { query } from './db.js'

/**
 * Authorization decisions for the CRDT sync service.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE SYNC SERVICE ASKS US
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A collab capability token proves this API once granted a peer access to a
 * room. It cannot express what changed afterwards — a share deleted, a link
 * expired, a member kicked, access switched to private. Only this app knows that,
 * because only this app owns `shared_notes` and `share_members`.
 *
 * So the sync service asks, rather than reading our tables itself. That keeps our
 * schema private and lets one sync deployment serve unrelated apps without
 * knowing anything about notes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FAILURE POLICY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every definitive negative denies: no share, deleted, expired, not an allowed
 * member, guest where guests are disallowed. An *unexpected* database error is
 * reported as such (HTTP 500) rather than as a denial, leaving the decision to
 * the sync service's own configured policy — which defaults to failing closed.
 * Guessing "allow" here would silently convert an outage into open access.
 */

/** Requests older than this are refused, so a captured one cannot be replayed. */
export const SIGNATURE_TOLERANCE_SECONDS = 300

export const SIGNATURE_HEADER = 'x-numori-crdt-signature'
export const TIMESTAMP_HEADER = 'x-numori-crdt-timestamp'

/**
 * Verify the sync service signed this request.
 *
 * The signature covers `timestamp.body`, so neither the payload nor the
 * timestamp can be altered independently. Comparison is constant-time, and the
 * digests are equal length by construction.
 *
 * @param {object} args
 * @param {string} args.rawBody exact bytes as received
 * @param {string} args.timestamp value of the timestamp header
 * @param {string} args.signature value of the signature header
 * @param {string} args.secret shared webhook secret
 * @param {number} [args.nowSeconds] injectable clock, for tests
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function verifyWebhookSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!secret) return { ok: false, reason: 'no webhook secret configured' }
  if (!signature) return { ok: false, reason: 'missing signature header' }
  if (!timestamp) return { ok: false, reason: 'missing timestamp header' }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'timestamp is not a number' }
  if (Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside the accepted window' }
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody ?? ''}`)
    .digest('hex')}`

  const given = Buffer.from(String(signature))
  const want = Buffer.from(expected)
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return { ok: false, reason: 'signature mismatch' }
  }
  return { ok: true }
}

/** Raised for an unexpected failure, so the caller can answer 500 not 403. */
export class AuthorizeLookupError extends Error {
  constructor(message, cause) {
    super(message, { cause })
    this.name = 'AuthorizeLookupError'
  }
}

/**
 * Decide whether an identity may join a collaborative document right now.
 *
 * @param {object} identity
 * @param {string} identity.documentId Automerge document id (bare, no scheme)
 * @param {number|null} [identity.userId] account id, when the peer has one
 * @param {string} [identity.kind] 'user' | 'guest'
 * @returns {Promise<{allow: boolean, reason: string}>}
 * @throws {AuthorizeLookupError} on an unexpected database failure
 */
export async function authorizeCollabRoom({ documentId, userId = null, kind = 'guest' }) {
  if (!documentId) return { allow: false, reason: 'no documentId supplied' }

  let share
  try {
    // The share may store the url in either form, so match both.
    const result = await query(
      `SELECT id, user_id, mode, access, allow_guests, expires_at, deleted_at
       FROM shared_notes
       WHERE automerge_url = $1 OR automerge_url = $2
       LIMIT 1`,
      [`automerge:${documentId}`, documentId],
    )
    share = result.rows[0]
  } catch (err) {
    throw new AuthorizeLookupError('share lookup failed', err)
  }

  if (!share) return { allow: false, reason: 'no share references this document' }
  if (share.deleted_at) return { allow: false, reason: 'share has been deleted' }
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { allow: false, reason: 'share has expired' }
  }
  if (share.mode && share.mode !== 'collaborative') {
    return { allow: false, reason: 'share is not collaborative' }
  }

  // The owner always retains access to their own share.
  if (kind === 'user' && userId != null && share.user_id === userId) {
    return { allow: true, reason: 'owner' }
  }

  if (share.access === 'private') {
    // Private: only an account on the allowlist, and only while still active.
    if (kind !== 'user' || userId == null) {
      return { allow: false, reason: 'share is private and requires an account' }
    }
    let member
    try {
      const result = await query(
        `SELECT status FROM share_members WHERE shared_note_id = $1 AND user_id = $2`,
        [share.id, userId],
      )
      member = result.rows[0]
    } catch (err) {
      throw new AuthorizeLookupError('membership lookup failed', err)
    }
    if (member?.status !== 'active') {
      return { allow: false, reason: 'not an active member of this private share' }
    }
    return { allow: true, reason: 'active member' }
  }

  // Public: guests only when the share allows them; any account may join.
  if (kind === 'guest') {
    return share.allow_guests === true
      ? { allow: true, reason: 'guest access allowed' }
      : { allow: false, reason: 'guest access is disabled for this share' }
  }
  return { allow: true, reason: 'public share' }
}
