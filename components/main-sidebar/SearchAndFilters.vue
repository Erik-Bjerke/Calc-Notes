<template>
  <div class="p-4 lg:pt-3 space-y-3" :class="{ invisible: selectMode }">
    <div class="flex items-center gap-2">
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
    </div>

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
  allTags: { type: Array, required: true },
  selectedTags: { type: Array, required: true },
  currentNote: { type: Object, default: null },
})

defineEmits(['show-meta', 'toggle-select-mode', 'toggle-tag'])
</script>
