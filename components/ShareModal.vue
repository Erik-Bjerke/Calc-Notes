<template>
  <UiModal :show="isOpen" max-width="sm" :fullscreen-mobile="false" panel-class="max-h-[85vh]" @close="$emit('close')">
    <div class="p-4 sm:p-5 overflow-y-auto overflow-x-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-400 leading-none">
          Share Note
        </h2>
        <UiButton variant="ghost" color="gray" icon-only @click="$emit('close')">
          <Icon name="mdi:close" class="block w-5 h-5" />
        </UiButton>
      </div>

      <!-- Already shared / just shared state -->
      <div v-if="activeHash" class="space-y-3">
        <p class="text-sm text-gray-700 dark:text-gray-400">
          <template v-if="shareMode === 'collaborative'">
            Your note is shared for collaborative editing. Anyone with this link can edit it in real
            time:
          </template>
          <template v-else> Your note is shared. Anyone with this link can view it: </template>
        </p>
        <div class="flex items-center gap-2">
          <UiInput :model-value="activeShareUrl" readonly :validate="false" />
          <UiButton icon-only class="flex-shrink-0" @click="copyLink">
            <Icon :name="copied ? 'mdi:check' : 'mdi:content-copy'" class="w-4 h-4 block" />
          </UiButton>
        </div>

        <!-- Password hint for password-protected shares -->
        <p
          v-if="usedSharePassword && sharePasswordMode === 'custom'"
          class="text-xs text-amber-600 dark:text-amber-400"
        >
          <Icon name="mdi:lock-outline" class="w-3 h-3 inline" />
          This note is password-protected. Share the password separately with the recipient.
        </p>

        <!-- Analytics link -->
        <UiButton
          variant="ghost"
          color="primary"
          size="sm"
          block
          @click="$emit('open-analytics', activeHash)"
        >
          <Icon name="mdi:chart-bar" class="w-4 h-4" />
          View analytics
        </UiButton>

        <!-- Owner settings — change lifecycle after sharing -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-400">Sharing settings</p>

          <UiAlert v-if="settingsError" color="red">{{ settingsError }}</UiAlert>

          <!-- Expiry: off by default for collaborative; owner opts in -->
          <label class="flex items-center gap-2 cursor-pointer">
            <UiCheckbox v-model="manageExpires" />
            <span class="text-sm text-gray-700 dark:text-gray-400">Set an expiry</span>
          </label>
          <UiSelect
            v-if="manageExpires"
            v-model="manageExpiresDays"
            :options="[
              { value: 1, label: '1 day' },
              { value: 7, label: '7 days' },
              { value: 14, label: '14 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
            ]"
          />
          <p v-else class="text-xs text-gray-400 dark:text-gray-600">
            This note stays shared until you stop it.
          </p>

          <!-- Mode switch (owner) -->
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">Mode</label>
            <div class="flex gap-2">
              <UiButton
                variant="outline"
                size="xs"
                class="flex-1"
                :loading="switchingMode === 'read-only'"
                :class="
                  manageMode === 'read-only'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                "
                @click="switchMode('read-only')"
              >
                <Icon name="mdi:eye-outline" class="w-3 h-3 inline" /> Read-only
              </UiButton>
              <UiButton
                variant="outline"
                size="xs"
                class="flex-1"
                :loading="switchingMode === 'collaborative'"
                :class="
                  manageMode === 'collaborative'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                "
                @click="switchMode('collaborative')"
              >
                <Icon name="mdi:account-group-outline" class="w-3 h-3 inline" /> Collaborative
              </UiButton>
            </div>
            <p v-if="modeSwitched" class="text-xs text-green-600 dark:text-green-400">
              <Icon name="mdi:check" class="w-3 h-3 inline" /> Mode changed.
            </p>
          </div>

          <!-- Allow guests (collaborative only) -->
          <label
            v-if="manageMode === 'collaborative'"
            class="flex items-center gap-2 cursor-pointer"
          >
            <UiCheckbox v-model="manageAllowGuests" />
            <span class="text-sm text-gray-700 dark:text-gray-400">
              Allow guests without an account
            </span>
          </label>

          <!-- Access model (collaborative, signed-in owner) -->
          <template v-if="manageMode === 'collaborative' && isLoggedIn">
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">
                Who can access
              </label>
              <div class="flex gap-2">
                <UiButton
                  variant="outline"
                  size="xs"
                  class="flex-1"
                  :class="accessBtnClass('public')"
                  @click="manageAccess = 'public'"
                >
                  <Icon name="mdi:link-variant" class="w-3 h-3 inline" /> Anyone with link
                </UiButton>
                <UiButton
                  variant="outline"
                  size="xs"
                  class="flex-1"
                  :class="accessBtnClass('private')"
                  @click="manageAccess = 'private'"
                >
                  <Icon name="mdi:account-lock-outline" class="w-3 h-3 inline" /> Specific people
                </UiButton>
              </div>
            </div>

            <!-- Participants -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">
                People with access
              </label>
              <UiAlert v-if="memberError" color="red">{{ memberError }}</UiAlert>
              <ul v-if="members.length" class="space-y-1">
                <li v-for="m in members" :key="m.id" class="flex items-center gap-2 text-sm">
                  <span
                    class="flex-1 truncate"
                    :class="
                      m.status === 'revoked'
                        ? 'line-through text-gray-400 dark:text-gray-600'
                        : 'text-gray-700 dark:text-gray-400'
                    "
                  >
                    {{ m.name || m.email }}
                  </span>
                  <UiSelect
                    :model-value="m.role"
                    class="w-24"
                    :options="[
                      { value: 'editor', label: 'Editor' },
                      { value: 'viewer', label: 'Viewer' },
                    ]"
                    @update:model-value="(r) => setMemberRole(m, r)"
                  />
                  <UiButton icon-only variant="ghost" color="red" size="xs" @click="kickMember(m)">
                    <Icon name="mdi:close" class="w-4 h-4 block" />
                  </UiButton>
                </li>
              </ul>
              <p v-else class="text-xs text-gray-400 dark:text-gray-600">No one added yet.</p>

              <div class="flex gap-2">
                <UiInput
                  v-model="newMemberEmail"
                  type="email"
                  placeholder="Add by account email"
                  :validate="false"
                  class="flex-1"
                />
                <UiButton
                  size="sm"
                  :loading="addingMember"
                  :disabled="!newMemberEmail"
                  @click="addMember"
                >
                  Add
                </UiButton>
              </div>
            </div>
          </template>

          <UiButton size="sm" variant="outline" block :loading="savingSettings" @click="saveSettings">
            <Icon name="mdi:content-save-outline" class="w-4 h-4" />
            Save settings
          </UiButton>
          <p v-if="settingsSaved" class="text-xs text-green-600 dark:text-green-400">
            <Icon name="mdi:check" class="w-3 h-3 inline" /> Settings updated.
          </p>
        </div>

        <div class="flex gap-2">
          <UiButton variant="solid" color="gray" class="flex-1" @click="$emit('close')">
            Done
          </UiButton>
          <UiButton variant="ghost" color="red" class="flex-1" @click="handleUnshare">
            Stop sharing
          </UiButton>
        </div>
      </div>

      <!-- Share form -->
      <div v-else class="space-y-3">
        <p class="text-xs text-gray-500 dark:text-gray-500">
          No account needed. Share with a unique link.
        </p>

        <!-- Error -->
        <UiAlert v-if="error" color="red">{{ error }}</UiAlert>

        <!-- Sharing mode: read-only vs collaborative -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">
            Sharing mode
          </label>
          <div class="flex gap-2">
            <UiButton
              variant="outline"
              size="xs"
              class="flex-1"
              :class="
                shareMode === 'read-only'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
              @click="shareMode = 'read-only'"
            >
              <Icon name="mdi:eye-outline" class="w-3 h-3 inline" /> Read-only
            </UiButton>
            <UiButton
              variant="outline"
              size="xs"
              class="flex-1"
              :class="
                shareMode === 'collaborative'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
              @click="shareMode = 'collaborative'"
            >
              <Icon name="mdi:account-group-outline" class="w-3 h-3 inline" /> Collaborative
            </UiButton>
          </div>
          <p v-if="shareMode === 'collaborative'" class="text-xs text-amber-600 dark:text-amber-400">
            <Icon name="mdi:information-outline" class="w-3 h-3 inline" />
            Everyone with the link can edit in real time. Collaborative content is visible to the
            server (not end-to-end encrypted).
          </p>
        </div>

        <!-- Guest access (collaborative only) -->
        <label
          v-if="shareMode === 'collaborative'"
          class="flex items-center gap-2 cursor-pointer"
        >
          <UiCheckbox v-model="allowGuests" />
          <span class="text-sm text-gray-700 dark:text-gray-400">
            Allow guests without an account
          </span>
        </label>

        <!-- Access model + invites (collaborative, signed-in owner) -->
        <template v-if="shareMode === 'collaborative' && isLoggedIn">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">
              Who can access
            </label>
            <div class="flex gap-2">
              <UiButton
                variant="outline"
                size="xs"
                class="flex-1"
                :class="preAccessBtnClass('public')"
                @click="preAccess = 'public'"
              >
                <Icon name="mdi:link-variant" class="w-3 h-3 inline" /> Anyone with link
              </UiButton>
              <UiButton
                variant="outline"
                size="xs"
                class="flex-1"
                :class="preAccessBtnClass('private')"
                @click="preAccess = 'private'"
              >
                <Icon name="mdi:account-lock-outline" class="w-3 h-3 inline" /> Specific people
              </UiButton>
            </div>
          </div>

          <!-- Invite accounts (queued, applied when the note is shared) -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">
              Invite people
            </label>
            <UiAlert v-if="inviteError" color="red">{{ inviteError }}</UiAlert>
            <ul v-if="pendingInvites.length" class="space-y-1">
              <li
                v-for="email in pendingInvites"
                :key="email"
                class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-400"
              >
                <Icon name="mdi:account-outline" class="w-4 h-4 flex-shrink-0" />
                <span class="flex-1 truncate">{{ email }}</span>
                <UiButton
                  icon-only
                  variant="ghost"
                  color="red"
                  size="xs"
                  @click="removePendingInvite(email)"
                >
                  <Icon name="mdi:close" class="w-4 h-4 block" />
                </UiButton>
              </li>
            </ul>
            <div class="flex gap-2">
              <UiInput
                v-model="preInviteEmail"
                type="email"
                placeholder="Add by account email"
                :validate="false"
                class="flex-1"
                @keyup.enter="addPendingInvite"
              />
              <UiButton size="sm" :disabled="!preInviteEmail" @click="addPendingInvite">Add</UiButton>
            </div>
          </div>
        </template>

        <!-- Anonymous toggle -->
        <label class="flex items-center gap-2 cursor-pointer">
          <UiCheckbox v-model="anonymous" />
          <span class="text-sm text-gray-700 dark:text-gray-400">Share anonymously</span>
        </label>

        <!-- Sharer details (if not logged in and not anonymous) -->
        <template v-if="!isLoggedIn && !anonymous">
          <UiFormField label="Your name">
            <UiInput v-model="sharerName" type="text" placeholder="Optional" :validate="false" />
          </UiFormField>
          <UiFormField label="Your email">
            <UiInput v-model="sharerEmail" type="email" placeholder="Optional" />
          </UiFormField>
        </template>

        <!-- Logged in but not anonymous: show who it'll be shared as -->
        <p v-if="isLoggedIn && !anonymous" class="text-xs text-gray-500 dark:text-gray-500">
          Shared as {{ userName || userEmail }}
        </p>

        <!-- Share password mode (read-only shares only; collaborative content
             must be readable by the sync service) -->
        <div v-if="shareMode === 'read-only'" class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-400"
            >Encryption</label
          >
          <div class="flex gap-2">
            <UiButton
              variant="outline"
              size="xs"
              class="flex-1"
              :class="
                sharePasswordMode === 'none'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
              @click="sharePasswordMode = 'none'"
            >
              Link only
            </UiButton>
            <UiButton
              variant="outline"
              size="xs"
              class="flex-1"
              :class="
                sharePasswordMode === 'custom'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
              @click="sharePasswordMode = 'custom'"
            >
              <Icon name="mdi:lock-outline" class="w-3 h-3 inline" /> Password
            </UiButton>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-600">
            <template v-if="sharePasswordMode === 'custom'">
              Recipient needs this password to view the note. Share it separately.
            </template>
            <template v-else>
              <!-- Passwordless sharing: key is embedded in the URL. Encrypted in transit
                         but the server can see the key in the URL query parameter.
                         This provides light obfuscation, not confidentiality against the server. -->
              A random key is embedded in the link. Encrypted in transit but not hidden from the
              server.
            </template>
          </p>
        </div>

        <!-- Custom password input -->
        <div v-if="shareMode === 'read-only' && sharePasswordMode === 'custom'" class="space-y-2">
          <UiFormField label="Share password">
            <UiInput
              v-model="sharePassword"
              type="password"
              placeholder="Enter a password for this share"
              :validate="false"
            />
          </UiFormField>
          <UiFormField label="Password hint" optional>
            <UiInput
              v-model="passwordHint"
              type="text"
              :maxlength="255"
              :validate="false"
              placeholder="A hint to help the recipient remember the password"
            />
          </UiFormField>
        </div>

        <!-- Expiration — read-only shares always expire (1–30 days); a
             collaborative note stays shared until stopped unless you opt in. -->
        <UiFormField v-if="shareMode === 'read-only'" label="Expires after">
          <UiSelect
            v-model="expiresInDays"
            :options="[
              { value: 1, label: '1 day' },
              { value: 7, label: '7 days' },
              { value: 14, label: '14 days' },
              { value: 30, label: '30 days' },
            ]"
          />
        </UiFormField>
        <div v-else class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <UiCheckbox v-model="preExpires" />
            <span class="text-sm text-gray-700 dark:text-gray-400">Set an expiry</span>
          </label>
          <UiSelect
            v-if="preExpires"
            v-model="preExpiresDays"
            :options="[
              { value: 1, label: '1 day' },
              { value: 7, label: '7 days' },
              { value: 14, label: '14 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
            ]"
          />
          <p v-else class="text-xs text-gray-400 dark:text-gray-600">
            Stays shared until you stop it.
          </p>
        </div>

        <!-- Analytics toggle with tooltip -->
        <div class="relative">
          <label class="flex items-center gap-2 cursor-pointer">
            <UiCheckbox v-model="collectAnalytics" />
            <span class="text-sm text-gray-700 dark:text-gray-400">Enable view analytics</span>
            <UiTooltip width="w-56 sm:w-64">
              <Icon name="mdi:information-outline" class="w-4 h-4 text-gray-400 cursor-help" />
              <template #content>
                <p class="font-medium mb-1">View Analytics</p>
                <p>
                  When enabled, the following data is collected each time someone opens or imports
                  your shared note:
                </p>
                <ul class="list-disc pl-3 mt-1 space-y-0.5">
                  <li>View and import counts</li>
                  <li>Viewer's display name (if signed in and they allow tracking)</li>
                  <li>Device, OS, and browser info via user agent</li>
                  <li>IP address and referrer URL</li>
                  <li>Language preferences (Accept-Language)</li>
                  <li>Browser client hints (Sec-CH-UA)</li>
                  <li>Do Not Track (DNT) preference</li>
                  <li>Timestamp of each event</li>
                </ul>
                <p class="mt-1.5 text-gray-300">
                  Emails are never collected. Signed-in users with privacy protection will appear as
                  "Unknown" with no device or IP data. Analytics persist even after you stop
                  sharing.
                </p>
              </template>
            </UiTooltip>
          </label>
        </div>

        <UiButton
          block
          :loading="sharing"
          :disabled="sharePasswordMode === 'custom' && !sharePassword"
          @click="handleShare"
        >
          <Icon name="mdi:share-variant-outline" class="w-4 h-4" />
          Share Note
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup>
import { encryptSharedNote, deriveShareKey, generateSharePassword } from '~/utils/crypto.js'
import db from '~/db.js'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  note: { type: Object, default: null },
  isLoggedIn: { type: Boolean, default: false },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  authHeaders: { type: Object, default: () => ({}) },
  existingHash: { type: String, default: null },
})

