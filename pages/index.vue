<template>
  <div class="h-screen flex flex-col bg-white dark:bg-gray-925">
    <!-- Mobile-friendly Toolbar -->
    <AppHeader :current-note="currentNote" :show-results="showResults" @toggle-sidebar="showSidebar = !showSidebar"
      @show-meta="currentNote && (showMetaModal = true)" @apply-format="applyFormat" @toggle-results="showResults = !showResults"
      @show-templates="showTemplates = true" @show-shortcuts="showShortcuts = true" @show-help="showHelp = true"
      @show-language="showLanguageModal = true" />

    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar - Notes List -->
      <aside class="w-80 flex-shrink-0 transition-all duration-300" :class="[
        showSidebar ? 'block' : 'hidden lg:block',
        showSidebar && 'max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-20 max-lg:shadow-xl'
      ]">
        <NotesList :notes="notes" :current-note-id="currentNoteId" @new-note="addNote" @select-note="selectNote"
          @delete-note="confirmDelete" @edit-note="openEditModal" />
      </aside>

      <!-- Overlay for mobile -->
      <div v-if="showSidebar" @click="showSidebar = false" class="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden">
      </div>

      <!-- Editor Area -->
      <main class="flex-1 overflow-hidden flex flex-col">
        <NoteEditor v-if="currentNote" ref="editorRef" :content="currentNote.content" :show-results="showResults"
          @update:content="updateContent"
          :placeholder="'Start typing... Try: 10 + 20, or use # for headers, // for comments'" />
        <div v-else class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <p>Select a note or create a new one</p>
        </div>
      </main>
    </div>

    <!-- Modals -->
    <NoteMetaModal :is-open="showMetaModal" :title="currentNote?.title || ''"
      :description="currentNote?.description || ''" :note-id="currentNote?.id" @close="showMetaModal = false"
      @save="updateMeta" @delete="confirmDelete" />

    <HelpModal :is-open="showHelp" @close="showHelp = false" />
    <ShortcutsModal :is-open="showShortcuts" @close="showShortcuts = false" />
    <TemplatesModal :is-open="showTemplates" @close="showTemplates = false" @insert="insertTemplate" />
    <LanguageSwitcher :is-open="showLanguageModal" @close="showLanguageModal = false" />
  </div>
</template>

<script setup>
const { notes, currentNoteId, currentNote, addNote, deleteNote, updateNoteContent, updateNoteMeta } = useNotes()

const showSidebar = ref(true) // Default to true for better UX
const showMetaModal = ref(false)
const showHelp = ref(false)
const showShortcuts = ref(false)
const showTemplates = ref(false)
const showLanguageModal = ref(false)
const showResults = ref(true)
const editorRef = ref(null)

// Hide sidebar on mobile by default
onMounted(() => {
  if (window.innerWidth < 1024) {
    showSidebar.value = false
  }
})

const selectNote = (id) => {
  currentNoteId.value = id
  showSidebar.value = false // Close sidebar on mobile after selection
}

const openEditModal = (id) => {
  currentNoteId.value = id
  showMetaModal.value = true
}

const updateContent = (content) => {
  if (currentNote.value) {
    updateNoteContent(currentNote.value.id, content)
  }
}

const updateMeta = ({ title, description }) => {
  if (currentNote.value) {
    updateNoteMeta(currentNote.value.id, { title, description })
  }
}

const confirmDelete = (id) => {
  if (confirm('Are you sure you want to delete this note?')) {
    deleteNote(id)
  }
}

const applyFormat = (before, after) => {
  if (editorRef.value) {
    editorRef.value.wrapSelection(before, after)
  }
}

const insertTemplate = (templateContent) => {
  if (currentNote.value && editorRef.value) {
    let content = currentNote.value.content
    if (content && !content.endsWith('\n')) {
      content += '\n\n'
    }
    content += templateContent
    updateContent(content)
  }
}
</script>
