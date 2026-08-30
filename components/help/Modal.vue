<template>
  <UiModal
    :show="isOpen"
    max-width="5xl"
    padding="md:p-4"
    panel-class="h-screen md:h-[90vh] safe-area-modal rounded-none md:rounded-lg"
    @close="closeModal"
  >
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div class="flex items-center gap-2">
          <UiButton
            variant="ghost"
            color="gray"
            icon-only
            class="md:hidden"
            :title="activeSection ? 'Back' : 'Close'"
            @click="mobileBack"
          >
            <Icon :name="activeSection && isMobile ? 'mdi:arrow-left' : 'mdi:close'" class="block w-5 h-5" />
          </UiButton>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-200 leading-none">
            {{ activeSection && isMobile ? activeSectionLabel : $t('help.title') }}
          </h2>
        </div>
        <UiButton variant="ghost" color="gray" icon-only class="hidden md:flex" @click="closeModal">
          <Icon name="mdi:close" class="block w-5 h-5" />
        </UiButton>
      </div>

      <!-- Body: sidebar + content -->
      <div class="flex flex-1 overflow-hidden min-h-0">
        <!-- Sidebar navigation -->
        <nav
          v-show="!isMobile || (!activeSection && transitionState !== 'leaving')"
          class="shrink-0 w-full md:w-60 h-full bg-gray-50 dark:bg-gray-900 md:border-r border-gray-200 dark:border-gray-800 flex flex-col"
        >
          <div class="p-3 pb-2 shrink-0">
            <UiInput
              v-model="searchQuery"
              placeholder="Search help..."
              icon-left="mdi:magnify"
              clearable
            />
          </div>
          <ul class="px-2 pb-3 space-y-0.5 overflow-y-auto flex-1 min-h-0">
            <template v-for="(section, idx) in filteredSections" :key="section.id">
              <li v-if="section.id === 'shortcuts' && idx > 0" class="py-1.5 px-3">
                <div class="border-t border-gray-200 dark:border-gray-700/50" />
              </li>
              <li>
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                  :class="
                    activeSection === section.id
                      ? 'bg-primary-50 dark:bg-gray-800 text-primary-700 dark:text-primary-400 font-medium'
                      : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850'
                  "
                  @click="selectSection(section.id)"
                >
                  <Icon :name="section.icon" class="w-5 h-5 shrink-0 opacity-70" />
                  <div class="min-w-0">
                    <span class="block truncate">{{ section.label }}</span>
                    <span class="block text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ section.description }}</span>
                  </div>
                </button>
              </li>
            </template>
            <li v-if="searchQuery && filteredSections.length === 0" class="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              <Icon name="mdi:magnify" class="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No results for "{{ searchQuery }}"</p>
            </li>
          </ul>
        </nav>

        <!-- Content panel -->
        <div v-show="!isMobile || activeSection || transitionState === 'leaving'" ref="contentPanelRef" class="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-925">
          <div v-if="!activeSection && !isMobile" class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div class="text-center">
              <Icon name="mdi:help-circle-outline" class="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p class="text-sm">Select a topic</p>
            </div>
          </div>

          <div v-if="displayedSection" :class="sectionTransitionClasses">
            <HelpBasics v-if="displayedSection === 'basics'" />
            <HelpOperators v-else-if="displayedSection === 'operators'" />
            <HelpBitwise v-else-if="displayedSection === 'bitwise'" />
            <HelpVariables v-else-if="displayedSection === 'variables'" />
            <HelpSpecial v-else-if="displayedSection === 'special'" />
            <HelpPercentages v-else-if="displayedSection === 'percentages'" />
            <HelpScales v-else-if="displayedSection === 'scales'" />
            <HelpCurrency v-else-if="displayedSection === 'currency'" />
            <HelpUnits v-else-if="displayedSection === 'units'" />
            <HelpFuel v-else-if="displayedSection === 'fuel'" />
            <HelpCssUnits v-else-if="displayedSection === 'css'" />
            <HelpSiPrefixes v-else-if="displayedSection === 'si'" />
            <HelpNumberFormats v-else-if="displayedSection === 'numformats'" />
            <HelpFunctions v-else-if="displayedSection === 'functions'" />
            <HelpConstants v-else-if="displayedSection === 'constants'" />
            <HelpDateTime v-else-if="displayedSection === 'datetime'" />
            <HelpFormatting v-else-if="displayedSection === 'formatting'" />
            <HelpShortcuts v-else-if="displayedSection === 'shortcuts'" :mod-label="modLabel" />
            <HelpTips v-else-if="displayedSection === 'tips'" />
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup>
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  modLabel: { type: String, default: 'Ctrl' },
  hasActiveNote: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'insert'])

