<template>
  <div class="h-full flex">
    <!-- Monaco Editor -->
    <div :class="[
      'flex-1 overflow-hidden',
      bordered ? 'border border-gray-200 dark:border-gray-700 rounded-lg' : ''
    ]">
      <ClientOnly>
        <template #fallback>
          <div class="h-full flex items-center justify-center text-gray-500">
            Loading editor...
          </div>
        </template>
        <MonacoEditor ref="editorRef" v-model="localContent" :options="editorOptions" lang="calcnotes" class="h-full" />
      </ClientOnly>
    </div>

    <!-- Results column (separate, synced scroll) -->
    <div v-if="props.showResults" :class="[
      'flex-shrink-0 w-48 overflow-hidden bg-white dark:bg-gray-925 border-l border-gray-200 dark:border-gray-800',
      bordered ? 'ml-2 rounded-lg' : ''
    ]">
      <div :style="{ transform: `translateY(-${scrollTop}px)` }">
        <div class="p-0">
          <div v-for="(line, index) in displayLines" :key="index" :class="[
            'text-right whitespace-nowrap leading-6 flex items-center justify-end gap-2',
            currentLine === index ? 'bg-primary-100 dark:bg-primary-900' : ''
          ]" :style="{ height: lineHeight + 'px' }">
            <span v-if="line.result" @click="copyResult(line.result)"
              class="text-primary-600 dark:text-primary-400 text-lg cursor-pointer hover:text-primary-700 dark:hover:text-primary-400 transition-colors pl-1">{{
                line.result }}</span>
            <span v-else-if="line.error" class="text-error-500 dark:text-error-400 text-sm italic">{{ line.error
              }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Start typing... (e.g., 10 + 20)'
  },
  showResults: {
    type: Boolean,
    default: true
  },
  bordered: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:content'])

const displayLines = ref([])
const scrollTop = ref(0)
const currentLine = ref(0)
const lineHeight = ref(19)
const localContent = ref(props.content)
const editorRef = ref(null)

const { evaluateLines } = useCalculator()
const { registerCalcLanguage } = useMonacoCalcLanguage()
const colorMode = useColorMode()

// Editor options
const editorOptions = computed(() => ({
  theme: colorMode.value === 'dark' ? 'vs-dark' : 'vs',
  fontSize: 16,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  lineHeight: lineHeight.value,
  minimap: { enabled: false },
  scrollBeyondLastLine: true,
  wordWrap: 'off',
  lineNumbers: 'on',
  glyphMargin: true,
  folding: true,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'line',
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  automaticLayout: true,
}))

// Try to setup Monaco after mount
onMounted(async () => {
  updateLines(props.content)

  // Wait for Monaco to be available
  await nextTick()

  // Try multiple times to find Monaco
  let attempts = 0
  const maxAttempts = 20

  const trySetupMonaco = () => {
    attempts++

    // Try to import monaco-editor directly
    import('monaco-editor').then((monaco) => {
      setupMonaco(monaco)
    }).catch(() => {
      // Try window.monaco
      if (window.monaco) {
        setupMonaco(window.monaco)
      } else if (attempts < maxAttempts) {
        setTimeout(trySetupMonaco, 200)
      }
    })
  }

  setTimeout(trySetupMonaco, 500)
})

const setupMonaco = (monaco) => {
  try {
    // Register language first
    registerCalcLanguage(monaco)

    // Set theme
    const themeName = colorMode.value === 'dark' ? 'calcnotes-dark' : 'calcnotes-light'
    monaco.editor.setTheme(themeName)

    // Get the editor instance - try multiple times if needed
    const attachListeners = () => {
      if (!editorRef.value) return false

      const editorComponent = editorRef.value

      // Try different ways to access the editor
      const editor = editorComponent.editor ||
        editorComponent.$editor ||
        editorComponent._editor ||
        editorComponent

      if (editor && editor.getModel && typeof editor.onDidChangeCursorPosition === 'function') {
        const currentModel = editor.getModel()

        if (currentModel) {
          // Get current content
          const content = currentModel.getValue()

          // Dispose old model
          currentModel.dispose()

          // Create new model with calcnotes language
          const newModel = monaco.editor.createModel(content, 'calcnotes')

          // Set the new model
          editor.setModel(newModel)
        }

        // Listen for cursor position changes
        editor.onDidChangeCursorPosition((e) => {
          currentLine.value = e.position.lineNumber - 1 // Monaco uses 1-based line numbers
        })

        // Listen for scroll changes to sync results column
        editor.onDidScrollChange((e) => {
          scrollTop.value = e.scrollTop
        })

        // Set initial cursor position
        const position = editor.getPosition()
        if (position) {
          currentLine.value = position.lineNumber - 1
        }

        return true
      }

      return false
    }

    // Try to attach listeners immediately
    if (!attachListeners()) {
      // If it fails, try again after a delay
      let retries = 0
      const retryInterval = setInterval(() => {
        if (attachListeners() || retries++ > 10) {
          clearInterval(retryInterval)
        }
      }, 200)
    }
  } catch (e) {
    console.error('Error setting up Monaco:', e)
  }
}

