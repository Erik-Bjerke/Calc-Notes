import { createHash } from 'node:crypto'
import { optionalAuth } from '../../utils/auth.js'
import { query } from '../../utils/db.js'
import { notifyCollabRevoke } from '../../utils/collabRevoke.js'

/**
 * PATCH /api/share/:hash — Update an existing share's settings (owner only).
 *
 * Body (all fields optional; only provided fields are changed):
 *   expiresInDays — number > 0 sets an expiry that many days out; null/0 clears
 *                   it (never expires). Collaborative shares have no cap.
 *   allowGuests   — boolean; whether anonymous users may join.
 *   access        — 'public' | 'private' (allowlist-restricted collaboration).
 *   mode          — 'read-only' | 'collaborative'. NOTE: this only flips the
 *                   flag; provisioning/freezing the Automerge document is wired
 *                   separately (see mode-switching task).
 *
 * Authorization mirrors DELETE: an authenticated owner (user_id match) or, for
 * anonymous shares, a valid delete token via `X-Delete-Token` header / `_token`.
 */
export default defineEventHandler(async (event) => {
  const auth = await optionalAuth(event)
  const hash = getRouterParam(event, 'hash')
  const { _token } = getQuery(event)
  const deleteToken = getHeader(event, 'x-delete-token') || _token || null
  const body = (await readBody(event)) || {}

  if (!hash || hash.length !== 32) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid share link' })
  }
  if (!auth && !deleteToken) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication or delete token required' })
  }

  // Ensure the access column exists (idempotent) for older databases.
  await query(
    `ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'public'`,
  ).catch(() => {})

  // Build the SET clause from only the fields that were supplied.
  const updates = []
  const params = [hash]
  let p = 2

  if ('allowGuests' in body) {
    updates.push(`allow_guests = $${p++}`)
    params.push(body.allowGuests === true)
  }
  if ('access' in body) {
    updates.push(`access = $${p++}`)
    params.push(body.access === 'private' ? 'private' : 'public')
  }
  if ('mode' in body) {
    updates.push(`mode = $${p++}`)
    params.push(body.mode === 'collaborative' ? 'collaborative' : 'read-only')
  }
  // Mode-switch support: switching to collaborative supplies the client-created
  // Automerge document url; switching to read-only supplies the frozen content
  // snapshot. Both are optional and only set when provided.
  if ('automergeUrl' in body) {
    updates.push(`automerge_url = $${p++}`)
    params.push(body.automergeUrl || null)
  }
  if ('content' in body) {
    updates.push(`content = $${p++}`)
    params.push(typeof body.content === 'string' ? body.content : '')
  }
  if ('expiresInDays' in body) {
    const days = parseInt(body.expiresInDays)
    const expiresAt =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 86400000).toISOString()
        : null
    updates.push(`expires_at = $${p++}`)
    params.push(expiresAt)
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No settings to update' })
  }

  // Ownership condition (parameter appended after the SET params).
  let ownerCondition
  if (auth) {
    ownerCondition = `user_id = $${p}`
    params.push(auth.userId)
  } else {
    const tokenHash = createHash('sha256').update(deleteToken).digest('hex')
    ownerCondition = `delete_token_hash = $${p}`
    params.push(tokenHash)
  }

  const result = await query(
    `UPDATE shared_notes SET ${updates.join(', ')}, updated_at = NOW()
     WHERE hash = $1 AND ${ownerCondition} AND deleted_at IS NULL
     RETURNING hash, mode, allow_guests, access, expires_at, automerge_url`,
    params,
  )

  if (result.rows.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shared note not found or not owned by you',
    })
  }

  const row = result.rows[0]

  // If access-affecting settings changed, boot everyone so each peer reconnects
  // and is re-validated against the new rules (guests/non-members get refused,
  // members/owner re-admitted). Simpler and safe versus surgical targeting.
  if ('allowGuests' in body || 'access' in body || 'mode' in body) {
    await notifyCollabRevoke({ automergeUrl: row.automerge_url })
  }

  return {
    hash: row.hash,
    mode: row.mode,
    allowGuests: row.allow_guests === true,
    access: row.access,
    expiresAt: row.expires_at,
  }
})
