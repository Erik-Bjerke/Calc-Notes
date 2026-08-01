import { requireAuth } from '../../utils/auth.js'
import { query } from '../../utils/db.js'
import { notifySync } from '../../utils/syncBroadcast.js'

/**
 * POST /api/notes/sync — Bulk sync endpoint.
 *
 * Client sends:
 *   { notes: [...], deletedClientIds: [...], lastSyncedAt: ISO_DATE | null }
 *
 * Server responds:
 *   { pushed: [...], pulled: [...], deletedClientIds: [...], syncedAt: ISO_DATE }
 *
 * Deletion strategy: hard delete.
 * - Client sends deletedClientIds → server deletes those notes immediately.
 * - A lightweight tombstone (user_id + client_id only, no content) is recorded
 *   so other devices learn about the deletion on their next sync.
 * - Tombstones older than 30 days are purged automatically.
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const body = await readBody(event)
  const {
    notes: clientNotes = [],
    deletedClientIds = [],
    sessionId,
    broadcast,
    welcomeCreated,
  } = body || {}

  const deletedSet = new Set(deletedClientIds)

  // 0. Fetch data_wiped_at — reject notes older than the last wipe
  const userRow = await query('SELECT data_wiped_at FROM users WHERE id = $1', [auth.userId])
  const dataWipedAt = userRow.rows[0]?.data_wiped_at
    ? new Date(userRow.rows[0].data_wiped_at)
    : null

  // 1. Hard-delete notes and record tombstones for multi-device sync
  if (deletedClientIds.length > 0) {
    await query('DELETE FROM notes WHERE user_id = $1 AND client_id = ANY($2)', [
      auth.userId,
      deletedClientIds,
    ])
    // Record tombstones so other devices learn about the deletion
    for (const clientId of deletedClientIds) {
      await query(
        `INSERT INTO deleted_notes (user_id, client_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [auth.userId, clientId],
      )
    }
  }

  // 2. Upsert each client note — skip if tombstoned
  const pushed = []

  for (const note of clientNotes) {
    if (!note.clientId || deletedSet.has(note.clientId)) continue

    // Reject notes that predate the last data wipe (stale offline data)
    if (dataWipedAt && note.updatedAt && new Date(note.updatedAt) < dataWipedAt) continue

    // Check if this note was deleted (tombstone exists)
    const tombstone = await query(
      'SELECT 1 FROM deleted_notes WHERE user_id = $1 AND client_id = $2',
      [auth.userId, note.clientId],
    )
    if (tombstone.rows.length > 0) continue

    // Tags may be an encrypted string (E2E) or an array (legacy).
    const tagsValue = typeof note.tags === 'string' ? note.tags : JSON.stringify(note.tags || [])

    const result = await query(
      `
      INSERT INTO notes (user_id, client_id, title, description, tags, content, sort_order, archived, deleted_at, internal_name, group_id, collab, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL
      DO UPDATE SET
        title = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.title ELSE notes.title END,
        description = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.description ELSE notes.description END,
        tags = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.tags ELSE notes.tags END,
        content = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.content ELSE notes.content END,
        sort_order = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.sort_order ELSE notes.sort_order END,
        archived = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.archived ELSE notes.archived END,
        deleted_at = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.deleted_at ELSE notes.deleted_at END,
        internal_name = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.internal_name ELSE notes.internal_name END,
        group_id = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.group_id ELSE notes.group_id END,
        collab = CASE WHEN EXCLUDED.updated_at >= notes.updated_at THEN EXCLUDED.collab ELSE notes.collab END,
        updated_at = GREATEST(EXCLUDED.updated_at, notes.updated_at)
      RETURNING id, client_id, title, description, tags, content, sort_order, archived, deleted_at, internal_name, group_id, collab, created_at, updated_at
    `,
      [
        auth.userId,
        note.clientId,
        note.title || 'Untitled Note',
        note.description || '',
        tagsValue,
        note.content || '',
        note.sortOrder ?? 0,
        note.archived ?? false,
        note.deletedAt || null,
        note.internalName || '',
        note.groupId || null,
        note.collab || null,
        note.createdAt || new Date().toISOString(),
        note.updatedAt || new Date().toISOString(),
      ],
    )

    if (result.rows.length > 0) {
      const row = result.rows[0]
      pushed.push({
        id: row.id,
        clientId: row.client_id,
        title: row.title,
        description: row.description,
        tags: row.tags,
        content: row.content,
        sortOrder: row.sort_order,
        archived: row.archived,
        deletedAt: row.deleted_at,
        internalName: row.internal_name,
        groupId: row.group_id,
        collab: row.collab,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    }
  }

  // 3. Tell the client which of its notes have been deleted
  const allClientIds = clientNotes.map((n) => n.clientId).filter(Boolean)
  let serverDeletedIds = []
  if (allClientIds.length > 0) {
    const deletedResult = await query(
      'SELECT client_id FROM deleted_notes WHERE user_id = $1 AND client_id = ANY($2)',
      [auth.userId, allClientIds],
    )
    serverDeletedIds = deletedResult.rows.map((r) => r.client_id)
  }

  // 4. Pull all notes from server
  const pullResult = await query(
    `
    SELECT id, client_id, title, description, tags, content, sort_order, archived, deleted_at, internal_name, group_id, collab, created_at, updated_at
    FROM notes WHERE user_id = $1
    ORDER BY sort_order ASC
  `,
    [auth.userId],
  )

  const pulled = pullResult.rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    content: row.content,
    sortOrder: row.sort_order,
    archived: row.archived,
    deletedAt: row.deleted_at,
    internalName: row.internal_name,
    groupId: row.group_id,
    collab: row.collab,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  // Notify other connected clients
  if (broadcast !== false) {
    notifySync(auth.userId, sessionId || null)
  }

  // Welcome-note flag
  if (welcomeCreated) {
    await query(
      'UPDATE users SET welcome_created = TRUE WHERE id = $1 AND welcome_created = FALSE',
      [auth.userId],
    )
  }
  const wcRow = await query('SELECT welcome_created FROM users WHERE id = $1', [auth.userId])
  const serverWelcomeCreated = wcRow.rows[0]?.welcome_created ?? false

  // Purge old tombstones (30 days)
  await query(
    `DELETE FROM deleted_notes WHERE user_id = $1 AND deleted_at < NOW() - INTERVAL '30 days'`,
    [auth.userId],
  )

  return {
    pushed,
    pulled,
    deletedClientIds: serverDeletedIds,
    syncedAt: new Date().toISOString(),
    welcomeCreated: serverWelcomeCreated,
  }
})
