/**
 * Cloud sync composable with end-to-end encryption.
 *
 * Triggers: syncNow() for create/delete/reorder, debouncedSync() for edits,
 * 2-minute interval, and SSE push from other clients.
 * No deep watcher on notes to avoid feedback loops.
 *
 * Encryption flow:
 *   - All note data is encrypted with the user's encKey before being sent
 *     to the server, and decrypted after being received.
 *   - Local IndexedDB storage remains unencrypted.
 *   - If encKey is null (session restored without password), sync is skipped.
 */
import db from '~/db.js'
import { encryptNote, decryptNote } from '~/utils/crypto.js'

export const useSync = (
  auth,
  notes,
  saveNotes,
  deletedIds,
  clearDeletedIds,
  onDataWipe,
  onSessionRevoked,
  removeWelcomeNoteIfNeeded,
  groups,
  saveGroups,
  deletedGroupIds,
  clearDeletedGroupIds,
) => {
  const { apiFetch, apiUrl } = useApi()

  const syncing = ref(false)
  const lastSyncedAt = ref(null)
  const syncError = ref(null)
  const pendingNoteIds = ref(new Set())
  const isOnline = useOnlineStatus()

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  let expectingSelfEcho = false
  let echoTimer = null
  let intervalId = null
  let debounceTimer = null
  let pendingSync = null

  const AUTO_SYNC_INTERVAL = 2 * 60 * 1000
  const DEBOUNCE_DELAY = 3000
  const SESSION_CHECK_INTERVAL = 30 * 1000 // Check session validity every 30s

  onMounted(async () => {
    if (import.meta.client) {
      const row = await db.appState.get('last_synced_at')
      lastSyncedAt.value = row?.value || null
    }
  })

  // Flush pending changes when connectivity returns
  watch(isOnline, (online) => {
    if (online && auth.isLoggedIn.value) {
      // Validate session immediately when coming back online
      validateSessionOrLogout()
      if (pendingNoteIds.value.size > 0) syncNow()
    }
  })

  const sync = async (source = 'unknown') => {
    if (!auth.isLoggedIn.value || sessionRevokedHandled) return
    // encKey is required for E2E encryption. If the user restored a session
    // without entering their password, we can't encrypt/decrypt.
    if (!auth.encKey.value) return
    // Skip sync when offline — changes stay pending until connection returns
    if (!isOnline.value) {
      pendingSync = source
      return
    }
    if (syncing.value) {
      pendingSync = source
      return
    }

    syncing.value = true
    syncError.value = null

    const shouldBroadcast = source !== 'sse'
    const key = auth.encKey.value

    try {
      // Encrypt client notes before sending
      const encryptedClientNotes = []
      for (const n of notes.value) {
        const plain = {
          clientId: n.id,
          title: n.title,
          description: n.description,
          tags: n.tags || [],
          content: n.content,
          sortOrder: n.sortOrder ?? 0,
          archived: n.archived ?? false,
          deletedAt: n.deletedAt || null,
          internalName: n.internalName || '',
          groupId: n.groupId || null,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }
        const encrypted = await encryptNote(plain, key)
        encryptedClientNotes.push(encrypted)
      }

      // Read local welcome flag to push to server
      const welcomeRow = await db.appState.get('welcome_note_created')
      const localWelcomeCreated = !!welcomeRow?.value

      const data = await apiFetch('/api/notes/sync', {
        method: 'POST',
        headers: auth.authHeaders.value,
        body: {
          notes: encryptedClientNotes,
          deletedClientIds: [...deletedIds.value],
          lastSyncedAt: lastSyncedAt.value,
          sessionId,
          broadcast: shouldBroadcast,
          welcomeCreated: localWelcomeCreated,
        },
      })

      if (data.deletedClientIds?.length) {
        for (const id of data.deletedClientIds) {
          const idx = notes.value.findIndex((n) => n.id === id)
          if (idx !== -1) notes.value.splice(idx, 1)
        }
        await db.notes.bulkDelete(data.deletedClientIds)
      }

      // Rule 5: If the server says the welcome note was already seen/deleted,
      // remove the local auto-generated one BEFORE the merge loop (prevents flash).
      // Track its ID so we can tell the server to delete it too.
      let removedWelcomeNoteId = null
      if (data.welcomeCreated && removeWelcomeNoteIfNeeded) {
        // Find the unmodified welcome note before removing it
        const welcomeNote = notes.value.find(
          (n) => n.title === 'Welcome' && n.description === 'Notes with calculator features',
        )
        if (welcomeNote) {
          removedWelcomeNoteId = welcomeNote.id
        }
        await removeWelcomeNoteIfNeeded()
      }

      for (const remote of data.pulled) {
        const localId = remote.clientId || remote.id.toString()
        const decrypted = await decryptNote(remote, key)

        // Skip re-adding the welcome note we just removed
        if (removedWelcomeNoteId && localId === removedWelcomeNoteId) continue

        const existing = notes.value.find((n) => n.id === localId)
        if (existing) {
          if (new Date(decrypted.updatedAt) > new Date(existing.updatedAt)) {
            if (existing.title !== decrypted.title) existing.title = decrypted.title
            if (existing.description !== decrypted.description)
              existing.description = decrypted.description
            if (JSON.stringify(existing.tags) !== JSON.stringify(decrypted.tags))
              existing.tags = decrypted.tags
            if (existing.content !== decrypted.content) existing.content = decrypted.content
            if (existing.archived !== (decrypted.archived ?? false))
              existing.archived = decrypted.archived ?? false
            const remoteDeletedAt = decrypted.deletedAt || null
            if (existing.deletedAt !== remoteDeletedAt) existing.deletedAt = remoteDeletedAt
            if (existing.sortOrder !== (decrypted.sortOrder ?? 0))
              existing.sortOrder = decrypted.sortOrder ?? 0
            if (existing.internalName !== (decrypted.internalName || ''))
              existing.internalName = decrypted.internalName || ''
            const remoteGroupId = decrypted.groupId || null
            if (existing.groupId !== remoteGroupId) existing.groupId = remoteGroupId
            existing.updatedAt = decrypted.updatedAt
          }
        } else {
          notes.value.push({
            id: localId,
            title: decrypted.title,
            description: decrypted.description,
            tags: decrypted.tags || [],
            content: decrypted.content,
            sortOrder: decrypted.sortOrder ?? 0,
            archived: decrypted.archived ?? false,
            deletedAt: decrypted.deletedAt || null,
            internalName: decrypted.internalName || '',
            groupId: decrypted.groupId || null,
            createdAt: decrypted.createdAt,
            updatedAt: decrypted.updatedAt,
          })
        }
      }

      notes.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      await clearDeletedIds()
      lastSyncedAt.value = data.syncedAt
      await db.appState.put({ key: 'last_synced_at', value: data.syncedAt })
      await saveNotes()

      // If we removed a welcome note, add its ID to deletedIds so the server
      // cleans it up on the next sync. This runs AFTER clearDeletedIds.
      if (removedWelcomeNoteId) {
        deletedIds.value.push(removedWelcomeNoteId)
        await db.appState.put({ key: 'deleted_note_ids', value: JSON.stringify(deletedIds.value) })
      }

      // Sync groups if available
      if (groups && saveGroups) {
        try {
          const clientGroups = (groups.value || []).map((g) => ({
            clientId: g.id,
            name: g.name,
            internalName: g.internalName || '',
            sortOrder: g.sortOrder ?? 0,
            parentId: g.parentId ?? null,
            collapsed: g.collapsed ?? false,
            deletedAt: g.deletedAt ?? null,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
          }))

          const deletedGroupClientIds = deletedGroupIds ? [...deletedGroupIds.value] : []
          const deletedGroupSet = new Set(deletedGroupClientIds)

          const groupData = await apiFetch('/api/groups/sync', {
            method: 'POST',
            headers: auth.authHeaders.value,
            body: { groups: clientGroups, deletedClientIds: deletedGroupClientIds },
          })

          // Remove groups that were deleted by other devices
          if (groupData.deletedClientIds?.length) {
            for (const id of groupData.deletedClientIds) {
              const idx = groups.value.findIndex((g) => g.id === id)
              if (idx !== -1) groups.value.splice(idx, 1)
            }
            await db.groups.bulkDelete(groupData.deletedClientIds)
          }

          // Merge pulled groups (skip any that we just asked the server to delete)
          for (const remote of groupData.pulled || []) {
            const localId = remote.clientId || remote.id.toString()
            if (deletedGroupSet.has(localId)) continue
            const existing = groups.value.find((g) => g.id === localId)
            if (existing) {
              if (new Date(remote.updatedAt) > new Date(existing.updatedAt)) {
                if (existing.name !== remote.name) existing.name = remote.name
                if (existing.internalName !== (remote.internalName || ''))
                  existing.internalName = remote.internalName || ''
                if (existing.collapsed !== (remote.collapsed ?? false))
                  existing.collapsed = remote.collapsed ?? false
                if (existing.sortOrder !== (remote.sortOrder ?? 0))
                  existing.sortOrder = remote.sortOrder ?? 0
                // Only adopt a remote parentId when the server actually sends one,
                // so older servers that don't know about nesting don't flatten the tree.
                if (remote.parentId !== undefined && existing.parentId !== remote.parentId)
                  existing.parentId = remote.parentId
                if (remote.deletedAt !== undefined && existing.deletedAt !== remote.deletedAt)
                  existing.deletedAt = remote.deletedAt
                existing.updatedAt = remote.updatedAt
              }
            } else {
              groups.value.push({
                id: localId,
                name: remote.name,
                internalName: remote.internalName || '',
                sortOrder: remote.sortOrder ?? 0,
                parentId: remote.parentId ?? null,
                collapsed: remote.collapsed ?? false,
                deletedAt: remote.deletedAt ?? null,
                createdAt: remote.createdAt,
                updatedAt: remote.updatedAt,
              })
            }
          }
          groups.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          await saveGroups()
          if (clearDeletedGroupIds) await clearDeletedGroupIds()
        } catch (err) {
          // Groups sync failure is non-fatal — notes already synced
          console.warn('Groups sync failed:', err.message)
        }
      }

      // All notes are now synced — clear pending indicators
      pendingNoteIds.value = new Set()

      // Persist welcome flag from server so a new device won't re-create it
      if (data.welcomeCreated) {
        await db.appState.put({ key: 'welcome_note_created', value: '1' })
      }

      if (shouldBroadcast) {
        expectingSelfEcho = true
        clearTimeout(echoTimer)
        echoTimer = setTimeout(() => {
          expectingSelfEcho = false
        }, 500)
      }
    } catch (err) {
      syncError.value = err.data?.statusMessage || err.message || 'Sync failed'
      // If session was revoked, clear local data and log out
      const status = err.status || err.statusCode || err.data?.statusCode
      if (status === 401) {
        handleSessionRevoked()
        return
      }
    } finally {
      syncing.value = false
      if (pendingSync && !sessionRevokedHandled) {
        const queued = pendingSync
        pendingSync = null
        sync(queued)
      } else {
        pendingSync = null
      }
    }
  }

  const syncNow = (noteId) => {
    if (sessionRevokedHandled) return
    if (noteId) pendingNoteIds.value = new Set([...pendingNoteIds.value, noteId])
    clearTimeout(debounceTimer)
    if (!auth.isLoggedIn.value || !auth.encKey.value) {
      pendingSync = 'syncNow'
      return
    }
    sync('syncNow')
  }

  const debouncedSync = (noteId) => {
    if (sessionRevokedHandled) return
    if (noteId) pendingNoteIds.value = new Set([...pendingNoteIds.value, noteId])
    if (!auth.isLoggedIn.value || !auth.encKey.value) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => sync('debounce'), DEBOUNCE_DELAY)
  }

  const startAutoSync = () => {
    stopAutoSync()
    if (pendingSync) {
      const queued = pendingSync
      pendingSync = null
      sync(queued)
    } else {
      sync('login')
    }
    intervalId = setInterval(() => sync('interval'), AUTO_SYNC_INTERVAL)
  }

  const stopAutoSync = () => {
    clearInterval(intervalId)
    clearTimeout(debounceTimer)
    intervalId = null
  }

  // SSE — real-time notifications from other clients
  let eventSource = null
  let sessionRevokedHandled = false
  let sseReconnectTimer = null
  let sessionCheckId = null

  /** Lightweight session heartbeat — catches revocations that SSE missed. */
  const startSessionCheck = () => {
    stopSessionCheck()
    sessionCheckId = setInterval(() => {
      if (auth.isLoggedIn.value && isOnline.value && !sessionRevokedHandled) {
        validateSessionOrLogout()
      }
    }, SESSION_CHECK_INTERVAL)
  }

  const stopSessionCheck = () => {
    clearInterval(sessionCheckId)
    sessionCheckId = null
  }

  /** Check if our session is still valid. If not, clear local data and log out. */
  const validateSessionOrLogout = async () => {
    if (sessionRevokedHandled) return
    try {
      await apiFetch('/api/auth/me', { headers: auth.authHeaders.value })
      // Session still valid — ignore
    } catch (err) {
      const status = err.status || err.statusCode || err.data?.statusCode
      if (status === 401) {
        // Session genuinely revoked — clear everything
        handleSessionRevoked()
      }
      // Network/transient errors are ignored — we'll retry on the next interval
    }
  }

  const handleSessionRevoked = () => {
    if (sessionRevokedHandled) return
    sessionRevokedHandled = true
    clearTimeout(sseReconnectTimer)
    disconnectSSE()
    stopAutoSync()
    stopSessionCheck()
    if (onSessionRevoked) onSessionRevoked()
  }

  const connectSSE = () => {
    disconnectSSE()
    if (!auth.token.value || sessionRevokedHandled) return

    eventSource = new EventSource(
      apiUrl(`/api/sync/events?token=${auth.token.value}&sessionId=${sessionId}`),
    )

    eventSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'data-wipe') {
          if (onDataWipe) onDataWipe()
        } else if (msg.type === 'session-revoked') {
          // Validate our session is still alive — if not, clear local data
          validateSessionOrLogout()
        } else if (msg.type === 'sync' && !syncing.value && !expectingSelfEcho) {
          sync('sse')
        }
      } catch {
        /* ignore */
      }
    }

    eventSource.onerror = () => {
      disconnectSSE()
      if (sessionRevokedHandled) return
      sseReconnectTimer = setTimeout(() => {
        if (auth.isLoggedIn.value && !sessionRevokedHandled) connectSSE()
      }, 5000)
    }
  }

  const disconnectSSE = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  // Start sync when both logged in AND encKey is available
  watch(
    [() => auth.isLoggedIn.value, () => auth.encKey.value],
    ([loggedIn, key]) => {
      if (loggedIn && key) {
        // Reset revocation flag — user logged in again with a fresh session
        sessionRevokedHandled = false
        startAutoSync()
        connectSSE()
        startSessionCheck()
      } else if (!loggedIn) {
        stopAutoSync()
        disconnectSSE()
        stopSessionCheck()
        clearTimeout(sseReconnectTimer)
      }
    },
    { immediate: true },
  )

  const onBeforeUnload = () => disconnectSSE()

  if (import.meta.client) {
    window.addEventListener('beforeunload', onBeforeUnload)
  }

  onBeforeUnmount(() => {
    stopAutoSync()
    disconnectSSE()
    stopSessionCheck()
    clearTimeout(sseReconnectTimer)
    if (import.meta.client) {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  })

  return {
    syncing,
    lastSyncedAt,
    syncError,
    pendingNoteIds,
    isOnline,
    sync,
    syncNow,
    debouncedSync,
  }
}
