/**
 * useCollabSession — join a shared note by hash and, when it is collaborative,
 * connect to the sync service and open the live Automerge document.
 *
 * Used by the shared-note page for the join flow. Read-only shares return the
 * static snapshot exactly as before; collaborative shares additionally expose a
 * live DocHandle the editor binds to for real-time co-editing.
 */
import { loadCollabDoc, connectCollabNetwork } from '~/utils/collab.js'

export function useCollabSession() {
  const { apiFetch } = useApi()
  const { collabWsUrl } = useCollabConfig()

  const loading = ref(true)
  const error = ref(null)
  const mode = ref('read-only')
  const requiresAccount = ref(false)
  const handle = ref(null)
  const snapshot = ref(null)

  /**
   * @param {string} hash the share hash
   * @param {object} [opts]
   * @param {object} [opts.authHeaders] auth headers to send (logged-in joiner)
   * @returns {Promise<{ data: object }>}
   */
  const join = async (hash, opts = {}) => {
    loading.value = true
    error.value = null
    requiresAccount.value = false
    try {
      const data = await apiFetch(`/api/share/${hash}`, { headers: opts.authHeaders || {} })
      snapshot.value = data
      mode.value = data.mode === 'collaborative' ? 'collaborative' : 'read-only'

      if (mode.value === 'collaborative') {
        if (data.requiresAccount || !data.collabToken || !data.automergeUrl) {
          requiresAccount.value = true
          return { data }
        }
        // Attach the sync connection (gated by the capability token), then open
        // the document — it syncs down from the service on first join.
        await connectCollabNetwork(collabWsUrl(), data.collabToken)
        // markRaw: keep the DocHandle raw — its private class fields break
        // under a Vue reactive Proxy.
        handle.value = markRaw(await loadCollabDoc(data.automergeUrl))
      }
      return { data }
    } catch (e) {
      error.value = e.data?.statusMessage || e.message || 'Failed to open shared note'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, mode, requiresAccount, handle, snapshot, join }
}
