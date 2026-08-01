import { requireAuth } from '../../../utils/auth.js'
import { query } from '../../../utils/db.js'
import { ensureShareMembersTable, getOwnedShare } from '../../../utils/shareMembers.js'

/**
 * GET /api/share/:hash/members — List the members/allowlist of a share.
 * Owner only.
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const hash = getRouterParam(event, 'hash')

  await ensureShareMembersTable()
  const share = await getOwnedShare(hash, auth.userId)
  if (!share) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shared note not found or not owned by you',
    })
  }

  const result = await query(
    `SELECT sm.id, sm.user_id, COALESCE(sm.email, u.email) AS email, sm.role, sm.status, u.name
     FROM share_members sm
     LEFT JOIN users u ON u.id = sm.user_id
     WHERE sm.shared_note_id = $1
     ORDER BY sm.created_at ASC`,
    [share.id],
  )

  return result.rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    email: m.email,
    name: m.name || null,
    role: m.role,
    status: m.status,
  }))
})
