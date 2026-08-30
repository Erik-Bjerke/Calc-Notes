<template>
  <nav
    class="flex flex-col items-center w-12 shrink-0 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800"
    :style="{ paddingTop: 'env(safe-area-inset-top, 0px)' }"
  >
    <!-- Top actions (e.g. New Note) -->
    <div v-if="$slots.top" class="py-2">
      <slot name="top" />
    </div>

    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="relative w-12 h-12 flex items-center justify-center group focus:outline-none"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="panelOpen && active === item.id"
      @click="$emit('select', item.id)"
    >
      <!-- Active accent bar -->
      <span
        v-if="panelOpen && active === item.id"
        class="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary-500"
      />
      <Icon
        :name="item.icon"
        class="w-6 h-6 transition-colors"
        :class="
          panelOpen && active === item.id
            ? 'text-gray-900 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200'
        "
      />
    </button>

    <!-- Bottom actions (e.g. account avatar) -->
    <div
      v-if="$slots.bottom"
      class="mt-auto py-1"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
    >
      <slot name="bottom" />
    </div>
  </nav>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true }, // [{ id, icon, label }]
  active: { type: String, default: 'explorer' },
  panelOpen: { type: Boolean, default: true },
})

defineEmits(['select'])
</script>
