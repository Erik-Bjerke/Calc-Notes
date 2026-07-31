<template>
  <div
    class="tree-node group relative flex items-center h-9 cursor-pointer select-none text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors"
    :class="{
      'bg-primary-100/80 dark:bg-primary-500/20 text-gray-900 dark:text-gray-100':
        active && !selectMode,
      'bg-primary-50 dark:bg-primary-900/20': selectMode && selected,
    }"
    :style="{ paddingLeft: indent + 'px', paddingRight: '2px' }"
    :title="note.title || 'Untitled'"
    @click="handleClick"
  >
    <!-- Active row accent bar (VSCode-style) -->
    <span
      v-if="active && !selectMode"
      class="absolute left-0 top-0 bottom-0 w-[2px] bg-primary-500"
    />

    <!-- Select-mode checkbox -->
    <div
      v-if="selectMode"
      class="flex-shrink-0 mr-1 flex items-center justify-center"
      @click.stop="$emit('toggle-select', note.id)"
    >
      <div
        class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
        :class="
          selected
            ? 'bg-primary-600 border-primary-600'
            : 'border-gray-300 dark:border-gray-600'
        "
      >
        <Icon v-if="selected" name="mdi:check" class="w-3 h-3 text-white" />
      </div>
    </div>

    <!-- Empty twisty slot (aligns note icons under folder icons) -->
    <span v-else class="w-4 flex-shrink-0" />

    <!-- File icon -->
    <Icon
      :name="shared ? 'mdi:file-link-outline' : 'mdi:file-document-outline'"
      class="w-4 h-4 flex-shrink-0 mr-1.5"
      :class="shared ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'"
    />

    <!-- Label -->
    <span class="flex-1 min-w-0 truncate text-[13px] leading-none">
      {{ note.title || 'Untitled' }}
    </span>

    <!-- Sync pending dot -->
    <span
      v-if="pending && isLoggedIn"
      class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mx-1"
      title="Not synced"
    />

    <!-- Three-dots menu (reveals on hover / focus) -->
    <div
      v-if="!selectMode"
      class="flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      :class="{ 'opacity-100': menuOpen }"
    >
      <UiDropdown
        ref="menuDropdownRef"
        width="w-48"
        align="right"
        :drop="dropUp ? 'up' : 'down'"
        @open="onMenuOpen"
        @close="menuOpen = false"
      >
        <template #trigger="{ toggle }">
          <UiButton
            variant="ghost"
            color="gray"
            icon-only
            title="Actions"
            class="!p-0.5"
            @click.stop="toggle"
          >
            <Icon name="mdi:dots-horizontal" class="w-4 h-4" />
          </UiButton>
        </template>

            <!-- Bin mode: simplified menu -->
            <template v-if="binMode">
              <UiButton variant="menu-item" @click.stop="handleAction('restore')">
                <Icon name="mdi:restore" class="w-4 h-4" /> Restore
              </UiButton>
              <UiDivider color="medium" />
              <UiButton variant="menu-item" color="red" @click.stop="handleAction('permanent-delete')">
                <Icon name="mdi:delete-forever-outline" class="w-4 h-4" /> Delete permanently
              </UiButton>
            </template>

            <!-- Normal mode: full menu -->
            <template v-else>
              <UiButton variant="menu-item" @click.stop="handleAction('duplicate')">
                <Icon name="mdi:content-duplicate" class="w-4 h-4" /> Duplicate
              </UiButton>
              <UiButton variant="menu-item" @click.stop="handleAction('copy-to-clipboard')">
                <Icon name="mdi:clipboard-text-outline" class="w-4 h-4" /> Copy to clipboard
              </UiButton>
              <UiButton variant="menu-item" @click.stop="handleAction('export')">
                <Icon name="mdi:content-save-outline" class="w-4 h-4" /> Save
              </UiButton>
              <UiButton variant="menu-item" @click.stop="handleAction('print')">
                <Icon name="mdi:printer-outline" class="w-4 h-4" /> Print
              </UiButton>
              <UiDivider color="medium" />
              <UiButton variant="menu-item" @click.stop="handleAction('share')">
                <Icon name="mdi:share-variant-outline" class="w-4 h-4" />
                {{ shared ? 'Sharing details' : 'Share' }}
              </UiButton>
              <UiButton v-if="shared" variant="menu-item" @click.stop="handleCopyLink">
                <Icon :name="copied ? 'mdi:check' : 'mdi:content-copy'" class="w-4 h-4" />
                {{ copied ? 'Copied' : 'Copy link' }}
              </UiButton>
              <UiButton
                v-if="shared"
                variant="menu-item"
                color="red"
                @click.stop="handleAction('unshare')"
              >
                <Icon name="mdi:link-variant-off" class="w-4 h-4" /> Stop sharing
              </UiButton>
              <UiButton
                v-if="analyticsHash"
                variant="menu-item"
                @click.stop="handleAction('analytics')"
              >
                <Icon name="mdi:chart-bar" class="w-4 h-4" /> View analytics
              </UiButton>
              <UiDivider color="medium" />
              <UiButton
                v-if="note.archived"
                variant="menu-item"
                @click.stop="handleAction('unarchive')"
              >
                <Icon name="mdi:package-up" class="w-4 h-4" /> Unarchive
              </UiButton>
              <UiButton v-else variant="menu-item" @click.stop="handleAction('archive')">
                <Icon name="mdi:archive-outline" class="w-4 h-4" /> Archive
              </UiButton>
              <UiButton variant="menu-item" @click.stop="handleAction('properties')">
                <Icon name="mdi:information-outline" class="w-4 h-4" /> Properties
              </UiButton>
              <UiButton variant="menu-item" @click.stop="handleAction('add-to-group')">
                <Icon name="mdi:folder-plus-outline" class="w-4 h-4" /> Add to group
              </UiButton>
              <UiDivider color="medium" />
              <UiButton variant="menu-item" color="red" @click.stop="handleAction('delete')">
                <Icon name="mdi:trash-can-outline" class="w-4 h-4" /> Delete
              </UiButton>
            </template>
          </UiDropdown>
        </div>
  </div>
