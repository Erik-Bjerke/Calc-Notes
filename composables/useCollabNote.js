/**
 * useCollabNote — bind the owner's main editor to a note's collaborative
 * Automerge document when that note has been shared for real-time editing.
 *
 * When the selected note has a local `collabDocs` mapping (created by
 * ShareModal when the owner turns on collaborative sharing), we connect to the
 * sync service and open the live document, exposing a `collabHandle` the editor
 * binds to. Content then flows through the CRDT; the caller mirrors it back to
 * the local note (Dexie) for the notes list / search / offline reading, while
 * title, tags, groups and ordering keep travelling over the existing
 * last-write-wins encrypted sync.
 *
 * @param {import('vue').Ref} noteRef ref to the currently selected note
 * @returns {{ collabHandle: import('vue').Ref, isCollab: import('vue').ComputedRef<boolean> }}
 */
import db from '~/db.js'

export function useCollabNote(noteRef, auth = null) {
  const { collabWsUrl } = useCollabConfig()
  const { apiFetch } = useApi()
  const collabHandle = ref(null)

  const isCollab = computed(() => !!collabHandle.value)

  watch(
    () => noteRef.value?.id,
    async (id) => {
      collabHandle.value = null
      if (!id || !import.meta.client) return

      let mapping
      try {
        mapping = await db.collabDocs.get(id)
      } catch {
        return
      }
      if (!mapping?.automergeUrl) return
      clog('useCollabNote: note', id, 'is collaborative →', mapping.automergeUrl)

      // Ensure a usable capability token. On a device that received the note
      // through account sync the linkage has no token; tokens also expire
      // (~12h). Re-mint from the share hash on demand and cache it. Signed-in
      // users get a 'user' write token; guests get a guest token when the share
      // allows them. Without a hash we can't re-mint and rely on any cached one.
      let token = mapping.collabToken
      if (mapping.hash && isCollabTokenExpired(token)) {
        try {
          clog('useCollabNote: (re)minting collab token from hash', mapping.hash)
          const headers = auth?.authHeaders?.value || {}
          const share = await apiFetch(`/api/share/${mapping.hash}`, { headers })
          if (share?.collabToken) {
            token = share.collabToken
            await db.collabDocs.update(id, { collabToken: token }).catch(() => {})
          } else {
            clog('useCollabNote: no token issued (requiresAccount?)', share?.requiresAccount)
          }
        } catch (err) {
          clog('useCollabNote: token re-mint failed', err?.message)
        }
      }

      try {
        const { connectCollabNetwork, loadCollabDoc } = await import('~/utils/collab.js')
        if (token) {
          clog('useCollabNote: connecting network', collabWsUrl())
          await connectCollabNetwork(collabWsUrl(), token)
        }
        clog('useCollabNote: loading document…')
        const handle = await loadCollabDoc(mapping.automergeUrl)
        // Guard against the user having switched notes while we loaded.
        if (noteRef.value?.id === id) {
          // markRaw is essential: a DocHandle uses private class fields (#…),
          // which throw "object is not the right class" if accessed through a
          // Vue reactive Proxy. Keep the handle raw.
          collabHandle.value = markRaw(handle)
          clog('useCollabNote: collabHandle set, editor will bind')
        } else {
          clog('useCollabNote: note changed while loading, discarding handle')
        }
      } catch (err) {
        // Offline or the document isn't reachable yet — fall back to the plain
        // (last-synced) content; the editor stays usable and will bind later.
        console.error('[collab] useCollabNote: FAILED to bind collaborative document:', err)
      }
    },
    { immediate: true },
  )

  return { collabHandle, isCollab }
}
