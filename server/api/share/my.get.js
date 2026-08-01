import { requireAuth } from '../../utils/auth.js'
import { query } from '../../utils/db.js'

/**
 * GET /api/share/my — List all shared notes created by the authenticated user.
 * Includes soft-deleted (unshared) notes so analytics remain accessible.
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)

  const result = await query(
    `
    SELECT hash, title, anonymous, expires_at, created_at, collect_analytics, deleted_at,
           source_client_id, mode, allow_guests, automerge_url, access
    FROM shared_notes
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,
    [auth.userId],
  )

  return result.rows.map((row) => ({
    hash: row.hash,
    title: row.title,
    anonymous: row.anonymous,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    collectAnalytics: row.collect_analytics,
    isActive: !row.deleted_at,
    sourceClientId: row.source_client_id,
    mode: row.mode === 'collaborative' ? 'collaborative' : 'read-only',
    allowGuests: row.allow_guests === true,
    automergeUrl: row.automerge_url || null,
    access: row.access === 'private' ? 'private' : 'public',
  }))
})