const emit = defineEmits(['close', 'unshare', 'open-analytics', 'collab-changed'])

const { copy: clipboardCopy } = useClipboard()
const { apiFetch, apiUrl } = useApi()

const { collabWsUrl } = useCollabConfig()

const anonymous = ref(false)
const sharerName = ref('')
const sharerEmail = ref('')
const expiresInDays = ref(7)
const collectAnalytics = ref(false)
// Sharing mode: 'read-only' (static, E2E-encrypted snapshot) or 'collaborative'
// (real-time co-editing via an Automerge document the sync service can read).
const shareMode = ref('read-only')
const allowGuests = ref(true)
// Pre-share collaborative options (configurable BEFORE the share is created).
const preAccess = ref('public')
const preExpires = ref(false) // collaborative: no expiry by default
const preExpiresDays = ref(30)
const pendingInvites = ref([])
const preInviteEmail = ref('')
const inviteError = ref(null)
const sharing = ref(false)
const error = ref(null)
const newShareHash = ref(null)
const copied = ref(false)

// Encryption mode for shared notes
const sharePasswordMode = ref('none') // 'none' = passwordless (random key in URL), 'custom' = user-set password
const sharePassword = ref('')
const passwordHint = ref('')
const usedSharePassword = ref(false)

// ── Owner settings (manage an existing share's lifecycle) ────────────────
const manageMode = ref('read-only')
const manageAllowGuests = ref(true)
const manageAccess = ref('public')
const manageExpires = ref(false)
const manageExpiresDays = ref(30)
const savingSettings = ref(false)
const settingsError = ref(null)
const settingsSaved = ref(false)
const switchingMode = ref(null)
const modeSwitched = ref(false)

