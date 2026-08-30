<template>
  <UiModal :show="isOpen" max-width="md" @close="$emit('close')">
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-400 leading-none">Note Details</h2>
        <UiButton variant="ghost" color="gray" icon-only @click="$emit('close')">
          <Icon name="mdi:close" class="block w-5 h-5" />
        </UiButton>
      </div>

      <div class="space-y-4">
        <UiFormField label="Title">
          <UiInput v-model="localTitle" type="text" placeholder="Untitled Note" :validate="false" />
        </UiFormField>

        <UiFormField label="Internal Name" hint="Auto-generated from title. Edit to customise.">
          <UiInput
            v-model="localInternalName"
            type="text"
            placeholder="untitled_note"
            :validate="false"
            @update:model-value="internalNameManuallyEdited = true"
          />
        </UiFormField>

        <UiFormField label="Description">
          <UiInput
            v-model="localDescription"
            type="textarea"
            :rows="3"
            placeholder="Add a description..."
            :validate="false"
          />
        </UiFormField>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"> Tags </label>
          <div v-if="localTags.length" class="flex flex-wrap gap-1.5 mb-2">
            <UiBadge v-for="(tag, i) in localTags" :key="i">
              {{ tag }}
              <UiButton variant="ghost" color="gray" size="xs" icon-only @click="removeTag(i)">
                <Icon name="mdi:close" class="w-3 h-3" />
              </UiButton>
            </UiBadge>
          </div>
          <div class="relative">
            <UiInput
              v-model="tagInput"
              type="text"
              placeholder="e.g. work, ideas, urgent"
              :validate="false"
              @keydown.enter.prevent="addTags"
              @keydown.backspace="tagInput === '' && localTags.length && removeTag(localTags.length - 1)"
              @update:model-value="onTagInput"
            />
            <div
              v-if="tagSuggestions.length"
              class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-32 overflow-y-auto"
            >
              <UiButton
                v-for="s in tagSuggestions"
                :key="s"
                variant="menu-item"
                @mousedown.prevent="selectSuggestion(s)"
              >
                {{ s }}
              </UiButton>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Press Enter to add. Separate multiple tags with commas.
          </p>
        </div>
      </div>

      <!-- Share status -->
      <div
        v-if="noteId"
        class="mt-4 px-3 py-2.5 rounded-lg border"
        :class="
          props.shared
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
        "
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon
              :name="props.shared ? 'mdi:link-variant' : 'mdi:link-variant-off'"
              class="w-4 h-4"
              :class="props.shared ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'"
            />
            <span
              class="text-sm"
              :class="props.shared ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'"
            >
              {{ props.shared ? 'This note is shared' : 'Not shared' }}
            </span>
          </div>
          <UiButton v-if="props.shared" variant="ghost" color="red" size="xs" @click="emit('unshare', props.noteId)">
            Stop sharing
          </UiButton>
          <UiButton v-else variant="ghost" size="xs" @click="emit('share', props.noteId)"> Share </UiButton>
        </div>
        <div v-if="props.shared && props.shareHash" class="flex items-center gap-2 mt-2">
          <UiInput :model-value="shareUrl" readonly :validate="false" />
          <UiButton icon-only size="sm" class="shrink-0" @click="copyShareLink">
            <Icon :name="copiedLink ? 'mdi:check' : 'mdi:content-copy'" class="w-3.5 h-3.5 block" />
          </UiButton>
        </div>
        <UiButton
          v-if="props.analyticsHash"
          variant="ghost"
          size="xs"
          block
          @click="emit('open-analytics', props.analyticsHash)"
        >
          <Icon name="mdi:chart-bar" class="w-3.5 h-3.5" />
          View analytics
        </UiButton>
      </div>

      <div class="flex justify-between gap-2 mt-6">
        <UiButton v-if="noteId" variant="ghost" color="red" @click="handleDelete"> Delete </UiButton>
        <div class="flex-1" />
        <UiButton variant="ghost" color="gray" @click="$emit('close')"> Cancel </UiButton>
        <UiButton @click="save"> Save </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup>
import { normaliseName, uniqueInternalName } from '~/utils/normaliseName.js'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  title: { type: String, default: '' },
  internalName: { type: String, default: '' },
  description: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
  allTags: { type: Array, default: () => [] },
  noteId: { type: String, default: null },
  shared: { type: Boolean, default: false },
  shareHash: { type: String, default: null },
  analyticsHash: { type: String, default: null },
  existingInternalNames: { type: Array, default: () => [] },
  allNotes: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'save', 'delete', 'share', 'unshare', 'open-analytics'])

const { copy: clipboardCopy } = useClipboard()
const { apiUrl } = useApi()

const localTitle = ref(props.title)
const localInternalName = ref(props.internalName)
const internalNameManuallyEdited = ref(false)
const localDescription = ref(props.description)
const localTags = ref([...props.tags])
const tagInput = ref('')
const tagSuggestions = ref([])
const copiedLink = ref(false)

// Auto-generate internal name from title.
// If the user edits the title, always regenerate (back to step 1).
watch(localTitle, (val) => {
  internalNameManuallyEdited.value = false
  localInternalName.value = uniqueInternalName(val, [], 'untitled_note', props.noteId, props.allNotes)
})

const shareUrl = computed(() => {
  if (!props.shareHash) return ''
  return apiUrl(`/shared/${props.shareHash}`)
})

const copyShareLink = async () => {
  await clipboardCopy(shareUrl.value)
  copiedLink.value = true
  setTimeout(() => {
    copiedLink.value = false
  }, 2000)
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      localTitle.value = props.title
      localInternalName.value =
        props.internalName || uniqueInternalName(props.title, [], 'untitled_note', props.noteId, props.allNotes)
      internalNameManuallyEdited.value = false
      localDescription.value = props.description
      localTags.value = [...props.tags]
      tagInput.value = ''
      tagSuggestions.value = []
      copiedLink.value = false
    }
  },
)

const addTags = () => {
  tagInput.value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && !localTags.value.includes(t))
    .forEach((t) => localTags.value.push(t))
  tagInput.value = ''
  tagSuggestions.value = []
}

const removeTag = (index) => {
  localTags.value.splice(index, 1)
}

const selectSuggestion = (tag) => {
  if (!localTags.value.includes(tag)) {
    localTags.value.push(tag)
  }
  tagInput.value = ''
  tagSuggestions.value = []
}

const onTagInput = () => {
  const q = tagInput.value.trim().toLowerCase()
  if (!q) {
    tagSuggestions.value = []
    return
  }
  tagSuggestions.value = props.allTags.filter((t) => t.includes(q) && !localTags.value.includes(t))
}

const save = () => {
  const rawName = internalNameManuallyEdited.value
    ? normaliseName(localInternalName.value)
    : normaliseName(localTitle.value)
  const finalInternalName = uniqueInternalName(rawName, [], 'untitled_note', props.noteId, props.allNotes)
  emit('save', {
    title: localTitle.value,
    internalName: finalInternalName,
    description: localDescription.value,
    tags: [...localTags.value],
  })
  emit('close')
}

const handleDelete = () => {
  emit('close')
  emit('delete', props.noteId)
}
</script>