// Provide insert capability to child CodeBlock components
const canInsert = computed(() => props.hasActiveNote)
const handleInsertContent = (text) => {
  if (text && props.hasActiveNote) {
    emit('insert', text)
  }
}
provide('helpCanInsert', canInsert)
provide('helpOnInsert', handleInsertContent)

const activeSection = ref(null)
const displayedSection = ref(null)
const slideDirection = ref('down')
const searchQuery = ref('')
const isMobile = ref(false)
const contentPanelRef = ref(null)
const transitionState = ref('idle')
const mobileGoingBack = ref(false)

const checkMobile = () => { isMobile.value = window.innerWidth < 768 }

const sections = [
  { id: 'basics', label: 'Basics', icon: 'mdi:calculator', description: 'Arithmetic & operations', keywords: 'basics arithmetic add subtract multiply divide exponent modulo implicit multiplication' },
  { id: 'operators', label: 'Operators', icon: 'mdi:plus-minus-variant', description: 'Symbols & natural language', keywords: 'operators plus minus times divide multiply addition subtraction multiplication division' },
  { id: 'bitwise', label: 'Bitwise', icon: 'mdi:gate-and', description: 'AND, OR, XOR, shifts', keywords: 'bitwise and or xor shift left right' },
  { id: 'variables', label: 'Variables', icon: 'mdi:variable', description: 'Store & reuse values', keywords: 'variables assign store value names' },
  { id: 'special', label: 'Special Keywords', icon: 'mdi:star-outline', description: 'prev, sum, sub, avg', keywords: 'special prev previous sum sub subtract average avg aggregate' },
  { id: 'percentages', label: 'Percentages', icon: 'mdi:percent-outline', description: 'All percentage modes', keywords: 'percentages percent contextual literal reverse compound interest' },
  { id: 'scales', label: 'Scales', icon: 'mdi:arrow-expand-vertical', description: 'k, M, billion, trillion', keywords: 'scales thousand million billion trillion k M shorthand large numbers' },
  { id: 'currency', label: 'Currency', icon: 'mdi:currency-usd', description: 'Conversion & arithmetic', keywords: 'currency dollar euro pound yen usd eur gbp conversion exchange rate money' },
  { id: 'units', label: 'Units', icon: 'mdi:ruler', description: 'Length, weight, volume...', keywords: 'units length weight volume temperature area speed time data convert conversion' },
  { id: 'fuel', label: 'Fuel Economy', icon: 'mdi:gas-station-outline', description: 'mpg, kpl, l/100km', keywords: 'fuel economy mpg kpl consumption miles per gallon litre' },
  { id: 'css', label: 'CSS Units', icon: 'mdi:language-css3', description: 'px, em, rem, pt', keywords: 'css units px em rem pt inch pixel font size' },
  { id: 'si', label: 'SI Prefixes', icon: 'mdi:alpha-k-box-outline', description: 'kilo, mega, milli...', keywords: 'si prefixes kilo mega giga tera milli micro' },
  { id: 'numformats', label: 'Number Formats', icon: 'mdi:numeric', description: 'Binary, hex, octal', keywords: 'number formats binary hex hexadecimal octal scientific notation base' },
  { id: 'functions', label: 'Functions', icon: 'mdi:function-variant', description: 'Math & trig functions', keywords: 'functions sqrt cbrt abs round ceil floor log ln sin cos tan trigonometry' },
  { id: 'constants', label: 'Constants', icon: 'mdi:pi', description: 'pi, e, tau, phi', keywords: 'constants pi e tau phi golden ratio' },
  { id: 'datetime', label: 'Date & Time', icon: 'mdi:calendar-clock', description: 'Dates & timezones', keywords: 'date time now today yesterday tomorrow timezone unix timestamp' },
  { id: 'formatting', label: 'Formatting', icon: 'mdi:format-header-pound', description: 'Headers & comments', keywords: 'formatting header comment label hash' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'mdi:keyboard-outline', description: 'Keyboard shortcuts', keywords: 'shortcuts keyboard navigation quick functions conversions ctrl cmd' },
  { id: 'tips', label: 'Tips', icon: 'mdi:lightbulb-outline', description: 'Tips & tricks', keywords: 'tips tricks hints' },
]

const activeSectionLabel = computed(() => {
  const s = sections.find((s) => s.id === activeSection.value)
  return s ? s.label : 'Help'
})

const filteredSections = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return sections
  return sections.filter((s) => s.label.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q))
})

watch(filteredSections, (filtered) => {
  if (searchQuery.value && filtered.length === 1) activeSection.value = filtered[0].id
})