</template>

<script setup>
const props = defineProps({
  note: { type: Object, required: true },
  active: { type: Boolean, default: false },
  selectMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  shared: { type: Boolean, default: false },
  shareHash: { type: String, default: null },
  analyticsHash: { type: String, default: null },
  pending: { type: Boolean, default: false },
  isLoggedIn: { type: Boolean, default: false },
  binMode: { type: Boolean, default: false },
  indent: { type: Number, default: 8 },
})

const emit = defineEmits([
  'select',
  'delete',
  'toggle-select',
  'share',
  'unshare',
  'properties',
  'open-analytics',
  'duplicate',
  'export',
  'copy-to-clipboard',
  'print',
  'archive',
  'unarchive',
  'add-to-group',
  'restore',
  'permanent-delete',
])

const { copy: clipboardCopy } = useClipboard()
const { apiUrl } = useApi()

const menuDropdownRef = ref(null)
const dropUp = ref(false)
const copied = ref(false)
const menuOpen = ref(false)
const menuId = Math.random().toString(36).slice(2)

const handleClick = () => {
  if (props.selectMode) {
    emit('toggle-select', props.note.id)
  } else {
    emit('select', props.note.id)
  }
}

const onMenuOpen = () => {
  menuOpen.value = true
  document.dispatchEvent(new CustomEvent('close-all-menus', { detail: { sourceId: menuId } }))
  const el = menuDropdownRef.value?.$el
  if (el) {
    const rect = el.getBoundingClientRect()
    dropUp.value = rect.bottom + 360 > window.innerHeight
  }
}

const onCloseAllMenus = (e) => {
  if (e.detail?.sourceId !== menuId) {
    menuDropdownRef.value?.close()
  }
}

const handleAction = (action) => {
  menuDropdownRef.value?.close()
  if (action === 'share') emit('share', props.note.id)
  else if (action === 'unshare') emit('unshare', props.note.id)
  else if (action === 'delete') emit('delete', props.note.id)
  else if (action === 'properties') emit('properties', props.note.id)
  else if (action === 'analytics') emit('open-analytics', props.analyticsHash)
  else if (action === 'duplicate') emit('duplicate', props.note.id)
  else if (action === 'export') emit('export', props.note.id)
  else if (action === 'copy-to-clipboard') emit('copy-to-clipboard', props.note.id)
  else if (action === 'print') emit('print', props.note.id)
  else if (action === 'archive') emit('archive', props.note.id)
  else if (action === 'unarchive') emit('unarchive', props.note.id)
  else if (action === 'add-to-group') emit('add-to-group', props.note.id)
  else if (action === 'restore') emit('restore', props.note.id)
  else if (action === 'permanent-delete') emit('permanent-delete', props.note.id)
}

const handleCopyLink = async () => {
  if (!props.shareHash) return
  await clipboardCopy(apiUrl(`/shared/${props.shareHash}`))
  copied.value = true
  setTimeout(() => {
    copied.value = false
    menuDropdownRef.value?.close()
  }, 1000)
}

onMounted(() => {
  document.addEventListener('close-all-menus', onCloseAllMenus)
})
onBeforeUnmount(() => {
  document.removeEventListener('close-all-menus', onCloseAllMenus)
})
</script>
