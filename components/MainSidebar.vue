<template>
  <div class="h-full flex flex-col bg-gray-100 dark:bg-gray-900">
    <!-- Selection Toolbar / Header — crossfade in a fixed container -->
    <div
      class="relative border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
      :class="showFilters ? 'overflow-visible' : 'overflow-hidden'"
    >
      <!-- Select toolbar -->
      <MainSidebarSelectionToolbar
        :select-mode="selectMode"
        :selected-ids="selectedIds"
        :all-selected="allSelected"
        :show-bin="showBin"
        :show-archive="showArchive"
        @exit-select-mode="exitSelectMode"
        @toggle-select-all="toggleSelectAll"
        @bulk-restore="bulkRestore"
        @bulk-permanent-delete="bulkPermanentDelete"
        @bulk-group="bulkGroup"
        @bulk-unarchive="bulkUnarchive"
        @bulk-archive="bulkArchive"
        @bulk-delete="bulkDelete"
      />

      <!-- Normal header (always in flow to maintain height) -->
      <MainSidebarSearchAndFilters
        :select-mode="selectMode"
        :search-query="searchQuery"
        :show-filters="showFilters"
        :has-active-filters="hasActiveFilters"
        :filters="filters"
        :all-tags="allTags"
        :selected-tags="selectedTags"
        :current-note="currentNote"
        @new-note="handleNewNote"
        @show-meta="$emit('show-meta')"
        @toggle-select-mode="toggleSelectMode"
        @update:search-query="searchQuery = $event"
        @toggle-filters="showFilters = !showFilters"
        @update:filter-date-range="filters.dateRange = $event"
        @toggle-filter="toggleFilter"
        @clear-filters="clearFilters"
        @toggle-tag="toggleTag"
      />
    </div>

    <!-- Notes List -->
    <MainSidebarNotesList
      ref="notesListRef"
      :sidebar-items="sidebarItems"
      :display-items="displayItems"
      :show-bin="showBin"
      :show-archive="showArchive"
      :current-note-id="currentNoteId"
      :select-mode="selectMode"
      :selected-ids="selectedIds"
      :shared-note-ids="sharedNoteIds"
      :shared-notes-map="sharedNotesMap"
      :analytics-notes-map="analyticsNotesMap"
      :pending-note-ids="pendingNoteIds"
      :is-logged-in="isLoggedIn"
      :can-reorder="canReorder"
      :is-touch-device="isTouchDevice"
      :dragging-id="draggingId"
      :drop-target="dropTarget"
      :get-group-notes="getGroupNotes"
      :gap-style="gapStyle"
      :is-dragged-item="isDraggedItem"
      :is-touch-dragged-item="isTouchDraggedItem"
      @drag-over-list="onDragOverList"
      @drop="onDrop"
      @drag-start="onDragStart"
      @drag-end="onDragEnd"
      @touch-start="onTouchStart"
      @toggle-group-collapse="(id) => $emit('toggle-group-collapse', id)"
      @edit-group="(id) => $emit('edit-group', id)"
      @delete-group="(id) => $emit('delete-group', id)"
      @select-note="(id) => $emit('select-note', id)"
      @delete-note="(id) => $emit('delete-note', id)"
      @share-note="(id) => $emit('share-note', id)"
      @unshare-note="(id) => $emit('unshare-note', id)"
      @show-properties="(id) => $emit('show-properties', id)"
      @open-analytics="(hash) => $emit('open-analytics', hash)"
      @duplicate-note="(id) => $emit('duplicate-note', id)"
      @export-note="(id) => $emit('export-note', id)"
      @copy-to-clipboard="(id) => $emit('copy-to-clipboard', id)"
      @print-note="(id) => $emit('print-note', id)"
      @archive-note="(id) => $emit('archive-note', id)"
      @unarchive-note="(id) => $emit('unarchive-note', id)"
      @toggle-note-selection="toggleNoteSelection"
      @add-to-group="(id) => $emit('add-to-group', id)"
      @restore-note="(id) => $emit('restore-note', id)"
      @permanent-delete-note="(id) => $emit('permanent-delete-note', id)"
    />

    <!-- Notes / Archive / Bin segmented control -->
    <MainSidebarViewSwitcher
      :sidebar-view="sidebarView"
      :sidebar-view-options="sidebarViewOptions"
      @update:sidebar-view="sidebarView = $event"
    />
  </div>
