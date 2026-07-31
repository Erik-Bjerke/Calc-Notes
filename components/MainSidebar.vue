<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
    <!-- Selection Toolbar / Header — crossfade in a fixed container.
         In select mode the area expands (animated) to fit the taller toolbar. -->
    <div
      class="relative border-b border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-hidden transition-[padding] duration-200 ease-out"
      :class="{ 'pb-14': selectMode }"
    >
      <!-- Select toolbar -->
      <MainSidebarSelectionToolbar
        :select-mode="selectMode"
        :selected-ids="selectedIds"
        :selected-count="selectedCount"
        :can-group="canGroupSelection"
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
        :all-tags="allTags"
        :selected-tags="selectedTags"
        :current-note="currentNote"
        @show-meta="$emit('show-meta')"
        @toggle-select-mode="toggleSelectMode"
        @toggle-tag="toggleTag"
      />
    </div>

    <!-- Notes List -->
    <MainSidebarNotesList
      ref="notesListRef"
      :display-items="displayItems"
      :show-bin="showBin"
      :show-archive="showArchive"
      :current-note-id="currentNoteId"
      :select-mode="selectMode"
      :selected-ids="selectedIds"
      :selected-group-ids="selectedGroupIds"
      :shared-note-ids="sharedNoteIds"
      :shared-notes-map="sharedNotesMap"
      :analytics-notes-map="analyticsNotesMap"
      :pending-note-ids="pendingNoteIds"
      :is-logged-in="isLoggedIn"
      :can-reorder="canReorder"
      :is-touch-device="isTouchDevice"
      :max-group-depth="maxGroupDepth"
      :dragging-id="draggingId"
      :drop-inside-id="dropInsideId"
      :insertion-index="insertionIndex"
      :insertion-depth="insertionDepth"
      :is-hidden="isHidden"
      :group-count="groupCount"
      @drag-over-list="onDragOverList"
      @drop="onDrop"
      @drag-start="onDragStart"
      @drag-end="onDragEnd"
      @touch-start="onTouchStart"
      @toggle-group-collapse="(id) => $emit('toggle-group-collapse', id)"
      @edit-group="(id) => $emit('edit-group', id)"
      @delete-group="(id) => $emit('delete-group', id)"
      @add-subgroup="(id) => $emit('add-subgroup', id)"
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
      @toggle-group-selection="toggleGroupSelection"
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
  'add-subgroup',
  'tree-move',
])

const selectedTags = ref([])
const notesListRef = ref(null)

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

// Switch to the Notes view whenever the current note is (or becomes) a live
// note — covers creating a note, and restoring/unarchiving the open note
// (where the id doesn't change but its archived/deleted state does).
watch(
  () => {
    const note = props.notes.find((n) => n.id === props.currentNoteId)
    return `${props.currentNoteId}|${note?.archived ? 1 : 0}|${note?.deletedAt ? 1 : 0}`
  },
  () => {
    const id = props.currentNoteId
    if (!id || sidebarView.value === 'notes') return
    const note = props.notes.find((n) => n.id === id)
    if (note && !note.archived && !note.deletedAt) {
      sidebarView.value = 'notes'
    }
  },
)

// ── Reorder / filter gating ──────────────────────────────
// Search lives in the dedicated Search panel now; the Explorer only filters
// by tag. When a tag filter is active the tree flattens to matching notes.

const isFiltering = computed(() => selectedTags.value.length > 0)
const canReorder = computed(
  () => !selectMode.value && !isFiltering.value && !showArchive.value && !showBin.value,
)

// ── Multi-select ─────────────────────────────────────────

const selectMode = ref(false)
const selectedIds = ref(new Set()) // selected note ids
const selectedGroupIds = ref(new Set()) // selected group ids

const selectedCount = computed(() => selectedIds.value.size + selectedGroupIds.value.size)

// Groups that are currently visible in the tree (all of them, or — in
// archive/bin/filter views — only those containing matching notes).
const selectableGroups = computed(() => {
  const vis = visibleGroupIds.value
  return vis === null ? viewGroups.value : viewGroups.value.filter((g) => vis.has(g.id))
})

