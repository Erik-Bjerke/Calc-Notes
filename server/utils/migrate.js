import { query } from './db.js'

/**
 * Database migration — creates tables if they don't exist.
 * Safe to run multiple times (idempotent).
 */
export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      avatar_url    TEXT,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS notes (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id   TEXT,
      title       TEXT NOT NULL DEFAULT 'Untitled Note',
      description TEXT NOT NULL DEFAULT '',
      tags        TEXT NOT NULL DEFAULT '[]',
      content     TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Index for fast user lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)
  `)

  // Unique constraint: one client_id per user (for sync dedup)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_client_id
    ON notes(user_id, client_id) WHERE client_id IS NOT NULL
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS shared_notes (
      id              SERIAL PRIMARY KEY,
      hash            TEXT UNIQUE NOT NULL,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title           TEXT NOT NULL DEFAULT 'Shared Note',
      description     TEXT NOT NULL DEFAULT '',
      tags            TEXT NOT NULL DEFAULT '[]',
      content         TEXT NOT NULL DEFAULT '',
      sharer_name     TEXT,
      sharer_email    TEXT,
      anonymous       BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shared_notes_hash ON shared_notes(hash)
  `)

  // Add avatar_url column if missing (for existing databases)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add sort_order column for manual ordering
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Drop legacy columns that are no longer used
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users DROP COLUMN IF EXISTS deletion_requested_at;
      ALTER TABLE notes DROP COLUMN IF EXISTS deleted_at;
    EXCEPTION WHEN others THEN NULL;
    END $do$
  `)

  // Lightweight tombstone table for multi-device sync (no note content stored)
  await query(`
    CREATE TABLE IF NOT EXISTS deleted_notes (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id  TEXT NOT NULL,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, client_id)
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_deleted_notes_user_id ON deleted_notes(user_id)
  `)

  // Add collect_analytics flag to shared_notes
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS collect_analytics BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add privacy_no_tracking flag to users (default TRUE — privacy on by default)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_no_tracking BOOLEAN NOT NULL DEFAULT TRUE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Share views table for analytics
  await query(`
    CREATE TABLE IF NOT EXISTS share_views (
      id              SERIAL PRIMARY KEY,
      shared_note_id  INTEGER NOT NULL REFERENCES shared_notes(id) ON DELETE CASCADE,
      viewer_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      viewer_name     TEXT,
      user_agent      TEXT,
      ip_address      TEXT,
      referrer        TEXT,
      country         TEXT,
      event_type      TEXT NOT NULL DEFAULT 'view',
      viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_share_views_shared_note_id ON share_views(shared_note_id)
  `)

  // Add ip_address and event_type columns if missing (for existing databases)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS ip_address TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'view';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add deleted_at to shared_notes for soft-delete (analytics persist)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add viewer_fingerprint for identifying unique viewers across repeat visits
  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS viewer_fingerprint TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add extra header columns for richer analytics
  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS accept_language TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS dnt TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS sec_ch_ua TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add city and region columns for IP geolocation
  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS city TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE share_views ADD COLUMN IF NOT EXISTS region TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add encrypted flag to shared_notes for E2E encrypted shares
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Change notes.tags and shared_notes.tags column type from JSONB to TEXT
  // to support encrypted payloads (encrypted tags are JSON strings like { iv, ct }).
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ALTER COLUMN tags TYPE TEXT USING tags::TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ALTER COLUMN tags TYPE TEXT USING tags::TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $do$
  `)

  // Add source_client_id to shared_notes so we can match shares to local notes
  // without relying on title comparison (which breaks with encrypted titles)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS source_client_id TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add password_hint to shared_notes for password-protected shares
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS password_hint TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // ── Collaborative sharing ──────────────────────────────────────────────
  // A share is either 'read-only' (static snapshot, existing behaviour) or
  // 'collaborative' (real-time co-editing backed by an Automerge document).
  // `allow_guests` controls whether users without an account may join.
  // `automerge_url` holds the collaborative document reference (automerge:...).
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'read-only';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS automerge_url TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Track whether the welcome note has been created for this user
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_created BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add archived flag to notes
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add deleted_at for soft-delete (bin) support
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add internal_name to notes for normalised identifier
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS internal_name TEXT NOT NULL DEFAULT '';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add group_id to notes for note grouping
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS group_id TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add collab linkage to notes. Holds an E2E-encrypted JSON blob
  // ({ hash, automergeUrl }) so a collaborative note's binding follows the
  // account and reaches other devices. Opaque to the server; collab tokens are
  // never stored here — each device re-mints them from the share hash.
  await query(`
    DO $do$ BEGIN
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS collab TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Groups table for note grouping
  await query(`
    CREATE TABLE IF NOT EXISTS groups (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id     TEXT,
      name          TEXT NOT NULL DEFAULT 'New Group',
      internal_name TEXT NOT NULL DEFAULT '',
      sort_order    INTEGER NOT NULL DEFAULT 0,
      collapsed     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id)
  `)

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_user_client_id
    ON groups(user_id, client_id) WHERE client_id IS NOT NULL
  `)

  // Add parent_id to groups for nested folders (stores the parent's client_id)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS parent_id TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add deleted_at to groups for soft-delete (bin) support
  await query(`
    DO $do$ BEGIN
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Lightweight tombstone table for multi-device group deletion sync
  await query(`
    CREATE TABLE IF NOT EXISTS deleted_groups (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id  TEXT NOT NULL,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, client_id)
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_deleted_groups_user_id ON deleted_groups(user_id)
  `)

  // Email verification and password recovery
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_purpose TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_recovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Sessions table for multi-device session management
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash    TEXT NOT NULL,
      device_name   TEXT,
      ip_address    TEXT,
      location      TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)
  `)

  // Add session_duration preference to users (default 7 days in seconds)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS session_duration INTEGER NOT NULL DEFAULT 604800;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Add expires_at to sessions for server-side expiry enforcement
  await query(`
    DO $do$ BEGIN
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // App lock settings (JSON) for per-user app lock configuration
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS app_lock_settings JSONB;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Privacy screen preference (synced across devices, applied on native only)
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_screen_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  // Timestamp of last data wipe — used to reject stale notes from offline devices
  await query(`
    DO $do$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS data_wiped_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $do$
  `)

  console.warn('[migrate] Database tables ready')
}