</template>

<script setup>
const props = defineProps({
  notes: { type: Array, required: true },
  groups: { type: Array, default: () => [] },
  currentNoteId: { type: String, default: null },
  currentNote: { type: Object, default: null },
  allTags: { type: Array, default: () => [] },
  isLoggedIn: { type: Boolean, default: false },
  user: { type: Object, default: null },
  appLockEnabled: { type: Boolean, default: false },
  sharedNoteIds: { type: Array, default: () => [] },
  sharedNotesMap: { type: Map, default: () => new Map() },
  analyticsNotesMap: { type: Map, default: () => new Map() },
  pendingNoteIds: { type: Set, default: () => new Set() },
})

const emit = defineEmits([
  'new-note',
  'show-meta',
  'select-note',
  'delete-note',
  'edit-note',
  'show-help',
  'show-locale-settings',
  'show-auth',
  'logout',
  'edit-profile',
  'lock-app',
  'bulk-delete',
  'bulk-restore',
  'bulk-permanent-delete',
  'restore-note',
  'permanent-delete-note',
  'selection-change',
  'reorder',
  'share-note',
  'unshare-note',
  'show-properties',
  'open-analytics',
  'duplicate-note',
  'export-note',
  'copy-to-clipboard',
  'print-note',
  'archive-note',
  'unarchive-note',
  'bulk-archive',
  'bulk-unarchive',
  'bulk-group',
  'add-to-group',
  'toggle-group-collapse',
  'edit-group',
  'delete-group',
  'move-note-to-group',
  'reorder-groups',
  'reorder-all',
  'reorder-within-group',
])

const searchQuery = ref('')
const selectedTags = ref([])
const notesListRef = ref(null)
const showFilters = ref(false)

// Expose listRef for parent access
const listRef = computed(() => notesListRef.value?.listRef)

// Sidebar view: 'notes' | 'archive' | 'bin'
const sidebarView = ref('notes')
const showArchive = computed(() => sidebarView.value === 'archive')
const showBin = computed(() => sidebarView.value === 'bin')

const sidebarViewOptions = computed(() => [
  { value: 'notes', label: 'Notes' },
  { value: 'archive', label: archivedCount.value > 0 ? `Archive (${archivedCount.value})` : 'Archive' },
  { value: 'bin', label: binCount.value > 0 ? `Bin (${binCount.value})` : 'Bin' },
])

const hasArchivedNotes = computed(() => props.notes.some((n) => n.archived && !n.deletedAt))
const archivedCount = computed(() => props.notes.filter((n) => n.archived && !n.deletedAt).length)
const binCount = computed(() => props.notes.filter((n) => !!n.deletedAt).length)

// Auto-exit archive view when no archived notes remain
watch(hasArchivedNotes, (has) => {
  if (!has && sidebarView.value === 'archive') sidebarView.value = 'notes'
})

// Switch to notes view when creating a new note from the sidebar button
const handleNewNote = () => {
  if (sidebarView.value !== 'notes') sidebarView.value = 'notes'
  emit('new-note')
}

// Switch to notes view when a new note is created from outside (header, keyboard shortcut)
// and the current view is archive or bin
watch(() => props.currentNoteId, (newId) => {
  if (!newId || sidebarView.value === 'notes') return
  const note = props.notes.find((n) => n.id === newId)
  if (note && !note.archived && !note.deletedAt) {
    sidebarView.value = 'notes'
  }
})

