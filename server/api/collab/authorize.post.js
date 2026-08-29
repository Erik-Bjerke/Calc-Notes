import {
  verifyWebhookSignature,
  authorizeCollabRoom,
  AuthorizeLookupError,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '../../utils/collabAuthorize.js'
import { toDocumentId } from '../../utils/collabToken.js'

/**
 * POST /api/collab/authorize — authorization endpoint for the CRDT sync service.
 *
 * The sync service calls this when a peer opens a connection, and again whenever
 * that peer reaches for a document its token did not name. We answer from the
 * live state of `shared_notes` / `share_members`, so a kicked member or a deleted
 * share stops syncing without waiting for their token to expire.
 *
 * Configure `CRDT_WEBHOOK_SECRET` here and the matching `webhookSecretEnv` on the
 * app in the sync service's registry. Requests are HMAC-signed over
 * `timestamp.body`; unsigned or stale requests are refused.
 *
 * Request body (from the sync service):
 *   { appId, check, documentId, documentIds, userId, sid, kind, access, name, … }
 *
 * Response:
 *   200 { allow: true }              may join
 *   200 { allow: false, reason }     may not join
 *   401                              signature missing, stale or wrong
 *   500                              our database could not answer
 *
 * Note the deliberate distinction between 401/500 and `{ allow: false }`. A
 * denial is an answer; a 500 is the absence of one, and the sync service's own
 * failure policy (fail closed by default) decides what to do about it. Returning
 * `allow: false` on an internal error would look identical to a real denial and
 * hide the outage.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.CRDT_WEBHOOK_SECRET

  if (!secret) {
    // Refuse rather than trust an unauthenticated caller: this endpoint decides
    // who can read collaborative documents.
    console.warn('[collab] /api/collab/authorize called but CRDT_WEBHOOK_SECRET is not configured')
    throw createError({ statusCode: 401, statusMessage: 'Authorization endpoint not configured' })
  }

  // The signature covers the exact bytes received, so verify before parsing.
  const rawBody = (await readRawBody(event, 'utf8')) || ''
  const verification = verifyWebhookSignature({
    rawBody,
    timestamp: getHeader(event, TIMESTAMP_HEADER),
    signature: getHeader(event, SIGNATURE_HEADER),
    secret,
  })
  if (!verification.ok) {
    console.warn(`[collab] authorize request rejected: ${verification.reason}`)
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Body is not valid JSON' })
  }

  const documentId = toDocumentId(payload?.documentId)
  if (!documentId) {
    return { allow: false, reason: 'no documentId supplied' }
  }

  try {
    const decision = await authorizeCollabRoom({
      documentId,
      userId: payload.userId ?? null,
      kind: payload.kind ?? 'guest',
    })
    return { allow: decision.allow, reason: decision.reason }
  } catch (err) {
    if (err instanceof AuthorizeLookupError) {
      console.error(`[collab] authorize lookup failed: ${err.cause?.message ?? err.message}`)
      throw createError({ statusCode: 500, statusMessage: 'Authorization lookup failed' })
    }
    throw err
  }
})
