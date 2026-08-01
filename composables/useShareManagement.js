import db from '~/db.js'

/**
 * Manages shared note state and share/unshare actions.
 */
export function useShareManagement({ auth, notes, apiFetch, onUnshared }) {
  const sharedNoteIds = ref([])
  const sharedNotesMap = ref(new Map())
  const analyticsNotesMap = ref(new Map())

  const showShareModal = ref(false)
  const showAnalyticsModal = ref(false)
  const analyticsHash = ref(null)

  const loadSharedNotes = async () => {
    if (auth.isLoggedIn.value) {
      // Authenticated: fetch from server
      try {
        const shared = await apiFetch('/api/share/my', { headers: auth.authHeaders.value })
        const map = new Map()
        const analyticsMap = new Map()
        const ids = []
        for (const sn of shared) {
          const match = sn.sourceClientId
            ? notes.value.find((n) => n.id === sn.sourceClientId)
            : notes.value.find((n) => n.title === sn.title)
          if (match) {
            if (sn.isActive) {
              ids.push(match.id)
              map.set(match.id, sn.hash)
            }
            if (sn.collectAnalytics) {
              analyticsMap.set(match.id, sn.hash)
            }
          }
        }
        sharedNoteIds.value = ids
        sharedNotesMap.value = map
        analyticsNotesMap.value = analyticsMap
      } catch {
        sharedNoteIds.value = []
        sharedNotesMap.value = new Map()
        analyticsNotesMap.value = new Map()
      }
    } else {
      // Anonymous: use locally stored share tokens
      try {
        const allTokens = await db.shareTokens.toArray()
        const map = new Map()
        const analyticsMap = new Map()
        const ids = []
        for (const record of allTokens) {
          if (record.noteId) {
            ids.push(record.noteId)
            map.set(record.noteId, record.hash)
            if (record.collectAnalytics) {
              analyticsMap.set(record.noteId, record.hash)
            }
          }
        }
        sharedNoteIds.value = ids
        sharedNotesMap.value = map
        analyticsNotesMap.value = analyticsMap
      } catch {
        sharedNoteIds.value = []
        sharedNotesMap.value = new Map()
        analyticsNotesMap.value = new Map()
      }
    }
  }

  const handleShareNote = (noteId, currentNoteId) => {
    currentNoteId.value = noteId
    showShareModal.value = true
  }

  const handleUnshareNote = async (noteId) => {
    const hash = sharedNotesMap.value.get(noteId)
    if (!hash) return
    try {
      // If not logged in, use the stored delete token as a query param
      let tokenParam = ''
      if (!auth.isLoggedIn.value) {
        try {
          const record = await db.shareTokens.get(hash)
          if (record?.token) {
            tokenParam = `?_token=${encodeURIComponent(record.token)}`
          }
        } catch {
          /* db unavailable */
        }
      }

      await apiFetch(`/api/share/${hash}${tokenParam}`, {
        method: 'DELETE',
        headers: auth.authHeaders.value,
      })

      // Clean up the stored delete token AND the local collaborative mapping,
      // so the note stops being treated as collaborative (no live sync, no
      // "not encrypted" banner) and becomes fully private again.
      try {
        await db.shareTokens.delete(hash)
      } catch {
        /* db unavailable */
      }
      try {
        await db.collabDocs.delete(noteId)
        await db.collabDocs.where('hash').equals(hash).delete()
      } catch {
        /* db unavailable */
      }

      // Let the page react (unbind the open editor, clear the synced linkage).
      if (onUnshared) onUnshared(noteId)

      await loadSharedNotes()
    } catch {
      /* ignore */
    }
  }

  const handleShareModalClose = () => {
    showShareModal.value = false
    loadSharedNotes()
  }

  const handleShareModalUnshare = () => {
    showShareModal.value = false
    loadSharedNotes()
  }

  const handleOpenAnalytics = (hash) => {
    analyticsHash.value = hash
    showAnalyticsModal.value = true
  }

  const handleProfileUnshare = () => {
    loadSharedNotes()
  }

  return {
    sharedNoteIds,
    sharedNotesMap,
    analyticsNotesMap,
    showShareModal,
    showAnalyticsModal,
    analyticsHash,
    loadSharedNotes,
    handleShareNote,
    handleUnshareNote,
    handleShareModalClose,
    handleShareModalUnshare,
    handleOpenAnalytics,
    handleProfileUnshare,
  }
}
