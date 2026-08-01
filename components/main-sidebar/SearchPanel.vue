<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <div class="p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 space-y-2">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Search
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Icon
            name="mdi:magnify"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search notes..."
            class="w-full pl-8 pr-8 py-1.5 text-sm rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
            @keydown.esc="query = ''"
          >
          <button
            v-if="query"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear"
            @click="query = ''"
          >
            <Icon name="mdi:close-circle" class="w-4 h-4" />
          </button>
        </div>
        <UiButton
          v-if="allTags.length"
          variant="ghost"
          icon-only
          size="sm"
          class="flex-shrink-0"
          :class="
            showTags || selectedTags.length
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          "
          title="Filter by tag"
          @click="showTags = !showTags"
        >
          <Icon name="mdi:tag-multiple-outline" class="w-4 h-4 block" />
        </UiButton>
        <UiButton
          variant="ghost"
          icon-only
          size="sm"
          class="flex-shrink-0"
          :class="
            showFilters || hasActiveFilters
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          "
          title="Filters"
          @click="showFilters = !showFilters"
        >
          <Icon
            :name="showFilters ? 'mdi:filter-variant-remove' : 'mdi:filter-variant'"
            class="w-4 h-4 block transition-transform duration-200"
            :class="{ 'rotate-180': showFilters }"
          />
        </UiButton>
      </div>

      <!-- Advanced filters -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1 max-h-0"
        enter-to-class="opacity-100 translate-y-0 max-h-40"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 max-h-40"
        leave-to-class="opacity-0 -translate-y-1 max-h-0"
      >
        <div v-if="showFilters" class="rounded-lg bg-white dark:bg-gray-800 p-2.5 space-y-2 shadow-sm">
          <UiSelect
            :model-value="filters.dateRange"
            size="xs"
            :options="[
              { value: '', label: 'Modified: Any time' },
              { value: 'today', label: 'Modified: Today' },
              { value: 'week', label: 'Modified: Past 7 days' },
              { value: 'month', label: 'Modified: Past 30 days' },
              { value: 'older', label: 'Modified: Older than 30 days' },
            ]"
            @update:model-value="filters.dateRange = $event"
          />

          <div class="flex flex-wrap gap-1.5">
            <UiButton
              variant="ghost"
              shape="pill"
              size="xs"
              :class="chipClass(filters.searchContent)"
              @click="filters.searchContent = !filters.searchContent"
            >
              Content
            </UiButton>
            <UiButton
              variant="ghost"
              shape="pill"
              size="xs"
              :class="chipClass(filters.hasDescription)"
              @click="filters.hasDescription = !filters.hasDescription"
            >
              Has desc
            </UiButton>
            <UiButton
              variant="ghost"
              shape="pill"
              size="xs"
              :class="chipClass(filters.hasTags)"
              @click="filters.hasTags = !filters.hasTags"
            >
              Has tags
            </UiButton>
            <UiButton
              variant="ghost"
              shape="pill"
              size="xs"
              :class="chipClass(filters.emptyOnly)"
              @click="filters.emptyOnly = !filters.emptyOnly"
            >
              Empty
            </UiButton>
            <UiButton
              v-if="hasActiveFilters"
              variant="ghost"
              color="red"
              shape="pill"
              size="xs"
              class="ml-auto"
              @click="clearFilters"
            >
              Clear
            </UiButton>
          </div>
        </div>
      </Transition>

      <!-- Tag filter -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1 max-h-0"
        enter-to-class="opacity-100 translate-y-0 max-h-40"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 max-h-40"
        leave-to-class="opacity-0 -translate-y-1 max-h-0"
      >
        <div v-if="showTags && allTags.length" class="flex flex-wrap gap-1.5">
          <UiButton
            v-for="tag in allTags"
            :key="tag"
            variant="ghost"
            shape="pill"
            size="xs"
            :class="
              selectedTags.includes(tag)
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            "
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </UiButton>
        </div>
      </Transition>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-if="!isSearching"
        class="p-4 text-center text-sm text-gray-400 dark:text-gray-500 mt-8"
      >
        <Icon name="mdi:text-search" class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Search your notes</p>
        <p class="text-xs mt-1">Matches titles, descriptions, tags and content</p>
      </div>

      <div
        v-else-if="results.length === 0"
        class="p-4 text-center text-sm text-gray-400 dark:text-gray-500 mt-8"
      >
        No results{{ trimmed ? ` for "${trimmed}"` : '' }}
      </div>

      <template v-else>
        <div class="px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ results.length }} result{{ results.length === 1 ? '' : 's' }}
        </div>
        <button
          v-for="note in results"
          :key="note.id"
          type="button"
          class="w-full text-left px-3 py-2 flex flex-col gap-0.5 border-b border-gray-100 dark:border-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors"
          :class="{ 'bg-primary-50 dark:bg-primary-500/15': note.id === currentNoteId }"
          @click="$emit('select-note', note.id)"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <Icon
              name="mdi:file-document-outline"
              class="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
            />
            <span class="truncate text-[13px] text-gray-800 dark:text-gray-200">
              {{ note.title || 'Untitled' }}
            </span>
          </div>
          <div
            v-if="snippet(note)"
            class="pl-5 text-xs text-gray-500 dark:text-gray-500 truncate"
          >
            {{ snippet(note) }}
          </div>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  notes: { type: Array, default: () => [] },
  currentNoteId: { type: String, default: null },
  active: { type: Boolean, default: false },
})

