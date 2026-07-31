<template>
  <UiDropdown ref="dropdownRef" width="w-48 sm:w-56">
    <template #trigger="{ toggle }">
      <UiButton variant="ghost" color="gray" size="sm" title="View menu" @click="toggle">
        <Icon name="mdi:eye-outline" class="w-4.5 h-4.5 block" />
        <span class="hidden sm:inline text-sm">View</span>
        <Icon
          name="mdi:chevron-down"
          class="w-3 h-3 block transition-transform"
          :class="{ 'rotate-180': dropdownRef?.isOpen }"
        />
      </UiButton>
    </template>

    <UiButton variant="menu-item" @click="action('toggle-focus')">
      <Icon name="mdi:fullscreen" class="w-4 h-4 block flex-shrink-0" />
      <span class="flex-1 text-left">Focus Mode</span>
      <kbd
        class="ml-auto text-[10px] text-gray-400 dark:text-gray-500 font-mono"
      >{{ modLabel }}+Shift+F</kbd>
    </UiButton>

    <UiDivider />

    <!-- Zoom controls -->
    <div class="flex items-center gap-1 px-3 py-1.5">
      <UiButton
        :disabled="zoomPercent <= MIN_ZOOM"
        variant="ghost"
        color="gray"
        icon-only
        size="xs"
        :class="
          zoomPercent <= MIN_ZOOM ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : ''
        "
        title="Zoom out"
        @click="$emit('zoom-out')"
      >
        <Icon name="mdi:magnify-minus-outline" class="w-4.5 h-4.5 block" />
      </UiButton>
      <UiButton
        :title="zoomPercent === 100 ? 'Zoom at 100%' : 'Reset zoom to 100%'"
        class="flex-1 text-center text-sm rounded px-1 py-0.5 min-w-0"
        :class="
          zoomPercent === 100
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-500 dark:hover:text-gray-400 cursor-default'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer'
        "
        variant="ghost"
        color="gray"
        size="xs"
        @click="$emit('zoom-reset')"
      >
        {{ zoomPercent }}%
      </UiButton>
      <UiButton
        :disabled="zoomPercent >= MAX_ZOOM"
        variant="ghost"
        color="gray"
        icon-only
        size="xs"
        :class="
          zoomPercent >= MAX_ZOOM ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : ''
        "
        title="Zoom in"
        @click="$emit('zoom-in')"
      >
        <Icon name="mdi:magnify-plus-outline" class="w-4.5 h-4.5 block" />
      </UiButton>
    </div>

    <UiDivider />

    <div
      class="px-3 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
    >
      Markdown
    </div>

    <UiButton
      v-for="opt in mdOptions"
      :key="opt.value"
      variant="menu-item"
      :class="
        markdownMode === opt.value
          ? 'text-gray-900 dark:text-gray-100'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      "
      @click="setMarkdownMode(opt.value)"
    >
      <Icon
        :key="opt.value + '-' + markdownMode"
        :name="markdownMode === opt.value ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'"
        class="w-4 h-4 block flex-shrink-0"
      />
      <span>{{ opt.label }}</span>
    </UiButton>

    <UiDivider />

    <div
      class="px-3 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
    >
      Results
    </div>

    <UiButton
      v-for="opt in resultsOptions"
      :key="opt.value"
      variant="menu-item"
      :class="
        inlineMode === opt.value
          ? 'text-gray-900 dark:text-gray-100'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      "
      @click="setInlineMode(opt.value)"
    >
      <Icon
        :key="opt.value + '-' + inlineMode"
        :name="inlineMode === opt.value ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'"
        class="w-4 h-4 block flex-shrink-0"
      />
      <Icon :name="opt.icon" class="w-4 h-4 block flex-shrink-0" />
      <span>{{ opt.label }}</span>
    </UiButton>

    <UiDivider />

    <!-- Theme toggle -->
    <UiButton variant="menu-item" @click="toggleTheme">
      <Icon name="mdi:theme-light-dark" class="w-4 h-4 block flex-shrink-0" />
      <span class="flex-1 text-left">Theme</span>
      <span
        class="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
        :class="isDark ? 'bg-gray-700 text-gray-300' : 'bg-amber-100 text-amber-700'"
      >
        <Icon :name="isDark ? 'mdi:weather-night' : 'mdi:white-balance-sunny'" class="w-3 h-3" />
        {{ isDark ? 'Dark' : 'Light' }}
      </span>
    </UiButton>

    <UiDivider />

    <UiDropdownItem
      icon="mdi:file-document-outline"
      label="Templates"
      @click="action('templates')"
    />
    <UiDropdownItem icon="mdi:help-circle-outline" label="Help" @click="action('help')" />
    <UiDropdownItem icon="mdi:information-outline" label="About" @click="action('about')" />

    <UiDivider />

    <UiButton
      :disabled="updateChecking"
      variant="menu-item"
      class="disabled:opacity-50"
      @click="handleCheckUpdate"
    >
      <Icon
        :name="updateChecking ? 'mdi:loading' : updateResultIcon"
        class="w-4 h-4 block flex-shrink-0"
        :class="{
          'animate-spin': updateChecking,
          [updateResultColor]: !updateChecking && updateResult,
        }"
      />
      <span>{{ updateLabel }}</span>
    </UiButton>
  </UiDropdown>