// ── Filters ──────────────────────────────────────────────

const filters = reactive({
  searchContent: true,
  dateRange: '',
  hasDescription: false,
  hasTags: false,
  emptyOnly: false,
})

const hasActiveFilters = computed(() => {
  return (
    !filters.searchContent ||
    filters.dateRange !== '' ||
    filters.hasDescription ||
    filters.hasTags ||
    filters.emptyOnly
  )
})

const toggleFilter = (key) => {
  filters[key] = !filters[key]
}

const clearFilters = () => {
  filters.searchContent = true
  filters.dateRange = ''
  filters.hasDescription = false
  filters.hasTags = false
  filters.emptyOnly = false
  selectedTags.value = []
}

// ── Drag-to-reorder (unified list) ───────────────────────────────────

const draggingId = ref(null)
const draggingType = ref(null) // 'note' | 'group'
const dropTarget = ref(null) // { id, type, position: 'before'|'after'|'inside' }
const hasDragMoved = ref(false) // true once cursor moves to a different item

const GROUP_DROP_THRESHOLD = 0.3

const isFiltering = computed(
  () => searchQuery.value.trim() !== '' || selectedTags.value.length > 0 || hasActiveFilters.value,
)
const canReorder = computed(() => !selectMode.value && !isFiltering.value)

// ── Auto-expand collapsed groups on hover ────────────────
let hoverExpandTimer = null
const HOVER_EXPAND_MS = 500
const dragExpandedGroupIds = ref(new Set()) // groups we auto-expanded during this drag

const startHoverExpand = (groupId) => {
  clearHoverExpand()
  const group = props.groups.find((g) => g.id === groupId)
  if (!group || !group.collapsed) return
  hoverExpandTimer = setTimeout(() => {
    emit('toggle-group-collapse', groupId)
    dragExpandedGroupIds.value = new Set([...dragExpandedGroupIds.value, groupId])
  }, HOVER_EXPAND_MS)
}

const clearHoverExpand = () => {
  clearTimeout(hoverExpandTimer)
  hoverExpandTimer = null
}

// ── Unified sidebar items ────────────────────────────────

const filteredGroups = computed(() => {
  if (showArchive.value) return []
  if (showBin.value) return []
  if (isFiltering.value) return []
  return props.groups
})

const getGroupNotes = (groupId) => {
  return filteredNotes.value.filter((n) => n.groupId === groupId)
}

const sidebarItems = computed(() => {
  const items = []
  for (const n of filteredNotes.value) {
    if (!n.groupId || showArchive.value || isFiltering.value) {
      items.push({ id: n.id, kind: 'note', sortOrder: n.sortOrder ?? 0, data: n })
    }
  }
  for (const g of filteredGroups.value) {
    items.push({ id: g.id, kind: 'group', sortOrder: g.sortOrder ?? 0, data: g })
  }
  items.sort((a, b) => a.sortOrder - b.sortOrder)
  return items
})

const displayItems = computed(() => {
  const list = []
  for (const item of sidebarItems.value) {
    list.push(item)
    if (item.kind === 'group') {
      const children = getGroupNotes(item.id)
      if (!item.data.collapsed) {
        if (children.length > 0) {
          for (const n of children) {
            list.push({
              id: n.id,
              kind: 'grouped-note',
              sortOrder: n.sortOrder ?? 0,
              data: n,
              parentGroupId: item.id,
            })
          }
        } else {
          list.push({
            id: `${item.id}__empty`,
            kind: 'group-empty',
            sortOrder: 0,
            data: null,
            parentGroupId: item.id,
          })
        }
      }
    }
  }
  return list
})