// Watch for external content changes
watch(() => props.content, (newContent) => {
  if (localContent.value !== newContent) {
    localContent.value = newContent
  }
  updateLines(newContent)
})

// Watch local content and emit changes + update calculations
watch(localContent, (newContent) => {
  emit('update:content', newContent)
  updateLines(newContent)
})

const updateLines = (text) => {
  if (!text) {
    displayLines.value = []
    return
  }
  const lines = text.split('\n')
  displayLines.value = evaluateLines(lines)
}

const copyResult = async (result) => {
  try {
    await navigator.clipboard.writeText(result)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Watch for theme changes
watch(() => colorMode.value, (newMode) => {
  if (window.monaco) {
    const monaco = window.monaco
    const themeName = newMode === 'dark' ? 'calcnotes-dark' : 'calcnotes-light'
    monaco.editor.setTheme(themeName)
  }
})

// Expose methods for toolbar actions
const insertText = (text) => {
  if (!editorRef.value) {
    // Fallback: append to content
    const newContent = localContent.value + text
    localContent.value = newContent
    emit('update:content', newContent)
    return
  }

  const editorComponent = editorRef.value
  const editor = editorComponent.editor ||
    editorComponent.$editor ||
    editorComponent._editor ||
    editorComponent

  if (editor && editor.getModel && typeof editor.executeEdits === 'function') {
    const position = editor.getPosition()
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }

    editor.executeEdits('toolbar', [{
      range: range,
      text: text,
      forceMoveMarkers: true
    }])

    // Move cursor after inserted text
    editor.setPosition({
      lineNumber: position.lineNumber,
      column: position.column + text.length
    })

    editor.focus()
  } else {
    // Fallback
    const newContent = localContent.value + text
    localContent.value = newContent
    emit('update:content', newContent)
  }
}

const wrapSelection = (before, after = before) => {
  if (!editorRef.value) {
    // Fallback: append to content
    const newContent = localContent.value + before + after
    localContent.value = newContent
    emit('update:content', newContent)
    return
  }

  const editorComponent = editorRef.value
  const editor = editorComponent.editor ||
    editorComponent.$editor ||
    editorComponent._editor ||
    editorComponent

  if (editor && editor.getModel && typeof editor.executeEdits === 'function') {
    const selection = editor.getSelection()
    const selectedText = editor.getModel().getValueInRange(selection)

    if (selectedText) {
      // Wrap selected text
      const wrappedText = before + selectedText + after
      editor.executeEdits('toolbar', [{
        range: selection,
        text: wrappedText,
        forceMoveMarkers: true
      }])

      // Select the wrapped content (excluding the wrapper)
      editor.setSelection({
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn + before.length,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn + before.length
      })
    } else {
      // No selection, insert at cursor with cursor between wrappers
      const position = editor.getPosition()
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      }

      editor.executeEdits('toolbar', [{
        range: range,
        text: before + after,
        forceMoveMarkers: true
      }])

      // Position cursor between the wrappers
      editor.setPosition({
        lineNumber: position.lineNumber,
        column: position.column + before.length
      })
    }

    editor.focus()
  } else {
    // Fallback
    const newContent = localContent.value + before + after
    localContent.value = newContent
    emit('update:content', newContent)
  }
}

defineExpose({
  insertText,
  wrapSelection
})
</script>
