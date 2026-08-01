/**
 * useCollab — Vue-reactive wrapper around a single collaborative Automerge
 * document (a note's `content` body).
 *
 * The heavy lifting (Repo singleton, WASM init, IndexedDB persistence) lives in
 * the framework-agnostic utils/collab.js. This composable exposes the current
 * DocHandle plus reactive `ready`/`text`/`error` state, and keeps `text` in
 * sync with remote/local changes so callers (note list, reconciliation) can
 * observe the live body without touching Automerge internals.
 *
 * The CodeMirror editor binds to `handle` directly via the Automerge codemirror
 * plugin (see Task 3) rather than through `text`, so typing does not round-trip
 * through Vue reactivity.
 */
import { createCollabDoc, loadCollabDoc, getDocText } from '~/utils/collab.js'

export function useCollab() {
  const handle = ref(null)
  const ready = ref(false)
  const error = ref(null)
  const text = ref('')

  let changeHandler = null

  const detach = () => {
    if (handle.value && changeHandler) {
      handle.value.off('change', changeHandler)
    }
    changeHandler = null
    handle.value = null
    ready.value = false
    text.value = ''
  }

  const attach = (h) => {
    detach()
    // markRaw: DocHandle uses private class fields that break under a Vue
    // reactive Proxy ("object is not the right class"). Store it raw.
    handle.value = markRaw(h)
    text.value = getDocText(h)
    changeHandler = () => {
      text.value = getDocText(h)
    }
    h.on('change', changeHandler)
    ready.value = true
  }

  /** Open an existing collaborative document by its Automerge url. */
  const open = async (url) => {
    error.value = null
    ready.value = false
    try {
      const h = await loadCollabDoc(url)
      attach(h)
      return h
    } catch (e) {
      error.value = e?.message || 'Failed to open collaborative document'
      throw e
    }
  }

  /** Create a new collaborative document seeded with existing note content. */
  const create = async (initialText = '') => {
    error.value = null
    ready.value = false
    try {
      const h = await createCollabDoc(initialText)
      attach(h)
      return h
    } catch (e) {
      error.value = e?.message || 'Failed to create collaborative document'
      throw e
    }
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(detach)
  }

  return { handle, ready, error, text, open, create, detach }
}
