import { requireAuth } from '../../../../utils/auth.js'
import { query } from '../../../../utils/db.js'
import { ensureShareMembersTable, getOwnedShare } from '../../../../utils/shareMembers.js'
import { notifyCollabRevoke } from '../../../../utils/collabRevoke.js'

/**
 * DELETE /api/share/:hash/members/:memberId — Revoke a member (kick). Owner only.
 *
 * Marks the member 'revoked' (kept for audit and to block re-entry to a private
 * share) rather than hard-deleting. Immediate disconnection of a live session is
 * wired separately via the revocation signal the numori-crdt sync service
 * listens for (see server/utils/collabRevoke.js).
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const hash = getRouterParam(event, 'hash')
  const memberId = getRouterParam(event, 'memberId')

  await ensureShareMembersTable()
  const share = await getOwnedShare(hash, auth.userId)
  if (!share) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shared note not found or not owned by you',
    })
  }

  const result = await query(
    `UPDATE share_members SET status = 'revoked', updated_at = NOW()
     WHERE id = $1 AND shared_note_id = $2
     RETURNING id, user_id`,
    [memberId, share.id],
  )
  if (result.rows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  // Boot the revoked account's live sockets. On a private share they can't
  // reconnect; on a public share this is a best-effort nudge (they may rejoin).
  const revokedUserId = result.rows[0].user_id
  if (revokedUserId != null) {
    await notifyCollabRevoke({ automergeUrl: share.automerge_url, userId: revokedUserId })
  }

  return { revoked: true, memberId: result.rows[0].id, userId: revokedUserId }
})
