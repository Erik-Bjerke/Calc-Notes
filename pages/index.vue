<template>
  <div class="h-screen flex flex-col bg-white dark:bg-gray-925 overscroll-none">
    <OfflineIndicator :offline="!sw.isOnline.value" />

    <EmailVerificationBanner
      :visible="auth.isLoggedIn.value && auth.user.value?.emailVerified === false"
      @click="authHandlers.showEmailVerificationModal.value = true"
    />

    <div
      class="transition-all duration-300 ease-in-out flex-shrink-0 relative z-30"
      :class="focusMode ? 'max-h-0 overflow-hidden opacity-0' : 'max-h-40 opacity-100'"
    >
      <AppHeader
        :preferences="localePrefs.preferences"
        :current-note="currentNote"
        :inline-mode="showInlineResults"
        :markdown-mode="markdownMode"
        :mod-label="modLabel"
        :selection-count="selectedNoteIds.length"
        :is-logged-in="auth.isLoggedIn.value"
        :user="auth.user.value"
        :app-lock-enabled="appLock.settings.enabled"
        :can-undo="editorRef?.canUndo ?? false"
        :can-redo="editorRef?.canRedo ?? false"
        :editor-font-size="localePrefs.preferences.editorFontSize ?? 16"
        :check-for-update="sw.checkForUpdate"
        @toggle-sidebar="showSidebar = !showSidebar"
        @apply-format="applyFormat"
        @indent="editorRef?.indentLine()"
        @outdent="editorRef?.outdentLine()"
        @undo="editorRef?.undo()"
        @redo="editorRef?.redo()"
        @update:inline-mode="showInlineResults = $event"
        @update:markdown-mode="markdownMode = $event"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @zoom-reset="handleZoomReset"
        @toggle-focus="focusMode = true"
        @show-templates="showTemplates = true"
        @show-help="showHelp = true"
        @file-new="createNote"
        @file-open="noteActions.handleOpenFile"
        @file-duplicate="noteActions.handleDuplicate"
        @file-save="noteActions.showSaveModal.value = true"
        @file-backup="showBackup = true"
        @file-restore="noteActions.handleImport"
        @file-copy="noteActions.handleCopy"
        @file-print="noteActions.handlePrint"
        @file-about="showAbout = true"
        @edit-profile="settingsInitialSection = 'profile'; showLocaleSettings = true"
        @show-auth="authHandlers.showAuthModal.value = true"
        @show-locale-settings="settingsInitialSection = 'general'; showLocaleSettings = true"
        @show-locale-settings-locales="settingsInitialSection = 'locales'; showLocaleSettings = true"
        @show-locale-settings-security="settingsInitialSection = 'security'; showLocaleSettings = true"
        @show-locale-settings-sessions="settingsInitialSection = 'sessions'; showLocaleSettings = true"
        @show-locale-settings-shared-notes="settingsInitialSection = 'shared'; showLocaleSettings = true"
        @lock-app="appLock.lock()"
        @logout="authHandlers.handleLogout"
      />
    </div>

    <div class="flex-1 flex overflow-hidden">
      <aside
        class="flex-shrink-0 hidden lg:block transition-all duration-300 ease-in-out relative z-20 overflow-hidden"
        :class="
          !focusMode && showSidebar
            ? (sidebarPanelOpen ? 'w-[368px]' : 'w-12') +
              ' opacity-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)]'
            : 'w-0 opacity-0'
        "
      >
        <Transition
          enter-active-class="transition-opacity duration-500" enter-from-class="opacity-0" enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-500" leave-from-class="opacity-100" leave-to-class="opacity-0"
        >
          <div v-if="sidebarGlow" class="absolute inset-0 z-10 pointer-events-none bg-primary-500/25 dark:bg-primary-400/20" />
        </Transition>
        <SidebarWorkbench
          v-bind="sidebarProps"
          v-model:active-panel="activePanel"
          v-model:panel-open="sidebarPanelOpen"
          class="h-full"
          v-on="sidebarEvents"
        />
      </aside>

      <Teleport to="body">
        <Transition
          enter-active-class="transition-opacity duration-300 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0"
        >
          <div v-if="showSidebar" class="fixed inset-0 bg-black/50 z-20 lg:hidden" @click="showSidebar = false" />
        </Transition>
        <Transition
          enter-active-class="transition-transform duration-300 ease-out" enter-from-class="-translate-x-full" enter-to-class="translate-x-0"
          leave-active-class="transition-transform duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="-translate-x-full"
        >
          <aside
            v-if="showSidebar"
            class="fixed inset-y-0 left-0 z-30 w-[340px] max-w-[85vw] shadow-xl lg:hidden"
            :style="{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)' }"
          >
            <div class="h-full relative">
              <Transition
                enter-active-class="transition-opacity duration-500" enter-from-class="opacity-0" enter-to-class="opacity-100"
                leave-active-class="transition-opacity duration-500" leave-from-class="opacity-100" leave-to-class="opacity-0"
              >
                <div v-if="sidebarGlow" class="absolute inset-0 z-10 pointer-events-none bg-primary-500/25 dark:bg-primary-400/20" />
              </Transition>
              <SidebarWorkbench
                v-bind="sidebarProps"
                v-model:active-panel="activePanel"
                class="h-full"
                v-on="sidebarEvents"
              />
            </div>
          </aside>
        </Transition>
      </Teleport>

      <main
        class="flex-1 overflow-hidden flex flex-col isolate transition-[padding] duration-300 relative"
        :style="focusMode ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' } : {}"
      >
        <div class="absolute top-0 left-0 right-0 h-3 z-10 pointer-events-none bg-gradient-to-b from-black/[0.06] to-transparent dark:from-black/[0.25]" />
        <NoteEditor
          v-if="currentNote" ref="editorRef"
          :content="currentNote.content"
          :note-id="currentNote.id"
          :show-inline="showInlineResults !== 'off'"
          :inline-align="showInlineResults === 'off' ? 'left' : showInlineResults"
          :locale-preferences="localePrefs.preferences"
          :markdown-mode="markdownMode"
          :shortcut-handlers="shortcutHandlers"
          :placeholder="'Start typing... Try: 10 + 20, or use # for headers, // for comments'"
          @update:content="updateContent"
        />
        <div v-else class="flex items-center justify-center h-full px-6">
          <div class="text-center max-w-sm space-y-6">
            <div class="mx-auto w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <Icon name="mdi:file-document-outline" class="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <div class="space-y-2">
              <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200">No note selected</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Pick an existing note from the sidebar or start fresh with a new one.</p>
            </div>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
              <UiButton size="lg" class="w-full sm:w-auto" @click="createNote">
                <Icon name="mdi:plus" class="w-5 h-5" /> Create new note
              </UiButton>
              <UiButton variant="outline" color="white" size="lg" class="w-full sm:w-auto" @click="showSidebar = true">
                <Icon name="mdi:menu" class="w-5 h-5" /> Browse notes
              </UiButton>
            </div>
            <p v-if="notes.length" class="text-xs text-gray-400 dark:text-gray-500">
              {{ notes.length }} {{ notes.length === 1 ? 'note' : 'notes' }} in your library
            </p>
          </div>
        </div>
      </main>
    </div>

    <div
      v-if="currentNote && !isNativeApp"
      class="lg:hidden fixed left-0 right-0 z-10 transition-[bottom] duration-150 ease-out px-1.5 pb-1.5"
      :style="{ bottom: mobileKeyboardOffset + 'px' }"
    >
      <div
        class="overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-xl"
        :style="{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }"
      >
        <FormattingToolbar
          container-class="px-2 py-1.5" :show-dismiss="hasVirtualKeyboard"
          :can-undo="editorRef?.canUndo ?? false" :can-redo="editorRef?.canRedo ?? false"
          @apply-format="applyFormat" @indent="editorRef?.indentLine()" @outdent="editorRef?.outdentLine()"
          @undo="editorRef?.undo()" @redo="editorRef?.redo()" @dismiss-keyboard="editorRef?.blur()"
        />
      </div>
    </div>

    <!-- Modals -->
    <NoteMetaModal
      :is-open="showMetaModal" :title="currentNote?.title || ''" :internal-name="currentNote?.internalName || ''"
      :description="currentNote?.description || ''" :tags="currentNote?.tags || []" :all-tags="allTags"
      :note-id="currentNote?.id" :all-notes="notes"
      :shared="currentNote ? shareManagement.sharedNoteIds.value.includes(currentNote.id) : false"
      :share-hash="currentNote ? shareManagement.sharedNotesMap.value.get(currentNote.id) || null : null"
      :analytics-hash="currentNote ? shareManagement.analyticsNotesMap.value.get(currentNote.id) || null : null"
      @close="showMetaModal = false" @save="updateMeta" @delete="confirmDelete"
      @share="handleShareNote" @unshare="shareManagement.handleUnshareNote" @open-analytics="shareManagement.handleOpenAnalytics"
    />

    <HelpModal :is-open="showHelp" :mod-label="modLabel" :has-active-note="!!currentNote" @close="showHelp = false" @insert="insertTemplate" />
    <AboutModal :is-open="showAbout" :check-for-update="sw.checkForUpdate" @close="showAbout = false" />
    <TemplatesModal :is-open="showTemplates" @close="showTemplates = false" @insert="insertTemplate" />
    <SettingsModal
      :is-open="showLocaleSettings" :initial-section="settingsInitialSection"
      :preferences="localePrefs.preferences"
      :apply-preset="localePrefs.applyPreset" :set-preference="localePrefs.setPreference"
      :get-active-preset="localePrefs.getActivePreset" :save="localePrefs.save" :reset="localePrefs.reset"
      :user="auth.user.value" :last-synced-at="lastSyncedAt"
      :auth-headers="auth.authHeaders.value" :on-delete-data="authHandlers.handleDeleteData" :on-delete-account="authHandlers.handleDeleteAccount"
      :on-backup="handleBackupConfirm"
      @close="showLocaleSettings = false; settingsInitialSection = null" @relaunch-wizard="showLocaleSettings = false; welcomeWizard.isOpen.value = true"
      @update-profile="authHandlers.handleUpdateProfile" @change-password="(...args) => { authHandlers.handleChangePassword(...args); showLocaleSettings = false }"
      @logout="() => { showLocaleSettings = false; authHandlers.handleLogout() }" @unshare="shareManagement.handleProfileUnshare"
      @open-analytics="shareManagement.handleOpenAnalytics" @sync-now="syncNow" @show-notes="handleShowNotes"
    />

    <ExportOptionsModal :is-open="noteActions.showExportOptions.value" @close="noteActions.showExportOptions.value = false" @confirm="noteActions.handleExportConfirm" />
    <PrintModal :is-open="noteActions.showPrintModal.value" :note-title="currentNote?.title || ''" @close="noteActions.showPrintModal.value = false" @confirm="noteActions.handlePrintConfirm" />
    <SaveModal :is-open="noteActions.showSaveModal.value" :note-title="currentNote?.title || ''" @close="noteActions.showSaveModal.value = false" @confirm="handleSaveConfirm" />
    <BackupModal :is-open="showBackup" :has-note="!!currentNote" @close="showBackup = false" @confirm="handleBackupConfirm" />
    <RestorePasswordModal :is-open="noteActions.showRestorePassword.value" :error="noteActions.restorePasswordError.value" @close="noteActions.handleRestorePasswordClose" @confirm="noteActions.handleRestorePasswordConfirm" />
    <RestoreConfirmModal :is-open="noteActions.showRestoreConfirm.value" :duplicate-count="noteActions.restoreDuplicateCount.value" @close="noteActions.handleRestoreConfirmClose" @skip="noteActions.handleRestoreConfirmSkip" @overwrite="noteActions.handleRestoreConfirmOverwrite" />
    <ConfirmDeleteModal :is-open="showDeleteConfirm" :bin-enabled="binEnabled" @close="showDeleteConfirm = false" @confirm="handleDeleteConfirm" />
    <ConfirmBulkDeleteModal :is-open="showBulkDeleteConfirm" :count="pendingBulkDeleteIds.length + pendingBulkDeleteGroupIds.length" :bin-enabled="binEnabled" @close="showBulkDeleteConfirm = false" @confirm="handleBulkDeleteConfirm" />
    <ConfirmPermanentDeleteModal :is-open="showPermanentDeleteConfirm" :count="pendingPermanentDeleteIds.length + pendingPermanentDeleteGroupIds.length" @close="handlePermanentDeleteCancel" @confirm="handlePermanentDeleteConfirm" />
    <RestoreFromBinModal :is-open="noteActions.showRestoreFromBin.value" :note-title="noteActions.pendingRestoreFromBinTitle.value" @close="noteActions.handleRestoreFromBinClose" @confirm="handleRestoreFromBinConfirm" />

    <WelcomeWizard
      :is-open="welcomeWizard.isOpen.value" :preferences="localePrefs.preferences"
      :apply-preset="localePrefs.applyPreset" :save-preferences="localePrefs.save"
      @complete="welcomeWizard.complete()"
    />

    <AuthModal
      :is-open="authHandlers.showAuthModal.value" :loading="auth.loading.value" :error="auth.error.value"
      @close="authHandlers.showAuthModal.value = false" @login="authHandlers.handleLogin" @register="authHandlers.handleRegister"
      @forgot-password="authHandlers.handleForgotPassword" @verify-recovery="authHandlers.handleVerifyRecovery"
      @reset-password="authHandlers.handleResetPassword"
    />

    <EmailVerificationModal
      :is-open="authHandlers.showEmailVerificationModal.value" :loading="auth.loading.value" :error="auth.error.value"
      @close="authHandlers.showEmailVerificationModal.value = false" @verify="authHandlers.handleVerifyEmail" @resend="authHandlers.handleResendVerification"
    />

    <ShareModal
      :is-open="shareManagement.showShareModal.value" :note="currentNote" :is-logged-in="auth.isLoggedIn.value"
      :user-name="auth.user.value?.name || ''" :user-email="auth.user.value?.email || ''"
      :auth-headers="auth.authHeaders.value"
      :existing-hash="currentNote ? shareManagement.sharedNotesMap.value.get(currentNote.id) || null : null"
      @close="shareManagement.handleShareModalClose" @unshare="shareManagement.handleShareModalUnshare"
      @open-analytics="shareManagement.handleOpenAnalytics"
    />

    <ShareAnalyticsModal :is-open="shareManagement.showAnalyticsModal.value" :hash="shareManagement.analyticsHash.value" :auth-headers="auth.authHeaders.value" @close="shareManagement.showAnalyticsModal.value = false" />

    <SyncIndicator :syncing="syncing" />

    <GroupModal
      :is-open="groupManagement.showGroupModal.value" :editing-group-id="groupManagement.editingGroupId.value"
      :initial-name="groupManagement.editingGroupName.value" :initial-internal-name="groupManagement.editingGroupInternalName.value"
      :all-groups="groups" @close="groupManagement.showGroupModal.value = false" @save="groupManagement.handleGroupModalSave"
    />

    <DeleteGroupModal
      :is-open="groupManagement.showDeleteGroupModal.value" :group-name="groupManagement.pendingDeleteGroup.value?.name || ''"
      :note-count="groupManagement.pendingDeleteGroupNoteCount.value" :other-groups="groupManagement.otherGroupsForDelete.value"
      @close="groupManagement.showDeleteGroupModal.value = false" @confirm="groupManagement.handleDeleteGroupConfirm"
    />

    <AddToGroupModal
      :is-open="groupManagement.showAddToGroupModal.value" :groups="groups"
      :current-group-id="groupManagement.addToGroupNoteId.value ? notes.find((n) => n.id === groupManagement.addToGroupNoteId.value)?.groupId || null : null"
      @close="groupManagement.showAddToGroupModal.value = false; groupManagement.bulkGroupNoteIds.value = null; groupManagement.bulkGroupGroupIds.value = null; groupManagement.addToGroupNoteId.value = null"
      @select="groupManagement.handleAddToGroupSelect" @create-new="groupManagement.handleAddToGroupCreateNew"
    />

    <UpdateNotification :visible="sw.updateAvailable.value" :is-native="sw.isNative" @apply="sw.applyUpdate" @dismiss="sw.dismissUpdate" />
    <ToastNotification :toasts="toast.toasts.value" />

    <UiButton
      v-if="focusMode" variant="ghost" color="gray" icon-only
      class="fixed z-50 pl-2.5 pb-2.5 rounded-bl-xl focus-exit-enter"
      :style="{ top: 'env(safe-area-inset-top, 0px)', right: 'env(safe-area-inset-right, 0px)', paddingRight: '4px', paddingTop: '4px' }"
      title="Exit focus mode" @click="focusMode = false"
    >
      <Icon name="mdi:fullscreen-exit" class="w-4 h-4 block" />
    </UiButton>

    <AppLockScreen :show="appLock.isLocked.value" :preferences="localePrefs.preferences" @logout="authHandlers.handleLogout" />
  </div>
