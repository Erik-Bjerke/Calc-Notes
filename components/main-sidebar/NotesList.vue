<template>
  <div
    ref="listRef"
    class="flex-1 overflow-y-auto bg-white dark:bg-gray-800/50"
    @dragover.prevent="$emit('drag-over-list', $event)"
    @drop.prevent="$emit('drop')"
  >
    <!-- ── Empty state ── -->
    <div
      v-if="displayItems.length === 0"
      class="p-4 text-center text-sm text-gray-500 dark:text-gray-400 mt-8"
    >
      <template v-if="showBin">
        <Icon name="mdi:delete-empty-outline" class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Bin is empty</p>
        <p class="text-xs mt-1 text-gray-400 dark:text-gray-500">Deleted notes will appear here</p>
      </template>
      <template v-else-if="showArchive">
        <Icon name="mdi:archive-off-outline" class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No archived notes</p>
        <p class="text-xs mt-1 text-gray-400 dark:text-gray-500">Archived notes will appear here</p>
      </template>
      <template v-else> No notes found </template>
    </div>

    <template v-for="(item, idx) in displayItems" :key="item.id">
      <!-- ── Insertion line (before this row) ── -->
      <div
        v-if="insertionIndex === idx"
        class="tree-drop-line bg-primary-500"
        :style="lineStyle(insertionDepth)"
      />

      <!-- ── Group / folder row ── -->
      <div
        v-if="item.kind === 'group'"
        v-show="!isHidden(item.id)"
        :data-item-id="item.id"
        data-kind="group"
        :data-depth="item.depth"
        :draggable="canReorder && !isTouchDevice"
        class="relative"
        @dragstart="$emit('drag-start', $event, item.id, 'group')"
        @dragend="$emit('drag-end')"
        @touchstart.passive="$emit('touch-start', $event, item.id, 'group')"
      >
        <span
          v-for="(gx, gi) in guideOffsets(item.depth)"
          :key="gi"
          class="tree-guide"
          :style="{ left: gx + 'px' }"
        />
        <GroupListItem
          :group="item.data"
          :note-count="groupCount(item.id)"
          :level="item.depth + 1"
          :max-depth="maxGroupDepth"
          :indent="indentPx(item.depth)"
          :drop-indicator="dropInsideId === item.id ? 'inside' : null"
          :select-mode="selectMode"
          :selected="selectedGroupIds.has(item.id)"
          :bin-mode="showBin"
          @toggle-collapse="(id) => $emit('toggle-group-collapse', id)"
          @toggle-select="(id) => $emit('toggle-group-selection', id)"
          @edit="(id) => $emit('edit-group', id)"
          @delete="(id) => $emit('delete-group', id)"
          @add-subgroup="(id) => $emit('add-subgroup', id)"
        />
      </div>

      <!-- ── Empty group placeholder ── -->
      <div
        v-else-if="item.kind === 'group-empty'"
        :data-item-id="item.id"
        data-kind="empty"
        :data-depth="item.depth"
        class="relative flex items-center h-8 text-[13px] italic text-gray-400 dark:text-gray-600"
        :class="{
          'bg-primary-50/70 dark:bg-primary-500/15 ring-1 ring-inset ring-primary-400/70':
            dropInsideId === item.parentId,
        }"
        :style="{ paddingLeft: indentPx(item.depth) + 16 + 'px' }"
      >
        <span
          v-for="(gx, gi) in guideOffsets(item.depth)"
          :key="gi"
          class="tree-guide"
          :style="{ left: gx + 'px' }"
        />
        (empty)
      </div>

      <!-- ── Note (leaf) ── -->
      <div
        v-else
        v-show="!isHidden(item.id)"
        :data-item-id="item.id"
        data-kind="note"
        :data-depth="item.depth"
        :draggable="canReorder && !isTouchDevice"
        class="relative"
        @dragstart="$emit('drag-start', $event, item.id, 'note')"
        @dragend="$emit('drag-end')"
        @touchstart.passive="$emit('touch-start', $event, item.id, 'note')"
      >
        <span
          v-for="(gx, gi) in guideOffsets(item.depth)"
          :key="gi"
          class="tree-guide"
          :style="{ left: gx + 'px' }"
        />
        <NoteListItem
          :note="item.data"
          :active="item.data.id === currentNoteId"
          :select-mode="selectMode"
          :selected="selectedIds.has(item.data.id)"
          :shared="sharedNoteIds.includes(item.data.id)"
          :share-hash="sharedNotesMap.get(item.data.id) || null"
          :analytics-hash="analyticsNotesMap.get(item.data.id) || null"
          :pending="pendingNoteIds.has(item.data.id)"
          :is-logged-in="isLoggedIn"
          :bin-mode="showBin"
          :indent="indentPx(item.depth)"
          @select="(id) => $emit('select-note', id)"
          @delete="(id) => $emit('delete-note', id)"
          @share="(id) => $emit('share-note', id)"
          @unshare="(id) => $emit('unshare-note', id)"
          @properties="(id) => $emit('show-properties', id)"
          @open-analytics="(hash) => $emit('open-analytics', hash)"
          @duplicate="(id) => $emit('duplicate-note', id)"
          @export="(id) => $emit('export-note', id)"
          @copy-to-clipboard="(id) => $emit('copy-to-clipboard', id)"
          @print="(id) => $emit('print-note', id)"
          @archive="(id) => $emit('archive-note', id)"
          @unarchive="(id) => $emit('unarchive-note', id)"
          @toggle-select="(id) => $emit('toggle-note-selection', id)"
          @add-to-group="(id) => $emit('add-to-group', id)"
          @restore="(id) => $emit('restore-note', id)"
          @permanent-delete="(id) => $emit('permanent-delete-note', id)"
        />
      </div>
    </template>

    <!-- ── Bottom insertion line + drop zone ── -->
    <div
      v-if="insertionIndex === displayItems.length"
      class="tree-drop-line bg-primary-500 ring-1 ring-primary-300 dark:ring-primary-700"
      :style="lineStyle(0)"
    />
    <div v-if="draggingId" class="min-h-[60px]" />
  </div>
