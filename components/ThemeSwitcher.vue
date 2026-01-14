<template>
  <button @click="toggleTheme"
    class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
    <Icon v-if="isDark" name="mdi:weather-sunny" class="w-5 h-5" />
    <Icon v-else name="mdi:weather-night" class="w-5 h-5" />
  </button>
</template>

<script setup>
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>
