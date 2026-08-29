/**
 * Resolve the WebSocket URL of the CRDT sync service.
 *
 * Priority:
 *   1. NUXT_PUBLIC_COLLAB_WS_URL (explicit, e.g. wss://crdt.numori.app/notes
 *      or ws://localhost:3030/notes in development).
 *   2. Derived from the API base (native Capacitor / Electron builds set
 *      NUXT_PUBLIC_API_BASE) or, on the web, the current origin — upgraded to
 *      ws(s):// with a `/collab/<appId>` path.
 *
 * The trailing app id is required: the sync service hosts several applications
 * and selects one from the first path segment it receives, refusing anything it
 * doesn't recognise. `/collab` is the reverse-proxy mount point, so a proxy that
 * strips that prefix (nginx `location /collab/ { proxy_pass http://crdt:3030/; }`)
 * forwards `/notes` upstream.
 *
 * Native (capacitor://) and Electron (app://) origins are NOT valid WebSocket
 * bases, so on those platforms the API base must be configured; if no usable
 * http(s) base is available we return '' and collaboration is disabled
 * gracefully rather than attempting an invalid connection.
 */

/**
 * App id this client is registered under in the sync service. Must match the
 * `id` of an app in that service's registry, or connections are refused.
 */
export const COLLAB_APP_ID = 'notes'

/**
 * Pure derivation of the collab WebSocket URL. Exported for testing.
 * @param {string} explicit  NUXT_PUBLIC_COLLAB_WS_URL
 * @param {string} apiBase   NUXT_PUBLIC_API_BASE
 * @param {string} origin    window.location.origin (web only)
 * @param {string} [appId]   app id to address on the sync service
 * @returns {string} a ws(s):// url, or '' when collaboration can't be located
 */
export function deriveCollabWsUrl(explicit, apiBase, origin, appId = COLLAB_APP_ID) {
  if (explicit) return explicit
  const base = apiBase || origin || ''
  // Only http(s) bases can be turned into a websocket endpoint. capacitor://,
  // app:// (Electron) and file:// are rejected — those platforms must set the
  // explicit env var (or a http(s) API base).
  if (!/^https?:\/\//i.test(base)) return ''
  const wsBase = base.replace(/^http/i, 'ws').replace(/\/$/, '')
  return `${wsBase}/collab/${appId}`
}

export const useCollabConfig = () => {
  const config = useRuntimeConfig()

  const collabWsUrl = () =>
    deriveCollabWsUrl(
      config.public.collabWsUrl || '',
      config.public.apiBase || '',
      import.meta.client ? window.location.origin : '',
    )

  return { collabWsUrl }
}
