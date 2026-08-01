/**
 * Debug-gated logger for collaborative-editing diagnostics.
 *
 * The collab pipeline (WASM init, repo/network setup, document binding,
 * CodeMirror extension building) is chatty by nature — and some call sites fire
 * on every editor update. To keep the production console clean while leaving the
 * breadcrumbs one toggle away, `clog` only emits when the debug flag is set:
 *
 *   localStorage.setItem('numori-collab-debug', '1')  // enable, then reload
 *   localStorage.removeItem('numori-collab-debug')     // disable
 *
 * The flag is read once at module load (client only), so toggling it requires a
 * reload. In Node/Nitro and unit tests there is no `localStorage`, so logging
 * stays silent.
 */

const DEBUG_FLAG = 'numori-collab-debug'

let enabled = false
if (import.meta.client) {
  try {
    enabled = localStorage.getItem(DEBUG_FLAG) === '1'
  } catch {
    /* localStorage unavailable (private mode, etc.) — stay silent */
  }
}

/** Emit a "[collab] …" diagnostic when the debug flag is enabled. */
export function clog(...args) {
  if (enabled) console.warn('[collab]', ...args)
}

/** Whether collab debug logging is currently enabled. */
export function collabDebugEnabled() {
  return enabled
}
