import { query } from './db.js'
import { toDocumentId } from './collabToken.js'

/**
 * Signal the collab sync service to disconnect peers of a collaborative
 * document, via Postgres NOTIFY on the `collab_revoke` channel.
 *
 * Targeting (all optional; omit all to boot everyone in the room):
 *   userId — a specific account's sockets
 *   sid    — a specific guest session's socket
 *   kind   — a whole kind ('guest' | 'user')
 *
 * Best-effort: failures are swallowed so a NOTIFY hiccup never breaks the API
 * request that triggered it. The collab server also re-checks access on any
 * reconnect, so a missed boot degrades to token-expiry, not a security hole.
 *
 * @param {{automergeUrl?: string, userId?: number|null, sid?: string|null, kind?: string|null}} opts
 */
export async function notifyCollabRevoke({ automergeUrl, userId = null, sid = null, kind = null }) {
  const documentId = toDocumentId(automergeUrl)
  if (!documentId) return
  const payload = JSON.stringify({ documentId, userId, sid, kind })
  try {
    await query(`SELECT pg_notify('collab_revoke', $1)`, [payload])
  } catch {
    /* best-effort */
  }
}
