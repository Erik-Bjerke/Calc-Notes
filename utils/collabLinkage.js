/**
 * Serialise/parse the collaborative linkage that travels with a note through
 * the E2E-encrypted account sync.
 *
 * A collaborative note's binding lives locally in `db.collabDocs`
 * (`{ noteId, hash, automergeUrl, collabToken }`). To make collaboration follow
 * the account across devices we sync only the DURABLE part — the share `hash`
 * and `automergeUrl` — as an encrypted blob on the note's `collab` field. The
 * short-lived capability token is deliberately NEVER synced; each device
 * re-mints its own from the hash when the editor binds.
 *
 * These helpers are pure: the caller injects the encrypt/decrypt functions
 * (already bound to the user's key), which keeps them trivially unit-testable
 * and free of Web Crypto / Nuxt coupling.
 */

/**
 * Build the encrypted `collab` field for a note's outgoing sync payload.
 *
 * @param {{hash?: string|null, automergeUrl?: string}|null|undefined} mapping
 *        a `db.collabDocs` row (or nothing)
 * @param {(plaintext: string) => Promise<string>} encryptFn key-bound encryptor
 * @returns {Promise<string|null>} the encrypted blob, or null when the note is
 *          not collaborative (no automergeUrl)
 */
export async function encodeCollabLinkage(mapping, encryptFn) {
  if (!mapping?.automergeUrl) return null
  return encryptFn(
    JSON.stringify({ hash: mapping.hash || null, automergeUrl: mapping.automergeUrl }),
  )
}

/**
 * Parse an incoming encrypted `collab` blob into a linkage object.
 *
 * @param {string|null|undefined} blob the encrypted `collab` field from a pulled note
 * @param {(ciphertext: string) => Promise<string>} decryptFn key-bound decryptor
 * @returns {Promise<{hash: string|null, automergeUrl: string}|null>} the linkage,
 *          or null when absent or malformed
 */
export async function decodeCollabLinkage(blob, decryptFn) {
  if (!blob) return null
  try {
    const parsed = JSON.parse(await decryptFn(blob))
    if (!parsed?.automergeUrl) return null
    return { hash: parsed.hash || null, automergeUrl: parsed.automergeUrl }
  } catch {
    return null
  }
}