const dropInsertIndex = computed(() => {
  if (!dropTarget.value || !draggingId.value || !hasDragMoved.value) return -1
  const dt = dropTarget.value
  if (dt.position === 'inside') return -1
  if (dt.id === '__bottom__') return displayItems.value.length
  const targetIdx = displayItems.value.findIndex((i) => i.id === dt.id)
  if (targetIdx === -1) return -1
  return dt.position === 'before' ? targetIdx : targetIdx + 1
})

const isDraggedItem = (id) =>
  draggingId.value !== null &&
  draggingId.value === id &&
  !touchDragActive.value &&
  hasDragMoved.value
const isTouchDraggedItem = (id) =>
  draggingId.value !== null &&
  draggingId.value === id &&
  touchDragActive.value &&
  hasDragMoved.value

const isGapInsideGroup = computed(() => {
  const idx = dropInsertIndex.value
  if (idx === -1) return false
  if (dropTarget.value?.id === '__bottom__') return false
  const itemAt = displayItems.value[idx]
  if (itemAt?.kind === 'grouped-note') return true
  const itemBefore = idx > 0 ? displayItems.value[idx - 1] : null
  if (itemBefore?.kind === 'grouped-note' || itemBefore?.kind === 'group-empty') return true
  return false
})

const gapStyle = (idx) => {
  if (dropInsertIndex.value === idx) {
    const ml = isGapInsideGroup.value ? 'margin-left: 22px;' : 'margin-left: 6px;'
    return `height: 48px; margin-top: 2px; margin-bottom: 2px; border-width: 2px; ${ml}`
  }
  return 'height: 0px; margin-top: 0px; margin-bottom: 0px; border-width: 0px;'
}

// -- Custom drag image --

const createDragImage = (el) => {
  const clone = el.cloneNode(true)
  clone.style.position = 'absolute'
  clone.style.top = '-9999px'
  clone.style.left = '-9999px'
  clone.style.width = el.offsetWidth + 'px'
  clone.style.opacity = '0.85'
  clone.style.borderRadius = '8px'
  clone.style.boxShadow = '0 12px 32px rgba(0,0,0,0.18)'
  clone.style.pointerEvents = 'none'
  clone.style.zIndex = '9999'
  clone.style.transform = 'rotate(1.5deg) scale(1.02)'
  document.body.appendChild(clone)
  return clone
}

let dragImageEl = null

// -- Mouse (HTML5 drag) --

const onDragStart = (e, id, type) => {
  if (!canReorder.value) return
  draggingId.value = id
  draggingType.value = type
  dragExpandedGroupIds.value = new Set()
  e.dataTransfer.effectAllowed = 'move'

  const el = e.currentTarget
  dragImageEl = createDragImage(el)
  e.dataTransfer.setDragImage(dragImageEl, el.offsetWidth / 2, 20)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (dragImageEl) {
        dragImageEl.remove()
        dragImageEl = null
      }
    })
  })
}

const onDragOverList = (e) => {
  if (draggingId.value === null) return
  hasDragMoved.value = true
  updateDropTarget(e.clientY)
}

const onDragEnd = () => {
  clearHoverExpand()
  if (draggingId.value !== null) {
    for (const gid of dragExpandedGroupIds.value) {
      emit('toggle-group-collapse', gid)
    }
    draggingId.value = null
    draggingType.value = null
    dropTarget.value = null
    dragExpandedGroupIds.value = new Set()
    hasDragMoved.value = false
  }
}

const onDrop = () => {
  clearHoverExpand()
  commitReorder()
}

// -- Touch --

const touchDragActive = ref(false)
let touchHoldTimer = null
let touchCloneEl = null
const TOUCH_HOLD_MS = 400
const TOUCH_MOVE_THRESHOLD = 8

