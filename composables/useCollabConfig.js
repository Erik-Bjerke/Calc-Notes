/**
 * Resolve the WebSocket URL of the collaborative sync service.
 *
 * Priority:
 *   1. NUXT_PUBLIC_COLLAB_WS_URL (explicit, e.g. wss://notes.numori.app/collab
 *      or ws://localhost:3030 in development).
 *   2. Derived from the API base (native Capacitor / Electron builds set
 *      NUXT_PUBLIC_API_BASE) or, on the web, the current origin — upgraded to
 *      ws(s):// with a `/collab` path (the expected reverse-proxy mount).
 *
 * Native (capacitor://) and Electron (app://) origins are NOT valid WebSocket
 * bases, so on those platforms the API base must be configured; if no usable
 * http(s) base is available we return '' and collaboration is disabled
 * gracefully rather than attempting an invalid connection.
 */

/**
 * Pure derivation of the collab WebSocket URL. Exported for testing.
 * @param {string} explicit  NUXT_PUBLIC_COLLAB_WS_URL
 * @param {string} apiBase   NUXT_PUBLIC_API_BASE
 * @param {string} origin    window.location.origin (web only)
 * @returns {string} a ws(s):// url, or '' when collaboration can't be located
 */
export function deriveCollabWsUrl(explicit, apiBase, origin) {
  if (explicit) return explicit
  const base = apiBase || origin || ''
  // Only http(s) bases can be turned into a websocket endpoint. capacitor://,
  // app:// (Electron) and file:// are rejected — those platforms must set the
  // explicit env var (or a http(s) API base).
  if (!/^https?:\/\//i.test(base)) return ''
  const wsBase = base.replace(/^http/i, 'ws').replace(/\/$/, '')
  return `${wsBase}/collab`
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
