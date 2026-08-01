/**
 * Authentication state and API calls.
 * Stores JWT in Dexie (appState table). Completely optional — app works without auth.
 *
 * E2E encryption: On login/register the user's password is used to derive
 * two independent keys via PBKDF2 (see utils/crypto.js):
 *   - authKey  → sent to the server for authentication (server stores hash(authKey))
 *   - encKey   → non-extractable AES-GCM key kept in memory only, never sent to server
 *
 * The encKey is exposed via `encKey` ref so the sync composable can
 * encrypt/decrypt notes transparently.
 */
import db from '~/db.js'
import { deriveAuthKey, deriveEncKey, exportKey, importKey } from '~/utils/crypto.js'

export const useAuth = () => {
  const { apiFetch } = useApi()

  const user = ref(null)
  const token = ref(null)
  const loading = ref(false)
  const error = ref(null)

  /** The non-extractable AES-GCM encryption key. Lives in memory only. */
  const encKey = ref(null)

  /**
   * Persist the derived key material in IndexedDB (appState table) so we
   * can restore encKey after a page refresh. We store the raw AES key
   * bytes as a base64 string, never the user's password.
   */
  const _saveEncKey = async (key) => {
    if (import.meta.client) {
      const b64 = await exportKey(key)
      await db.appState.put({ key: 'enc_key', value: b64 })
    }
  }
  const _clearEncKey = async () => {
    if (import.meta.client) await db.appState.delete('enc_key')
  }
  const _restoreEncKey = async () => {
    if (!import.meta.client) return null
    const row = await db.appState.get('enc_key')
    if (!row?.value) return null
    return importKey(row.value)
  }

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  const authHeaders = computed(() => {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  })

  /** Persist token to IndexedDB */
  const _saveToken = async (t) => {
    token.value = t
    if (t) {
      await db.appState.put({ key: 'auth_token', value: t })
    } else {
      await db.appState.delete('auth_token')
    }
  }

  /** True if restore() found a stored token but the session was invalid/revoked. */
  const wasSessionInvalid = ref(false)

  const restore = async () => {
    if (!import.meta.client) return
    const row = await db.appState.get('auth_token')
    if (!row?.value) return

    token.value = row.value
    try {
      user.value = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${row.value}` },
      })
      // Restore encKey from IndexedDB (survives refresh)
      encKey.value = await _restoreEncKey()
    } catch (err) {
      const status = err.status || err.statusCode || err.data?.statusCode
      if (status === 401) {
        // Session genuinely invalid or revoked — clear all auth AND local data
        token.value = null
        encKey.value = null
        await _clearEncKey()
        await db.appState.delete('auth_token')
        // Clear notes so revoked sessions don't leave data behind
        await db.notes.clear()
        await db.collabDocs.clear()
        await db.appState.bulkDelete(['deleted_note_ids', 'deleted_group_ids', 'last_synced_at'])
        wasSessionInvalid.value = true
      } else {
        // Network/transient error — keep the token and let sync retry later.
        // The user stays "logged in" with cached data until connectivity returns.
        console.warn('Session restore: transient error, keeping token', err.message || err)
      }
    }
  }

  const register = async (email, password, name = '') => {
    loading.value = true
    error.value = null
    try {
      const authKeyHex = await deriveAuthKey(password)
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { email, authKey: authKeyHex, name },
      })
      await _saveToken(data.token)
      user.value = data.user
      encKey.value = await deriveEncKey(password)
      await _saveEncKey(encKey.value)
      return data
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Registration failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const login = async (email, password) => {
    loading.value = true
    error.value = null
    try {
      const authKeyHex = await deriveAuthKey(password)
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, authKey: authKeyHex },
      })
      await _saveToken(data.token)
      user.value = data.user
      encKey.value = await deriveEncKey(password)
      await _saveEncKey(encKey.value)
      return data
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    // Revoke session server-side (best-effort)
    if (token.value) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.value}` },
        })
      } catch {
        /* ignore — token may already be invalid */
      }
    }
    token.value = null
    user.value = null
    encKey.value = null
    await db.appState.bulkDelete(['auth_token', 'last_synced_at', 'enc_key'])
  }

  const updateProfile = async ({ name, email, avatarUrl }) => {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: authHeaders.value,
        body: { name, email, avatarUrl },
      })
      user.value = { ...user.value, ...data }
      return data
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Update failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Change password. Derives old and new encKeys, re-encrypts all notes
   * client-side, and sends the re-encrypted dataset + new authKey hash
   * to the server atomically.
   *
   * `onProgress(current, total)` is called during re-encryption so the
   * UI can display a progress bar.
   *
   * On success the session is invalidated and the user must log in again.
   */
  const changePassword = async (currentPassword, newPassword, notes = [], onProgress = null) => {
    loading.value = true
    error.value = null
    try {
      const { encryptNote, decryptNote } = await import('~/utils/crypto.js')

      const oldAuthKey = await deriveAuthKey(currentPassword)
      const newAuthKey = await deriveAuthKey(newPassword)
      const oldEncKey = await deriveEncKey(currentPassword)
      const newEncKey = await deriveEncKey(newPassword)

      // Re-encrypt every note: decrypt with old key, encrypt with new key
      const reEncryptedNotes = []
      for (let i = 0; i < notes.length; i++) {
        const plain = await decryptNote(notes[i], oldEncKey)
        const encrypted = await encryptNote(plain, newEncKey)
        reEncryptedNotes.push(encrypted)
        if (onProgress) onProgress(i + 1, notes.length)
      }

      await apiFetch('/api/auth/password', {
        method: 'PUT',
        headers: authHeaders.value,
        body: {
          currentAuthKey: oldAuthKey,
          newAuthKey,
          reEncryptedNotes,
        },
      })

      // Invalidate session — force re-login
      await logout()
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Password change failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const requestDeletion = async (type, password) => {
    loading.value = true
    error.value = null
    try {
      const authKeyHex = await deriveAuthKey(password)
      const data = await apiFetch('/api/auth/delete', {
        method: 'POST',
        headers: authHeaders.value,
        body: { type, authKey: authKeyHex },
      })
      if (type === 'account') await logout()
      return data
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Deletion failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const refreshUser = async () => {
    if (!token.value) return
    try {
      user.value = await apiFetch('/api/auth/me', { headers: authHeaders.value })
    } catch {
      /* ignore */
    }
  }

  /** Send (or re-send) email verification OTP */
  const sendVerification = async () => {
    loading.value = true
    error.value = null
    try {
      await apiFetch('/api/auth/send-verification', {
        method: 'POST',
        headers: authHeaders.value,
      })
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Failed to send verification email'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Verify email with OTP code */
  const verifyEmail = async (code) => {
    loading.value = true
    error.value = null
    try {
      await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        headers: authHeaders.value,
        body: { code },
      })
      if (user.value) user.value = { ...user.value, emailVerified: true }
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Verification failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Request password recovery OTP (unauthenticated) */
  const forgotPassword = async (email) => {
    loading.value = true
    error.value = null
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
      })
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Failed to send recovery email'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Verify recovery OTP and get recovery token */
  const verifyRecovery = async (email, code) => {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch('/api/auth/verify-recovery', {
        method: 'POST',
        body: { email, code },
      })
      return data.recoveryToken
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Invalid code'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Reset password using recovery token */
  const resetPassword = async (recoveryToken, newPassword) => {
    loading.value = true
    error.value = null
    try {
      const newAuthKey = await deriveAuthKey(newPassword)
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { recoveryToken, newAuthKey },
      })
      await _saveToken(data.token)
      user.value = data.user
      encKey.value = await deriveEncKey(newPassword)
      await _saveEncKey(encKey.value)
      return data
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Password reset failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Toggle password recovery setting */
  const setPasswordRecovery = async (enabled) => {
    loading.value = true
    error.value = null
    try {
      await apiFetch('/api/auth/security', {
        method: 'PUT',
        headers: authHeaders.value,
        body: { passwordRecoveryEnabled: enabled },
      })
      if (user.value) user.value = { ...user.value, passwordRecoveryEnabled: enabled }
    } catch (err) {
      error.value = err.data?.statusMessage || err.message || 'Failed to update setting'
      throw err
    } finally {
      loading.value = false
    }
  }

  onMounted(() => restore())

  return {
    user,
    token,
    loading,
    error,
    isLoggedIn,
    authHeaders,
    encKey,
    wasSessionInvalid,
    register,
    login,
    logout,
    restore,
    updateProfile,
    changePassword,
    requestDeletion,
    refreshUser,
    sendVerification,
    verifyEmail,
    forgotPassword,
    verifyRecovery,
    resetPassword,
    setPasswordRecovery,
  }
}
