<template>
  <UiDropdown ref="dropdownRef" width="w-56" @close="onClose">
    <template #trigger="{ toggle }">
      <UiButton variant="ghost" color="gray" size="sm" title="File menu" @click="toggle">
        <Icon name="mdi:file-document-outline" class="w-4.5 h-4.5 block" />
        <span class="text-sm">File</span>
        <Icon
          name="mdi:chevron-down"
          class="w-3 h-3 block transition-transform"
          :class="{ 'rotate-180': dropdownRef?.isOpen }"
        />
      </UiButton>
    </template>

    <!-- Create -->
    <UiDropdownItem
      icon="mdi:plus"
      label="New Note"
      :shortcut="`${modLabel}+⇧+N`"
      @click="action('new-note')"
    />
    <UiDropdownItem
      icon="mdi:folder-open-outline"
      label="Open File…"
      :shortcut="`${modLabel}+O`"
      @click="action('open-file')"
    />
    <UiDropdownItem
      icon="mdi:content-duplicate"
      label="Duplicate Note"
      :shortcut="`${modLabel}+⇧+D`"
      :disabled="!hasNote"
      @click="action('duplicate')"
    />

    <UiDivider />

    <UiDropdownItem
      icon="mdi:content-save-outline"
      label="Save As…"
      :shortcut="`${modLabel}+S`"
      :disabled="!hasNote"
      @click="action('save')"
    />
    <UiDropdownItem
      icon="mdi:content-copy"
      label="Copy to Clipboard"
      :disabled="!hasNote"
      @click="action('copy')"
    />
    <UiDropdownItem
      icon="mdi:printer"
      label="Print"
      :shortcut="`${modLabel}+P`"
      :disabled="!hasNote"
      @click="action('print')"
    />

    <UiDivider />

    <!-- Backup & Restore -->
    <UiDropdownItem
      icon="mdi:backup-restore"
      label="Back-up"
      :shortcut="`${modLabel}+⇧+S`"
      @click="action('backup')"
    />
    <UiDropdownItem
      icon="mdi:upload"
      label="Restore Back-up"
      @click="action('restore')"
    />
  </UiDropdown>
</template>

<script setup>
defineProps({
  hasNote: { type: Boolean, default: false },
  modLabel: { type: String, default: 'Ctrl' },
  selectionCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'new-note',
  'open-file',
  'duplicate',
  'save',
  'backup',
  'restore',
  'copy',
  'print',
])

const dropdownRef = ref(null)

const action = (name) => {
  dropdownRef.value?.close()
  emit(name)
}

const onClose = () => {}
</script>
