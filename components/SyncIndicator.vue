<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="syncing"
      class="fixed bottom-4 right-4 z-50 p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
      title="Syncing..."
      role="status"
      aria-label="Syncing in progress"
    >
      <Icon
        name="mdi:sync"
        class="w-5 h-5 block text-primary-600 dark:text-primary-400 animate-spin"
      />
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  syncing: {
    type: Boolean,
    default: false,
  },
})
</script>
