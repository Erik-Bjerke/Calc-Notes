<template>
  <div class="p-4 lg:pt-3 space-y-3" :class="{ invisible: selectMode }">
    <div class="flex items-center gap-2">
      <UiButton
        variant="ghost"
        icon-only
        size="sm"
        class="shrink-0 -ml-2"
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

      <UiButton
        v-if="allTags.length"
        variant="ghost"
        icon-only
        size="sm"
        class="shrink-0 -mr-2"
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
    </div>

    <!-- Tag filter (toggled, hidden by default) -->
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
          @click="$emit('toggle-tag', tag)"
        >
          {{ tag }}
        </UiButton>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineProps({
  selectMode: { type: Boolean, required: true },
  allTags: { type: Array, required: true },
  selectedTags: { type: Array, required: true },
  currentNote: { type: Object, default: null },
})

defineEmits(['show-meta', 'toggle-select-mode', 'toggle-tag'])

// Tag filters are hidden by default and revealed via the toggle button.
const showTags = ref(false)
</script>