const isTouchDevice = ref(false)
if (typeof window !== 'undefined') {
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

const createTouchClone = (el) => {
  const clone = el.cloneNode(true)
  const rect = el.getBoundingClientRect()
  clone.style.cssText = `
    position: fixed; left: 8px; width: ${rect.width - 16}px;
    opacity: 0.9; border-radius: 8px; pointer-events: none; z-index: 9999;
    box-shadow: 0 12px 32px rgba(0,0,0,0.22); transform: scale(1.02);
  `
  document.body.appendChild(clone)
  return clone
}

const cleanupTouchDrag = () => {
  clearTimeout(touchHoldTimer)
  touchHoldTimer = null
  if (touchCloneEl) {
    touchCloneEl.remove()
    touchCloneEl = null
  }
  touchDragActive.value = false
}

const onTouchStart = (e, id, type) => {
  if (!canReorder.value) return

  const el = e.currentTarget
  const t0 = e.touches[0]
  const startX = t0.clientX
  const startY = t0.clientY
  let phase = 'waiting' // 'waiting' → 'dragging' | 'cancelled'

  const onContextMenu = (ev) => ev.preventDefault()
  el.addEventListener('contextmenu', onContextMenu)

  const cancelHold = () => {
    if (phase === 'cancelled') return
    phase = 'cancelled'
    clearTimeout(touchHoldTimer)
    cleanup()
  }

  const cleanup = () => {
    el.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('touchmove', onWaitingMove)
    document.removeEventListener('touchend', onWaitingEnd)
    document.removeEventListener('touchcancel', onWaitingEnd)
  }

  const onWaitingMove = (ev) => {
    const t = ev.touches[0]
    if (
      Math.abs(t.clientX - startX) > TOUCH_MOVE_THRESHOLD ||
      Math.abs(t.clientY - startY) > TOUCH_MOVE_THRESHOLD
    ) {
      cancelHold()
    }
  }

  const onWaitingEnd = () => {
    cancelHold()
  }

  document.addEventListener('touchmove', onWaitingMove, { passive: true })
  document.addEventListener('touchend', onWaitingEnd)
  document.addEventListener('touchcancel', onWaitingEnd)

  touchHoldTimer = setTimeout(() => {
    if (phase !== 'waiting') return
    phase = 'dragging'

    document.removeEventListener('touchmove', onWaitingMove)
    document.removeEventListener('touchend', onWaitingEnd)
    document.removeEventListener('touchcancel', onWaitingEnd)

    touchDragActive.value = true
    draggingId.value = id
    draggingType.value = type
    dragExpandedGroupIds.value = new Set()

    try {
      window.navigator?.vibrate?.(30)
    } catch (_) {
      /* ignore */
    }

    touchCloneEl = createTouchClone(el)
    touchCloneEl.style.top = startY - 26 + 'px'

    const onDragMove = (ev) => {
      ev.preventDefault()
      const touch = ev.touches[0]

      if (touchCloneEl) {
        touchCloneEl.style.top = touch.clientY - 26 + 'px'
      }

      if (listRef.value) {
        const listRect = listRef.value.getBoundingClientRect()
        const SCROLL_ZONE = 50
        const SCROLL_SPEED = 6
        if (touch.clientY < listRect.top + SCROLL_ZONE) {
          listRef.value.scrollTop = Math.max(0, listRef.value.scrollTop - SCROLL_SPEED)
        } else if (touch.clientY > listRect.bottom - SCROLL_ZONE) {
          listRef.value.scrollTop += SCROLL_SPEED
        }
      }

      hasDragMoved.value = true
      updateDropTarget(touch.clientY)
    }

    const onDragEnd = () => {
      document.removeEventListener('touchmove', onDragMove)
      document.removeEventListener('touchend', onDragEnd)
      document.removeEventListener('touchcancel', onDragEnd)
      el.removeEventListener('contextmenu', onContextMenu)
      clearHoverExpand()
      cleanupTouchDrag()
      commitReorder()
    }

    document.addEventListener('touchmove', onDragMove, { passive: false })
    document.addEventListener('touchend', onDragEnd)
    document.addEventListener('touchcancel', onDragEnd)
  }, TOUCH_HOLD_MS)
}

const getItemAtY = (y) => {
  if (!listRef.value) return null
  const items = listRef.value.querySelectorAll('[data-item-id]')
  let closest = null
  let closestDist = Infinity
  for (const item of items) {
    if (item.style.display === 'none') continue
    const rect = item.getBoundingClientRect()
    if (y >= rect.top && y <= rect.bottom) {
      const kind = item.dataset.kind
      return {
        id: item.dataset.itemId,
        type: kind === 'group' ? 'group' : 'note',
        position: y < rect.top + rect.height / 2 ? 'before' : 'after',
        rect,
      }
    }
    const distTop = Math.abs(y - rect.top)
    const distBottom = Math.abs(y - rect.bottom)
    const dist = Math.min(distTop, distBottom)
    if (dist < closestDist) {
      closestDist = dist
      closest = { item, rect, distTop, distBottom }
    }
  }
  if (closest && closestDist < 60) {
    const kind = closest.item.dataset.kind
    return {
      id: closest.item.dataset.itemId,
      type: kind === 'group' ? 'group' : 'note',
      position: closest.distTop < closest.distBottom ? 'before' : 'after',
      rect: closest.rect,
    }
  }
  return null
}

const updateDropTarget = (clientY) => {
  const hit = getItemAtY(clientY)

  if (hit && hit.id !== draggingId.value) {
    if (draggingType.value === 'note' && hit.type === 'group') {
      const hy = clientY - hit.rect.top
      const hh = hit.rect.height
      if (hy < hh * GROUP_DROP_THRESHOLD) {
        dropTarget.value = { id: hit.id, type: hit.type, position: 'before' }
        clearHoverExpand()
      } else if (hy > hh * (1 - GROUP_DROP_THRESHOLD)) {
        const group = props.groups.find((g) => g.id === hit.id)
        if (group && !group.collapsed) {
          dropTarget.value = { id: hit.id, type: hit.type, position: 'inside' }
        } else {
          dropTarget.value = { id: hit.id, type: hit.type, position: 'after' }
        }
        clearHoverExpand()
      } else {
        dropTarget.value = { id: hit.id, type: hit.type, position: 'inside' }
        startHoverExpand(hit.id)
      }
    } else {
      dropTarget.value = { id: hit.id, type: hit.type, position: hit.position }
      clearHoverExpand()
    }
  } else if (!hit && listRef.value) {
    dropTarget.value = { id: '__bottom__', type: 'bottom', position: 'after' }
    clearHoverExpand()
  } else if (hit && hit.id === draggingId.value) {
    // Over the dragged item itself — keep current target
  } else {
    dropTarget.value = null
    clearHoverExpand()
  }
}

// -- Commit --

const commitReorder = () => {
  if (draggingId.value === null || dropTarget.value === null) {
    for (const gid of dragExpandedGroupIds.value) {
      emit('toggle-group-collapse', gid)
    }
    draggingId.value = null
    draggingType.value = null
    dropTarget.value = null
    dragExpandedGroupIds.value = new Set()
    return
  }

  const dt = dropTarget.value
  const draggedNote =
    draggingType.value === 'note'
      ? filteredNotes.value.find((n) => n.id === draggingId.value)
      : null
  const targetDisplayItem = displayItems.value.find((i) => i.id === dt.id)

  if (draggingType.value === 'note') {
    if (dt.id === '__bottom__') {
      if (draggedNote?.groupId) {
        emit('move-note-to-group', { noteId: draggingId.value, groupId: null })
      }
      const topLevel = [...sidebarItems.value]
      const fromIdx = topLevel.findIndex((i) => i.id === draggingId.value)
      let movedItem
      if (fromIdx !== -1) {
        ;[movedItem] = topLevel.splice(fromIdx, 1)
      } else {
        movedItem = { id: draggingId.value, kind: 'note', sortOrder: 0, data: draggedNote }
      }
      topLevel.push(movedItem)
      emitUnifiedOrder(topLevel)
    } else if (dt.type === 'group' && dt.position === 'inside') {
      emit('move-note-to-group', { noteId: draggingId.value, groupId: dt.id })
    } else {
      let newGroupId = null
      if (targetDisplayItem?.kind === 'grouped-note') {
        newGroupId = targetDisplayItem.parentGroupId
      } else if (targetDisplayItem?.kind === 'group') {
        newGroupId = null
      }

      const oldGroupId = draggedNote?.groupId || null

      if (oldGroupId && newGroupId === oldGroupId && targetDisplayItem?.kind === 'grouped-note') {
        const siblings = getGroupNotes(oldGroupId)
        const ordered = [...siblings]
        const fromIdx = ordered.findIndex((n) => n.id === draggingId.value)
        const toIdx = ordered.findIndex((n) => n.id === dt.id)
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          const [moved] = ordered.splice(fromIdx, 1)
          let insertAt = ordered.findIndex((n) => n.id === dt.id)
          if (insertAt === -1) insertAt = ordered.length
          if (dt.position === 'after') insertAt++
          ordered.splice(insertAt, 0, moved)
          emit('reorder-within-group', {
            groupId: oldGroupId,
            orderedNoteIds: ordered.map((n) => n.id),
          })
        }
      } else {
        if (newGroupId !== oldGroupId) {
          emit('move-note-to-group', { noteId: draggingId.value, groupId: newGroupId })
        }

        if (newGroupId && targetDisplayItem?.kind === 'grouped-note') {
          const siblings = getGroupNotes(newGroupId).filter((n) => n.id !== draggingId.value)
          const targetIdx = siblings.findIndex((n) => n.id === dt.id)
          let insertAt = targetIdx === -1 ? siblings.length : targetIdx
          if (dt.position === 'after') insertAt++
          siblings.splice(insertAt, 0, draggedNote)
          emit('reorder-within-group', {
            groupId: newGroupId,
            orderedNoteIds: siblings.map((n) => n.id),
          })
        } else if (!newGroupId) {
          const topLevel = [...sidebarItems.value]
          const fromIdx = topLevel.findIndex((i) => i.id === draggingId.value)
          let movedItem
          if (fromIdx !== -1) {
            ;[movedItem] = topLevel.splice(fromIdx, 1)
          } else {
            movedItem = { id: draggingId.value, kind: 'note', sortOrder: 0, data: draggedNote }
          }

          let targetTopId = dt.id
          if (targetDisplayItem?.kind === 'grouped-note') {
            targetTopId = targetDisplayItem.parentGroupId
          }
          let insertAt = topLevel.findIndex((i) => i.id === targetTopId)
          if (insertAt === -1) insertAt = topLevel.length
          if (dt.position === 'after') insertAt++
          topLevel.splice(insertAt, 0, movedItem)

          emitUnifiedOrder(topLevel)
        }
      }
    }
  } else if (draggingType.value === 'group') {
    const topLevel = [...sidebarItems.value]
    const fromIdx = topLevel.findIndex((i) => i.id === draggingId.value)
    if (fromIdx !== -1) {
      const [moved] = topLevel.splice(fromIdx, 1)
      if (dt.id === '__bottom__') {
        topLevel.push(moved)
      } else {
        let targetTopId = dt.id
        if (targetDisplayItem?.kind === 'grouped-note') {
          targetTopId = targetDisplayItem.parentGroupId
        }
        let insertAt = topLevel.findIndex((i) => i.id === targetTopId)
        if (insertAt === -1) insertAt = topLevel.length
        if (dt.position === 'after') insertAt++
        topLevel.splice(insertAt, 0, moved)
      }
      emitUnifiedOrder(topLevel)
    }
  }

  nextTick(() => {
    draggingId.value = null
    draggingType.value = null
    dropTarget.value = null
    dragExpandedGroupIds.value = new Set()
    hasDragMoved.value = false
  })
}

