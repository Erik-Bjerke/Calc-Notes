/**
 * Guest-kick deterrent marker.
 *
 * When a guest (no account) is kicked from a collaborative room, the sync
 * service boots their socket with close code 4001. We then drop a small marker
 * in localStorage keyed by the share hash so a plain page refresh won't
 * auto-rejoin. This is intentionally a soft deterrent — clearing site data,
 * incognito, another browser or device all bypass it — matching the product
 * decision that kicking anonymous editors is best-effort (only private,
 * account-based shares are hard-enforceable server-side).
 *
 * Reads globalThis.localStorage lazily so it is safe on the server (SSR is off
 * here, but guards keep it inert) and stubbable in tests.
 */

const PREFIX = 'numori-collab-kicked:'

function store() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Mark the given share hash as kicked for this browser profile. */
export function markKicked(hash) {
  if (!hash) return
  const s = store()
  if (!s) return
  try {
    s.setItem(PREFIX + hash, '1')
  } catch {
    /* storage full / unavailable */
  }
}

/** Whether this browser profile has been kicked from the given share. */
export function isKicked(hash) {
  if (!hash) return false
  const s = store()
  if (!s) return false
  try {
    return s.getItem(PREFIX + hash) === '1'
  } catch {
    return false
  }
}

/** Clear the kicked marker (e.g. the owner re-invites, or manual reset). */
export function clearKick(hash) {
  if (!hash) return
  const s = store()
  if (!s) return
  try {
    s.removeItem(PREFIX + hash)
  } catch {
    /* ignore */
  }
}
