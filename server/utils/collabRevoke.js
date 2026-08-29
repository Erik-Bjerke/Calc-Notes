import { toDocumentId } from './collabToken.js'

/**
 * Disconnect peers of a collaborative document from the CRDT sync service.
 *
 * A capability token stays valid until it expires, so when a share's access
 * changes the peers already connected have to be kicked explicitly. The sync
 * service exposes an authenticated admin endpoint for exactly this, and re-runs
 * authorization on any reconnect — so a booted peer cannot simply come back.
 *
 * Targeting (all optional; omit all to boot everyone in the room):
 *   userId — a specific account's sockets
 *   sid    — a specific guest session's socket
 *   kind   — a whole kind ('guest' | 'user')
 *
 * Configure with:
 *   CRDT_ADMIN_URL      base url of the sync service, e.g. https://crdt.numori.app
 *   CRDT_ADMIN_SECRET   its CRDT_ADMIN_SECRET (or the app's own adminSecret)
 *   CRDT_APP_ID         app id registered there (defaults to "notes")
 *
 * Best-effort by design: this runs inside the request that changed the share, so
 * a slow or unreachable sync service must not fail that request or hold it open.
 * The call is bounded by a short timeout and every failure is swallowed after
 * logging. A missed kick degrades to token expiry, not to unauthorized access,
 * because authorization is re-checked on reconnect.
 */

/** Bound the call so an unreachable sync service cannot stall an API request. */
const REVOKE_TIMEOUT_MS = 2000

let warnedMissingConfig = false

function revokeConfig() {
  const baseUrl = process.env.CRDT_ADMIN_URL?.trim().replace(/\/+$/, '') || ''
  const secret = process.env.CRDT_ADMIN_SECRET?.trim() || ''
  const appId = process.env.CRDT_APP_ID?.trim() || 'notes'
  return { baseUrl, secret, appId }
}

/**
 * @param {{automergeUrl?: string, userId?: number|null, sid?: string|null, kind?: string|null}} opts
 * @returns {Promise<boolean>} whether the sync service confirmed the revocation
 */
export async function notifyCollabRevoke({ automergeUrl, userId = null, sid = null, kind = null }) {
  const documentId = toDocumentId(automergeUrl)
  if (!documentId) return false

  const { baseUrl, secret, appId } = revokeConfig()
  if (!baseUrl || !secret) {
    // Warn once rather than on every share change: a permanently missing config
    // is a deployment problem worth surfacing, but not worth flooding the log.
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.warn(
        '[collab] CRDT_ADMIN_URL / CRDT_ADMIN_SECRET are not configured — ' +
          'access changes will not disconnect connected peers until their tokens expire.',
      )
    }
    return false
  }

  try {
    const res = await fetch(`${baseUrl}/_admin/apps/${encodeURIComponent(appId)}/revoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ documentId, userId, sid, kind }),
      signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[collab] revoke request failed with HTTP ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `timed out after ${REVOKE_TIMEOUT_MS}ms`
        : err?.message
    console.warn(`[collab] revoke request could not be delivered: ${reason}`)
    return false
  }
}
