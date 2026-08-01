import { createHash } from 'node:crypto'
import { optionalAuth } from '../../utils/auth.js'
import { query } from '../../utils/db.js'
import { notifyCollabRevoke } from '../../utils/collabRevoke.js'

/**
 * DELETE /api/share/:hash — Stop sharing or permanently remove a shared note.
 *
 * Query params:
 *   ?purge=true — Hard-delete the shared note and all its analytics data.
 *   (default)   — Soft-delete (stop sharing). Analytics data is preserved.
 *
 * Authorization: either
 *   1. Authenticated user who owns the share (user_id matches), OR
 *   2. Valid delete token passed via `X-Delete-Token` header (for anonymous shares).
 */
export default defineEventHandler(async (event) => {
  const auth = await optionalAuth(event)
  const hash = getRouterParam(event, 'hash')
  const { purge, _token } = getQuery(event)
  const deleteToken = getHeader(event, 'x-delete-token') || _token || null

  // Must have either auth or a delete token
  if (!auth && !deleteToken) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication or delete token required' })
  }

  // Build the ownership condition
  let ownerCondition
  let ownerParams

  if (auth) {
    // Authenticated user — verify ownership via user_id
    ownerCondition = 'user_id = $2'
    ownerParams = [hash, auth.userId]
  } else {
    // Anonymous — verify ownership via delete token hash
    const tokenHash = createHash('sha256').update(deleteToken).digest('hex')
    ownerCondition = 'delete_token_hash = $2'
    ownerParams = [hash, tokenHash]
  }

  if (purge === 'true') {
    // Hard-delete: removes shared note + analytics (via CASCADE)
    const result = await query(
      `DELETE FROM shared_notes WHERE hash = $1 AND ${ownerCondition} RETURNING id, automerge_url`,
      ownerParams,
    )
    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Shared note not found or not owned by you',
      })
    }
    // Boot everyone from the room — the share no longer exists.
    await notifyCollabRevoke({ automergeUrl: result.rows[0].automerge_url })
    return { deleted: true, purged: true }
  }

  // Soft-delete: stop sharing but keep analytics
  const result = await query(
    `UPDATE shared_notes SET deleted_at = NOW() WHERE hash = $1 AND ${ownerCondition} AND deleted_at IS NULL RETURNING id, automerge_url`,
    ownerParams,
  )

  if (result.rows.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shared note not found or not owned by you',
    })
  }

  // Boot everyone — sharing has stopped.
  await notifyCollabRevoke({ automergeUrl: result.rows[0].automerge_url })
  return { deleted: true }
})
