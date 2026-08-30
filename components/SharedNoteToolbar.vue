<template>
  <div class="flex flex-wrap items-center gap-1 sm:flex-nowrap">
    <!-- View toggles -->
    <div class="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-start">
      <UiButtonsGroup
        :model-value="renderMarkdown"
        size="sm"
        icon-class="w-4.5 h-4.5"
        :options="[
          { value: true, icon: 'mdi:language-markdown', title: 'Render Markdown' },
          { value: false, icon: 'mdi:format-text', title: 'Raw text' },
        ]"
        @update:model-value="$emit('update:renderMarkdown', $event)"
      />

      <UiButtonsGroup
        :model-value="resultsPosition"
        size="sm"
        icon-class="w-4.5 h-4.5"
        :options="[
          { value: 'left', icon: 'mdi:dock-left', title: 'Results on left' },
          { value: 'off', icon: 'mdi:eye-off-outline', title: 'Results off' },
          { value: 'right', icon: 'mdi:dock-right', title: 'Results on right' },
        ]"
        @update:model-value="$emit('update:resultsPosition', $event)"
      />
    </div>

    <!-- Spacer / line break on mobile -->
    <div class="flex-1 basis-full sm:basis-0" />

    <!-- Actions: Copy · Export · Print · Import -->
    <div class="flex items-center justify-between sm:justify-end gap-0.5 w-full sm:w-auto">
      <UiButton
        variant="ghost"
        color="gray"
        size="sm"
        :title="copied ? 'Copied!' : 'Copy to clipboard'"
        @click="handleCopy"
      >
        <Icon
          :name="copied ? 'mdi:check' : 'mdi:content-copy'"
          class="w-3.5 h-3.5 sm:w-4 sm:h-4 block"
          :class="copied ? 'text-green-500' : ''"
        />
        <span>{{ copied ? 'Copied' : 'Copy' }}</span>
      </UiButton>

      <UiDivider direction="vertical" class="h-4 mx-0" />

      <UiDropdown ref="exportDropdownRef" width="w-52" align="right" :drop="dropUp ? 'up' : 'down'">
        <template #trigger="{ toggle }">
          <UiButton variant="ghost" color="gray" size="sm" title="Export note" @click="toggle">
            <Icon name="mdi:export" class="w-3.5 h-3.5 sm:w-4 sm:h-4 block" />
            <span>Export</span>
            <Icon
              name="mdi:chevron-down"
              class="w-3 h-3 block transition-transform"
              :class="{ 'rotate-180': exportDropdownRef?.isOpen }"
            />
          </UiButton>
        </template>

        <UiButton variant="menu-item" @click="emitExport('text')">
          <Icon name="mdi:file-document-outline" class="w-4 h-4 block shrink-0" />
          <span>Text (.txt)</span>
        </UiButton>
        <UiButton variant="menu-item" @click="emitExport('markdown')">
          <Icon name="mdi:language-markdown-outline" class="w-4 h-4 block shrink-0" />
          <span>Markdown (.md)</span>
        </UiButton>
        <UiButton variant="menu-item" @click="emitExport('pdf')">
          <Icon name="mdi:file-pdf-box" class="w-4 h-4 block shrink-0" />
          <span>PDF</span>
        </UiButton>
        <UiDivider />
        <UiButton variant="menu-item" @click="emitExport('json')">
          <Icon name="mdi:code-json" class="w-4 h-4 block shrink-0" />
          <span>Export as JSON</span>
        </UiButton>
      </UiDropdown>

      <UiButton variant="ghost" color="gray" size="sm" title="Print" @click="$emit('print')">
        <Icon name="mdi:printer" class="w-3.5 h-3.5 sm:w-4 sm:h-4 block" />
        <span>Print</span>
      </UiButton>

      <UiDivider direction="vertical" class="h-4 mx-0" />

      <UiButton
        variant="ghost"
        color="primary"
        size="sm"
        title="Import to my notes"
        @click="$emit('import')"
      >
        <Icon name="mdi:note-plus-outline" class="w-3.5 h-3.5 sm:w-4 sm:h-4 block" />
        <span>Import</span>
      </UiButton>
    </div>
  </div>
</template>

<script setup>
const _props = defineProps({
  renderMarkdown: { type: Boolean, default: true },
  resultsPosition: { type: String, default: 'left' },
  copied: { type: Boolean, default: false },
  dropUp: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:renderMarkdown',
  'update:resultsPosition',
  'copy',
  'export',
  'print',
  'import',
])

const exportDropdownRef = ref(null)

const handleCopy = () => emit('copy')

const emitExport = (format) => {
  exportDropdownRef.value?.close()
  emit('export', format)
}
</script>