// Participants (collaborative shares)
const members = ref([])
const memberError = ref(null)
const newMemberEmail = ref('')
const addingMember = ref(false)

const accessBtnClass = (val) =>
  manageAccess.value === val
    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'

const activeHash = computed(() => newShareHash.value || props.existingHash)

const activeShareUrl = computed(() => {
  if (!activeHash.value) return ''
  let url = apiUrl(`/shared/${activeHash.value}`)
  // For passwordless shares, include the key in the URL
  if (sharePassword.value && sharePasswordMode.value === 'none') {
    url += `?key=${encodeURIComponent(sharePassword.value)}`
  }
  return url
})

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      anonymous.value = false
      sharerName.value = ''
      sharerEmail.value = ''
      expiresInDays.value = 7
      collectAnalytics.value = false
      sharing.value = false
      error.value = null
      newShareHash.value = null
      copied.value = false
      sharePasswordMode.value = 'none'
      sharePassword.value = ''
      passwordHint.value = ''
      usedSharePassword.value = false
      shareMode.value = 'read-only'
      allowGuests.value = true
      preAccess.value = 'public'
      preExpires.value = false
      preExpiresDays.value = 30
      pendingInvites.value = []
      preInviteEmail.value = ''
      inviteError.value = null
    }
  },
)