const emitUnifiedOrder = (topLevel) => {
  const orders = topLevel.map((item, idx) => ({
    id: item.id,
    kind: item.kind,
    sortOrder: idx,
  }))
  emit('reorder-all', orders)
}

// ── Multi-select ─────────────────────────────────────────

const selectMode = ref(false)
const selectedIds = ref(new Set())

const allSelected = computed(() => {
  return (
    filteredNotes.value.length > 0 && filteredNotes.value.every((n) => selectedIds.value.has(n.id))
  )
})

const toggleSelectMode = () => {
  if (selectMode.value) exitSelectMode()
  else {
    selectMode.value = true
    selectedIds.value = new Set()
    emit('selection-change', [])
  }
}

const exitSelectMode = () => {
  selectMode.value = false
  selectedIds.value = new Set()
  emit('selection-change', [])
}

const toggleNoteSelection = (noteId) => {
  const next = new Set(selectedIds.value)
  if (next.has(noteId)) next.delete(noteId)
  else next.add(noteId)
  selectedIds.value = next
  emit('selection-change', [...next])
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedIds.value = new Set()
    emit('selection-change', [])
  } else {
    const ids = filteredNotes.value.map((n) => n.id)
    selectedIds.value = new Set(ids)
    emit('selection-change', ids)
  }
}

