<template>
  <div class="relative">
    <!-- Trigger Button -->
    <button @click="isOpen = !isOpen"
      class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition-colors"
      title="Settings">
      <Icon name="mdi:cog" class="w-5 h-5" />
    </button>

    <!-- Backdrop -->
    <Teleport to="body">
      <div v-if="isOpen" class="fixed inset-0 z-30" @click="isOpen = false"></div>
    </Teleport>

    <!-- Dropdown Menu -->
    <Teleport to="body">
      <Transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
        <div v-if="isOpen" :style="dropdownStyle"
          class="fixed w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <!-- Templates -->
          <button @click="handleAction('templates')"
            class="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 active:bg-gray-200 dark:active:bg-gray-925 transition-colors cursor-pointer">
            <Icon name="mdi:file-document-outline" class="w-5 h-5" />
            <span>Templates</span>
          </button>

          <!-- Keyboard Shortcuts -->
          <button @click="handleAction('shortcuts')"
            class="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 active:bg-gray-200 dark:active:bg-gray-925 transition-colors cursor-pointer">
            <Icon name="mdi:keyboard-outline" class="w-5 h-5" />
            <span>Keyboard Shortcuts</span>
          </button>

          <!-- Help -->
          <button @click="handleAction('help')"
            class="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 active:bg-gray-200 dark:active:bg-gray-925 transition-colors cursor-pointer">
            <Icon name="mdi:help-circle-outline" class="w-5 h-5" />
            <span>Help</span>
          </button>

          <div class="border-t border-gray-200 dark:border-gray-700"></div>

          <!-- Theme Toggle -->
          <button @click="toggleTheme"
            class="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 active:bg-gray-200 dark:active:bg-gray-925 transition-colors cursor-pointer">
            <Icon v-if="isDark" name="mdi:weather-sunny" class="w-5 h-5" />
            <Icon v-else name="mdi:weather-night" class="w-5 h-5" />
            <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>

          <!-- Language Switcher -->
          <button @click="handleAction('language')"
            class="w-full flex items-center justify-between px-4 py-3 text-left text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 active:bg-gray-200 dark:active:bg-gray-925 transition-colors cursor-pointer">
            <div class="flex items-center gap-3">
              <Icon name="mdi:translate" class="w-5 h-5" />
              <span>Language</span>
            </div>
            <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400-muted">
              {{ currentLocale.code.split('-')[0] }}
            </span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
const isOpen = ref(false)
const buttonRef = ref(null)
const dropdownStyle = ref({})

// Theme
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
  isOpen.value = false
}

// Language
const { $getLocale, $getLocales } = useI18n()
const availableLocales = computed(() => $getLocales())
const currentLocale = computed(() => {
  const currentCode = $getLocale()
  return availableLocales.value.find(l => l.code === currentCode) || availableLocales.value[0]
})

// Emits
const emit = defineEmits(['templates', 'shortcuts', 'help', 'language'])

const handleAction = (action) => {
  emit(action)
  isOpen.value = false
}

// Position dropdown
const updateDropdownPosition = () => {
  const button = document.querySelector('[title="Settings"]')
  if (button) {
    const rect = button.getBoundingClientRect()
    dropdownStyle.value = {
      top: `${rect.bottom + 8}px`,
      right: `${window.innerWidth - rect.right}px`
    }
  }
}

watch(isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      updateDropdownPosition()
    })
  }
})

// Close on Escape
onMounted(() => {
  const handleEscape = (e) => {
    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }
  document.addEventListener('keydown', handleEscape)
  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape)
  })
})
</script>
