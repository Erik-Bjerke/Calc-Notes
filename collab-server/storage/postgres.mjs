/**
 * PostgreSQL-backed Automerge storage adapter.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DESIGN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * automerge-repo persists each document as a set of binary *chunks* keyed by a
 * hierarchical StorageKey (`string[]`), e.g.
 *   [documentId, "snapshot", hash]
 *   [documentId, "incremental", hash]
 *
 * We store the key as a native Postgres `text[]` so prefix (range) queries are
 * exact and correct for arbitrary key strings — no delimiter escaping games.
 * The binary chunk is stored as `bytea`.
 *
 * Range queries match on a key prefix by comparing the leading slice of the
 * stored key against the requested prefix: `key[1:N] = prefix`.
 *
 * Durability: because chunks are written on every change and snapshots are
 * compacted by the repo, a fresh sync-server process (or a late-joining peer)
 * can fully reconstruct any document from storage.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { query } from '../db.mjs'

const TABLE = 'collab_chunks'

let schemaReady = null

/** Create the chunk table if it doesn't exist (idempotent). */
export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        key   TEXT[] NOT NULL,
        data  BYTEA,
        PRIMARY KEY (key)
      )
    `)
  }
  await schemaReady
}

export class PostgresStorageAdapter {
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.ensure=true] run the schema migration lazily on first use
   */
  constructor(opts = {}) {
    this.ensure = opts.ensure !== false
    this._ready = null
  }

  async _prepare() {
    if (this.ensure) {
      if (!this._ready) this._ready = ensureSchema()
      await this._ready
    }
  }

  /** @param {string[]} key */
  async load(key) {
    await this._prepare()
    const res = await query(`SELECT data FROM ${TABLE} WHERE key = $1`, [key])
    if (res.rows.length === 0) return undefined
    const data = res.rows[0].data
    return data == null ? undefined : new Uint8Array(data)
  }

  /**
   * @param {string[]} key
   * @param {Uint8Array} data
   */
  async save(key, data) {
    await this._prepare()
    await query(
      `INSERT INTO ${TABLE} (key, data) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
      [key, Buffer.from(data)],
    )
  }

  /** @param {string[]} key */
  async remove(key) {
    await this._prepare()
    await query(`DELETE FROM ${TABLE} WHERE key = $1`, [key])
  }

  /**
   * @param {string[]} keyPrefix
   * @returns {Promise<Array<{ key: string[], data: Uint8Array | undefined }>>}
   */
  async loadRange(keyPrefix) {
    await this._prepare()
    const len = keyPrefix.length
    // key[1:len] selects the leading `len` elements of the stored key (Postgres
    // arrays are 1-indexed and slices are inclusive). Matches all keys under
    // the prefix. An empty prefix matches everything.
    const res =
      len === 0
        ? await query(`SELECT key, data FROM ${TABLE}`)
        : await query(`SELECT key, data FROM ${TABLE} WHERE key[1:${len}] = $1`, [keyPrefix])
    return res.rows.map((row) => ({
      key: row.key,
      data: row.data == null ? undefined : new Uint8Array(row.data),
    }))
  }

  /** @param {string[]} keyPrefix */
  async removeRange(keyPrefix) {
    await this._prepare()
    const len = keyPrefix.length
    if (len === 0) {
      await query(`DELETE FROM ${TABLE}`)
      return
    }
    await query(`DELETE FROM ${TABLE} WHERE key[1:${len}] = $1`, [keyPrefix])
  }
}
