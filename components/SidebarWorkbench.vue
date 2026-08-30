<template>
  <div class="flex h-full">
    <ActivityBar
      :items="items"
      :active="activePanel"
      :panel-open="panelOpen"
      @select="onSelect"
    >
      <template #top>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400/60"
          title="New note"
          aria-label="New note"
          @click="onNewNote"
        >
          <Icon name="mdi:plus" class="w-5 h-5" />
        </button>
      </template>

      <template #bottom>
        <MainSidebarAccountSection
          :is-logged-in="!!attrs.isLoggedIn"
          :user="attrs.user || null"
          :app-lock-enabled="!!attrs.appLockEnabled"
          @edit-profile="emit('edit-profile')"
          @show-auth="emit('show-auth')"
          @show-locale-settings="emit('show-locale-settings')"
          @show-locale-settings-locales="emit('show-locale-settings-locales')"
          @show-locale-settings-security="emit('show-locale-settings-security')"
          @show-locale-settings-sessions="emit('show-locale-settings-sessions')"
          @show-locale-settings-shared-notes="emit('show-locale-settings-shared-notes')"
          @lock-app="emit('lock-app')"
          @logout="emit('logout')"
        />
      </template>
    </ActivityBar>

    <!-- Panel area — fades/slides on open/close; crossfades between panels.
         `lg:min-w` keeps the desktop panel from reflowing while it clips shut. -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-x-3"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-3"
    >
      <div
        v-show="panelOpen"
        class="relative flex-1 min-w-0 lg:min-w-[320px] h-full overflow-hidden"
      >
        <!-- Explorer layer -->
        <div
          class="absolute inset-0 h-full transition-all duration-200 ease-out"
          :class="
            activePanel === 'explorer'
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-3 pointer-events-none'
          "
          :aria-hidden="activePanel !== 'explorer'"
        >
          <MainSidebar v-bind="$attrs" @select-note="(id) => $emit('select-note', id)" />
        </div>

        <!-- Search layer -->
        <div
          class="absolute inset-0 h-full transition-all duration-200 ease-out"
          :class="
            activePanel === 'search'
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-3 pointer-events-none'
          "
          :aria-hidden="activePanel !== 'search'"
        >
          <MainSidebarSearchPanel
            :active="panelOpen && activePanel === 'search'"
            :notes="attrs.notes || []"
            :current-note-id="attrs.currentNoteId || null"
            @select-note="onSelectNote"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

const props = defineProps({
  activePanel: { type: String, default: 'explorer' },
  panelOpen: { type: Boolean, default: true },
})

const emit = defineEmits([
  'update:activePanel',
  'update:panelOpen',
  'select-note',
  'new-note',
  'edit-profile',
  'show-auth',
  'show-locale-settings',
  'show-locale-settings-locales',
  'show-locale-settings-security',
  'show-locale-settings-sessions',
  'show-locale-settings-shared-notes',
  'lock-app',
  'logout',
])

const attrs = useAttrs()

const items = [
  { id: 'explorer', icon: 'mdi:file-document-multiple-outline', label: 'Explorer' },
  { id: 'search', icon: 'mdi:magnify', label: 'Search' },
]

// Clicking the active icon collapses the panel; clicking another switches
// (and re-opens the panel if it was collapsed).
const onSelect = (id) => {
  if (id === props.activePanel) {
    emit('update:panelOpen', !props.panelOpen)
    return
  }
  emit('update:activePanel', id)
  if (!props.panelOpen) emit('update:panelOpen', true)
}

// Selecting a search result reveals the note in the Explorer.
const onSelectNote = (id) => {
  if (props.activePanel !== 'explorer') emit('update:activePanel', 'explorer')
  if (!props.panelOpen) emit('update:panelOpen', true)
  emit('select-note', id)
}

// New note: create it, then reveal it in the Explorer.
const onNewNote = () => {
  if (props.activePanel !== 'explorer') emit('update:activePanel', 'explorer')
  if (!props.panelOpen) emit('update:panelOpen', true)
  emit('new-note')
}
</script>
