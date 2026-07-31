<template>
  <div class="relative">
    <button
      ref="triggerRef"
      type="button"
      class="w-12 h-12 flex items-center justify-center focus:outline-none"
      :title="isLoggedIn ? user?.name || user?.email || 'Account' : 'Account'"
      aria-label="Account"
      @click="toggle"
    >
      <UiAvatar v-if="isLoggedIn" :src="user?.avatarUrl" size="sm" :ring="open" />
      <UiAvatar
        v-else
        size="sm"
        color="gray"
        fallback-icon="mdi:account-circle-outline"
        :ring="open"
      />
    </button>

    <Teleport to="body">
      <!-- Click-away backdrop -->
      <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />

      <Transition
        enter-active-class="transition ease-out duration-150"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="open"
          class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
          :style="menuStyle"
        >
          <!-- Account header -->
          <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <template v-if="isLoggedIn">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">
                {{ user?.name || 'No name' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ user?.email }}</p>
            </template>
            <template v-else>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">Guest</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Not signed in</p>
            </template>
          </div>

          <UiButton
            v-if="isLoggedIn"
            variant="menu-item"
            class="px-4"
            @click="accountAction('edit-profile')"
          >
            <Icon name="mdi:account-edit-outline" class="w-4 h-4" />
            Edit Profile
          </UiButton>

          <UiButton
            variant="menu-item"
            class="px-4"
            @click="accountAction('show-locale-settings-locales')"
          >
            <Icon name="mdi:translate" class="w-4 h-4" />
            Language
          </UiButton>
          <UiButton
            variant="menu-item"
            class="px-4"
            @click="accountAction('show-locale-settings-shared-notes')"
          >
            <Icon name="mdi:share-variant-outline" class="w-4 h-4" />
            Shared Notes
          </UiButton>

          <UiDivider class="my-1" />

          <UiButton
            variant="menu-item"
            class="px-4"
            @click="accountAction('show-locale-settings-sessions')"
          >
            <Icon name="mdi:devices" class="w-4 h-4" />
            Sessions
          </UiButton>
          <UiButton
            variant="menu-item"
            class="px-4"
            @click="accountAction('show-locale-settings-security')"
          >
            <Icon name="mdi:shield-lock-outline" class="w-4 h-4" />
            Security
          </UiButton>

          <UiDivider class="my-1" />

          <UiButton variant="menu-item" class="px-4" @click="accountAction('show-locale-settings')">
            <Icon name="mdi:cog-outline" class="w-4 h-4" />
            Settings
          </UiButton>

          <UiDivider class="my-1" />

          <UiDropdownRow v-if="isLoggedIn">
            <UiButton
              v-if="appLockEnabled"
              variant="menu-item"
              class="flex-1 justify-center"
              @click="accountAction('lock-app')"
            >
              <Icon name="mdi:lock" class="w-4 h-4" />
              Lock
            </UiButton>
            <UiDivider v-if="appLockEnabled" direction="vertical" />
            <UiButton
              variant="menu-item"
              color="red"
              class="flex-1 justify-center"
              @click="accountAction('logout')"
            >
              <Icon name="mdi:logout" class="w-4 h-4" />
              Sign Out
            </UiButton>
          </UiDropdownRow>
          <UiButton
            v-else
            variant="menu-item"
            class="px-4"
            @click="accountAction('show-auth')"
          >
            <Icon name="mdi:login" class="w-4 h-4" />
            Sign In / Sign Up
          </UiButton>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
defineProps({
  isLoggedIn: { type: Boolean, required: true },
  user: { type: Object, default: null },
  appLockEnabled: { type: Boolean, default: false },
})

const emit = defineEmits([
  'edit-profile',
  'show-auth',
  'show-locale-settings',
  'show-locale-settings-locales',
  'show-locale-settings-security',
  'show-locale-settings-sessions',
  'show-locale-settings-shared-notes',
  'lock-app',
  'logout',
])

const MENU_WIDTH = 256 // w-64

const open = ref(false)
const triggerRef = ref(null)
const menuStyle = ref({})

// Anchor the menu just to the right of the avatar, growing upward — teleported
// to the body so it can't be clipped by the (overflow-hidden) sidebar.
const updatePosition = () => {
  const el = triggerRef.value
  if (!el || typeof window === 'undefined') return
  const rect = el.getBoundingClientRect()
  const left = Math.max(8, Math.min(rect.right + 6, window.innerWidth - MENU_WIDTH - 8))
  menuStyle.value = {
    left: `${left}px`,
    bottom: `${window.innerHeight - rect.bottom}px`,
    width: `${MENU_WIDTH}px`,
  }
}

const toggle = () => {
  open.value = !open.value
  if (open.value) updatePosition()
}

const accountAction = (action) => {
  open.value = false
  emit(action)
}

const onKey = (e) => {
  if (e.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (typeof window === 'undefined') return
  if (isOpen) {
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', updatePosition)
  } else {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', updatePosition)
  }
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', updatePosition)
})
</script>
