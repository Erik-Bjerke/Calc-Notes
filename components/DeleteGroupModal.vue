<template>
  <UiPrompt :show="isOpen" title="Delete Group" @close="$emit('close')">
    <p class="mb-2">
      What would you like to do with the <span class="font-medium">{{ noteCount }}</span> note{{
        noteCount === 1 ? '' : 's'
      }}
      in "<span class="font-medium">{{ groupName }}</span>"?
    </p>

    <div class="space-y-2 mt-4">
      <UiButton
        variant="outline"
        color="gray"
        block
        class="text-left"
        @click="$emit('confirm', 'keep')"
      >
        <Icon name="mdi:folder-remove-outline" class="w-5 h-5 text-gray-500 shrink-0" />
        <div>
          <p class="text-sm font-medium text-gray-800 dark:text-gray-300">Delete group only</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Notes will be moved outside the group
          </p>
        </div>
      </UiButton>

      <UiButton
        v-if="otherGroups.length > 0"
        variant="outline"
        color="gray"
        block
        class="text-left"
        @click="showMoveOptions = !showMoveOptions"
      >
        <Icon name="mdi:folder-swap-outline" class="w-5 h-5 text-primary-500 shrink-0" />
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
            Move notes to another group
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Then delete this group</p>
        </div>
        <Icon
          :name="showMoveOptions ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          class="w-4 h-4 text-gray-400 shrink-0"
        />
      </UiButton>

      <div v-if="showMoveOptions" class="pl-8 space-y-1">
        <UiButton
          v-for="g in otherGroups"
          :key="g.id"
          variant="ghost"
          color="gray"
          size="sm"
          block
          @click="$emit('confirm', 'move', g.id)"
        >
          <Icon name="mdi:folder-outline" class="w-4 h-4 text-primary-500 shrink-0" />
          {{ g.name }}
        </UiButton>
      </div>

      <UiButton
        variant="outline"
        color="red"
        block
        class="text-left"
        @click="$emit('confirm', 'delete-all')"
      >
        <Icon name="mdi:trash-can-outline" class="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p class="text-sm font-medium text-red-600 dark:text-red-400">
            Delete group and all notes
          </p>
          <p class="text-xs text-red-400 dark:text-red-500">This cannot be undone</p>
        </div>
      </UiButton>
    </div>
    <template #actions>
      <UiButton variant="ghost" color="gray" @click="$emit('close')"> Cancel </UiButton>
    </template>
  </UiPrompt>
</template>

<script setup>
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  groupName: { type: String, default: '' },
  noteCount: { type: Number, default: 0 },
  otherGroups: { type: Array, default: () => [] },
})

defineEmits(['close', 'confirm'])

const showMoveOptions = ref(false)

watch(
  () => props.isOpen,
  (open) => {
    if (open) showMoveOptions.value = false
  },
)
</script>