</template>

<script setup>
import db from '~/db.js'
import { useAuthHandlers } from '~/composables/useAuthHandlers'
import { useShareManagement } from '~/composables/useShareManagement'
import { useGroupManagement } from '~/composables/useGroupManagement'
import { useNoteActions } from '~/composables/useNoteActions'

const {
  notes, notesLoaded, currentNoteId, currentNote, allTags, deletedIds,
  addNote, deleteNote, softDeleteNote, restoreNote, permanentlyDeleteNote,
  updateNoteContent, updateNoteMeta, saveNotes,
  clearDeletedIds, reorderNotes, moveNotesToGroup, removeNotesFromGroup,
  archiveNote, unarchiveNote, bulkArchive, bulkUnarchive, removeWelcomeNoteIfNeeded,
} = useNotes()
const {
  groups, deletedGroupIds, addGroup, updateGroup,
  deleteGroup: deleteGroupFromDb, toggleGroupCollapsed, reorderGroups, moveGroup, saveGroups, clearDeletedGroupIds,
  softDeleteGroups, restoreGroups, restoreGroupAncestors, permanentlyDeleteGroups,
} = useGroups()
const fileActions = useFileActions()
const { evaluateLines } = useCalculator()
const localePrefs = useLocalePreferences()
const welcomeWizard = useWelcomeWizard()
const auth = useAuth()
const { apiFetch } = useApi()
const toast = useToast()
const appLock = useAppLock()
const privacyScreen = usePrivacyScreen()