const preAccessBtnClass = (val) =>
  preAccess.value === val
    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'

/** Queue an email to invite once the collaborative share is created. */
const addPendingInvite = () => {
  const email = preInviteEmail.value.trim().toLowerCase()
  inviteError.value = null
  if (!email) return
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    inviteError.value = 'Enter a valid email address'
    return
  }
  if (!pendingInvites.value.includes(email)) pendingInvites.value.push(email)
  preInviteEmail.value = ''
}

const removePendingInvite = (email) => {
  pendingInvites.value = pendingInvites.value.filter((e) => e !== email)
}

const handleShare = async () => {
  if (!props.note) return
  if (shareMode.value === 'collaborative') {
    return handleShareCollaborative()
  }
  sharing.value = true
  error.value = null

  try {
    // Determine the share password
    let effectivePassword
    if (sharePasswordMode.value === 'custom') {
      effectivePassword = sharePassword.value
    } else {
      // Passwordless sharing: generate a random password.
      // The key is appended to the URL as a query parameter.
      // The encryption/decryption flow is identical to password-protected sharing,
      // but since the password travels in the URL, the server can see it.
      // The intent here is light obfuscation in transit, NOT security against
      // a server-side observer.
      effectivePassword = generateSharePassword()
    }

    // Derive the share encryption key (independent from user's personal encKey)
    const shareKey = await deriveShareKey(effectivePassword)

    // Encrypt the note data with the share key
    const noteData = {
      title: props.note.title,
      description: props.note.description,
      tags: props.note.tags,
      content: props.note.content,
    }
    const encryptedData = await encryptSharedNote(noteData, shareKey)

    const body = {
      title: encryptedData.title,
      description: encryptedData.description,
      tags: encryptedData.tags,
      content: encryptedData.content,
      encrypted: true,
      anonymous: anonymous.value,
      expiresInDays: expiresInDays.value,
      collectAnalytics: collectAnalytics.value,
      sourceClientId: props.note.id,
      passwordHint:
        sharePasswordMode.value === 'custom' && passwordHint.value ? passwordHint.value : undefined,
    }

    if (!props.isLoggedIn && !anonymous.value) {
      body.sharerName = sharerName.value || undefined
      body.sharerEmail = sharerEmail.value || undefined
    }

    const data = await apiFetch('/api/share', {
      method: 'POST',
      headers: props.authHeaders,
      body,
    })

    newShareHash.value = data.hash
    usedSharePassword.value = sharePasswordMode.value === 'custom'

    // Store the delete token locally so anonymous users can stop sharing later
    if (data.deleteToken) {
      try {
        await db.shareTokens.put({
          hash: data.hash,
          token: data.deleteToken,
          noteId: props.note.id,
          collectAnalytics: collectAnalytics.value,
        })
      } catch {
        /* db unavailable */
      }
    }

    // For passwordless sharing, append the random password to the URL
    // so the recipient can derive the decryption key from it.
    if (sharePasswordMode.value === 'none') {
      // Store the password so the URL includes it
      sharePassword.value = effectivePassword
    }
  } catch (err) {
    error.value = err.data?.statusMessage || err.message || 'Failed to share'
  } finally {
    sharing.value = false
  }
}