const selectSection = (id) => {
  if (id === activeSection.value) return

  if (isMobile.value && activeSection.value) {
    slideDirection.value = sectionIndex(id) > sectionIndex(activeSection.value) ? 'right' : 'left'
    transitionState.value = 'leaving'
    const enterDir = slideDirection.value
    setTimeout(() => {
      activeSection.value = id
      displayedSection.value = id
      if (contentPanelRef.value) contentPanelRef.value.scrollTop = 0
      slideDirection.value = enterDir
      transitionState.value = 'entering-start'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          transitionState.value = 'entering'
          setTimeout(() => { transitionState.value = 'idle' }, 200)
        })
      })
    }, 200)
  } else {
    activeSection.value = id
  }

  searchQuery.value = ''
}

const sectionIndex = (id) => sections.findIndex((s) => s.id === id)

watch(activeSection, (newId, oldId) => {
  const mobile = isMobile.value

  if (mobile) {
    const goingBack = mobileGoingBack.value
    mobileGoingBack.value = false

    if (!oldId && newId) {
      slideDirection.value = 'right'
      displayedSection.value = newId
      transitionState.value = 'entering-start'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          transitionState.value = 'entering'
          setTimeout(() => { transitionState.value = 'idle' }, 200)
        })
      })
      return
    }
    if (oldId && !newId && goingBack) {
      slideDirection.value = 'left'
      transitionState.value = 'leaving'
      setTimeout(() => {
        displayedSection.value = null
        transitionState.value = 'idle'
      }, 200)
      return
    }
  }

  if (!oldId || !newId) {
    displayedSection.value = newId
    transitionState.value = 'idle'
    return
  }
  slideDirection.value = sectionIndex(newId) > sectionIndex(oldId) ? 'down' : 'up'
  transitionState.value = 'leaving'
  setTimeout(() => {
    displayedSection.value = newId
    if (contentPanelRef.value) contentPanelRef.value.scrollTop = 0
    transitionState.value = 'entering-start'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        transitionState.value = 'entering'
        setTimeout(() => { transitionState.value = 'idle' }, 200)
      })
    })
  }, 150)
}, { immediate: true })

const sectionTransitionClasses = computed(() => {
  const dir = slideDirection.value
  const mobile = isMobile.value

  if (mobile && (dir === 'right' || dir === 'left')) {
    switch (transitionState.value) {
      case 'leaving': return dir === 'left'
        ? 'transition-all duration-200 ease-in opacity-0 translate-x-8'
        : 'transition-all duration-200 ease-in opacity-0 -translate-x-8'
      case 'entering-start': return dir === 'right'
        ? 'opacity-0 translate-x-8'
        : 'opacity-0 -translate-x-8'
      case 'entering': return 'transition-all duration-200 ease-out opacity-100 translate-x-0'
      default: return 'opacity-100 translate-x-0'
    }
  }

  switch (transitionState.value) {
    case 'leaving': return dir === 'down' ? 'transition-all duration-150 ease-in opacity-0 -translate-y-4' : 'transition-all duration-150 ease-in opacity-0 translate-y-4'
    case 'entering-start': return dir === 'down' ? 'opacity-0 translate-y-4' : 'opacity-0 -translate-y-4'
    case 'entering': return 'transition-all duration-200 ease-out opacity-100 translate-y-0'
    default: return 'opacity-100 translate-y-0'
  }
})

const mobileBack = () => {
  if (activeSection.value && isMobile.value) { mobileGoingBack.value = true; activeSection.value = null } else { closeModal() }
}

const closeModal = () => {
  activeSection.value = null
  displayedSection.value = null
  transitionState.value = 'idle'
  searchQuery.value = ''
  emit('close')
}

const handleEscape = (e) => { if (e.key === 'Escape' && props.isOpen) closeModal() }

// ── Back-button interception (Capacitor) ──
const { register: registerBack, unregister: unregisterBack } = useBackButton()
let backHandlerId = null

watch(() => props.isOpen, (open) => {
  if (open) {
    checkMobile()
    activeSection.value = isMobile.value ? null : 'basics'

    backHandlerId = registerBack(() => {
      if (!props.isOpen) return false
      if (activeSection.value && isMobile.value) { mobileGoingBack.value = true; activeSection.value = null; return true }
      return false
    }, 10)
  } else {
    if (backHandlerId !== null) { unregisterBack(backHandlerId); backHandlerId = null }
  }
}, { immediate: true })

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape)
  window.removeEventListener('resize', checkMobile)
  if (backHandlerId !== null) { unregisterBack(backHandlerId); backHandlerId = null }
})
</script>