let _onDataWipe = null
let _onSessionRevoked = null
const {
  syncing, lastSyncedAt, syncError: _syncError, pendingNoteIds,
  isOnline: _isOnline, sync: _sync, syncNow, debouncedSync,
} = useSync(
  auth, notes, saveNotes, deletedIds, clearDeletedIds,
  () => _onDataWipe?.(), () => _onSessionRevoked?.(),
  removeWelcomeNoteIfNeeded, groups, saveGroups, deletedGroupIds, clearDeletedGroupIds,
)

watch(() => auth.wasSessionInvalid.value, (invalid) => {
  if (invalid) {
    appLock.resetForLogout()
    notes.value = []; currentNoteId.value = null; deletedIds.value = []
    deletedGroupIds.value = []; groups.value = []; lastSyncedAt.value = null
  }
})

_onDataWipe = async () => {
  notes.value = []; currentNoteId.value = null; deletedIds.value = []
  deletedGroupIds.value = []; groups.value = []
  await db.notes.clear(); await db.groups.clear()
  await db.appState.bulkDelete(['deleted_note_ids', 'deleted_group_ids', 'last_synced_at'])
  lastSyncedAt.value = null; await auth.refreshUser()
}

_onSessionRevoked = async () => {
  auth.user.value = null; auth.token.value = null; auth.encKey.value = null
  notes.value = []; currentNoteId.value = null; deletedIds.value = []
  deletedGroupIds.value = []; groups.value = []; lastSyncedAt.value = null
  await db.notes.clear(); await db.groups.clear()
  await db.appState.bulkDelete(['auth_token', 'enc_key', 'deleted_note_ids', 'deleted_group_ids', 'last_synced_at'])
}

