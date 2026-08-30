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
            {{ activeSection && isMobile ? activeSectionLabel : $t('templates.title') }}
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
              placeholder="Search templates..."
              icon-left="mdi:magnify"
              clearable
            />
          </div>
          <ul class="px-2 pb-3 space-y-0.5 overflow-y-auto flex-1 min-h-0">
            <template v-for="section in filteredSections" :key="section.id">
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
                    <span class="block text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ section.count }} templates</span>
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
              <Icon name="mdi:file-document-outline" class="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p class="text-sm">Select a category</p>
            </div>
          </div>

          <div v-if="displayedSection" :class="sectionTransitionClasses">
            <TemplatesCategoryView
              :templates="activeCategoryTemplates"
              :icon="activeSectionData?.icon || 'mdi:file-document-outline'"
              :title="activeSectionData?.label || ''"
              :description="activeSectionData?.description || ''"
              @insert="insertTemplate"
            />
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup>
const props = defineProps({
  isOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'insert'])

const { templates, categories } = useTemplates()

const activeSection = ref(null)
const displayedSection = ref(null)
const slideDirection = ref('down')
const searchQuery = ref('')
const isMobile = ref(false)
const contentPanelRef = ref(null)
const transitionState = ref('idle')
const mobileGoingBack = ref(false)

const checkMobile = () => { isMobile.value = window.innerWidth < 768 }

const categoryIcons = {
  all: 'mdi:view-grid-outline',
  shopping: 'mdi:cart-outline',
  dining: 'mdi:silverware-fork-knife',
  travel: 'mdi:airplane',
  finance: 'mdi:chart-line',
  work: 'mdi:briefcase-outline',
  cooking: 'mdi:pot-steam-outline',
  home: 'mdi:home-outline',
  health: 'mdi:heart-pulse',
  planning: 'mdi:calendar-check-outline',
  dev: 'mdi:code-braces',
  learning: 'mdi:school-outline',
}

const categoryDescriptions = {
  all: 'Browse all available templates',
  shopping: 'Price comparisons & discounts',
  dining: 'Tips, splits & restaurant math',
  travel: 'Currency, fuel & timezone tools',
  finance: 'Budgets, loans & investments',
  work: 'Rates, hours & project costs',
  cooking: 'Recipe scaling & conversions',
  home: 'Area, paint & DIY calculations',
  health: 'BMI & health metrics',
  planning: 'Dates, ages & countdowns',
  dev: 'Data, CSS & number formats',
  learning: 'Learn Numori features',
}

const sections = computed(() => {
  return categories.map((cat) => ({
    id: cat.id,
    label: cat.name,
    icon: categoryIcons[cat.id] || 'mdi:file-document-outline',
    description: categoryDescriptions[cat.id] || '',
    count: cat.id === 'all' ? templates.length : templates.filter((t) => t.category === cat.id).length,
    keywords: `${cat.name.toLowerCase()} ${(categoryDescriptions[cat.id] || '').toLowerCase()}`,
  }))
})

const activeSectionLabel = computed(() => {
  const s = sections.value.find((s) => s.id === activeSection.value)
  return s ? s.label : 'Templates'
})

const activeSectionData = computed(() => {
  return sections.value.find((s) => s.id === displayedSection.value)
})

const activeCategoryTemplates = computed(() => {
  if (!displayedSection.value || displayedSection.value === 'all') return templates
  return templates.filter((t) => t.category === displayedSection.value)
})

const filteredSections = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return sections.value
  return sections.value.filter((s) => s.label.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q))
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

const sectionIndex = (id) => sections.value.findIndex((s) => s.id === id)

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

const insertTemplate = (content) => {
  emit('insert', content)
  closeModal()
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
    activeSection.value = isMobile.value ? null : 'all'

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
