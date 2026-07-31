import { requireAuth } from '../../utils/auth.js'
import { query } from '../../utils/db.js'

/**
 * POST /api/groups/sync — Bulk sync endpoint for note groups.
 *
 * Client sends:
 *   { groups: [...], deletedClientIds: [...] }
 *
 * Server responds:
 *   { pushed: [...], pulled: [...], deletedClientIds: [...], syncedAt: ISO_DATE }
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const body = await readBody(event)
  const { groups: clientGroups = [], deletedClientIds = [] } = body || {}

  const deletedSet = new Set(deletedClientIds)

  // 0. Fetch data_wiped_at — reject groups older than the last wipe
  const userRow = await query('SELECT data_wiped_at FROM users WHERE id = $1', [auth.userId])
  const dataWipedAt = userRow.rows[0]?.data_wiped_at
    ? new Date(userRow.rows[0].data_wiped_at)
    : null

  // 1. Delete groups and record tombstones
  if (deletedClientIds.length > 0) {
    await query('DELETE FROM groups WHERE user_id = $1 AND client_id = ANY($2)', [
      auth.userId,
      deletedClientIds,
    ])
    for (const clientId of deletedClientIds) {
      await query(
        `INSERT INTO deleted_groups (user_id, client_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [auth.userId, clientId],
      )
    }
  }

  // 2. Upsert each client group — skip if deleted or tombstoned
  const pushed = []

  for (const group of clientGroups) {
    if (!group.clientId || deletedSet.has(group.clientId)) continue

    // Reject groups that predate the last data wipe (stale offline data)
    if (dataWipedAt && group.updatedAt && new Date(group.updatedAt) < dataWipedAt) continue

    // Check if this group was deleted (tombstone exists)
    const tombstone = await query(
      'SELECT 1 FROM deleted_groups WHERE user_id = $1 AND client_id = $2',
      [auth.userId, group.clientId],
    )
    if (tombstone.rows.length > 0) continue

    const result = await query(
      `
      INSERT INTO groups (user_id, client_id, name, internal_name, sort_order, collapsed, parent_id, deleted_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL
      DO UPDATE SET
        name = CASE WHEN EXCLUDED.updated_at >= groups.updated_at THEN EXCLUDED.name ELSE groups.name END,
        internal_name = CASE WHEN EXCLUDED.updated_at >= groups.updated_at THEN EXCLUDED.internal_name ELSE groups.internal_name END,
        sort_order = CASE WHEN EXCLUDED.updated_at >= groups.updated_at THEN EXCLUDED.sort_order ELSE groups.sort_order END,
        collapsed = CASE WHEN EXCLUDED.updated_at >= groups.updated_at THEN EXCLUDED.collapsed ELSE groups.collapsed END,
        parent_id = CASE WHEN EXCLUDED.updated_at >= groups.updated_at THEN EXCLUDED.parent_id ELSE groups.parent_id END,
        deleted_at = CASE WHEN EXCLUDED.updated_at >= groups.updated_at THEN EXCLUDED.deleted_at ELSE groups.deleted_at END,
        updated_at = GREATEST(EXCLUDED.updated_at, groups.updated_at)
      RETURNING id, client_id, name, internal_name, sort_order, collapsed, parent_id, deleted_at, created_at, updated_at
    `,
      [
        auth.userId,
        group.clientId,
        group.name || 'New Group',
        group.internalName || '',
        group.sortOrder ?? 0,
        group.collapsed ?? false,
        group.parentId ?? null,
        group.deletedAt ?? null,
        group.createdAt || new Date().toISOString(),
        group.updatedAt || new Date().toISOString(),
      ],
    )

    if (result.rows.length > 0) {
      const row = result.rows[0]
      pushed.push({
        id: row.id,
        clientId: row.client_id,
        name: row.name,
        internalName: row.internal_name,
        sortOrder: row.sort_order,
        collapsed: row.collapsed,
        parentId: row.parent_id,
        deletedAt: row.deleted_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    }
  }

  // 3. Tell the client which of its groups have been deleted by other devices
  const allClientIds = clientGroups.map((g) => g.clientId).filter(Boolean)
  let serverDeletedIds = []
  if (allClientIds.length > 0) {
    const deletedResult = await query(
      'SELECT client_id FROM deleted_groups WHERE user_id = $1 AND client_id = ANY($2)',
      [auth.userId, allClientIds],
    )
    serverDeletedIds = deletedResult.rows.map((r) => r.client_id)
  }

  // 4. Pull all groups from server
  const pullResult = await query(
    `
    SELECT id, client_id, name, internal_name, sort_order, collapsed, parent_id, deleted_at, created_at, updated_at
    FROM groups WHERE user_id = $1
    ORDER BY sort_order ASC
  `,
    [auth.userId],
  )

  const pulled = pullResult.rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    internalName: row.internal_name,
    sortOrder: row.sort_order,
    collapsed: row.collapsed,
    parentId: row.parent_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  // Purge old tombstones (30 days)
  await query(
    `DELETE FROM deleted_groups WHERE user_id = $1 AND deleted_at < NOW() - INTERVAL '30 days'`,
    [auth.userId],
  )

  return {
    pushed,
    pulled,
    deletedClientIds: serverDeletedIds,
    syncedAt: new Date().toISOString(),
  }
})