const sw = useServiceWorker()
watch(() => localePrefs.preferences.updateCheckInterval, (val) => { sw.setPollInterval(val ?? 30) })
localePrefs.ready.then(() => { sw.setPollInterval(localePrefs.preferences.updateCheckInterval ?? 30) })

// --- Composable: Auth handlers ---
const authHandlers = useAuthHandlers({
  auth, appLock, notes, currentNoteId, deletedIds, deletedGroupIds, groups, lastSyncedAt,
})

// --- Composable: Share management ---
const shareManagement = useShareManagement({ auth, notes, apiFetch })

// --- Bin enabled preference ---
const binEnabled = computed(() => localePrefs.preferences.binEnabled !== false)

// --- Composable: Group management ---
const groupManagement = useGroupManagement({
  notes, groups, addGroup, updateGroup, deleteGroupFromDb, toggleGroupCollapsed,
  reorderGroups, moveGroup, softDeleteGroups, moveNotesToGroup, removeNotesFromGroup, deleteNote, softDeleteNote, binEnabled, syncNow,
})

// Wrapper: create note + instant sync
const createNote = () => {
  const now = new Date().toISOString()
  groups.value.forEach((g) => { g.sortOrder = (g.sortOrder ?? 0) + 1; g.updatedAt = now })
  saveGroups()
  const note = addNote()
  syncNow(note.id)
  return note
}

const handleReorder = (orderedIds) => { reorderNotes(orderedIds); syncNow() }

// --- Composable: Note file actions ---
const selectedNoteIds = ref([])
const noteActions = useNoteActions({
  notes, groups, currentNote, currentNoteId, selectedNoteIds, createNote,
  updateNoteMeta, updateNoteContent, softDeleteNote, archiveNote, restoreNote,
  evaluateLines, fileActions, toast,
})