const allSelected = computed(() => {
  const hasItems = filteredNotes.value.length > 0 || selectableGroups.value.length > 0
  const notesAll = filteredNotes.value.every((n) => selectedIds.value.has(n.id))
  const groupsAll = selectableGroups.value.every((g) => selectedGroupIds.value.has(g.id))
  return hasItems && notesAll && groupsAll
})

const toggleSelectMode = () => {
  if (selectMode.value) exitSelectMode()
  else {
    selectMode.value = true
    selectedIds.value = new Set()
    selectedGroupIds.value = new Set()
    emit('selection-change', [])
  }
}

const exitSelectMode = () => {
  selectMode.value = false
  selectedIds.value = new Set()
  selectedGroupIds.value = new Set()
  emit('selection-change', [])
}

const toggleNoteSelection = (noteId) => {
  const next = new Set(selectedIds.value)
  if (next.has(noteId)) next.delete(noteId)
  else next.add(noteId)
  selectedIds.value = next
  emit('selection-change', [...next])
}

// Selecting a group cascades to its whole subtree (sub-groups + notes);
// deselecting removes them all.
const toggleGroupSelection = (groupId) => {
  const selecting = !selectedGroupIds.value.has(groupId)
  const groupIds = [groupId, ...descendantIds(groupId)]
  const noteIds = groupDescendantNoteIds(groupId)

  const nextGroups = new Set(selectedGroupIds.value)
  const nextNotes = new Set(selectedIds.value)
  if (selecting) {
    groupIds.forEach((id) => nextGroups.add(id))
    noteIds.forEach((id) => nextNotes.add(id))
  } else {
    groupIds.forEach((id) => nextGroups.delete(id))
    noteIds.forEach((id) => nextNotes.delete(id))
  }
  selectedGroupIds.value = nextGroups
  selectedIds.value = nextNotes
  emit('selection-change', [...nextNotes])
}

// Top-level selected items (their parent group is not itself selected). These
// are what a bulk "Group" moves — their subtrees travel with them.
const selectedGroupRoots = computed(() =>
  [...selectedGroupIds.value].filter((id) => {
    const g = groupsById.value.get(id)
    return !g || !g.parentId || !selectedGroupIds.value.has(g.parentId)
  }),
)

const selectedNoteRoots = computed(() =>
  [...selectedIds.value].filter((id) => {
    const note = props.notes.find((n) => n.id === id)
    const gid = note?.groupId ?? null
    return !gid || !selectedGroupIds.value.has(gid)
  }),
)

// The common parent of the selection roots (null = mixed parents or root).
const selectionCommonParent = computed(() => {
  const parents = new Set()
  for (const id of selectedGroupRoots.value) {
    const g = groupsById.value.get(id)
    parents.add(g?.parentId ?? null)
  }
  for (const id of selectedNoteRoots.value) {
    const n = props.notes.find((x) => x.id === id)
    parents.add(n?.groupId ?? null)
  }
  return parents.size === 1 ? [...parents][0] : null
})

// Grouping wraps the selection in a new group one level deeper (in place).
// Only possible if the deepest group involved would stay within the limit:
//   • a group root R: its subtree's deepest level (groupLevel + height - 1),
//     pushed one deeper, must be <= MAX_DEPTH.
//   • a standalone note: the group that would wrap it sits at its parent
//     level + 1, which must be <= MAX_DEPTH.
const canGroupSelection = computed(() => {
  if (selectedCount.value === 0) return false
  const groupsOk = selectedGroupRoots.value.every(
    (id) => groupLevel(id) + subtreeHeight(id) <= maxGroupDepth,
  )
  const notesOk = selectedNoteRoots.value.every((id) => {
    const note = props.notes.find((n) => n.id === id)
    const parentLevel = note?.groupId ? groupLevel(note.groupId) : 0
    return parentLevel + 1 <= maxGroupDepth
  })
  return groupsOk && notesOk
})

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedIds.value = new Set()
    selectedGroupIds.value = new Set()
    emit('selection-change', [])
  } else {
    const ids = filteredNotes.value.map((n) => n.id)
    selectedIds.value = new Set(ids)
    selectedGroupIds.value = new Set(selectableGroups.value.map((g) => g.id))
    emit('selection-change', ids)
  }
}

