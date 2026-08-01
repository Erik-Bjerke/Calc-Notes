<template>
  <div class="h-screen bg-white dark:bg-gray-925 flex flex-col overflow-hidden">
    <!-- Header -->
    <header
      class="flex-shrink-0 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3"
      :style="{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }"
    >
      <div class="max-w-5xl mx-auto flex items-center justify-between relative">
        <a
          href="/"
          class="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          <Icon name="mdi:arrow-left" class="w-4 h-4" />
          Numori
        </a>
        <ThemeSwitcher />
      </div>
    </header>

    <!-- Loading / importing -->
    <div v-if="loading" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center space-y-3">
        <Icon name="mdi:loading" class="w-8 h-8 text-gray-400 animate-spin mx-auto" />
        <p class="text-sm text-gray-500 dark:text-gray-500">{{ loadingLabel }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center space-y-3">
        <Icon name="mdi:alert-circle-outline" class="w-12 h-12 text-gray-400 mx-auto" />
        <p class="text-gray-700 dark:text-gray-400">{{ error }}</p>
        <a
          href="/"
          class="inline-block px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
        >
          Go to Numori
        </a>
      </div>
    </div>

    <!-- Password prompt for encrypted notes without a key in the URL -->
    <div v-else-if="needsPassword" class="flex-1 flex items-center justify-center px-6">
      <div class="max-w-sm w-full space-y-4 text-center">
        <Icon name="mdi:lock-outline" class="w-12 h-12 text-gray-400 mx-auto" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-200">
          This note is password-protected
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          Enter the password to open this shared note.
        </p>
        <p v-if="passwordHint" class="text-sm text-amber-600 dark:text-amber-400">
          <Icon name="mdi:lightbulb-outline" class="w-3.5 h-3.5 inline" />
          Hint: {{ passwordHint }}
        </p>
        <UiAlert v-if="decryptError" color="red">{{ decryptError }}</UiAlert>
        <UiInput
          v-model="passwordInput"
          type="password"
          placeholder="Share password"
          :validate="false"
          @keyup.enter="decryptWithPassword"
        />
        <UiButton
          :disabled="!passwordInput"
          :loading="decrypting"
          variant="solid"
          color="primary"
          block
          @click="decryptWithPassword"
        >
          <Icon name="mdi:lock-open-outline" class="w-4 h-4" />
          Open
        </UiButton>
      </div>
    </div>

    <!-- Collaborative share that requires an account (guests not allowed / denied) -->
    <div v-else-if="needsAccount" class="flex-1 flex items-center justify-center px-6">
      <div class="max-w-sm w-full space-y-4 text-center">
        <Icon name="mdi:account-lock-outline" class="w-12 h-12 text-gray-400 mx-auto" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-200">
          Sign in to open this note
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          The owner limits this collaborative note to specific accounts. Open Numori, sign in with
          an invited account, then follow this link again.
        </p>
        <a
          href="/"
          class="inline-block px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
        >
          Go to Numori
        </a>
      </div>
    </div>

    <!-- One-time consent before joining a collaborative (server-visible) note -->
    <div v-else-if="needsConsent" class="flex-1 flex items-center justify-center px-6">
      <div class="max-w-sm w-full space-y-4 text-center">
        <Icon name="mdi:account-group-outline" class="w-12 h-12 text-primary-500 mx-auto" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-200">
          Join this collaborative note
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          You'll edit together in real time. Collaborative notes are stored on the server and are
          <strong class="text-amber-600 dark:text-amber-400">not end-to-end encrypted</strong> —
          don't put secrets in them.
        </p>
        <UiButton variant="solid" color="primary" block :loading="importing" @click="acceptConsent">
          <Icon name="mdi:check" class="w-4 h-4" />
          Continue
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { deriveShareKey, decryptSharedNote, isEncrypted } from '~/utils/crypto.js'

const route = useRoute()
const hash = route.params.hash
const { apiFetch } = useApi()
const auth = useAuth()

const loading = ref(true)
const importing = ref(false)
const error = ref(null)

const needsAccount = ref(false)
const needsConsent = ref(false)

// Encryption (read-only shares only)
const rawEncryptedData = ref(null)
const needsPassword = ref(false)
const passwordInput = ref('')
const passwordHint = ref(null)
const decryptError = ref(null)
const decrypting = ref(false)

// The resolved note payload + collab link (once known), pending import.
const resolved = ref(null) // { title, description, tags, content, readOnly, collab? }

const loadingLabel = computed(() => (importing.value ? 'Opening note…' : 'Loading…'))

const CONSENT_KEY = 'numori-collab-consent'
const hasConsented = () => {
  try {
    return globalThis.localStorage?.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}
const setConsented = () => {
  try {
    globalThis.localStorage?.setItem(CONSENT_KEY, '1')
  } catch {
    /* ignore */
  }
}

// Collaborative shares aren't encrypted, so tags arrive as the raw stored value
// (a JSON string). Normalize to an array.
const normalizeTags = (t) => {
  if (Array.isArray(t)) return t
  if (typeof t === 'string' && t.trim()) {
    try {
      const parsed = JSON.parse(t)
      return Array.isArray(parsed) ? parsed : [t]
    } catch {
      return [t]
    }
  }
  return []
}

/** Stash the resolved note as a pending import and hand off to the main app. */
const doImport = async () => {
  if (!resolved.value) return
  importing.value = true
  // Best-effort analytics ping (import event).
  apiFetch(`/api/share/${hash}/import`, { method: 'POST' }).catch(() => {})
  const { default: db } = await import('~/db.js')
  await db.appState.put({
    key: 'pending_import',
    value: JSON.stringify({ ...resolved.value, sourceHash: hash }),
  })
  navigateTo('/')
}

const acceptConsent = async () => {
  setConsented()
  needsConsent.value = false
  await doImport()
}

onMounted(async () => {
  try {
    const headers = auth.authHeaders?.value || {}
    const data = await apiFetch(`/api/share/${hash}`, { headers })

    if (data.mode === 'collaborative') {
      // Guests not allowed / access denied → require sign-in.
      if (data.requiresAccount || data.accessDenied || !data.collabToken || !data.automergeUrl) {
        needsAccount.value = true
        loading.value = false
        return
      }
      resolved.value = {
        title: data.title,
        description: data.description || '',
        tags: normalizeTags(data.tags),
        content: data.content || '',
        readOnly: false,
        collab: {
          hash,
          automergeUrl: data.automergeUrl,
          collabToken: data.collabToken,
          role: data.role || 'editor',
        },
      }
      // First collaborative join shows a one-time not-E2E consent.
      if (hasConsented()) {
        await doImport()
      } else {
        needsConsent.value = true
        loading.value = false
      }
      return
    }

    // Read-only share (static snapshot). May be encrypted.
    if (data.encrypted && isEncrypted(data.content)) {
      const urlKey = route.query.key
      if (urlKey) {
        try {
          const shareKey = await deriveShareKey(urlKey)
          const dec = await decryptSharedNote(data, shareKey)
          resolved.value = {
            title: dec.title,
            description: dec.description,
            tags: dec.tags,
            content: dec.content,
            readOnly: true,
          }
          await doImport()
        } catch {
          error.value = 'Failed to decrypt this shared note. The link may be invalid.'
          loading.value = false
        }
      } else {
        rawEncryptedData.value = data
        passwordHint.value = data.passwordHint || null
        needsPassword.value = true
        loading.value = false
      }
      return
    }

    // Plain read-only share.
    resolved.value = {
      title: data.title,
      description: data.description || '',
      tags: normalizeTags(data.tags),
      content: data.content || '',
      readOnly: true,
    }
    await doImport()
  } catch (err) {
    error.value = err.data?.statusMessage || 'This shared note could not be found.'
    loading.value = false
  }
})

const decryptWithPassword = async () => {
  if (!passwordInput.value || !rawEncryptedData.value) return
  decrypting.value = true
  decryptError.value = null
  try {
    const shareKey = await deriveShareKey(passwordInput.value)
    const dec = await decryptSharedNote(rawEncryptedData.value, shareKey)
    resolved.value = {
      title: dec.title,
      description: dec.description,
      tags: dec.tags,
      content: dec.content,
      readOnly: true,
    }
    needsPassword.value = false
    await doImport()
  } catch {
    decryptError.value = 'Incorrect password. Please try again.'
  } finally {
    decrypting.value = false
  }
}
</script>
