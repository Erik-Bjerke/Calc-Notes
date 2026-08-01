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

export function useCollabNote(noteRef) {
  const { collabWsUrl } = useCollabConfig()
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

      try {
        const { connectCollabNetwork, loadCollabDoc } = await import('~/utils/collab.js')
        if (mapping.collabToken) {
          clog('useCollabNote: connecting network', collabWsUrl())
          await connectCollabNetwork(collabWsUrl(), mapping.collabToken)
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
