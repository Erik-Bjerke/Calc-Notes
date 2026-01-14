<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-800">
      <button @click="$emit('new-note')"
        class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm hover:shadow-md">
        <Icon name="mdi:plus" class="w-5 h-5" />
        <span>New Note</span>
      </button>
    </div>

    <!-- Notes List -->
    <div class="flex-1 overflow-y-auto">
      <div v-for="note in notes" :key="note.id" @click="$emit('select-note', note.id)"
        class="p-4 border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors"
        :class="{ 'bg-white dark:bg-gray-925 border-l-4 border-l-primary-500': note.id === currentNoteId }">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-gray-900 dark:text-gray-400 truncate">
              {{ note.title || 'Untitled' }}
            </h3>
            <p v-if="note.description" class="text-sm text-gray-600 dark:text-gray-500 truncate mt-1">
              {{ note.description }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {{ formatDate(note.updatedAt) }}
            </p>
          </div>
          <button @click.stop="$emit('delete-note', note.id)"
            class="p-1 text-gray-400 hover:text-error-600 dark:text-gray-500 dark:hover:text-error-400 transition-colors"
            title="Delete note">
            <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  notes: {
    type: Array,
    required: true
  },
  currentNoteId: {
    type: String,
    default: null
  }
})

defineEmits(['new-note', 'select-note', 'delete-note'])

const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now'
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days}d ago`
  }

  // Format as date
  return date.toLocaleDateString()
}
</script>