// Unified file-tree move/reorder. Reparents the dragged item (unless keepParent,
// used by flat archive/bin/search reordering) then rewrites sortOrder across the
// destination's siblings (notes and sub-groups share one ordering space).
const handleTreeMove = ({ id, kind, newParentId, orderedIds, keepParent }) => {
  const now = new Date().toISOString()
  if (!keepParent) {
    if (kind === 'note') {
      const note = notes.value.find((n) => n.id === id)
      if (note) { note.groupId = newParentId ?? null; note.updatedAt = now }
    } else if (kind === 'group') {
      const group = groups.value.find((g) => g.id === id)
      if (group) { group.parentId = newParentId ?? null; group.updatedAt = now }
    }
  }
  orderedIds.forEach((sid, index) => {
    const group = groups.value.find((g) => g.id === sid)
    if (group) { group.sortOrder = index; group.updatedAt = now; return }
    const note = notes.value.find((n) => n.id === sid)
    if (note) { note.sortOrder = index; note.updatedAt = now }
  })
  saveNotes(); saveGroups(); syncNow()
}

const { isMac: _isMac, modLabel, handlers: shortcutHandlers } = useKeyboardShortcuts({
  save: () => { if (currentNote.value) noteActions.showSaveModal.value = true },
  newNote: () => createNote(),
  openFile: () => noteActions.handleOpenFile(),
  print: () => { if (currentNote.value) noteActions.handlePrint() },
  duplicate: () => noteActions.handleDuplicate(),
  exportText: () => { showBackup.value = true },
  help: () => { showHelp.value = true },
  exportAll: () => { showBackup.value = true },
  toggleFocus: () => { focusMode.value = !focusMode.value },
})

const showSidebar = ref(true)
const focusMode = ref(false)

// VSCode-style activity bar: which panel is active + whether it's expanded.
const activePanel = ref('explorer') // 'explorer' | 'search'
const sidebarPanelOpen = ref(true)

// ── Back-button: close mobile sidebar when open ──
const { register: registerBack, unregister: unregisterBack } = useBackButton()
let sidebarBackId = null
watch(showSidebar, (open) => {
  // Register at priority -1 (below modals at 0) so modals close first
  if (open && window.innerWidth < 1024) {
    sidebarBackId = registerBack(() => {
      if (!showSidebar.value) return false
      showSidebar.value = false
      return true
    }, -1)
  } else if (sidebarBackId !== null) {
    unregisterBack(sidebarBackId); sidebarBackId = null
  }
})
const showMetaModal = ref(false)
const showHelp = ref(false)
const showTemplates = ref(false)
const showLocaleSettings = ref(false)
const settingsInitialSection = ref(null)
const showAbout = ref(false)

const showInlineResults = computed({
  get: () => localePrefs.preferences.inlineMode ?? 'left',
  set: (v) => { localePrefs.preferences.inlineMode = v; localePrefs.save() },
})
const markdownMode = computed({
  get: () => localePrefs.preferences.markdownMode ?? 'edit',
  set: (v) => { localePrefs.preferences.markdownMode = v; localePrefs.save() },
})

const handleZoomIn = () => { const cur = localePrefs.preferences.editorFontSize ?? 16; localePrefs.preferences.editorFontSize = Math.min(cur + 2, 28); localePrefs.save() }
const handleZoomOut = () => { const cur = localePrefs.preferences.editorFontSize ?? 16; localePrefs.preferences.editorFontSize = Math.max(cur - 2, 10); localePrefs.save() }
const handleZoomReset = () => { localePrefs.preferences.editorFontSize = 16; localePrefs.save() }

const editorRef = ref(null)
const mobileKeyboardOffset = ref(0)

const { platform, isNative: _isNativePlatform } = usePlatform()
const isNativeApp = platform === 'ios' || platform === 'android'
const { hasVirtualKeyboard } = useHasVirtualKeyboard()

// Browser: sync focus mode with fullscreen
if (import.meta.client && platform === 'web') {
  watch(focusMode, async (on) => {
    try {
      if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen()
      else if (!on && document.fullscreenElement) await document.exitFullscreen()
    } catch { /* fullscreen not supported or denied */ }
  })
  useEventListener(document, 'fullscreenchange', () => {
    if (!document.fullscreenElement) focusMode.value = false
  })
}

// Electron: sync focus mode with native fullscreen
if (import.meta.client && platform === 'electron') {
  watch(focusMode, (on) => {
    window.electronAPI?.setFullScreen(on)
  })
  window.electronAPI?.onFullScreenChange((isFullScreen) => {
    focusMode.value = isFullScreen
  })
}

// Native: hide status bar in focus mode
if (import.meta.client && isNativeApp) {
  watch(focusMode, async (on) => {
    try {
      const { StatusBar } = await import('@capacitor/status-bar')
      if (on) await StatusBar.hide(); else await StatusBar.show()
    } catch { /* status bar plugin not available */ }
  })
}

// Native keyboard toolbar
if (import.meta.client && isNativeApp) {
  useNativeKeyboardToolbar({
    onFormat: (before, after) => editorRef.value?.wrapSelection(before, after),
    onUndo: () => editorRef.value?.undo(), onRedo: () => editorRef.value?.redo(),
    onIndent: () => editorRef.value?.indentLine(), onOutdent: () => editorRef.value?.outdentLine(),
    canUndo: () => editorRef.value?.canUndo ?? false, canRedo: () => editorRef.value?.canRedo ?? false,
  })
}

