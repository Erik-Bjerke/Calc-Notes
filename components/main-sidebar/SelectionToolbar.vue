<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="selectMode"
      class="absolute inset-0 z-10 p-4 bg-primary-50 dark:bg-primary-900/20 flex flex-col justify-center space-y-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
          {{ selectedCount }} selected
        </span>
        <UiButton
          variant="ghost"
          color="gray"
          icon-only
          size="sm"
          title="Cancel selection"
          @click="$emit('exit-select-mode')"
        >
          <Icon name="mdi:close" class="w-5 h-5" />
        </UiButton>
      </div>
      <div class="flex items-center gap-2">
        <UiButton
          variant="outline"
          color="gray"
          size="sm"
          icon-only
          class="shrink-0"
          :title="allSelected ? 'Deselect All' : 'Select All'"
          @click="$emit('toggle-select-all')"
        >
          <Icon
            :name="allSelected ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'"
            class="w-4 h-4"
          />
        </UiButton>
        <!-- Bin mode actions -->
        <template v-if="showBin">
          <UiButton
            variant="solid"
            color="primary"
            size="sm"
            :disabled="selectedCount === 0"
            class="flex-1"
            @click="$emit('bulk-restore')"
          >
            <Icon name="mdi:restore" class="w-4 h-4" />
            Restore
          </UiButton>
          <UiButton
            variant="solid"
            color="red"
            size="sm"
            :disabled="selectedCount === 0"
            class="flex-1"
            @click="$emit('bulk-permanent-delete')"
          >
            <Icon name="mdi:delete-forever-outline" class="w-4 h-4" />
            Delete
          </UiButton>
        </template>
        <!-- Normal mode actions -->
        <template v-else>
          <UiButton
            v-if="canGroup"
            variant="solid"
            color="primary"
            size="sm"
            :disabled="selectedCount === 0"
            class="flex-1"
            @click="$emit('bulk-group')"
          >
            <Icon name="mdi:folder-outline" class="w-4 h-4" />
            Group
          </UiButton>
          <UiButton
            v-if="showArchive"
            variant="solid"
            color="primary"
            size="sm"
            :disabled="selectedCount === 0"
            class="flex-1"
            @click="$emit('bulk-unarchive')"
          >
            <Icon name="mdi:package-up" class="w-4 h-4" />
            Unarchive
          </UiButton>
          <UiButton
            v-else
            variant="solid"
            color="gray"
            size="sm"
            :disabled="selectedCount === 0"
            class="flex-1"
            @click="$emit('bulk-archive')"
          >
            <Icon name="mdi:archive-outline" class="w-4 h-4" />
            Archive
          </UiButton>
          <UiButton
            variant="solid"
            color="red"
            size="sm"
            icon-only
            :disabled="selectedCount === 0"
            class="shrink-0"
            title="Delete"
            @click="$emit('bulk-delete')"
          >
            <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
          </UiButton>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  selectMode: { type: Boolean, required: true },
  selectedIds: { type: Set, required: true },
  selectedCount: { type: Number, default: 0 },
  canGroup: { type: Boolean, default: true },
  allSelected: { type: Boolean, required: true },
  showBin: { type: Boolean, required: true },
  showArchive: { type: Boolean, required: true },
})

defineEmits([
  'exit-select-mode',
  'toggle-select-all',
  'bulk-restore',
  'bulk-permanent-delete',
  'bulk-group',
  'bulk-unarchive',
  'bulk-archive',
  'bulk-delete',
])
</script>