// Notes contained (recursively) in a group, within the current view.
const groupDescendantNoteIds = (groupId) => {
  const out = []
  const walk = (gid) => {
    for (const n of filteredNotes.value) if ((n.groupId ?? null) === gid) out.push(n.id)
    for (const g of props.groups) if ((g.parentId ?? null) === gid) walk(g.id)
  }
  walk(groupId)
  return out
}

// Selected notes plus every note inside a selected group — used by note-level
// bulk actions (archive / group) so selecting a folder affects its contents.
const effectiveNoteIds = () => {
  const set = new Set(selectedIds.value)
  for (const gid of selectedGroupIds.value) {
    for (const nid of groupDescendantNoteIds(gid)) set.add(nid)
  }
  return [...set]
}

const bulkDelete = () => {
  if (selectedCount.value === 0) return
  emit('bulk-delete', {
    noteIds: [...selectedIds.value],
    groupIds: [...selectedGroupIds.value],
  })
  exitSelectMode()
}

const bulkRestore = () => {
  if (selectedCount.value === 0) return
  emit('bulk-restore', {
    noteIds: [...selectedIds.value],
    groupIds: [...selectedGroupIds.value],
  })
  exitSelectMode()
}

const bulkPermanentDelete = () => {
  if (selectedCount.value === 0) return
  emit('bulk-permanent-delete', {
    noteIds: [...selectedIds.value],
    groupIds: [...selectedGroupIds.value],
  })
  exitSelectMode()
}

const bulkArchive = () => {
  const ids = effectiveNoteIds()
  if (ids.length === 0) return
  emit('bulk-archive', ids)
  exitSelectMode()
}

const bulkUnarchive = () => {
  if (selectedIds.value.size === 0) return
  emit('bulk-unarchive', [...selectedIds.value])
  exitSelectMode()
}

const bulkGroup = () => {
  if (!canGroupSelection.value) return
  emit('bulk-group', {
    noteIds: selectedNoteRoots.value,
    groupIds: selectedGroupRoots.value,
    parentId: selectionCommonParent.value,
  })
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

  if (selectedTags.value.length) {
    result = result.filter((n) => selectedTags.value.every((t) => (n.tags || []).includes(t)))
  }

  return result.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
})

// ── File-tree model + drag & drop ────────────────────────
// In archive / bin / active-search views the tree flattens to a plain note
// list (no groups, reorder only). Otherwise the full nested tree is shown.
const maxGroupDepth = 3
// The bin shows soft-deleted folders; every other view shows live folders.
const viewGroups = computed(() =>
  showBin.value
    ? props.groups.filter((g) => g.deletedAt)
    : props.groups.filter((g) => !g.deletedAt),
)
// Archive / tag-filter views hide folders with no matching notes. The bin keeps
// its deleted folders even when empty so they remain restorable.
const pruneEmpty = computed(() => showArchive.value || isFiltering.value)

const {
  displayItems,
  childrenOf,
  groupsById,
  visibleGroupIds,
  groupLevel,
  subtreeHeight,
  descendantIds,
  canPlaceNoteIn,
  canPlaceGroupIn,
} = useNoteTree({
  filteredNotes,
  groups: viewGroups,
  pruneEmpty,
})

const groupCount = (groupId) => childrenOf(groupId).length

const {
  draggingId,
  isTouchDevice,
  isHidden,
  dropInsideId,
  insertionIndex,
  insertionDepth,
  onDragStart,
  onDragOverList,
  onDragEnd,
  onDrop,
  onTouchStart,
} = useTreeDragDrop({
  displayItems,
  childrenOf,
  groupsById,
  canPlaceNoteIn,
  canPlaceGroupIn,
  listRef,
  canReorder,
  flatMode: computed(() => false),
  onToggleCollapse: (id) => emit('toggle-group-collapse', id),
  onMove: (payload) => emit('tree-move', payload),
})
</script>