// Destructure for template access
const { sharedNoteIds, sharedNotesMap, analyticsNotesMap } = shareManagement

// Reload shared notes when auth changes
watch(() => auth.isLoggedIn.value, async (loggedIn, wasLoggedIn) => {
  if (loggedIn) {
    shareManagement.loadSharedNotes()
  } else {
    sharedNoteIds.value = []; sharedNotesMap.value = new Map(); analyticsNotesMap.value = new Map()
    if (wasLoggedIn) {
      notes.value = []; currentNoteId.value = null; deletedIds.value = []
      deletedGroupIds.value = []; groups.value = []
      await db.notes.clear(); await db.groups.clear()
      await db.appState.bulkDelete(['deleted_note_ids', 'deleted_group_ids', 'last_synced_at'])
      lastSyncedAt.value = null
    }
  }
})

onMounted(() => { if (auth.isLoggedIn.value) shareManagement.loadSharedNotes() })

// Track virtual keyboard
let vvCleanup = null
onMounted(() => {
  const vv = window.visualViewport
  if (vv) {
    const update = () => { mobileKeyboardOffset.value = Math.max(0, window.innerHeight - vv.height - vv.offsetTop) }
    vv.addEventListener('resize', update); vv.addEventListener('scroll', update)
    vvCleanup = () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }
})
onBeforeUnmount(() => { if (vvCleanup) vvCleanup() })

onMounted(async () => {
  if (window.innerWidth < 1024) showSidebar.value = false
  await welcomeWizard.showIfFirstTime()
  await appLock.loadSettings()
  appLock.initAppListeners()
  appLock.detectBiometrics()
  // Sync app lock settings from server (waits for auth if needed)
  appLock.loadFromServer()
  // Sync privacy screen setting from server (waits for auth if needed)
  privacyScreen.loadFromServer()
})

// Reload device-level settings when user logs in (login/register set auth.user)
watch(() => auth.user.value, async (newUser, oldUser) => {
  if (newUser && !oldUser) {
    // Login/register responses don't include appLockSettings — fetch full profile
    await auth.refreshUser()
    appLock.loadFromServer()
    privacyScreen.loadFromServer()
  }
})

// Share note handler (needs currentNoteId)
const handleShareNote = (noteId) => {
  currentNoteId.value = noteId
  shareManagement.showShareModal.value = true
}

const handleShowProperties = (noteId) => { currentNoteId.value = noteId; showMetaModal.value = true }

const sidebarGlow = ref(false)
const handleShowNotes = () => {
  showLocaleSettings.value = false
  showSidebar.value = true
  setTimeout(() => { sidebarGlow.value = true }, 400)
  setTimeout(() => { sidebarGlow.value = false }, 1400)
}

// Check for pending import from shared note page
onMounted(async () => {
  const { default: db } = await import('~/db.js')
  const row = await db.appState.get('pending_import')
  if (row?.value) {
    await db.appState.delete('pending_import')
    try {
      const data = JSON.parse(row.value)
      const newNote = createNote()
      updateNoteMeta(newNote.id, { title: data.title, description: data.description, tags: data.tags })
      updateNoteContent(newNote.id, data.content)
    } catch { /* ignore bad data */ }
  }
})

// Check for pending "Open With" file from OS
onMounted(() => {
  const consumePending = () => {
    if (!window.__pendingOpenWithNote) return
    const data = window.__pendingOpenWithNote

    // If notes haven't loaded from DB yet, wait until they do
    if (!notesLoaded.value) {
      const stop = watch(notesLoaded, (loaded) => {
        if (loaded) {
          stop()
          consumePending()
        }
      })
      return
    }

    window.__pendingOpenWithNote = null
    // Check if a note with the same content already exists (using hash for efficiency)
    const existing = noteActions.findExistingNote(data.title, data.content)
    if (existing) {
      if (existing.deletedAt) {
        // Note is in the bin — show restore modal
        noteActions.showRestoreFromBin.value = true
        noteActions.pendingRestoreFromBinTitle.value = existing.title
        // Store the id so handleRestoreFromBinConfirm can use it
        noteActions.pendingRestoreFromBinId.value = existing.id
      } else {
        currentNoteId.value = existing.id
      }
    } else {
      const newNote = createNote()
      updateNoteMeta(newNote.id, { title: data.title, description: data.description })
      updateNoteContent(newNote.id, data.content)
    }
  }
  consumePending()
  // Also listen for future open-with events while the page is active
  window.addEventListener('open-with-file-content', () => nextTick(consumePending))
})

const selectNote = (id) => {
  currentNoteId.value = id
  if (window.innerWidth < 1024) showSidebar.value = false
}

// Select a note and reveal it in the Explorer tree: expand every ancestor
// group so the note becomes visible (VSCode-style "reveal"). Scrolling the
// row into view is handled by the notes list itself.
const revealNoteInTree = (id) => {
  const note = notes.value.find((n) => n.id === id)
  if (note && note.groupId) {
    let gid = note.groupId
    const seen = new Set()
    while (gid && !seen.has(gid)) {
      seen.add(gid)
      const group = groups.value.find((g) => g.id === gid)
      if (!group) break
      if (group.collapsed) toggleGroupCollapsed(group.id)
      gid = group.parentId
    }
  }
  selectNote(id)
}

const openEditModal = (id) => { currentNoteId.value = id; showMetaModal.value = true }

const updateContent = (content) => {
  if (currentNote.value) { updateNoteContent(currentNote.value.id, content); debouncedSync(currentNote.value.id) }
}