</template>

<script setup>
const BASE_FONT_SIZE = 16
const MIN_ZOOM = 63
const MAX_ZOOM = 175

const props = defineProps({
  markdownMode: {
    type: String,
    default: 'edit',
    validator: (v) => ['off', 'edit', 'full'].includes(v),
  },
  inlineMode: {
    type: String,
    default: 'left',
    validator: (v) => ['left', 'off', 'right'].includes(v),
  },
  editorFontSize: { type: Number, default: 16 },
  checkForUpdate: { type: Function, default: null },
})

const emit = defineEmits([
  'update:markdown-mode',
  'update:inline-mode',
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'toggle-focus',
  'templates',
  'help',
  'about',
])

const isMac = computed(() => {
  if (import.meta.server) return false
  return navigator.userAgent?.toUpperCase().includes('MAC')
})
const modLabel = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

const dropdownRef = ref(null)

const zoomPercent = computed(() => Math.round((props.editorFontSize / BASE_FONT_SIZE) * 100))

const mdOptions = [
  { value: 'edit', label: 'View & Edit' },
  { value: 'full', label: 'View Only' },
  { value: 'off', label: 'Edit Only' },
]

const resultsOptions = [
  { value: 'left', label: 'Results on left', icon: 'mdi:dock-left' },
  { value: 'off', label: 'Results off', icon: 'mdi:eye-off-outline' },
  { value: 'right', label: 'Results on right', icon: 'mdi:dock-right' },
]

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const setMarkdownMode = (mode) => {
  dropdownRef.value?.close()
  emit('update:markdown-mode', mode)
}

const setInlineMode = (mode) => {
  dropdownRef.value?.close()
  emit('update:inline-mode', mode)
}

const action = (name) => {
  dropdownRef.value?.close()
  emit(name)
}

const updateChecking = ref(false)
const updateResult = ref('')
let updateResultTimer = null

const updateLabel = computed(() => {
  if (updateChecking.value) return 'Checking...'
  if (updateResult.value === 'available') return 'Update available'
  if (updateResult.value === 'up-to-date') return 'Up to date'
  if (updateResult.value === 'error') return 'Check failed'
  return 'Check for updates'
})

const updateResultIcon = computed(() => {
  if (updateResult.value === 'available') return 'mdi:arrow-up-circle-outline'
  if (updateResult.value === 'up-to-date') return 'mdi:check-circle-outline'
  if (updateResult.value === 'error') return 'mdi:alert-circle-outline'
  return 'mdi:update'
})

const updateResultColor = computed(() => {
  if (updateResult.value === 'available') return 'text-primary-500'
  if (updateResult.value === 'up-to-date') return 'text-green-500'
  if (updateResult.value === 'error') return 'text-red-500'
  return ''
})

const handleCheckUpdate = async () => {
  if (!props.checkForUpdate || updateChecking.value) return
  updateChecking.value = true
  updateResult.value = ''
  clearTimeout(updateResultTimer)
  const result = await props.checkForUpdate(true)
  updateChecking.value = false
  updateResult.value = result
  updateResultTimer = setTimeout(() => {
    updateResult.value = ''
  }, 4000)
}
</script>
