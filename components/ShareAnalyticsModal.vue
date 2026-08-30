<template>
  <UiModal :show="isOpen" max-width="lg" :fullscreen-mobile="false" panel-class="max-h-[85vh]" @close="$emit('close')">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0"
    >
      <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-400 leading-none">
        Share Analytics
      </h2>
      <div class="flex items-center gap-1">
        <UiButton
          :disabled="loading"
          variant="ghost"
          color="gray"
          icon-only
          title="Refresh"
          @click="refresh"
        >
          <Icon name="mdi:refresh" class="block w-5 h-5" :class="{ 'animate-spin': loading }" />
        </UiButton>
        <UiButton variant="ghost" color="gray" icon-only @click="$emit('close')">
          <Icon name="mdi:close" class="block w-5 h-5" />
        </UiButton>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
      <UiButton
        v-for="tab in tabs"
        :key="tab.id"
        variant="ghost"
        class="flex-1 relative"
        :class="
          activeTab === tab.id
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        "
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <div
          v-if="activeTab === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"
        />
      </UiButton>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-5 py-4">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <Icon name="mdi:loading" class="w-6 h-6 text-gray-400 animate-spin" />
      </div>

      <div v-else-if="data && !data.enabled" class="text-center py-12">
        <Icon
          name="mdi:chart-bar"
          class="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2"
        />
        <p class="text-sm text-gray-500 dark:text-gray-500">
          Analytics were not enabled for this share
        </p>
      </div>

      <template v-else-if="data">
        <!-- ═══ Summary Tab ═══ -->
        <div v-if="activeTab === 'summary'" class="space-y-4">
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="
                data.isActive
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              "
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="data.isActive ? 'bg-green-500' : 'bg-gray-400'"
              />
              {{ data.isActive ? 'Active' : 'Unshared' }}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div
              class="px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <p class="text-lg font-semibold text-gray-900 dark:text-gray-200">
                {{ data.totalViews }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">Views</p>
            </div>
            <div
              class="px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <p class="text-lg font-semibold text-gray-900 dark:text-gray-200">
                {{ data.totalImports }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">Imports</p>
            </div>
            <div
              class="px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <p class="text-lg font-semibold text-gray-900 dark:text-gray-200">
                {{ data.uniqueViewers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">Unique visitors</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div
              class="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-200">
                {{ data.knownViewers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">Identified</p>
            </div>
            <div
              class="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-200">
                {{ data.anonymousViewers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">Anonymous / private</p>
            </div>
          </div>

          <!-- Recent activity (deduplicated by visitor) -->
          <div v-if="data.views.length">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">Recent visitors</p>
            <div class="space-y-1">
              <div
                v-for="v in recentUniqueViewers"
                :key="v.fingerprint || v.id"
                class="flex items-center justify-between text-xs py-1.5 px-2 rounded-sm bg-gray-50 dark:bg-gray-900"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <Icon
                    :name="v.eventType === 'import' ? 'mdi:download' : 'mdi:eye-outline'"
                    class="w-3.5 h-3.5 shrink-0"
                    :class="v.eventType === 'import' ? 'text-primary-500' : 'text-gray-400'"
                  />
                  <span class="text-gray-700 dark:text-gray-300 truncate">{{
                    viewerLabel(v)
                  }}</span>
                  <span v-if="v.totalVisits > 1" class="text-gray-400 shrink-0"
                    >({{ v.totalVisits }}x)</span
                  >
                  <span v-if="v.location" class="text-gray-400 truncate hidden sm:inline"
                    >· {{ formatLocation(v.location) }}</span
                  >
                  <span v-else-if="v.parsed" class="text-gray-400 truncate hidden sm:inline"
                    >· {{ v.parsed.summary }}</span
                  >
                </div>
                <span class="text-gray-400 shrink-0 ml-2">{{
                  formatTimeAgo(v.viewedAt)
                }}</span>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6">
            <Icon
              name="mdi:eye-off-outline"
              class="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2"
            />
            <p class="text-sm text-gray-500 dark:text-gray-500">No activity yet</p>
          </div>
        </div>

        <!-- ═══ Details Tab ═══ -->
        <div v-if="activeTab === 'details'" class="space-y-3">
          <!-- Controls -->
          <div class="flex items-center justify-between flex-wrap gap-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <UiCheckbox v-model="showRaw" size="sm" />
              <span class="text-xs text-gray-500 dark:text-gray-500">Show raw data</span>
            </label>
            <div class="flex items-center gap-2">
              <UiButton
                v-if="selectedIds.size > 0"
                variant="ghost"
                color="red"
                size="xs"
                @click="deleteSelected"
              >
                Delete selected ({{ selectedIds.size }})
              </UiButton>
              <UiButton
                v-if="data.totalRecords > 0"
                variant="ghost"
                color="red"
                size="xs"
                @click="deleteAll"
              >
                Delete all
              </UiButton>
            </div>
          </div>

          <!-- Select all on page -->
          <label
            v-if="uniqueDetailViewers.length > 0"
            class="flex items-center gap-2 cursor-pointer px-1"
          >
            <UiCheckbox :checked="allOnPageSelected" size="sm" @change="toggleSelectAll" />
            <span class="text-xs text-gray-500 dark:text-gray-500">Select all on this page</span>
          </label>

          <!-- Event list -->
          <div v-if="uniqueDetailViewers.length" class="space-y-2">
            <div
              v-for="v in uniqueDetailViewers"
              :key="v.id"
              class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900">
                <UiCheckbox
                  :checked="selectedIds.has(v.id)"
                  size="sm"
                  @change="toggleSelect(v.id)"
                />
                <Icon
                  :name="v.eventType === 'import' ? 'mdi:download' : 'mdi:eye-outline'"
                  class="w-4 h-4 shrink-0"
                  :class="v.eventType === 'import' ? 'text-primary-500' : 'text-gray-400'"
                />
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {{ viewerLabel(v) }}
                </span>
                <span
                  v-if="v.totalVisits > 1"
                  class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0"
                >
                  {{ v.totalVisits }} visits
                </span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="
                    v.eventType === 'import'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  "
                >
                  {{ v.eventType }}
                </span>
                <span class="ml-auto text-[10px] text-gray-400 shrink-0">{{
                  formatTimestamp(v.viewedAt)
                }}</span>
              </div>

              <div class="px-3 py-2 space-y-1 text-xs">
                <div
                  v-if="v.parsed"
                  class="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 dark:text-gray-400"
                >
                  <span><span class="text-gray-400">Device:</span> {{ v.parsed.deviceType }}</span>
                  <span
                    ><span class="text-gray-400">OS:</span> {{ v.parsed.os
                    }}{{ v.parsed.osVersion ? ' ' + v.parsed.osVersion : '' }}</span
                  >
                  <span
                    ><span class="text-gray-400">Browser:</span> {{ v.parsed.browser
                    }}{{
                      v.parsed.browserVersion ? ' ' + v.parsed.browserVersion.split('.')[0] : ''
                    }}</span
                  >
                </div>
                <div v-if="v.parsedLang" class="text-gray-600 dark:text-gray-400">
                  <span class="text-gray-400">Language:</span> {{ v.parsedLang.primary }}
                  <span v-if="v.parsedLang.all.length > 1" class="text-gray-400"
                    >(+{{ v.parsedLang.all.length - 1 }} more)</span
                  >
                </div>
                <div v-if="v.parsedSecChUa" class="text-gray-600 dark:text-gray-400">
                  <span class="text-gray-400">Client hints:</span>
                  {{ v.parsedSecChUa.brands.map((b) => b.brand + ' ' + b.version).join(', ') }}
                </div>
                <div v-if="v.raw.dnt" class="text-gray-600 dark:text-gray-400">
                  <span class="text-gray-400">DNT:</span>
                  {{ v.raw.dnt === '1' ? 'Enabled' : 'Disabled' }}
                </div>
                <div v-if="v.raw.referrer" class="text-gray-500 dark:text-gray-500 truncate">
                  <span class="text-gray-400">From:</span> {{ v.raw.referrer }}
                </div>
                <div v-if="v.raw.ip" class="text-gray-500 dark:text-gray-500">
                  <span class="text-gray-400">IP:</span> {{ v.raw.ip }}
                </div>
                <div v-if="v.location" class="text-gray-600 dark:text-gray-400">
                  <span class="text-gray-400">Location:</span> {{ formatLocation(v.location) }}
                </div>
                <div
                  v-if="v.fingerprint"
                  class="text-gray-400 dark:text-gray-600 font-mono text-[10px]"
                >
                  Visitor ID: {{ v.fingerprint }}
                </div>
                <!-- Raw data -->
                <template v-if="showRaw">
                  <div
                    v-if="v.raw.userAgent"
                    class="mt-1 px-2 py-1.5 rounded-sm bg-gray-100 dark:bg-gray-800 font-mono text-[10px] text-gray-500 dark:text-gray-500 break-all"
                  >
                    <span class="text-gray-400">UA:</span> {{ v.raw.userAgent }}
                  </div>
                  <div
                    v-if="v.raw.acceptLanguage"
                    class="px-2 py-1.5 rounded-sm bg-gray-100 dark:bg-gray-800 font-mono text-[10px] text-gray-500 dark:text-gray-500 break-all"
                  >
                    <span class="text-gray-400">Accept-Language:</span> {{ v.raw.acceptLanguage }}
                  </div>
                  <div
                    v-if="v.raw.secChUa"
                    class="px-2 py-1.5 rounded-sm bg-gray-100 dark:bg-gray-800 font-mono text-[10px] text-gray-500 dark:text-gray-500 break-all"
                  >
                    <span class="text-gray-400">Sec-CH-UA:</span> {{ v.raw.secChUa }}
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6">
            <Icon
              name="mdi:database-off-outline"
              class="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2"
            />
            <p class="text-sm text-gray-500 dark:text-gray-500">No data collected yet</p>
          </div>

          <!-- Pagination -->
          <div
            v-if="data.totalPages > 1"
            class="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800"
          >
            <span class="text-xs text-gray-500 dark:text-gray-500">
              Page {{ data.page }} of {{ data.totalPages }} ({{ data.totalRecords }} records)
            </span>
            <div class="flex items-center gap-1">
              <UiButton
                :disabled="data.page <= 1"
                variant="ghost"
                color="gray"
                icon-only
                size="xs"
                @click="goToPage(1)"
              >
                <Icon name="mdi:chevron-double-left" class="w-4 h-4" />
              </UiButton>
              <UiButton
                :disabled="data.page <= 1"
                variant="ghost"
                color="gray"
                icon-only
                size="xs"
                @click="goToPage(data.page - 1)"
              >
                <Icon name="mdi:chevron-left" class="w-4 h-4" />
              </UiButton>
              <UiButton
                :disabled="data.page >= data.totalPages"
                variant="ghost"
                color="gray"
                icon-only
                size="xs"
                @click="goToPage(data.page + 1)"
              >
                <Icon name="mdi:chevron-right" class="w-4 h-4" />
              </UiButton>
              <UiButton
                :disabled="data.page >= data.totalPages"
                variant="ghost"
                color="gray"
                icon-only
                size="xs"
                @click="goToPage(data.totalPages)"
              >
                <Icon name="mdi:chevron-double-right" class="w-4 h-4" />
              </UiButton>
            </div>
          </div>
        </div>
      </template>
    </div>
  </UiModal>

  <UiPrompt
    :show="!!deleteSelectedTarget"
    title="Delete selected records?"
    :body="`Delete ${deleteSelectedTarget || 0} selected record(s)?`"
    icon="mdi:delete-outline"
    confirm-label="Delete"
    confirm-color="red"
    :loading="deleting"
    @close="deleteSelectedTarget = 0"
    @confirm="confirmDeleteSelected"
  />

  <UiPrompt
    :show="showDeleteAllPrompt"
    title="Delete all analytics?"
    body="Delete all analytics data for this share? This cannot be undone."
    icon="mdi:delete-outline"
    confirm-label="Delete All"
    confirm-color="red"
    :loading="deleting"
    @close="showDeleteAllPrompt = false"
    @confirm="confirmDeleteAll"
  />
</template>

<script setup>
import db from '~/db.js'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  hash: { type: String, default: null },
  authHeaders: { type: Object, default: () => ({}) },
})

const _emit = defineEmits(['close'])
const { apiFetch } = useApi()

const ownerToken = ref(null)

const loadOwnerToken = async () => {
  if (!props.hash) return
  try {
    const record = await db.shareTokens.get(props.hash)
    ownerToken.value = record?.token || null
  } catch {
    ownerToken.value = null
  }
}

// Build request headers: use authHeaders if available, otherwise include the
// locally-stored owner/delete token for anonymous share ownership verification.
// Token is passed as a query param (_token) to avoid CORS preflight issues.
const requestHeaders = computed(() => ({ ...props.authHeaders }))

const tokenQueryParam = computed(() => {
  if (props.authHeaders?.Authorization || !ownerToken.value) return ''
  return `&_token=${encodeURIComponent(ownerToken.value)}`
})

const tabs = [
  { id: 'summary', label: 'Summary' },
  { id: 'details', label: 'Details' },
]

const activeTab = ref('summary')
const loading = ref(false)
const data = ref(null)
const showRaw = ref(false)
const selectedIds = ref(new Set())
const currentPage = ref(1)
const deleteSelectedTarget = ref(0)
const showDeleteAllPrompt = ref(false)
const deleting = ref(false)

const allOnPageSelected = computed(() => {
  if (!data.value || !uniqueDetailViewers.value.length) return false
  return uniqueDetailViewers.value.every((v) => selectedIds.value.has(v.id))
})

let autoRefreshTimer = null

watch(
  () => props.isOpen,
  async (open) => {
    if (open && props.hash) {
      activeTab.value = 'summary'
      showRaw.value = false
      selectedIds.value = new Set()
      currentPage.value = 1
      await loadOwnerToken()
      loadData(1)
      startAutoRefresh()
    } else {
      data.value = null
      ownerToken.value = null
      stopAutoRefresh()
    }
  },
)

onBeforeUnmount(() => stopAutoRefresh())

const startAutoRefresh = () => {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(
    () => {
      if (props.isOpen && props.hash) loadData(currentPage.value)
    },
    5 * 60 * 1000,
  )
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

const refresh = () => {
  loadData(currentPage.value)
}

const loadData = async (page = 1) => {
  loading.value = true
  try {
    data.value = await apiFetch(`/api/share/${props.hash}/analytics?page=${page}&limit=20${tokenQueryParam.value}`, {
      headers: requestHeaders.value,
    })
    currentPage.value = data.value.page
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}

const goToPage = (page) => {
  if (!data.value || page < 1 || page > data.value.totalPages) return
  selectedIds.value = new Set()
  loadData(page)
}

// Deduplicate views by fingerprint for the summary tab — show each unique visitor once
const recentUniqueViewers = computed(() => {
  if (!data.value?.views?.length) return []
  const seen = new Set()
  const unique = []
  for (const v of data.value.views) {
    const key = v.fingerprint || v.id
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(v)
      if (unique.length >= 5) break
    }
  }
  return unique
})

// Deduplicate views by fingerprint for the details tab — show each unique visitor once
const uniqueDetailViewers = computed(() => {
  if (!data.value?.views?.length) return []
  const seen = new Set()
  const unique = []
  for (const v of data.value.views) {
    const key = v.fingerprint || v.id
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(v)
    }
  }
  return unique
})

const viewerLabel = (v) => {
  if (v.viewerName) return v.viewerName
  if (v.fingerprint?.startsWith('user:')) return 'User #' + v.fingerprint.split(':')[1]
  if (v.fingerprint?.startsWith('private:')) return 'Private visitor'
  if (v.fingerprint?.startsWith('anon:'))
    return 'Visitor ' + v.fingerprint.split(':')[1].slice(0, 6)
  return 'Unknown'
}

const toggleSelect = (id) => {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

const toggleSelectAll = () => {
  if (allOnPageSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(uniqueDetailViewers.value.map((v) => v.id))
  }
}

const deleteSelected = async () => {
  if (!selectedIds.value.size) return
  deleteSelectedTarget.value = selectedIds.value.size
}

const confirmDeleteSelected = async () => {
  deleting.value = true
  try {
    await apiFetch(`/api/share/${props.hash}/analytics?${tokenQueryParam.value.replace(/^&/, '')}`, {
      method: 'DELETE',
      headers: requestHeaders.value,
      body: { ids: [...selectedIds.value] },
    })
    selectedIds.value = new Set()
    await loadData(currentPage.value)
  } catch {
    /* ignore */
  } finally {
    deleting.value = false
    deleteSelectedTarget.value = 0
  }
}

const deleteAll = async () => {
  showDeleteAllPrompt.value = true
}

const confirmDeleteAll = async () => {
  deleting.value = true
  try {
    await apiFetch(`/api/share/${props.hash}/analytics?${tokenQueryParam.value.replace(/^&/, '')}`, {
      method: 'DELETE',
      headers: requestHeaders.value,
    })
    selectedIds.value = new Set()
    await loadData(1)
  } catch {
    /* ignore */
  } finally {
    deleting.value = false
    showDeleteAllPrompt.value = false
  }
}

const formatLocation = (loc) => {
  if (!loc) return ''
  const parts = [loc.city, loc.region, loc.country].filter(Boolean)
  return parts.join(', ')
}

const formatTimeAgo = (iso) => {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString()
}

const formatTimestamp = (iso) => {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
