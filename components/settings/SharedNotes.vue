<template>
  <div class="p-5 md:p-8">
    <div class="max-w-2xl mx-auto">
      <SettingsSectionHeader icon="mdi:share-variant-outline" title="Shared Notes" description="Manage your shared notes" />
      <div v-if="loading" class="flex items-center justify-center py-8">
        <Icon name="mdi:loading" class="w-6 h-6 text-gray-400 animate-spin" />
      </div>
      <template v-else-if="sharedNotes.length">
        <div class="space-y-2">
          <div v-for="sn in sharedNotes" :key="sn.hash" class="flex items-center gap-2 px-3 py-2.5 rounded-lg border"
            :class="sn.isActive ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-200/50 dark:border-gray-800/50 opacity-60'">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{{ sn.title || 'Untitled' }}</p>
                <span v-if="!sn.isActive" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">unshared</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-500 truncate">
                {{ sn.anonymous ? 'Anonymous' : '' }}{{ sn.anonymous && sn.expiresAt ? ' · ' : '' }}{{ formatExpiry(sn.expiresAt) }}{{ sn.collectAnalytics ? ' · Analytics' : '' }}
              </p>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <UiButton v-if="sn.collectAnalytics" variant="ghost" color="primary" size="xs" icon-only title="View analytics" @click="openAnalytics(sn.hash)"><Icon name="mdi:chart-bar" class="w-4 h-4" /></UiButton>
              <UiButton variant="ghost" color="primary" size="xs" icon-only title="Copy link" @click="copySharedLink(sn.hash)"><Icon :name="copiedHash === sn.hash ? 'mdi:check' : 'mdi:content-copy'" class="w-4 h-4" /></UiButton>
              <UiButton variant="ghost" color="red" size="xs" icon-only :disabled="!sn.isActive" :title="sn.isActive ? 'Stop sharing' : 'Already unshared'" @click="handleUnshare(sn.hash)"><Icon name="mdi:link-variant-off" class="w-4 h-4" /></UiButton>
              <UiButton variant="ghost" color="red" size="xs" icon-only title="Delete permanently" @click="purgeTarget = sn.hash"><Icon name="mdi:delete-outline" class="w-4 h-4" /></UiButton>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="text-center py-8">
        <Icon name="mdi:share-variant-outline" class="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-500">No shared notes</p>
      </div>
    </div>
  </div>

  <UiPrompt
    :show="!!purgeTarget"
    title="Delete shared note?"
    body="Permanently delete this shared note and all its analytics? This cannot be undone."
    icon="mdi:delete-outline"
    confirm-label="Delete"
    confirm-color="red"
    :loading="purging"
    @close="purgeTarget = null"
    @confirm="confirmPurge"
  />
</template>

<script setup>
const props = defineProps({
  authHeaders: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['unshare', 'open-analytics', 'close-modal'])

const toast = useToast()
const { apiFetch, apiUrl } = useApi()
const { copy: clipboardCopy } = useClipboard()

const sharedNotes = ref([])
const loading = ref(false)
const copiedHash = ref(null)
const purgeTarget = ref(null)
const purging = ref(false)

const showFeedback = (msg, type = 'success') => {
  toast.show(msg, { type: type === 'error' ? 'error' : 'success', icon: type === 'error' ? 'mdi:alert-circle-outline' : 'mdi:check-circle-outline' })
}

const formatExpiry = (iso) => {
  if (!iso) return 'No expiry'; const d = new Date(iso); const now = new Date()
  if (d < now) return 'Expired'; const days = Math.ceil((d - now) / 86400000)
  return days === 1 ? '1 day left' : `${days} days left`
}

const loadSharedNotes = async () => {
  loading.value = true
  try {
    if (!props.authHeaders?.Authorization) return
    const notes = await apiFetch('/api/share/my', { headers: props.authHeaders })
    const { default: db } = await import('~/db.js')
    const localNotes = await db.notes.toArray()
    const localMap = new Map(localNotes.map((n) => [n.id, n]))
    sharedNotes.value = notes.map((sn) => {
      const local = sn.sourceClientId ? localMap.get(sn.sourceClientId) : null
      const isEncryptedTitle = sn.title && sn.title.startsWith('{') && sn.title.includes('"iv"')
      return { ...sn, title: isEncryptedTitle && local ? local.title || 'Untitled' : sn.title }
    })
  } catch { sharedNotes.value = [] }
  finally { loading.value = false }
}

const copySharedLink = async (hash) => {
  const url = apiUrl(`/shared/${hash}`)
  await clipboardCopy(url); copiedHash.value = hash
  setTimeout(() => { copiedHash.value = null }, 2000)
}

const handleUnshare = async (hash) => {
  try { await apiFetch(`/api/share/${hash}`, { method: 'DELETE', headers: props.authHeaders }); await loadSharedNotes(); showFeedback('Sharing stopped'); emit('unshare', hash) }
  catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to remove shared note', 'error') }
}

const handlePurge = async (hash) => {
  purging.value = true
  try { await apiFetch(`/api/share/${hash}?purge=true`, { method: 'DELETE', headers: props.authHeaders }); await loadSharedNotes(); showFeedback('Shared note deleted'); emit('unshare', hash) }
  catch (err) { showFeedback(err?.data?.statusMessage || 'Failed to delete shared note', 'error') }
  finally { purging.value = false; purgeTarget.value = null }
}

const confirmPurge = () => {
  if (purgeTarget.value) handlePurge(purgeTarget.value)
}

const openAnalytics = (hash) => {
  emit('open-analytics', hash)
  emit('close-modal')
}

onMounted(() => loadSharedNotes())
</script>