/**
 * Create a collaborative share: seed an Automerge document from the note's
 * current body, register the share as collaborative, then connect the owner to
 * the sync service so their edits propagate. Collaborative content is NOT
 * end-to-end encrypted — the sync service must read it to merge changes.
 */
const handleShareCollaborative = async () => {
  sharing.value = true
  error.value = null
  try {
    // Lazily load the collaboration module (Automerge + WASM) only when a user
    // actually creates a collaborative share, keeping it out of app startup.
    const { createCollabDoc, connectCollabNetwork } = await import('~/utils/collab.js')
    const handle = await createCollabDoc(props.note.content || '')
    const automergeUrl = handle.url

    const body = {
      title: props.note.title,
      description: props.note.description,
      tags: props.note.tags,
      content: props.note.content,
      encrypted: false,
      anonymous: anonymous.value,
      // Collaborative notes don't expire unless the owner opts in.
      expiresInDays: preExpires.value ? preExpiresDays.value : null,
      collectAnalytics: collectAnalytics.value,
      sourceClientId: props.note.id,
      mode: 'collaborative',
      allowGuests: allowGuests.value,
      access: props.isLoggedIn ? preAccess.value : 'public',
      automergeUrl,
    }
    if (!props.isLoggedIn && !anonymous.value) {
      body.sharerName = sharerName.value || undefined
      body.sharerEmail = sharerEmail.value || undefined
    }

    const data = await apiFetch('/api/share', { method: 'POST', headers: props.authHeaders, body })
    newShareHash.value = data.hash

    // Apply any queued invites now that the share exists (owner only).
    if (props.isLoggedIn && pendingInvites.value.length) {
      for (const email of pendingInvites.value) {
        try {
          await apiFetch(`/api/share/${data.hash}/members`, {
            method: 'POST',
            headers: props.authHeaders,
            body: { email, role: 'editor' },
          })
        } catch {
          /* skip an individual invite that fails (e.g. no such account) */
        }
      }
      // Reflect them in the post-share settings panel.
      manageAccess.value = preAccess.value
      loadMembers()
    }

    // Remember the note ↔ collaborative document mapping so the main editor can
    // bind to the live CRDT (see Task 10 reconciliation).
    try {
      await db.collabDocs.put({
        noteId: props.note.id,
        hash: data.hash,
        automergeUrl,
        collabToken: data.collabToken || null,
      })
    } catch {
      /* db unavailable */
    }

    // Connect the owner to the sync service so the document is published and
    // the owner's future edits are shared in real time.
    if (data.collabToken) {
      try {
        await connectCollabNetwork(collabWsUrl(), data.collabToken)
      } catch {
        /* network attach best-effort; offline edits sync on reconnect */
      }
    }

    // Tell the page the note just became collaborative so the open editor binds
    // to the live document immediately (no need to switch notes and back).
    emit('collab-changed')

    if (data.deleteToken) {
      try {
        await db.shareTokens.put({
          hash: data.hash,
          token: data.deleteToken,
          noteId: props.note.id,
          collectAnalytics: collectAnalytics.value,
        })
      } catch {
        /* db unavailable */
      }
    }
  } catch (err) {
    error.value = err.data?.statusMessage || err.message || 'Failed to share'
  } finally {
    sharing.value = false
  }
}

