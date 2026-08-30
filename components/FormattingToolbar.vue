<template>
  <div class="flex items-center" :class="containerClass">
    <!-- Undo / Redo (pinned left) -->
    <div class="flex items-center shrink-0">
      <UiButton
        :disabled="!canUndo"
        variant="ghost"
        color="gray"
        icon-only
        :class="canUndo ? '' : 'text-gray-300 dark:text-gray-700 cursor-default'"
        title="Undo"
        @mousedown.prevent
        @click="$emit('undo')"
      >
        <Icon name="mdi:undo" class="w-5 h-5 block" />
      </UiButton>
      <UiButton
        :disabled="!canRedo"
        variant="ghost"
        color="gray"
        icon-only
        :class="canRedo ? '' : 'text-gray-300 dark:text-gray-700 cursor-default'"
        title="Redo"
        @mousedown.prevent
        @click="$emit('redo')"
      >
        <Icon name="mdi:redo" class="w-5 h-5 block" />
      </UiButton>
      <UiDivider direction="vertical" />
    </div>

    <!-- Scrollable format buttons (middle) -->
    <div
      ref="scrollRef"
      class="flex items-center gap-0.5 overflow-x-auto min-w-0 scrollbar-none"
      :class="{ 'cursor-grabbing': isDragging, 'cursor-grab': !isDragging }"
      @mousedown="onDragStart"
      @mousemove="onDragMove"
      @mouseup="onDragEnd"
      @mouseleave="onDragEnd"
    >
      <UiButton
        v-for="btn in buttons"
        :key="btn.title"
        variant="ghost"
        color="gray"
        icon-only
        class="shrink-0"
        :title="btn.title"
        @mousedown.prevent
        @click="$emit('apply-format', btn.before, btn.after)"
      >
        <Icon :name="btn.icon" class="w-5 h-5 block" />
      </UiButton>
      <!-- Separator -->
      <UiDivider direction="vertical" class="shrink-0" />
      <!-- Indent / Outdent -->
      <UiButton
        variant="ghost"
        color="gray"
        icon-only
        class="shrink-0"
        title="Indent (nest)"
        @mousedown.prevent
        @click="$emit('indent')"
      >
        <Icon name="mdi:format-indent-increase" class="w-5 h-5 block" />
      </UiButton>
      <UiButton
        variant="ghost"
        color="gray"
        icon-only
        class="shrink-0"
        title="Outdent (unnest)"
        @mousedown.prevent
        @click="$emit('outdent')"
      >
        <Icon name="mdi:format-indent-decrease" class="w-5 h-5 block" />
      </UiButton>
    </div>

    <!-- Dismiss keyboard (pinned right, optional) -->
    <div v-if="showDismiss" class="flex items-center shrink-0">
      <UiDivider direction="vertical" />
      <UiButton
        variant="ghost"
        color="gray"
        icon-only
        title="Dismiss keyboard"
        @mousedown.prevent
        @click="$emit('dismiss-keyboard')"
      >
        <Icon name="mdi:keyboard-close" class="w-5 h-5 block" />
      </UiButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  containerClass: {
    type: String,
    default: '',
  },
  canUndo: {
    type: Boolean,
    default: false,
  },
  canRedo: {
    type: Boolean,
    default: false,
  },
  showDismiss: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['apply-format', 'indent', 'outdent', 'undo', 'redo', 'dismiss-keyboard'])

const buttons = [
  { before: '**', after: '**', title: 'Bold', icon: 'mdi:format-bold' },
  { before: '*', after: '*', title: 'Italic', icon: 'mdi:format-italic' },
  { before: '~~', after: '~~', title: 'Strikethrough', icon: 'mdi:format-strikethrough' },
  { before: '# ', after: '', title: 'Heading 1', icon: 'mdi:format-header-1' },
  { before: '## ', after: '', title: 'Heading 2', icon: 'mdi:format-header-2' },
  { before: '### ', after: '', title: 'Heading 3', icon: 'mdi:format-header-3' },
  { before: '- ', after: '', title: 'List', icon: 'mdi:format-list-bulleted' },
  { before: '- [ ] ', after: '', title: 'Checklist', icon: 'mdi:checkbox-marked-outline' },
  { before: '> ', after: '', title: 'Quote', icon: 'mdi:format-quote-close' },
  { before: '`', after: '`', title: 'Code', icon: 'mdi:code-tags' },
  { before: '[', after: '](url)', title: 'Link', icon: 'mdi:link-variant' },
]

// Mouse drag-to-scroll
const scrollRef = ref(null)
const isDragging = ref(false)
let dragStartX = 0
let dragScrollLeft = 0

const onDragStart = (e) => {
  if (!scrollRef.value) return
  isDragging.value = true
  dragStartX = e.pageX
  dragScrollLeft = scrollRef.value.scrollLeft
}

const onDragMove = (e) => {
  if (!isDragging.value || !scrollRef.value) return
  e.preventDefault()
  const dx = e.pageX - dragStartX
  scrollRef.value.scrollLeft = dragScrollLeft - dx
}

const onDragEnd = () => {
  isDragging.value = false
}
</script>
