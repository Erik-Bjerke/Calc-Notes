import { query } from './db.js'

/**
 * Idempotently ensure the share_members table exists. migrate() creates it on
 * boot; endpoints call this as a belt-and-suspenders guard (matching the
 * ensure* pattern used elsewhere for freshly-added tables/columns).
 */
export async function ensureShareMembersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS share_members (
      id             SERIAL PRIMARY KEY,
      shared_note_id INTEGER NOT NULL REFERENCES shared_notes(id) ON DELETE CASCADE,
      user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      email          TEXT,
      role           TEXT NOT NULL DEFAULT 'editor',
      status         TEXT NOT NULL DEFAULT 'active',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {})
  await query(
    `CREATE INDEX IF NOT EXISTS idx_share_members_shared_note_id ON share_members(shared_note_id)`,
  ).catch(() => {})
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_share_members_note_user
     ON share_members(shared_note_id, user_id) WHERE user_id IS NOT NULL`,
  ).catch(() => {})
}

/**
 * Fetch a share row by hash only if it is active and owned by `userId`.
 * Returns the row ({ id, user_id, mode, access }) or null when missing/not owned.
 */
export async function getOwnedShare(hash, userId) {
  const result = await query(
    `SELECT id, user_id, mode, access, automerge_url FROM shared_notes WHERE hash = $1 AND deleted_at IS NULL`,
    [hash],
  )
  const row = result.rows[0]
  if (!row || row.user_id !== userId) return null
  return row
}