</template>

<script setup>
const props = defineProps({
  displayItems: { type: Array, required: true },
  showBin: { type: Boolean, required: true },
  showArchive: { type: Boolean, required: true },
  currentNoteId: { type: String, default: null },
  selectMode: { type: Boolean, required: true },
  selectedIds: { type: Set, required: true },
  selectedGroupIds: { type: Set, default: () => new Set() },
  sharedNoteIds: { type: Array, required: true },
  sharedNotesMap: { type: Map, required: true },
  analyticsNotesMap: { type: Map, required: true },
  pendingNoteIds: { type: Set, required: true },
  isLoggedIn: { type: Boolean, required: true },
  canReorder: { type: Boolean, required: true },
  isTouchDevice: { type: Boolean, required: true },
  maxGroupDepth: { type: Number, default: 3 },
  draggingId: { type: [String, null], default: null },
  dropInsideId: { type: [String, null], default: null },
  insertionIndex: { type: Number, default: -1 },
  insertionDepth: { type: Number, default: 0 },
  isHidden: { type: Function, required: true },
  groupCount: { type: Function, required: true },
})

defineEmits([
  'drag-over-list',
  'drop',
  'drag-start',
  'drag-end',
  'touch-start',
  'toggle-group-collapse',
  'toggle-group-selection',
  'edit-group',
  'delete-group',
  'add-subgroup',
  'select-note',
  'delete-note',
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
  'toggle-note-selection',
  'add-to-group',
  'restore-note',
  'permanent-delete-note',
])

const BASE = 4 // px left padding at depth 0
const STEP = 16 // px indent per nesting level (one twisty width)

// Left padding applied inside a row for its nesting depth.
const indentPx = (depth) => BASE + depth * STEP

// X offsets (px) for the vertical indent guides of a row at a given depth —
// one guide per ancestor level, centered in that level's twisty column.
const guideOffsets = (depth) => Array.from({ length: depth }, (_, i) => BASE + i * STEP + 8)

// Position the drop insertion line at the content start of its nesting level.
const lineStyle = (depth) => `margin-left: ${BASE + depth * STEP + 16}px;`

const listRef = ref(null)
defineExpose({ listRef })

// Scroll the active note into view when it changes (e.g. revealed from search).
// `block: 'nearest'` keeps it a no-op when the row is already visible.
watch(
  () => props.currentNoteId,
  (id) => {
    if (!id) return
    nextTick(() => {
      requestAnimationFrame(() => {
        const root = listRef.value
        if (!root) return
        const key = window.CSS && CSS.escape ? CSS.escape(id) : id
        const el = root.querySelector(`[data-item-id="${key}"]`)
        el?.scrollIntoView({ block: 'nearest' })
      })
    })
  },
)
</script>

<style scoped>
/* VSCode-style vertical indent guides */
.tree-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 5;
  pointer-events: none;
  background-color: rgb(229 231 235); /* gray-200 */
}
:global(.dark) .tree-guide {
  background-color: rgb(55 65 81 / 0.6); /* gray-700 */
}
.tree-drop-line {
  height: 2px;
  margin-top: 1px;
  margin-bottom: 1px;
  margin-right: 6px;
  border-radius: 2px;
}
</style>