const handleUnshare = async () => {
  const hash = activeHash.value
  if (!hash) return
  try {
    // If not logged in, use the stored delete token as a query param
    let tokenParam = ''
    if (!props.isLoggedIn) {
      try {
        const record = await db.shareTokens.get(hash)
        if (record?.token) {
          tokenParam = `?_token=${encodeURIComponent(record.token)}`
        }
      } catch {
        /* db unavailable */
      }
    }

    await apiFetch(`/api/share/${hash}${tokenParam}`, {
      method: 'DELETE',
      headers: props.authHeaders,
    })

    // Clean up stored delete token + any collaborative mapping
    try {
      await db.shareTokens.delete(hash)
      await db.collabDocs.where('hash').equals(hash).delete()
    } catch {
      /* db unavailable */
    }

    emit('unshare')
    emit('close')
  } catch (err) {
    error.value = err.data?.statusMessage || err.message || 'Failed to stop sharing'
  }
}

const copyLink = async () => {
  await clipboardCopy(activeShareUrl.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

/** Load the current settings of the active share to populate the panel. */
const loadSettings = async () => {
  const hash = activeHash.value
  if (!hash) return
  try {
    const data = await apiFetch(`/api/share/${hash}`, { headers: props.authHeaders })
    manageMode.value = data.mode || 'read-only'
    manageAllowGuests.value = data.allowGuests === true
    manageAccess.value = data.access === 'private' ? 'private' : 'public'
    manageExpires.value = !!data.expiresAt
    if (manageMode.value === 'collaborative' && props.isLoggedIn) loadMembers()
  } catch {
    /* leave defaults on failure */
  }
}

/** Load the share's participant list (owner, collaborative shares). */
const loadMembers = async () => {
  const hash = activeHash.value
  if (!hash || !props.isLoggedIn) return
  try {
    members.value = await apiFetch(`/api/share/${hash}/members`, { headers: props.authHeaders })
  } catch {
    members.value = []
  }
}

/** Add (or re-add) an account to the allowlist by email. */
const addMember = async () => {
  const hash = activeHash.value
  if (!hash || !newMemberEmail.value) return
  addingMember.value = true
  memberError.value = null
  try {
    await apiFetch(`/api/share/${hash}/members`, {
      method: 'POST',
      headers: props.authHeaders,
      body: { email: newMemberEmail.value, role: 'editor' },
    })
    newMemberEmail.value = ''
    await loadMembers()
  } catch (err) {
    memberError.value = err.data?.statusMessage || err.message || 'Failed to add member'
  } finally {
    addingMember.value = false
  }
}

/** Change a member's role (re-uses the upsert POST by email). */
const setMemberRole = async (member, role) => {
  const hash = activeHash.value
  if (!hash || !member.email || role === member.role) return
  memberError.value = null
  try {
    await apiFetch(`/api/share/${hash}/members`, {
      method: 'POST',
      headers: props.authHeaders,
      body: { email: member.email, role },
    })
    await loadMembers()
  } catch (err) {
    memberError.value = err.data?.statusMessage || err.message || 'Failed to update role'
  }
}

/** Revoke (kick) a member. */
const kickMember = async (member) => {
  const hash = activeHash.value
  if (!hash) return
  memberError.value = null
  try {
    await apiFetch(`/api/share/${hash}/members/${member.id}`, {
      method: 'DELETE',
      headers: props.authHeaders,
    })
    await loadMembers()
  } catch (err) {
    memberError.value = err.data?.statusMessage || err.message || 'Failed to remove member'
  }
}

/** Persist changed settings to the share via PATCH (owner or delete-token). */
const saveSettings = async () => {
  const hash = activeHash.value
  if (!hash) return
  savingSettings.value = true
  settingsError.value = null
  settingsSaved.value = false
  try {
    // Anonymous owners authorise via their stored delete token.
    let tokenParam = ''
    if (!props.isLoggedIn) {
      const record = await db.shareTokens.get(hash).catch(() => null)
      if (record?.token) tokenParam = `?_token=${encodeURIComponent(record.token)}`
    }
    await apiFetch(`/api/share/${hash}${tokenParam}`, {
      method: 'PATCH',
      headers: props.authHeaders,
      body: {
        allowGuests: manageAllowGuests.value,
        access: manageAccess.value,
        expiresInDays: manageExpires.value ? manageExpiresDays.value : null,
      },
    })
    settingsSaved.value = true
    setTimeout(() => {
      settingsSaved.value = false
    }, 2500)
  } catch (err) {
    settingsError.value = err.data?.statusMessage || err.message || 'Failed to update settings'
  } finally {
    savingSettings.value = false
  }
}

/**
 * Switch an existing share between read-only and collaborative.
 *  - to collaborative: create an Automerge document seeded from the note's
 *    current content (client-side; the server can't build a CRDT), then PATCH
 *    the share with its url and store the local mapping so the editor binds.
 *  - to read-only: freeze the current content as the static snapshot, drop the
 *    local collaborative mapping, and let the PATCH boot the live room.
 * The bound editor re-binds when the note is reopened (hence the hint).
 */
const switchMode = async (target) => {
  const hash = activeHash.value
  if (!hash || !props.note || manageMode.value === target || switchingMode.value) return
  switchingMode.value = target
  settingsError.value = null
  modeSwitched.value = false
  try {
    let tokenParam = ''
    if (!props.isLoggedIn) {
      const record = await db.shareTokens.get(hash).catch(() => null)
      if (record?.token) tokenParam = `?_token=${encodeURIComponent(record.token)}`
    }

    if (target === 'collaborative') {
      const { createCollabDoc } = await import('~/utils/collab.js')
      const handle = await createCollabDoc(props.note.content || '')
      await apiFetch(`/api/share/${hash}${tokenParam}`, {
        method: 'PATCH',
        headers: props.authHeaders,
        body: { mode: 'collaborative', automergeUrl: handle.url, access: manageAccess.value },
      })
      await db.collabDocs
        .put({
          noteId: props.note.id,
          hash,
          automergeUrl: handle.url,
          collabToken: null,
          role: 'editor',
        })
        .catch(() => {})
    } else {
      await apiFetch(`/api/share/${hash}${tokenParam}`, {
        method: 'PATCH',
        headers: props.authHeaders,
        body: { mode: 'read-only', content: props.note.content || '' },
      })
      await db.collabDocs.delete(props.note.id).catch(() => {})
    }

    manageMode.value = target
    modeSwitched.value = true
    emit('collab-changed')
  } catch (err) {
    settingsError.value = err.data?.statusMessage || err.message || 'Failed to switch mode'
  } finally {
    switchingMode.value = null
  }
}

// Populate the settings panel whenever a share becomes active (freshly created
// or an existing one opened for management).
watch(activeHash, (hash) => {
  if (hash) loadSettings()
}, { immediate: true })
</script>
