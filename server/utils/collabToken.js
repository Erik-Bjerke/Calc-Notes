/**
 * Collaboration capability tokens.
 *
 * A collab token is a short-lived JWT (HS256, signed with the shared JWT_SECRET)
 * that grants a peer access to ONE collaborative document (room). It is minted
 * by the Nitro API when a user or permitted guest opens a collaborative share,
 * and verified by the standalone collab sync service on the WebSocket upgrade
 * (see collab-server/auth.mjs). Because both services share JWT_SECRET, the
 * sync service can authorize peers without talking to the API or the database.
 *
 * Payload:
 *   documentId  the Automerge documentId this token grants access to (room)
 *   access      'write' (editor) | 'read' (viewer, read-only relay)
 *   kind        'user' | 'guest'
 *   name        display name used for presence/cursors
 *   userId      account id (accounts only) — used for targeted revocation
 *   sid         random guest session id (guests only) — used for targeted kick
 *   purpose     always 'collab' (guards against token confusion)
 */
import { signJwt, verifyJwt } from './auth.js'

const DEFAULT_TTL_SECONDS = 12 * 3600 // 12h — a generous editing session

/** Strip the `automerge:` scheme from a url to get the bare documentId. */
export function toDocumentId(automergeUrl) {
  if (!automergeUrl) return null
  return automergeUrl.startsWith('automerge:')
    ? automergeUrl.slice('automerge:'.length)
    : automergeUrl
}

export async function signCollabToken(
  { documentId, access = 'write', kind = 'user', name = '', userId = null, sid = null },
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  if (!documentId) throw new Error('documentId is required')
  return signJwt(
    { documentId, access, kind, name, userId, sid, purpose: 'collab' },
    secret,
    ttlSeconds,
  )
}

export async function verifyCollabToken(token) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  const payload = await verifyJwt(token, secret)
  if (payload.purpose !== 'collab') throw new Error('Not a collab token')
  return payload
}
