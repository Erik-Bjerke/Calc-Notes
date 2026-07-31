import { createHash } from 'node:crypto'
import { query } from '../../utils/db.js'
import { optionalAuth } from '../../utils/auth.js'
import { enrichShareView } from '../../utils/geo.js'
import { signCollabToken, toDocumentId } from '../../utils/collabToken.js'

// Ensure password_hint column exists (idempotent, safe to call on every request)
async function ensurePasswordHintColumn() {
  await query(`ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS password_hint TEXT`).catch(
    () => {},
  )
}

/**
 * GET /api/share/:hash — Retrieve a shared note by its hash.
 * No authentication required. Records a view if analytics are enabled.
 */
export default defineEventHandler(async (event) => {
  const hash = getRouterParam(event, 'hash')

  if (!hash || hash.length !== 32) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid share link' })
  }

  await ensurePasswordHintColumn()

  const result = await query(
    `
    SELECT id, hash, title, description, tags, content, sharer_name, sharer_email,
           anonymous, expires_at, created_at, collect_analytics, deleted_at, encrypted, password_hint,
           mode, allow_guests, automerge_url
    FROM shared_notes WHERE hash = $1
  `,
    [hash],
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Shared note not found' })
  }

  const row = result.rows[0]

  if (row.deleted_at) {
    throw createError({ statusCode: 410, statusMessage: 'This shared note is no longer available' })
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'This shared note has expired' })
  }

  if (row.collect_analytics) {
    await recordEvent(event, row.id, 'view')
  }

  const mode = row.mode === 'collaborative' ? 'collaborative' : 'read-only'
  const allowGuests = row.allow_guests === true

  const response = {
    hash: row.hash,
    title: row.title,
    description: row.description,
    tags: row.tags,
    content: row.content,
    encrypted: row.encrypted === true,
    sharer: row.anonymous
      ? null
      : {
          name: row.sharer_name,
          email: row.sharer_email,
        },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    passwordHint: row.password_hint || null,
    mode,
    allowGuests,
    automergeUrl: mode === 'collaborative' ? row.automerge_url || null : null,
  }

  // For collaborative shares, mint a capability token so the viewer can connect
  // to the sync service and co-edit. Guests (no account) are only admitted when
  // the share allows guests; otherwise we signal that an account is required.
  if (mode === 'collaborative' && response.automergeUrl) {
    const auth = await optionalAuth(event)
    if (auth) {
      const meResult = await query('SELECT name FROM users WHERE id = $1', [auth.userId])
      response.collabToken = await signCollabToken({
        documentId: toDocumentId(response.automergeUrl),
        access: 'write',
        kind: 'user',
        name: meResult.rows[0]?.name || 'User',
      })
    } else if (allowGuests) {
      response.collabToken = await signCollabToken({
        documentId: toDocumentId(response.automergeUrl),
        access: 'write',
        kind: 'guest',
        name: 'Guest',
      })
    } else {
      response.collabToken = null
      response.requiresAccount = true
    }
  }

  return response
})

/**
 * Build a viewer fingerprint to identify the same person across repeat visits.
 * Uses IP + User-Agent + Accept-Language + DNT for anonymous visitors.
 * Accept-Language varies per user's locale preferences.
 * DNT is a binary signal that differs per user's privacy settings.
 */
function buildFingerprint(auth, privacyOn, ipAddress, userAgent, acceptLang, dnt, sharedNoteId) {
  if (auth && !privacyOn) {
    return `user:${auth.userId}`
  }
  if (auth && privacyOn) {
    const raw = `private:${auth.userId}:${sharedNoteId}`
    return `private:${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`
  }
  const raw = `anon:${ipAddress || 'no-ip'}:${userAgent || 'no-ua'}:${acceptLang || 'no-lang'}:${dnt || 'no-dnt'}`
  return `anon:${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`
}

/**
 * Record a view or import event for analytics.
 * Collects all available passive HTTP headers.
 */
async function recordEvent(event, sharedNoteId, eventType) {
  const auth = await optionalAuth(event)
  const userAgent = getHeader(event, 'user-agent') || null
  const referrer = getHeader(event, 'referer') || null
  const acceptLang = getHeader(event, 'accept-language') || null
  const dnt = getHeader(event, 'dnt') || null
  const secChUa = getHeader(event, 'sec-ch-ua') || null

  const forwarded = getHeader(event, 'x-forwarded-for')
  const realIp = getHeader(event, 'x-real-ip')
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : realIp || null

  let viewerUserId = null
  let viewerName = null
  let recordUserAgent = null
  let recordIp = null
  let recordAcceptLang = null
  let recordDnt = null
  let recordSecChUa = null
  let privacyOn = false

  if (auth) {
    const privResult = await query('SELECT privacy_no_tracking, name FROM users WHERE id = $1', [
      auth.userId,
    ])
    const viewer = privResult.rows[0]
    privacyOn = !viewer || viewer.privacy_no_tracking
    if (viewer && !viewer.privacy_no_tracking) {
      viewerUserId = auth.userId
      viewerName = viewer.name || null
      recordUserAgent = userAgent
      recordIp = ipAddress
      recordAcceptLang = acceptLang
      recordDnt = dnt
      recordSecChUa = secChUa
    }
  } else {
    recordUserAgent = userAgent
    recordIp = ipAddress
    recordAcceptLang = acceptLang
    recordDnt = dnt
    recordSecChUa = secChUa
  }

  const fingerprint = buildFingerprint(
    auth,
    privacyOn,
    ipAddress,
    userAgent,
    acceptLang,
    dnt,
    sharedNoteId,
  )

  // Insert the record first, then enrich with geolocation asynchronously
  query(
    `
    INSERT INTO share_views (shared_note_id, viewer_user_id, viewer_name, user_agent, ip_address, referrer, event_type, viewer_fingerprint, accept_language, dnt, sec_ch_ua)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `,
    [
      sharedNoteId,
      viewerUserId,
      viewerName,
      recordUserAgent,
      recordIp,
      referrer,
      eventType,
      fingerprint,
      recordAcceptLang,
      recordDnt,
      recordSecChUa,
    ],
  )
    .then((res) => {
      const recordId = res.rows[0]?.id
      const geoIp = recordIp || ipAddress
      if (recordId) {
        enrichShareView(event, geoIp, recordId)
      }
    })
    .catch(() => {})
}
