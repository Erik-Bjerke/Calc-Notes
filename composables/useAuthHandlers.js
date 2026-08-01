import db from '~/db.js'

/**
 * Auth-related action handlers for the index page.
 */
export function useAuthHandlers({
  auth,
  appLock,
  notes,
  currentNoteId,
  deletedIds,
  deletedGroupIds,
  groups,
  lastSyncedAt,
}) {
  const showAuthModal = ref(false)
  const showEmailVerificationModal = ref(false)
  const showProfileModal = ref(false)

  /**
   * Clear all local data from IndexedDB — called on logout, password change,
   * account deletion. Includes the collabDocs linkage table so collaborative
   * bindings never leak across accounts on a shared device.
   */
  const clearLocalData = async () => {
    auth.logout()
    notes.value = []
    currentNoteId.value = null
    groups.value = []
    await db.notes.clear()
    await db.groups.clear()
    await db.collabDocs.clear()
    await db.appState.delete('deleted_note_ids')
    await db.appState.delete('deleted_group_ids')
  }

  const handleLogin = async ({ email, password }) => {
    try {
      await auth.login(email, password)
      showAuthModal.value = false
    } catch {
      /* error shown in modal */
    }
  }

  const handleRegister = async ({ email, password, name }) => {
    try {
      await auth.register(email, password, name)
      showAuthModal.value = false
    } catch {
      /* error shown in modal */
    }
  }

  const handleForgotPassword = async ({ email, onSuccess }) => {
    try {
      await auth.forgotPassword(email)
      onSuccess()
    } catch {
      /* error shown in modal */
    }
  }

  const handleVerifyRecovery = async ({ email, code, onSuccess }) => {
    try {
      const token = await auth.verifyRecovery(email, code)
      onSuccess(token)
    } catch {
      /* error shown in modal */
    }
  }

  const handleResetPassword = async ({ recoveryToken, newPassword }) => {
    try {
      await auth.resetPassword(recoveryToken, newPassword)
      showAuthModal.value = false
      notes.value = []
      currentNoteId.value = null
      groups.value = []
      await db.notes.clear()
      await db.groups.clear()
      await db.collabDocs.clear()
      await db.appState.delete('deleted_note_ids')
      await db.appState.delete('deleted_group_ids')
    } catch {
      /* error shown in modal */
    }
  }

  const handleVerifyEmail = async (code) => {
    try {
      await auth.verifyEmail(code)
      showEmailVerificationModal.value = false
    } catch {
      /* error shown in modal */
    }
  }

  const handleResendVerification = async () => {
    try {
      await auth.sendVerification()
    } catch {
      /* ignore */
    }
  }

  const handleLogout = async () => {
    await appLock.resetForLogout()
    await clearLocalData()
  }

  const handleShowProfile = () => {
    auth.refreshUser()
    showProfileModal.value = true
  }

  const handleUpdateProfile = async (data) => {
    await auth.updateProfile(data)
  }

  const handleChangePassword = async ({ currentPassword, newPassword, onProgress }) => {
    const serverNotes = notes.value.map((n) => ({
      clientId: n.id,
      title: n.title,
      description: n.description,
      tags: n.tags || [],
      content: n.content,
      sortOrder: n.sortOrder ?? 0,
      archived: n.archived ?? false,
      internalName: n.internalName || '',
      groupId: n.groupId || null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }))
    await auth.changePassword(currentPassword, newPassword, serverNotes, onProgress)
    await clearLocalData()
    showProfileModal.value = false
    showAuthModal.value = true
  }

  const handleDeleteData = async (password) => {
    const backupNotes = [...notes.value]
    const backupCurrentNoteId = currentNoteId.value
    const backupGroups = [...groups.value]
    notes.value = []
    currentNoteId.value = null
    deletedIds.value = []
    deletedGroupIds.value = []
    groups.value = []

    try {
      await auth.requestDeletion('data', password)
      await db.notes.clear()
      await db.groups.clear()
      await db.collabDocs.clear()
      await db.appState.bulkDelete(['deleted_note_ids', 'deleted_group_ids', 'last_synced_at'])
      lastSyncedAt.value = null
      await auth.refreshUser()
    } catch (err) {
      notes.value = backupNotes
      currentNoteId.value = backupCurrentNoteId
      groups.value = backupGroups
      throw err
    }
  }

  const handleDeleteAccount = async (password) => {
    await auth.requestDeletion('account', password)
    await clearLocalData()
    showProfileModal.value = false
  }

  return {
    showAuthModal,
    showEmailVerificationModal,
    showProfileModal,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleVerifyRecovery,
    handleResetPassword,
    handleVerifyEmail,
    handleResendVerification,
    handleLogout,
    handleShowProfile,
    handleUpdateProfile,
    handleChangePassword,
    handleDeleteData,
    handleDeleteAccount,
  }
}
