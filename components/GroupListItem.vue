<template>
  <div
    class="tree-node group relative flex items-center h-9 cursor-pointer select-none transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70"
    :class="{
      'bg-primary-50/70 dark:bg-primary-500/15 ring-1 ring-inset ring-primary-400/70':
        dropIndicator === 'inside',
    }"
    :style="{ paddingLeft: indent + 'px', paddingRight: '2px' }"
    :title="group.name"
    @click="$emit('toggle-collapse', group.id)"
  >
    <!-- Twisty -->
    <Icon
      :name="group.collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'"
      class="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
    />
    <!-- Folder icon -->
    <Icon
      :name="group.collapsed ? 'mdi:folder-outline' : 'mdi:folder-open-outline'"
      class="w-4 h-4 flex-shrink-0 mr-1.5 text-primary-500 dark:text-primary-400"
    />
    <!-- Label -->
    <span class="flex-1 min-w-0 truncate text-[13px] font-medium leading-none">
      {{ group.name }}
    </span>

    <!-- Three-dots menu (reveals on hover / focus) -->
    <div
      ref="menuRef"
      class="relative flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      :class="{ 'opacity-100': menuOpen }"
      tabindex="-1"
      @focusout="onFocusOut"
    >
      <UiButton
        variant="ghost"
        color="gray"
        icon-only
        class="!p-0.5"
        title="Group actions"
        @click.stop="toggleMenu"
      >
        <Icon name="mdi:dots-horizontal" class="w-4 h-4" />
      </UiButton>
        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-show="menuOpen"
            class="absolute right-0 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
            :class="dropUp ? 'bottom-full mb-1' : 'top-full mt-1'"
          >
            <UiButton
              v-if="canAddSubgroup"
              variant="menu-item"
              @click.stop="handleAction('add-subgroup')"
            >
              <Icon name="mdi:folder-plus-outline" class="w-4 h-4" />
              Add Subgroup
            </UiButton>
            <UiButton variant="menu-item" @click.stop="handleAction('edit')">
              <Icon name="mdi:pencil-outline" class="w-4 h-4" />
              Edit Group
            </UiButton>
            <UiDivider color="medium" />
            <UiButton variant="menu-item" color="red" @click.stop="handleAction('delete')">
              <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
              Delete Group
            </UiButton>
          </div>
        </Transition>
      </div>
  </div>
</template>

<script setup>
const props = defineProps({
  group: { type: Object, required: true },
  noteCount: { type: Number, default: 0 },
  dropIndicator: { type: String, default: null }, // 'before' | 'after' | 'inside' | null
  level: { type: Number, default: 1 }, // 1-based nesting level
  maxDepth: { type: Number, default: 3 },
  indent: { type: Number, default: 8 }, // left padding (px) for nesting depth
})

const emit = defineEmits(['toggle-collapse', 'edit', 'delete', 'add-subgroup'])

const canAddSubgroup = computed(() => props.level < props.maxDepth)

const menuOpen = ref(false)
const menuRef = ref(null)
const dropUp = ref(false)
const menuId = Math.random().toString(36).slice(2)

const toggleMenu = () => {
  const willOpen = !menuOpen.value
  if (willOpen) {
    document.dispatchEvent(new CustomEvent('close-all-menus', { detail: { sourceId: menuId } }))
    if (menuRef.value) {
      const rect = menuRef.value.getBoundingClientRect()
      dropUp.value = rect.bottom + 120 > window.innerHeight
    }
  }
  menuOpen.value = willOpen
}

const handleAction = (action) => {
  menuOpen.value = false
  if (action === 'edit') emit('edit', props.group.id)
  else if (action === 'delete') emit('delete', props.group.id)
  else if (action === 'add-subgroup') emit('add-subgroup', props.group.id)
}

const onFocusOut = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.relatedTarget)) {
    menuOpen.value = false
  }
}

const onClickOutside = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    menuOpen.value = false
  }
}

const onCloseAllMenus = (e) => {
  if (e.detail?.sourceId !== menuId) menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('close-all-menus', onCloseAllMenus)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('close-all-menus', onCloseAllMenus)
})
</script>
