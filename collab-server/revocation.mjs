/**
 * Live revocation listener for the collab sync service.
 *
 * The API signals access changes (member kicked, share stopped/expired, guests
 * disabled, switched to private) by issuing `NOTIFY collab_revoke, '<json>'` on
 * the shared Postgres. This module holds a dedicated LISTEN connection and
 * forwards each notification to a callback (which boots the matching sockets).
 *
 * Payload shape: { documentId, userId?, sid?, kind? } — see matchesRevocation.
 */
import { useDb } from './db.mjs'

/**
 * Start listening for revocation notifications.
 *
 * @param {(payload: object) => void} onRevoke called with the parsed payload
 * @returns {Promise<() => Promise<void>>} a cleanup function
 */
export async function startRevocationListener(onRevoke) {
  const pool = useDb()
  const client = await pool.connect()

  client.on('notification', (msg) => {
    if (msg.channel !== 'collab_revoke' || !msg.payload) return
    try {
      onRevoke(JSON.parse(msg.payload))
    } catch (err) {
      console.warn('[collab] revoke: bad notification payload:', err?.message)
    }
  })

  // If the dedicated connection errors, log it — revocation degrades to
  // token-expiry (≤ token TTL) until the service restarts. Auth still gates
  // new connections, so this is a soft failure, not a security hole.
  client.on('error', (err) => {
    console.warn('[collab] revoke: listener connection error:', err?.message)
  })

  await client.query('LISTEN collab_revoke')
  console.warn('[collab] revoke: listening on channel collab_revoke')

  return async () => {
    try {
      await client.query('UNLISTEN collab_revoke')
    } catch {
      /* ignore */
    }
    client.release()
  }
}