defineEmits(['select-note'])

const query = ref('')
const showFilters = ref(false)
const showTags = ref(false)
const selectedTags = ref([])
const inputRef = ref(null)

const allTags = computed(() => {
  const set = new Set()
  for (const n of props.notes) {
    if (!n.deletedAt && Array.isArray(n.tags)) n.tags.forEach((t) => set.add(t))
  }
  return [...set].sort()
})

const toggleTag = (tag) => {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1) selectedTags.value.push(tag)
  else selectedTags.value.splice(idx, 1)
}

const filters = reactive({
  searchContent: true,
  dateRange: '',
  hasDescription: false,
  hasTags: false,
  emptyOnly: false,
})

const chipClass = (activeState) =>
  activeState
    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'

const hasActiveFilters = computed(
  () =>
    !filters.searchContent ||
    filters.dateRange !== '' ||
    filters.hasDescription ||
    filters.hasTags ||
    filters.emptyOnly,
)

const clearFilters = () => {
  filters.searchContent = true
  filters.dateRange = ''
  filters.hasDescription = false
  filters.hasTags = false
  filters.emptyOnly = false
}

const trimmed = computed(() => query.value.trim())
const q = computed(() => trimmed.value.toLowerCase())

// Results show when there's a query, any active filter, or a selected tag.
const isSearching = computed(
  () => trimmed.value !== '' || hasActiveFilters.value || selectedTags.value.length > 0,
)

const results = computed(() => {
  if (!isSearching.value) return []
  let list = props.notes.filter((n) => !n.deletedAt)

  if (selectedTags.value.length) {
    list = list.filter((n) => selectedTags.value.every((t) => (n.tags || []).includes(t)))
  }

  if (q.value) {
    list = list.filter((n) => {
      const inTitle = (n.title || '').toLowerCase().includes(q.value)
      const inDesc = (n.description || '').toLowerCase().includes(q.value)
      const inTags = (n.tags || []).some((t) => (t || '').toLowerCase().includes(q.value))
      const inName = (n.internalName || '').toLowerCase().includes(q.value)
      const inContent = filters.searchContent && (n.content || '').toLowerCase().includes(q.value)
      return inTitle || inDesc || inTags || inName || inContent
    })
  }

  if (filters.dateRange) {
    const now = Date.now()
    const day = 86400000
    list = list.filter((n) => {
      const age = now - new Date(n.updatedAt).getTime()
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
  if (filters.hasDescription) list = list.filter((n) => (n.description || '').trim().length > 0)
  if (filters.hasTags) list = list.filter((n) => (n.tags || []).length > 0)
  if (filters.emptyOnly) list = list.filter((n) => !(n.content || '').trim())

  return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
})

// Short context snippet around the first match (falls back to description).
const snippet = (note) => {
  if (!q.value) return (note.description || '').replace(/\s+/g, ' ').trim()
  for (const text of [note.content, note.description]) {
    if (!text) continue
    const idx = text.toLowerCase().indexOf(q.value)
    if (idx === -1) continue
    const start = Math.max(0, idx - 24)
    const end = Math.min(text.length, idx + q.value.length + 40)
    const clip = text.slice(start, end).replace(/\s+/g, ' ').trim()
    return (start > 0 ? '…' : '') + clip + (end < text.length ? '…' : '')
  }
  return (note.description || '').replace(/\s+/g, ' ').trim()
}

const focusInput = () => nextTick(() => inputRef.value?.focus())

watch(
  () => props.active,
  (isActive) => {
    if (isActive) focusInput()
  },
)

onMounted(() => {
  if (props.active) focusInput()
})
</script>
