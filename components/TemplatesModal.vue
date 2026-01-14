<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:p-4"
    @click="close">
    <div class="bg-white dark:bg-gray-925 md:rounded-lg max-w-4xl w-full h-full md:h-[600px] overflow-hidden"
      @click.stop>
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-400">{{ $t('templates.title') }}</h2>
        <button @click="close" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
          <Icon name="mdi:close" class="w-6 h-6" />
        </button>
      </div>

      <!-- Search bar -->
      <div class="px-6 pt-4 pb-2">
        <div class="relative">
          <Icon name="mdi:magnify"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-400-muted" />
          <input v-model="searchQuery" type="text" :placeholder="$t('templates.search')"
            class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-925er text-gray-900 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
            @input="selectedCategory = 'all'" />
        </div>
      </div>

      <!-- Category tabs -->
      <div class="border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        <div class="flex px-6">
          <button v-for="cat in consolidatedCategories" :key="cat.id" @click="selectCategory(cat.id)"
            class="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors" :class="selectedCategory === cat.id
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'">
            {{ cat.name }}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto p-6 h-[calc(100%-240px)] md:h-auto md:max-h-[340px]">
        <div v-if="filteredTemplates.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400-muted">
          {{ $t('templates.noResults') }}
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button v-for="template in filteredTemplates" :key="template.id" @click="insertTemplate(template)"
            class="text-left p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
            <h3 class="font-semibold text-gray-900 dark:text-gray-400 mb-1">{{ template.name }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400-muted">{{ template.description }}</p>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'insert'])

const { templates, getTemplates } = useTemplates()

const selectedCategory = ref('all')
const searchQuery = ref('')

// Consolidate categories to reduce tabs
const consolidatedCategories = [
  { id: 'all', name: 'All' },
  { id: 'money', name: 'Money', includes: ['shopping', 'dining', 'finance'] },
  { id: 'lifestyle', name: 'Lifestyle', includes: ['travel', 'health', 'personal'] },
  { id: 'productivity', name: 'Productivity', includes: ['work', 'cooking', 'home', 'tech'] }
]

const filteredTemplates = computed(() => {
  let result = templates

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.content.toLowerCase().includes(query)
    )
  } else {
    // Filter by category if no search
    if (selectedCategory.value === 'all') {
      result = templates
    } else {
      const category = consolidatedCategories.find(c => c.id === selectedCategory.value)
      if (category && category.includes) {
        result = templates.filter(t => category.includes.includes(t.category))
      }
    }
  }

  return result
})

const selectCategory = (categoryId) => {
  selectedCategory.value = categoryId
  searchQuery.value = ''
}

const insertTemplate = (template) => {
  emit('insert', template.content)
  close()
}

const close = () => {
  emit('close')
}
</script>
