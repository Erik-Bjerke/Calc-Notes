<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click="close">
    <div class="bg-white dark:bg-gray-925 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden" @click.stop>
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-400">{{ $t('shortcuts.title') }}</h2>
        <button @click="close" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
          <Icon name="mdi:close" class="w-6 h-6" />
        </button>
      </div>

      <div class="overflow-y-auto p-6 max-h-[calc(90vh-80px)]">
        <div class="space-y-6">
          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">Navigation</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">{{ $t('shortcuts.newLine') }}</span>
                <kbd
                  class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">Enter</kbd>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">{{ $t('shortcuts.moveUp') }}</span>
                <kbd
                  class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">↑</kbd>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">{{ $t('shortcuts.moveDown') }}</span>
                <kbd
                  class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">↓</kbd>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">Quick Functions</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Square root</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">sqrt(16)</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Power/Exponent</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">2^8</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Percentage</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">20%
                    of 100</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Previous result</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">prev</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Sum all above</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">sum</kbd>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">Formatting</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Header</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">#
                    Title</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Comment</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">//
                    Note</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Label</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">Label:</kbd>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">Quick Conversions</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Currency conversion</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">$100
                    in EUR</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Unit conversion</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">100
                    kg in lbs</kbd>
                </div>
              </div>

              <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span class="text-sm text-gray-700 dark:text-gray-400">Date arithmetic</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400-muted">Type:</span>
                  <kbd
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-400">today
                    + 2 weeks</kbd>
                </div>
              </div>
            </div>
          </section>

          <div class="mt-6 p-4 bg-primary-50 dark:bg-gray-800 rounded-lg">
            <h3 class="text-sm font-semibold text-primary-900 dark:text-primary-400 mb-2">{{ $t('shortcuts.tips') }}
            </h3>
            <ul class="text-xs text-primary-800 dark:text-gray-400 space-y-1">
              <li>• {{ $t('shortcuts.tip1') }}</li>
              <li>• {{ $t('shortcuts.tip2') }}</li>
              <li>• {{ $t('shortcuts.tip3') }}</li>
              <li>• {{ $t('shortcuts.tip4') }}</li>
              <li>• Use parentheses () to group operations: (10 + 20) * 2</li>
              <li>• Variables work across lines: price = 100, then use "price" later</li>
              <li>• Empty lines separate sum/average calculations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const close = () => {
  emit('close')
}
</script>
