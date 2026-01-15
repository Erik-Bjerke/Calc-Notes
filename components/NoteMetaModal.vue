<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
        @click.self="$emit('close')">
        <div class="bg-white dark:bg-gray-925 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-400 mb-4">
            Note Details
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                Title
              </label>
              <input v-model="localTitle" type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Untitled Note" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                Description
              </label>
              <textarea v-model="localDescription" rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                placeholder="Add a description..." />
            </div>
          </div>

          <div class="flex justify-between gap-2 mt-6">
            <button v-if="noteId" @click="handleDelete"
              class="px-4 py-2 text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors">
              Delete
            </button>
            <div class="flex-1"></div>
            <button @click="$emit('close')"
              class="px-4 py-2 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition-colors">
              Cancel
            </button>
            <button @click="save"
              class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm hover:shadow-md">
              Save
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  noteId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'save', 'delete'])

const localTitle = ref(props.title)
const localDescription = ref(props.description)

watch(() => props.title, (newVal) => {
  localTitle.value = newVal
})

watch(() => props.description, (newVal) => {
  localDescription.value = newVal
})

const save = () => {
  emit('save', {
    title: localTitle.value,
    description: localDescription.value
  })
  emit('close')
}

const handleDelete = () => {
  if (confirm('Are you sure you want to delete this note?')) {
    emit('delete', props.noteId)
    emit('close')
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
