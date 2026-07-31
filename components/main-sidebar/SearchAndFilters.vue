<template>
  <div class="p-4 lg:pt-3 space-y-3" :class="{ invisible: selectMode }">
    <div class="flex items-center gap-2">
      <UiButton
        variant="solid"
        color="primary"
        icon-only
        shape="circle"
        class="flex-shrink-0"
        title="New note"
        @click="$emit('new-note')"
      >
        <Icon name="mdi:plus" class="w-5 h-5" />
      </UiButton>

      <UiButton
        variant="ghost"
        color="gray"
        class="min-w-0 flex-1 px-2 py-1 bg-gray-200/50 dark:bg-gray-800/50 rounded-md"
        @click="$emit('show-meta')"
      >
        <h1 class="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-400 truncate">
          {{ currentNote?.title || 'Numori' }}
        </h1>
      </UiButton>
    </div>

    <!-- Search + select toggle + filters -->
    <div class="flex items-center gap-2">
      <UiButton
        variant="ghost"
        icon-only
        size="sm"
        class="flex-shrink-0"
        :class="
          selectMode
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        "
        title="Select notes"
        @click="$emit('toggle-select-mode')"
      >
        <Icon name="mdi:checkbox-multiple-marked-outline" class="w-4 h-4 block" />
      </UiButton>
      <div class="relative flex-1">
        <Icon
          name="mdi:magnify"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        />
        <UiInput
          :model-value="searchQuery"
          type="text"
          placeholder="Search notes..."
          :validate="false"
          clearable
          @update:model-value="$emit('update:search-query', $event)"
        />
      </div>
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
        @click="$emit('toggle-filters')"
      >
        <Icon
          :name="showFilters ? 'mdi:filter-variant-remove' : 'mdi:filter-variant'"
          class="w-4 h-4 block transition-transform duration-200"
          :class="{ 'rotate-180': showFilters }"
        />
      </UiButton>
    </div>

    <!-- Advanced filters panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1 max-h-0"
      enter-to-class="opacity-100 translate-y-0 max-h-40"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 max-h-40"
      leave-to-class="opacity-0 -translate-y-1 max-h-0"
    >
      <div
        v-if="showFilters"
        class="rounded-lg bg-white dark:bg-gray-800 p-2.5 space-y-2 shadow-sm"
      >
        <!-- Date range -->
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
          @update:model-value="$emit('update:filter-date-range', $event)"
        />

        <!-- Toggle chips -->
        <div class="flex flex-wrap gap-1.5">
          <UiButton
            variant="ghost"
            shape="pill"
            size="xs"
            :class="
              filters.searchContent
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            "
            @click="$emit('toggle-filter', 'searchContent')"
          >
            Content
          </UiButton>
          <UiButton
            variant="ghost"
            shape="pill"
            size="xs"
            :class="
              filters.hasDescription
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            "
            @click="$emit('toggle-filter', 'hasDescription')"
          >
            Has desc
          </UiButton>
          <UiButton
            variant="ghost"
            shape="pill"
            size="xs"
            :class="
              filters.hasTags
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            "
            @click="$emit('toggle-filter', 'hasTags')"
          >
            Has tags
          </UiButton>
          <UiButton
            variant="ghost"
            shape="pill"
            size="xs"
            :class="
              filters.emptyOnly
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            "
            @click="$emit('toggle-filter', 'emptyOnly')"
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
            @click="$emit('clear-filters')"
          >
            Clear
          </UiButton>
        </div>
      </div>
    </Transition>

    <!-- Tag filter -->
    <div v-if="allTags.length" class="flex flex-wrap gap-1.5">
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
        @click="$emit('toggle-tag', tag)"
      >
        {{ tag }}
      </UiButton>
    </div>
  </div>
</template>

<script setup>
defineProps({
  selectMode: { type: Boolean, required: true },
  searchQuery: { type: String, required: true },
  showFilters: { type: Boolean, required: true },
  hasActiveFilters: { type: Boolean, required: true },
  filters: { type: Object, required: true },
  allTags: { type: Array, required: true },
  selectedTags: { type: Array, required: true },
  currentNote: { type: Object, default: null },
})

defineEmits([
  'new-note',
  'show-meta',
  'toggle-select-mode',
  'update:search-query',
  'toggle-filters',
  'update:filter-date-range',
  'toggle-filter',
  'clear-filters',
  'toggle-tag',
])
</script>
