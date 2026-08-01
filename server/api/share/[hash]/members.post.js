import { requireAuth } from '../../../utils/auth.js'
import { query } from '../../../utils/db.js'
import { ensureShareMembersTable, getOwnedShare } from '../../../utils/shareMembers.js'

/**
 * POST /api/share/:hash/members — Add (or re-activate) an account on a share's
 * allowlist. Owner only.
 *
 * Body: { email, role? }  role = 'editor' (default) | 'viewer'
 *
 * The email must belong to an existing account — matching the "grant specific
 * accounts access" model. Re-adding a previously-revoked member re-activates it.
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const hash = getRouterParam(event, 'hash')
  const body = (await readBody(event)) || {}
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role === 'viewer' ? 'viewer' : 'editor'

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  await ensureShareMembersTable()
  const share = await getOwnedShare(hash, auth.userId)
  if (!share) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shared note not found or not owned by you',
    })
  }

  const userRes = await query('SELECT id, name FROM users WHERE email = $1', [email])
  const memberUser = userRes.rows[0]
  if (!memberUser) {
    throw createError({ statusCode: 404, statusMessage: 'No account found with that email' })
  }
  if (memberUser.id === auth.userId) {
    throw createError({ statusCode: 400, statusMessage: 'You already own this share' })
  }

  const result = await query(
    `INSERT INTO share_members (shared_note_id, user_id, email, role, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (shared_note_id, user_id) WHERE user_id IS NOT NULL
     DO UPDATE SET role = EXCLUDED.role, status = 'active', email = EXCLUDED.email, updated_at = NOW()
     RETURNING id, user_id, email, role, status`,
    [share.id, memberUser.id, email, role],
  )

  const m = result.rows[0]
  return {
    id: m.id,
    userId: m.user_id,
    email: m.email,
    name: memberUser.name || null,
    role: m.role,
    status: m.status,
  }
})
