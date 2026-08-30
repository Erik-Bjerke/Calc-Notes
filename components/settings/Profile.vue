<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div class="p-5 md:p-8">
    <div class="max-w-2xl mx-auto">
      <SettingsSectionHeader icon="mdi:account-circle-outline" title="Profile" description="Your account information" />

      <!-- Profile card -->
      <div class="relative rounded-xl bg-linear-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700/50 px-4 py-5 mb-5">
        <div class="flex items-center gap-4">
          <button type="button" class="relative group shrink-0 rounded-full" title="Change avatar" @click="subSection = 'avatar'">
            <UiAvatar :src="user?.avatarUrl" size="xl" ring />
            <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Icon name="mdi:camera" class="w-4 h-4 text-white" />
            </div>
          </button>
          <div class="flex-1 min-w-0 cursor-pointer" role="button" tabindex="0" title="Edit profile" @click="enterEditProfile" @keydown.enter="enterEditProfile">
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{{ user?.name || 'No name set' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{{ user?.email }}</p>
            <p class="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">Member since {{ user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Quick stats -->
      <div class="grid grid-cols-3 gap-2 mb-5">
        <button type="button" class="group flex flex-col items-center gap-1 px-2 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-primary-300 dark:hover:border-primary-700 transition-colors" @click="emit('show-notes')">
          <Icon name="mdi:note-multiple-outline" class="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
          <p class="text-lg font-semibold text-gray-900 dark:text-gray-200 leading-none">{{ user?.stats?.notesCount ?? '—' }}</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wide">Notes</p>
        </button>
        <button type="button" class="group flex flex-col items-center gap-1 px-2 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-primary-300 dark:hover:border-primary-700 transition-colors" @click="emit('navigate-section', 'shared')">
          <Icon name="mdi:share-variant-outline" class="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
          <p class="text-lg font-semibold text-gray-900 dark:text-gray-200 leading-none">{{ user?.stats?.sharedCount ?? '—' }}</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wide">Shared</p>
        </button>
        <button type="button" class="group flex flex-col items-center gap-1 px-2 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-primary-300 dark:hover:border-primary-700 transition-colors" @click="emit('sync-now')">
          <Icon name="mdi:cloud-sync-outline" class="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-200 leading-snug break-words capitalize">{{ lastSyncedAt ? formatDate(lastSyncedAt) : '—' }}</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wide">Synced</p>
        </button>
      </div>

      <!-- Avatar sub-section -->
      <template v-if="subSection === 'avatar'">
        <UiListMenu label="Change Avatar" preset="settings" class="mb-5">
          <div v-if="!avatarImageSrc" class="text-center space-y-3 py-4 px-4">
            <div class="w-24 h-24 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Icon name="mdi:image-plus" class="w-10 h-10 text-gray-400" />
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Choose an image for your avatar</p>
            <UiFileInput accept="image/*" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg" @select="onFileSelect">
              <Icon name="mdi:upload" class="w-4 h-4" /> Upload Image
            </UiFileInput>
            <UiButton v-if="user?.avatarUrl" variant="ghost" color="red" size="xs" class="block mx-auto mt-2" @click="removeAvatar">Remove current avatar</UiButton>
            <UiButton variant="ghost" color="gray" size="sm" class="block mx-auto mt-1" @click="cancelSubSection">Cancel</UiButton>
          </div>
          <div v-else class="space-y-3 p-4">
            <AvatarEditor :image-source="avatarImageSrc" :canvas-size="editorCanvasSize" @update="onAvatarCropped" />
            <div class="flex gap-2">
              <UiButton variant="solid" color="gray" class="flex-1" @click="avatarImageSrc = null">Choose Different</UiButton>
              <UiButton variant="solid" color="primary" :loading="saving" class="flex-1" @click="saveAvatar">Save Avatar</UiButton>
            </div>
            <UiButton variant="ghost" color="gray" size="sm" block @click="cancelSubSection">Cancel</UiButton>
          </div>
        </UiListMenu>
      </template>

      <!-- Edit profile sub-section -->
      <template v-if="subSection === 'edit'">
        <UiListMenu label="Edit Profile" preset="settings" class="mb-5">
          <div class="space-y-4 p-4">
            <UiFormField label="Name"><UiInput v-model="editName" type="text" placeholder="Your name" :validate="false" /></UiFormField>
            <UiFormField label="Email"><UiInput v-model="editEmail" type="email" placeholder="you@example.com" /></UiFormField>
            <div class="flex gap-2">
              <UiButton variant="outline" color="gray" class="flex-1" @click="cancelSubSection">Cancel</UiButton>
              <UiButton variant="solid" color="primary" class="flex-1" :loading="saving" @click="saveProfile">Save Changes</UiButton>
            </div>
          </div>
        </UiListMenu>
      </template>

      <!-- Password sub-section -->
      <template v-if="subSection === 'password'">
        <UiListMenu label="Change Password" preset="settings" class="mb-5">
          <div class="p-4">
            <p class="text-xs text-gray-500 dark:text-gray-500 mb-3">Changing your password will re-encrypt all your notes. This may take a moment.</p>
            <div class="space-y-4">
              <UiFormField label="Current Password"><UiInput v-model="currentPassword" type="password" :validate="false" /></UiFormField>
              <UiFormField label="New Password" hint="At least 8 characters"><UiInput v-model="newPassword" type="password" :minlength="8" :validate="false" /></UiFormField>
              <div>
                <UiFormField label="Confirm New Password"><UiInput v-model="confirmNewPassword" type="password" :validate="false" /></UiFormField>
                <p v-if="confirmNewPassword && newPassword !== confirmNewPassword" class="text-xs text-red-600 dark:text-red-400 mt-1">Passwords do not match</p>
              </div>
              <UiProgressBar v-if="reEncryptProgress" label="Re-encrypting notes…" show-value :current="reEncryptProgress.current" :total="reEncryptProgress.total" />
              <div class="flex gap-2">
                <UiButton variant="outline" color="gray" class="flex-1" :disabled="saving" @click="cancelSubSection">Cancel</UiButton>
                <UiButton variant="solid" color="primary" class="flex-1" :loading="saving" :disabled="!currentPassword || !newPassword || newPassword !== confirmNewPassword || newPassword.length < 8" @click="savePassword">Update Password</UiButton>
              </div>
            </div>
          </div>
        </UiListMenu>
      </template>

      <!-- Actions (when no sub-section is active) -->
      <template v-if="!subSection">
        <UiListMenu label="Account" preset="settings" class="mb-5">
          <UiListMenuItem icon="mdi:account-edit-outline" clickable @click="enterEditProfile">Edit Profile</UiListMenuItem>
          <UiListMenuItem icon="mdi:lock-outline" clickable @click="subSection = 'password'">Change Password</UiListMenuItem>
        </UiListMenu>
        <UiListMenu label="Privacy" preset="settings">
          <UiListMenuItem icon="mdi:shield-account-outline" :hint="privacyNoTracking ? 'Identity hidden on shared notes' : 'Sharers can see your name & device'" :toggle="privacyNoTracking" :disabled="savingPrivacy" @update:toggle="togglePrivacy">
            Privacy Protection
            <template #suffix><UiToggle :model-value="privacyNoTracking" :disabled="savingPrivacy" size="sm" readonly /></template>
          </UiListMenuItem>
        </UiListMenu>
        <UiListMenu preset="settings" class="mt-5">
          <UiListMenuItem icon="mdi:logout-variant" danger clickable :chevron="false" @click="emit('logout')">Sign out</UiListMenuItem>
        </UiListMenu>
      </template>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  user: { type: Object, default: null },
  lastSyncedAt: { type: String, default: null },
  authHeaders: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update-profile', 'change-password', 'logout', 'sync-now', 'show-notes', 'navigate-section'])

const toast = useToast()
const { apiFetch } = useApi()

const saving = ref(false)
const subSection = ref(null) // 'edit' | 'password' | 'avatar' | null
const editName = ref('')
const editEmail = ref('')
const avatarImageSrc = ref(null)
const croppedAvatarDataUrl = ref(null)
const editorCanvasSize = computed(() => typeof window === 'undefined' ? 220 : Math.min(220, window.innerWidth - 80))
const currentPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const reEncryptProgress = ref(null)
const privacyNoTracking = ref(true)
const savingPrivacy = ref(false)

const showFeedback = (msg, type = 'success') => {
  toast.show(msg, { type: type === 'error' ? 'error' : 'success', icon: type === 'error' ? 'mdi:alert-circle-outline' : 'mdi:check-circle-outline' })
}

const formatDate = (iso) => {
  if (!iso) return 'Never'
  const d = new Date(iso); const now = new Date(); const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

const cancelSubSection = () => {
  avatarImageSrc.value = null
  croppedAvatarDataUrl.value = null
  subSection.value = null
}

const enterEditProfile = () => {
  editName.value = props.user?.name || ''
  editEmail.value = props.user?.email || ''
  subSection.value = 'edit'
}

// Avatar
const onFileSelect = (file) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { avatarImageSrc.value = reader.result }; reader.readAsDataURL(file) }
const onAvatarCropped = (dataUrl) => { croppedAvatarDataUrl.value = dataUrl }

const saveAvatar = async () => {
  if (!croppedAvatarDataUrl.value) return
  saving.value = true
  try { await emit('update-profile', { avatarUrl: croppedAvatarDataUrl.value }); showFeedback('Avatar updated'); avatarImageSrc.value = null; subSection.value = null }
  catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to update avatar', 'error') }
  finally { saving.value = false }
}

const removeAvatar = async () => {
  saving.value = true
  try { await emit('update-profile', { avatarUrl: '' }); showFeedback('Avatar removed'); subSection.value = null }
  catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to remove avatar', 'error') }
  finally { saving.value = false }
}

const saveProfile = async () => {
  saving.value = true
  try { await emit('update-profile', { name: editName.value, email: editEmail.value }); showFeedback('Profile updated'); subSection.value = null }
  catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to update profile', 'error') }
  finally { saving.value = false }
}

const savePassword = async () => {
  saving.value = true; reEncryptProgress.value = null
  try {
    await emit('change-password', { currentPassword: currentPassword.value, newPassword: newPassword.value, onProgress: (current, total) => { reEncryptProgress.value = { current, total } } })
    showFeedback('Password updated. Please log in again.')
    currentPassword.value = ''; newPassword.value = ''; confirmNewPassword.value = ''; subSection.value = null
  } catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to change password', 'error') }
  finally { saving.value = false; reEncryptProgress.value = null }
}

// Privacy
const togglePrivacy = async () => {
  savingPrivacy.value = true; const newVal = !privacyNoTracking.value
  try { await apiFetch('/api/auth/privacy', { method: 'PUT', headers: props.authHeaders, body: { noTracking: newVal } }); privacyNoTracking.value = newVal; showFeedback(newVal ? 'Privacy protection enabled' : 'Privacy protection disabled') }
  catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to update privacy setting', 'error') }
  finally { savingPrivacy.value = false }
}

// Self-initialize from props on mount and when user changes
const initFromUser = () => {
  editName.value = props.user?.name || ''
  editEmail.value = props.user?.email || ''
  avatarImageSrc.value = null
  croppedAvatarDataUrl.value = null
  currentPassword.value = ''
  newPassword.value = ''
  confirmNewPassword.value = ''
  subSection.value = null
  privacyNoTracking.value = props.user?.privacyNoTracking !== false
}

onMounted(initFromUser)
watch(() => props.user, initFromUser)

defineExpose({ subSection })
</script>
