<template>
  <UiPrompt :show="isOpen" title="Add to Group" @close="$emit('close')">
    <div class="flex flex-col gap-1">
      <!-- Create new group option -->
      <UiButton
        variant="menu-item"
        color="primary"
        class="rounded-lg py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
        @click="$emit('create-new')"
      >
        <Icon name="mdi:folder-plus-outline" class="w-4.5 h-4.5 shrink-0" />
        <span class="font-medium">Create new group</span>
      </UiButton>

      <template v-if="groups.length">
        <p
          class="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none"
        >
          Your groups
        </p>

        <!-- Existing groups -->
        <div class="max-h-64 -mx-1 overflow-y-auto px-1">
          <UiButton
            v-for="group in groups"
            :key="group.id"
            variant="menu-item"
            class="rounded-lg py-2"
            :class="
              currentGroupId === group.id
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                : 'text-gray-700 dark:text-gray-300'
            "
            @click="$emit('select', group.id)"
          >
            <Icon
              name="mdi:folder-outline"
              class="w-4.5 h-4.5 shrink-0"
              :class="currentGroupId === group.id ? 'text-primary-500' : 'text-gray-400'"
            />
            <span class="truncate">{{ group.name }}</span>
            <Icon
              v-if="currentGroupId === group.id"
              name="mdi:check"
              class="w-4 h-4 ml-auto text-primary-500 shrink-0"
            />
          </UiButton>
        </div>
      </template>

      <!-- Remove from group option -->
      <template v-if="currentGroupId">
        <UiDivider color="medium" class="my-1" />
        <UiButton
          variant="menu-item"
          color="red"
          class="rounded-lg py-2"
          @click="$emit('select', null)"
        >
          <Icon name="mdi:folder-remove-outline" class="w-4.5 h-4.5 shrink-0" />
          <span>Remove from group</span>
        </UiButton>
      </template>
    </div>
    <template #actions>
      <UiButton variant="ghost" color="gray" @click="$emit('close')"> Cancel </UiButton>
    </template>
  </UiPrompt>
</template>

<script setup>
defineProps({
  isOpen: { type: Boolean, default: false },
  groups: { type: Array, default: () => [] },
  currentGroupId: { type: String, default: null },
})

defineEmits(['close', 'select', 'create-new'])
</script>