const updateMeta = ({ title, description, tags, internalName }) => {
  if (currentNote.value) { updateNoteMeta(currentNote.value.id, { title, description, tags, internalName }); debouncedSync(currentNote.value.id) }
}

const showBackup = ref(false)

const handleSaveConfirm = (options) => {
  noteActions.handleSave(options)
}

const handleBackupConfirm = (options) => {
  showBackup.value = false
  noteActions.handleBackup(options)
}

const showDeleteConfirm = ref(false)
const pendingDeleteId = ref(null)
const showBulkDeleteConfirm = ref(false)
const pendingBulkDeleteIds = ref([])
const pendingBulkDeleteGroupIds = ref([])

const confirmDelete = (id) => { pendingDeleteId.value = id; showDeleteConfirm.value = true }
const handleDeleteConfirm = ({ skipBin } = {}) => {
  showDeleteConfirm.value = false
  if (pendingDeleteId.value) {
    if (binEnabled.value && !skipBin) {
      softDeleteNote(pendingDeleteId.value)
      syncNow(pendingDeleteId.value)
      toast.show('Note moved to bin', { type: 'success', icon: 'mdi:delete-outline' })
    } else {
      deleteNote(pendingDeleteId.value)
      syncNow()
    }
    pendingDeleteId.value = null
  }
}

const applyFormat = (before, after) => { if (editorRef.value) editorRef.value.wrapSelection(before, after) }

const insertTemplate = (templateContent) => {
  if (currentNote.value && editorRef.value) {
    let content = currentNote.value.content
    if (content && !content.endsWith('\n')) content += '\n\n'
    content += templateContent
    updateContent(content)
  }
}