const bulkDelete = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-delete', [...selectedIds.value])
  exitSelectMode()
}

const bulkRestore = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-restore', [...selectedIds.value])
  exitSelectMode()
}

const bulkPermanentDelete = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-permanent-delete', [...selectedIds.value])
  exitSelectMode()
}

const bulkArchive = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-archive', [...selectedIds.value])
  exitSelectMode()
}

const bulkUnarchive = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-unarchive', [...selectedIds.value])
  exitSelectMode()
}

const bulkGroup = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-group', [...selectedIds.value])
  exitSelectMode()
}

// ── Filtering ────────────────────────────────────────────

const toggleTag = (tag) => {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1) selectedTags.value.push(tag)
  else selectedTags.value.splice(idx, 1)
}

const filteredNotes = computed(() => {
  let result = props.notes

  if (showBin.value) {
    result = result.filter((n) => !!n.deletedAt)
  } else {
    result = result.filter((n) => !n.deletedAt)
    result = result.filter((n) => (showArchive.value ? !!n.archived : !n.archived))
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter((n) => {
      const matchTitle = (n.title || '').toLowerCase().includes(q)
      const matchDesc = (n.description || '').toLowerCase().includes(q)
      const matchTags = (n.tags || []).some((t) => t.toLowerCase().includes(q))
      const matchContent = filters.searchContent && (n.content || '').toLowerCase().includes(q)
      const matchInternalName = (n.internalName || '').toLowerCase().includes(q)
      return matchTitle || matchDesc || matchTags || matchContent || matchInternalName
    })
  }
  if (selectedTags.value.length) {
    result = result.filter((n) => selectedTags.value.every((t) => (n.tags || []).includes(t)))
  }
  if (filters.dateRange) {
    const now = Date.now()
    const day = 86400000
    result = result.filter((n) => {
      const updated = new Date(n.updatedAt).getTime()
      const age = now - updated
      switch (filters.dateRange) {
        case 'today':
          return age < day
        case 'week':
          return age < 7 * day
        case 'month':
          return age < 30 * day
        case 'older':
          return age >= 30 * day
        default:
          return true
      }
    })
  }
  if (filters.hasDescription) {
    result = result.filter((n) => (n.description || '').trim().length > 0)
  }
  if (filters.hasTags) {
    result = result.filter((n) => (n.tags || []).length > 0)
  }
  if (filters.emptyOnly) {
    result = result.filter((n) => !(n.content || '').trim())
  }
  return result.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
})
</script>
