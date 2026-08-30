<template>
  <div class="p-5 md:p-8">
    <div class="max-w-2xl mx-auto">
      <HelpSectionHeader icon="mdi:lightbulb-outline" title="Tips & Tricks" description="Get the most out of Numori" />

      <div class="space-y-4">
        <div v-for="(tip, i) in tips" :key="i" class="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
          <div class="shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <span class="text-xs font-bold text-primary-600 dark:text-primary-400">{{ i + 1 }}</span>
          </div>
          <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{{ tip }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()

const tips = computed(() => [
  t('shortcuts.tip1'),
  t('shortcuts.tip2'),
  t('shortcuts.tip3'),
  t('shortcuts.tip4'),
  'Use parentheses () to group operations: (10 + 20) * 2',
  'Variables work across lines: price = 100, then use "price" later',
  'Empty lines separate sum/average calculations into groups',
  'Units work with or without spaces: 100km or 100 km',
  'Use scales with currency: $2k, €3M, £1 million',
])
</script>
