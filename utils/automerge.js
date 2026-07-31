/**
 * Automerge WASM bootstrap.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `@automerge/automerge-repo` (and, via our Vite alias, our own imports of
 * `@automerge/automerge`) resolve to Automerge's *slim* build. The slim build
 * deliberately does NOT auto-initialize the WebAssembly core — the caller must
 * initialize it exactly once before using any CRDT operation.
 *
 * We initialize from an inlined base64 copy of the `.wasm` binary rather than
 * fetching a separate `.wasm` asset. Fetching a hashed asset URL is unreliable
 * under the `capacitor://` (iOS/Android WebView) and `file://` (Electron)
 * origins the app also runs under, whereas an inlined module always loads.
 *
 * Initialization is lazy and cached: the WASM (~1.5 MB) is only pulled in the
 * first time a user actually opens a collaborative note, keeping the normal
 * offline-notes startup path lean.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { initializeBase64Wasm } from '@automerge/automerge/slim'

let initPromise = null

/**
 * Initialize the Automerge WASM core exactly once.
 * Safe to call repeatedly — subsequent calls return the same promise.
 *
 * The (large) inlined base64 WASM module is dynamically imported here so it is
 * split into its own chunk and only downloaded the first time collaboration is
 * actually used — never on normal offline-notes startup.
 *
 * @returns {Promise<void>} resolves once the CRDT engine is ready to use.
 */
export function initAutomerge() {
  if (!initPromise) {
    initPromise = import('@automerge/automerge/automerge.wasm.base64').then(
      ({ automergeWasmBase64 }) => initializeBase64Wasm(automergeWasmBase64),
    )
  }
  return initPromise
}
