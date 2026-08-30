<template>
  <div
    class="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 px-3 py-2"
  >
    <UiButtonsGroup
      :model-value="sidebarView"
      variant="tabs"
      :options="sidebarViewOptions"
      @update:model-value="$emit('update:sidebar-view', $event)"
    />
  </div>
</template>

<script setup>
defineProps({
  sidebarView: { type: String, required: true },
  sidebarViewOptions: { type: Array, required: true },
})

defineEmits(['update:sidebar-view'])
</script>