const onSelectionChange = (ids) => { selectedNoteIds.value = ids }
const confirmBulkDelete = (payload) => {
  pendingBulkDeleteIds.value = Array.isArray(payload) ? payload : payload?.noteIds || []
  pendingBulkDeleteGroupIds.value = Array.isArray(payload) ? [] : payload?.groupIds || []
  showBulkDeleteConfirm.value = true
}
const handleBulkDeleteConfirm = ({ skipBin } = {}) => {
  showBulkDeleteConfirm.value = false
  const soft = binEnabled.value && !skipBin
  const noteCount = pendingBulkDeleteIds.value.length
  const groupCount = pendingBulkDeleteGroupIds.value.length

  // Delete selected groups (folder + their contents) first, then standalone notes.
  if (groupCount) groupManagement.bulkDeleteGroups(pendingBulkDeleteGroupIds.value, { soft })
  for (const id of pendingBulkDeleteIds.value) {
    if (soft) softDeleteNote(id)
    else deleteNote(id)
  }

  const parts = []
  if (noteCount) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`)
  if (groupCount) parts.push(`${groupCount} group${groupCount > 1 ? 's' : ''}`)
  if (parts.length) {
    toast.show(`${parts.join(' and ')} ${soft ? 'moved to bin' : 'deleted'}`, {
      type: 'success',
      icon: 'mdi:delete-outline',
    })
  }
  pendingBulkDeleteIds.value = []
  pendingBulkDeleteGroupIds.value = []
  syncNow()
}

const handleArchiveNote = (id) => { archiveNote(id); syncNow(id); toast.show('Note archived', { type: 'success', icon: 'mdi:archive-outline' }) }
const handleUnarchiveNote = (id) => { unarchiveNote(id); syncNow(id); toast.show('Note unarchived', { type: 'success', icon: 'mdi:package-up' }) }
const handleBulkArchive = (ids) => { bulkArchive(ids); syncNow(); toast.show(`${ids.length} note${ids.length > 1 ? 's' : ''} archived`, { type: 'success', icon: 'mdi:archive-outline' }) }
const handleBulkUnarchive = (ids) => { bulkUnarchive(ids); syncNow(); toast.show(`${ids.length} note${ids.length > 1 ? 's' : ''} unarchived`, { type: 'success', icon: 'mdi:package-up' }) }

// --- Bin handlers ---
const showPermanentDeleteConfirm = ref(false)
const pendingPermanentDeleteIds = ref([])
const pendingPermanentDeleteGroupIds = ref([])

// Restoring a note also un-deletes its (soft-deleted) folder chain so it
// reappears in place.
const restoreNoteWithGroups = (id) => {
  const note = notes.value.find((n) => n.id === id)
  restoreNote(id)
  if (note?.groupId) restoreGroupAncestors(note.groupId)
}

const handleRestoreNote = (id) => { restoreNoteWithGroups(id); syncNow(id); toast.show('Note restored', { type: 'success', icon: 'mdi:restore' }) }
const handlePermanentDelete = (id) => { pendingPermanentDeleteIds.value = [id]; pendingPermanentDeleteGroupIds.value = []; showPermanentDeleteConfirm.value = true }
const handleBulkRestore = (payload) => {
  const noteIds = Array.isArray(payload) ? payload : payload?.noteIds || []
  const groupIds = Array.isArray(payload) ? [] : payload?.groupIds || []
  if (groupIds.length) restoreGroups(groupIds)
  for (const id of noteIds) restoreNoteWithGroups(id)
  syncNow()
  const count = noteIds.length + groupIds.length
  toast.show(`${count} item${count > 1 ? 's' : ''} restored`, { type: 'success', icon: 'mdi:restore' })
}
const handleBulkPermanentDelete = (payload) => {
  pendingPermanentDeleteIds.value = Array.isArray(payload) ? payload : payload?.noteIds || []
  pendingPermanentDeleteGroupIds.value = Array.isArray(payload) ? [] : payload?.groupIds || []
  showPermanentDeleteConfirm.value = true
}
const handlePermanentDeleteConfirm = () => {
  showPermanentDeleteConfirm.value = false
  const ids = pendingPermanentDeleteIds.value
  const groupIds = pendingPermanentDeleteGroupIds.value
  for (const id of ids) permanentlyDeleteNote(id)
  if (groupIds.length) permanentlyDeleteGroups(groupIds)
  syncNow()
  const count = ids.length + groupIds.length
  toast.show(count > 1 ? `${count} items permanently deleted` : 'Item permanently deleted', { type: 'success', icon: 'mdi:delete-forever-outline' })
  pendingPermanentDeleteIds.value = []
  pendingPermanentDeleteGroupIds.value = []
}
const handlePermanentDeleteCancel = () => {
  showPermanentDeleteConfirm.value = false
  pendingPermanentDeleteIds.value = []
  pendingPermanentDeleteGroupIds.value = []
  toast.show('Deletion cancelled', { type: 'info', icon: 'mdi:close-circle-outline' })
}

const handleRestoreFromBinConfirm = () => {
  noteActions.handleRestoreFromBinConfirm()
  syncNow(currentNoteId.value)
  toast.show('Note restored', { type: 'success', icon: 'mdi:restore' })
}

// --- Sidebar props/events (shared between desktop and mobile) ---
const sidebarProps = computed(() => ({
  notes: notes.value, groups: groups.value, currentNoteId: currentNoteId.value, currentNote: currentNote.value,
  allTags: allTags.value, isLoggedIn: auth.isLoggedIn.value, user: auth.user.value,
  appLockEnabled: appLock.settings.enabled,
  sharedNoteIds: sharedNoteIds.value, sharedNotesMap: sharedNotesMap.value,
  analyticsNotesMap: analyticsNotesMap.value, pendingNoteIds: pendingNoteIds.value,
}))

const sidebarEvents = {
  'new-note': createNote, 'select-note': revealNoteInTree, 'delete-note': confirmDelete,
  'show-meta': () => { if (currentNote.value) showMetaModal.value = true },
  'edit-note': openEditModal, 'bulk-delete': confirmBulkDelete, 'selection-change': onSelectionChange,
  'show-help': () => { showHelp.value = true },
  'show-locale-settings': () => { settingsInitialSection.value = 'general'; showLocaleSettings.value = true },
  'show-locale-settings-locales': () => { settingsInitialSection.value = 'locales'; showLocaleSettings.value = true },
  'show-locale-settings-security': () => { settingsInitialSection.value = 'security'; showLocaleSettings.value = true },
  'show-locale-settings-sessions': () => { settingsInitialSection.value = 'sessions'; showLocaleSettings.value = true },
  'show-locale-settings-shared-notes': () => { settingsInitialSection.value = 'shared'; showLocaleSettings.value = true },
  'show-auth': () => { authHandlers.showAuthModal.value = true },
  logout: authHandlers.handleLogout, 'edit-profile': () => { settingsInitialSection.value = 'profile'; showLocaleSettings.value = true },
  'lock-app': () => { appLock.lock() },
  'share-note': handleShareNote, 'show-properties': handleShowProperties,
  'unshare-note': shareManagement.handleUnshareNote, 'open-analytics': shareManagement.handleOpenAnalytics,
  reorder: handleReorder,
  'duplicate-note': noteActions.handleDuplicateById, 'export-note': noteActions.handleExportById,
  'copy-to-clipboard': noteActions.handleCopyById, 'print-note': noteActions.handlePrintById,
  'archive-note': handleArchiveNote, 'unarchive-note': handleUnarchiveNote,
  'bulk-archive': handleBulkArchive, 'bulk-unarchive': handleBulkUnarchive,
  'bulk-restore': handleBulkRestore, 'bulk-permanent-delete': handleBulkPermanentDelete,
  'restore-note': handleRestoreNote, 'permanent-delete-note': handlePermanentDelete,
  'bulk-group': groupManagement.handleBulkGroup, 'add-to-group': groupManagement.handleAddToGroup,
  'toggle-group-collapse': groupManagement.handleToggleGroupCollapse,
  'edit-group': groupManagement.handleEditGroup, 'delete-group': groupManagement.handleDeleteGroup,
  'add-subgroup': groupManagement.handleAddSubgroup,
  'tree-move': handleTreeMove,
}
</script>

<style scoped>
.focus-exit-enter {
  animation: focus-enter 1.5s ease-out forwards;
}

@keyframes focus-enter {
  0% { opacity: 0; background: rgba(239, 68, 68, 0.35); box-shadow: 0 0 20px rgba(239, 68, 68, 0.5); }
  40% { opacity: 1; background: rgba(239, 68, 68, 0.25); box-shadow: 0 0 14px rgba(239, 68, 68, 0.4); }
  100% { opacity: 1; background: rgba(0, 0, 0, 0.05); box-shadow: none; }
}

@media (prefers-color-scheme: dark) {
  @keyframes focus-enter {
    0% { opacity: 0; background: rgba(248, 113, 113, 0.3); box-shadow: 0 0 20px rgba(248, 113, 113, 0.45); }
    40% { opacity: 1; background: rgba(248, 113, 113, 0.2); box-shadow: 0 0 14px rgba(248, 113, 113, 0.35); }
    100% { opacity: 1; background: rgba(255, 255, 255, 0.05); box-shadow: none; }
  }
}
</style>
