import { randomBytes, createHash } from 'node:crypto'
import { optionalAuth } from '../../utils/auth.js'
import { query } from '../../utils/db.js'
import { signCollabToken, toDocumentId } from '../../utils/collabToken.js'

// Ensure extra columns exist (idempotent, safe to call on every request)
async function ensureExtraColumns() {
  await query(`ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS password_hint TEXT`).catch(
    () => {},
  )
  await query(`ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS delete_token_hash TEXT`).catch(
    () => {},
  )
  await query(
    `ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'read-only'`,
  ).catch(() => {})
  await query(
    `ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE`,
  ).catch(() => {})
  await query(`ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS automerge_url TEXT`).catch(
    () => {},
  )
  await query(
    `ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'public'`,
  ).catch(() => {})
}

/**
 * POST /api/share — Share a note. No account required.
 *
 * Body:
 *   { title, description, tags, content, anonymous?, sharerName?, sharerEmail?,
 *     expiresInDays?, collectAnalytics?, encrypted? }
 *
 * When `encrypted` is true, the title/description/tags/content fields contain
 * AES-GCM ciphertext produced by the client. The server stores them opaquely.
 *
 * If authenticated and not anonymous, sharer details come from the user account.
 * Returns: { hash, deleteToken? }
 *
 * For anonymous (non-authenticated) shares, a one-time `deleteToken` is returned.
 * The client must store it locally to be able to stop sharing later.
 */
export default defineEventHandler(async (event) => {
  const auth = await optionalAuth(event)
  const body = await readBody(event)
  const {
    title,
    content,
    description,
    tags,
    anonymous,
    sharerName,
    sharerEmail,
    expiresInDays,
    collectAnalytics,
    encrypted,
    passwordHint,
    mode: rawMode,
    allowGuests,
    automergeUrl,
    access: rawAccess,
  } = body || {}

  // Collaborative sharing: a share is 'read-only' (static snapshot) or
  // 'collaborative' (real-time co-editing backed by an Automerge document).
  const mode = rawMode === 'collaborative' ? 'collaborative' : 'read-only'

  // Access model: 'private' restricts a collaborative share to allowlisted
  // accounts (see share_members); 'public' is link-based. Defaults to public.
  const access = rawAccess === 'private' ? 'private' : 'public'

  if (!content && !title) {
    throw createError({ statusCode: 400, statusMessage: 'Title or content is required to share' })
  }

  const hash = randomBytes(16).toString('hex')

  // Determine sharer identity
  let name = null
  let email = null
  let userId = null
  const isAnonymous = anonymous === true

  if (auth && !isAnonymous) {
    userId = auth.userId
    const userResult = await query('SELECT name, email FROM users WHERE id = $1', [auth.userId])
    if (userResult.rows.length > 0) {
      name = userResult.rows[0].name || null
      email = userResult.rows[0].email || null
    }
  } else if (!isAnonymous) {
    name = sharerName || null
    email = sharerEmail || null
  }

  // Expiry policy:
  //  - read-only shares keep the existing 1–30 day window (default 30).
  //  - collaborative shares are owner-controlled: no expiry by default
  //    (expires_at = NULL); a positive expiresInDays opts into one, with no
  //    30-day cap since the owner decides how long it lives.
  let expiresAt
  if (mode === 'collaborative') {
    const collabDays = parseInt(expiresInDays)
    expiresAt =
      Number.isFinite(collabDays) && collabDays > 0
        ? new Date(Date.now() + collabDays * 86400000).toISOString()
        : null
  } else {
    const days = Math.min(Math.max(parseInt(expiresInDays) || 30, 1), 30)
    expiresAt = new Date(Date.now() + days * 86400000).toISOString()
  }

  // Tags may be an encrypted string or an array
  const tagsValue = typeof tags === 'string' ? tags : JSON.stringify(tags || [])

  const hint = passwordHint || null

  // Generate a delete token for non-authenticated shares so the creator can
  // stop sharing without needing an account. We store only the SHA-256 hash;
  // the plaintext token is returned once to the client.
  let deleteToken = null
  let deleteTokenHash = null
  if (!userId) {
    deleteToken = randomBytes(32).toString('hex')
    deleteTokenHash = createHash('sha256').update(deleteToken).digest('hex')
  }

  await ensureExtraColumns()

  const columns = [
    'hash',
    'user_id',
    'title',
    'description',
    'tags',
    'content',
    'sharer_name',
    'sharer_email',
    'anonymous',
    'expires_at',
    'collect_analytics',
    'encrypted',
    'source_client_id',
    // Collaborative sharing columns are appended AFTER source_client_id so the
    // fixed base parameter indices (0-12) remain stable for existing callers.
    'mode',
    'allow_guests',
    'automerge_url',
    'access',
  ]
  const params = [
    hash,
    userId,
    title || 'Shared Note',
    description || '',
    tagsValue,
    content || '',
    name,
    email,
    isAnonymous,
    expiresAt,
    collectAnalytics === true,
    encrypted === true,
    body.sourceClientId || null,
    mode,
    allowGuests === true,
    mode === 'collaborative' ? automergeUrl || null : null,
    access,
  ]

  if (hint) {
    columns.push('password_hint')
    params.push(hint)
  }

  if (deleteTokenHash) {
    columns.push('delete_token_hash')
    params.push(deleteTokenHash)
  }

  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ')
  await query(`INSERT INTO shared_notes (${columns.join(', ')}) VALUES (${placeholders})`, params)

  const response = { hash, mode, access }
  if (deleteToken) {
    response.deleteToken = deleteToken
  }

  // For a collaborative share, hand the creator a capability token so they can
  // connect to the sync service and start co-editing immediately.
  if (mode === 'collaborative' && automergeUrl) {
    response.automergeUrl = automergeUrl
    response.collabToken = await signCollabToken({
      documentId: toDocumentId(automergeUrl),
      access: 'write',
      kind: userId ? 'user' : 'guest',
      name: name || sharerName || 'Anonymous',
    })
  }
  return response
})
