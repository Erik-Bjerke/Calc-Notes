<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
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

// ── Reorder / filter gating ──────────────────────────────

const isFiltering = computed(
  () => searchQuery.value.trim() !== '' || selectedTags.value.length > 0 || hasActiveFilters.value,
)
const canReorder = computed(() => !selectMode.value && !isFiltering.value)

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

// ── File-tree model + drag & drop ────────────────────────
// In archive / bin / active-search views the tree flattens to a plain note
// list (no groups, reorder only). Otherwise the full nested tree is shown.
const maxGroupDepth = 3
const flatMode = computed(() => showArchive.value || showBin.value || isFiltering.value)

const { displayItems, childrenOf, groupsById, canPlaceNoteIn, canPlaceGroupIn } = useNoteTree({
  filteredNotes,
  groups: toRef(props, 'groups'),
  flatMode,
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
  flatMode,
  onToggleCollapse: (id) => emit('toggle-group-collapse', id),
  onMove: (payload) => emit('tree-move', payload),
})
</script>
