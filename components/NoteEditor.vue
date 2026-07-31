<template>
  <div class="h-full flex">
    <div
      :class="[
        'flex-1 overflow-hidden transition-all duration-200 ease-in-out relative',
        bordered ? 'border border-gray-200 dark:border-gray-700 rounded-lg' : '',
      ]"
    >
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-300"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="!editorReady"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-925 text-gray-400 dark:text-gray-500"
        >
          <svg
            class="animate-spin h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-sm">Loading editor…</span>
        </div>
      </Transition>
      <ClientOnly>
        <template #fallback>
          <div class="h-full flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500">
            <svg class="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span class="text-sm">Loading editor…</span>
          </div>
        </template>
        <NuxtCodeMirror
          ref="editorRef"
          v-model="localContent"
          :extensions="cmExtensions"
          :theme="cmThemeMode"
          :basic-setup="cmBasicSetup"
          :editable="props.editable"
          height="100%"
          class="h-full"
          :placeholder="placeholder"
          @on-create-editor="onEditorCreate"
        />
      </ClientOnly>

      <!-- Link action popup -->
      <UiPopup :show="linkPopup.show" :x="linkPopup.x" :y="linkPopup.y" :offset-y="20" @close="closeLinkPopup">
        <div v-if="linkPopup.isExternal" class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <Icon name="mdi:alert-outline" class="w-3.5 h-3.5 block flex-shrink-0" />
          <span>Be careful, external link</span>
        </div>
        <UiButton variant="menu-item" @click="openLink">
          <Icon name="mdi:open-in-new" class="w-4 h-4 block flex-shrink-0" />
          <span>Open Link</span>
        </UiButton>
        <UiButton variant="menu-item" @click="copyLinkUrl">
          <Icon name="mdi:content-copy" class="w-4 h-4 block flex-shrink-0" />
          <span>Copy Link</span>
        </UiButton>
        <UiButton variant="menu-item" @click="copyLinkName">
          <Icon name="mdi:format-text" class="w-4 h-4 block flex-shrink-0" />
          <span>Copy Link Name</span>
        </UiButton>
        <div class="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 truncate border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
          {{ linkPopup.url }}
        </div>
      </UiPopup>
    </div>
  </div>
</template>

<script setup>
import {
  EditorView,
  keymap as cmKeymap,
  scrollPastEnd,
  lineNumbers as cmLineNumbers,
  highlightActiveLine as cmHighlightActiveLine,
  highlightActiveLineGutter as cmHighlightActiveLineGutter,
} from '@codemirror/view'
import { Compartment, EditorSelection, EditorState, Prec } from '@codemirror/state'
import { foldGutter as cmFoldGutter, indentUnit } from '@codemirror/language'
import { closeBrackets as cmCloseBrackets } from '@codemirror/autocomplete'
import { undo as cmUndo, redo as cmRedo, undoDepth, redoDepth } from '@codemirror/commands'
import { numoriLanguage, numoriLightTheme, numoriDarkTheme } from '~/composables/useNumoriLanguage'
import { formatDisplay } from '~/composables/useDisplayFormatter'
import {
  setInlineResults,
  setMdDecorations,
  inlineResultField,
  mdPreviewField,
  buildInlineDecorations,
  buildMdDecorations,
} from '~/composables/useEditorDecorations'
import { useEditorInteractions } from '~/composables/useEditorInteractions'
import { injectInlineStyles } from '~/composables/useEditorStyles'

const props = defineProps({
  content: { type: String, default: '' },
  noteId: { type: String, default: null },
  placeholder: { type: String, default: 'Start typing... (e.g., 10 + 20)' },
  showResults: { type: Boolean, default: false },
  showInline: { type: Boolean, default: true },
  inlineAlign: { type: String, default: null },
  bordered: { type: Boolean, default: false },
  localePreferences: { type: Object, default: null },
  markdownMode: { type: String, default: 'full' },
  shortcutHandlers: { type: Object, default: null },
  editable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:content'])

const displayLines = ref([])
const rawLines = ref([])
const currentLine = ref(0)
const lineHeight = computed(() => props.localePreferences?.editorLineHeight ?? 19)
const localContent = ref(props.content)
const editorRef = ref(null)
const editorReady = ref(false)
let editorView = null
const canUndo = ref(false)
const canRedo = ref(false)

const updateUndoRedoState = () => {
  if (!editorView) { canUndo.value = false; canRedo.value = false; return }
  canUndo.value = undoDepth(editorView.state) > 0
  canRedo.value = redoDepth(editorView.state) > 0
}

const { evaluateLines } = useCalculator()
const colorMode = useColorMode()
const autoCopyResult = computed(() => props.localePreferences?.autoCopyResult !== false)

// --- Interactions (link popup, click/touch handlers) ---
const {
  linkPopup, closeLinkPopup, openLink, copyLinkUrl, copyLinkName,
  handleResultClick, handleResultTouchStart, handleResultTouch,
  handleMdClick, handleMdTouchStart, handleMdTouchMove, handleMdTouchEnd,
  handleContextMenu, cleanupTimers,
} = useEditorInteractions({
  displayLines, autoCopyResult,
  getShowInline: () => props.showInline,
  getMarkdownMode: () => props.markdownMode,
  getEditable: () => props.editable,
  getLocalePreferences: () => props.localePreferences,
})

// --- Compartments for dynamic reconfiguration ---
const themeCompartment = new Compartment()
const fontThemeCompartment = new Compartment()
const scrollPastEndCompartment = new Compartment()
const lineNumbersCompartment = new Compartment()
const foldGutterCompartment = new Compartment()
const activeLineCompartment = new Compartment()
const activeLineGutterCompartment = new Compartment()
const closeBracketsCompartment = new Compartment()
const tabSizeCompartment = new Compartment()
const wordWrapCompartment = new Compartment()
const editableCompartment = new Compartment()

// --- Font family map ---
const FONT_FAMILY_MAP = {
  system: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  'fira-code': "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'source-code-pro': "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'cascadia-code': "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  'ibm-plex-mono': "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
}

const editorFontSize = computed(() => props.localePreferences?.editorFontSize ?? 16)
const editorFontFamily = computed(
  () => FONT_FAMILY_MAP[props.localePreferences?.editorFontFamily] ?? FONT_FAMILY_MAP.system,
)
const editorLineNumbers = computed(() => {
  const val = props.localePreferences?.editorLineNumbers
  return ['on', 'off', 'relative', 'interval'].includes(val) ? val : 'on'
})
const editorCursorStyle = computed(() => {
  const val = props.localePreferences?.editorCursorStyle
  return ['line', 'line-thin'].includes(val) ? val : 'line'
})

// --- Build font/cursor theme ---
const buildFontTheme = () => {
  const fontSize = editorFontSize.value
  const fontFamily = editorFontFamily.value
  const lh = lineHeight.value
  const ligatures = props.localePreferences?.editorLigatures ? 'normal' : 'none'
  const cursorWidth = editorCursorStyle.value.includes('thin') ? '1px' : '2px'
  return EditorView.theme({
    '.cm-content': { fontFamily, fontSize: `${fontSize}px`, lineHeight: `${lh}px`, fontVariantLigatures: ligatures },
    '.cm-gutters': { fontFamily, fontSize: `${fontSize}px`, lineHeight: `${lh}px` },
    '.cm-cursor': { borderLeftWidth: cursorWidth },
    '.cm-line': { lineHeight: `${lh}px` },
  })
}

// --- Dispatch decoration updates ---
const updateInlineDecorations = () => {
  if (!editorView) return
  const decos = buildInlineDecorations(editorView, {
    showInline: props.showInline,
    displayLines: displayLines.value,
    inlineAlign: props.inlineAlign,
    localePreferences: props.localePreferences,
    editorFontSize: editorFontSize.value,
  })
  editorView.dispatch({ effects: setInlineResults.of(decos) })
}

const updateMarkdownPreview = () => {
  if (!editorView) return
  const decos = buildMdDecorations(editorView, {
    markdownMode: props.markdownMode,
  })
  editorView.dispatch({ effects: setMdDecorations.of(decos) })
}

// --- Keyboard shortcuts ---
const buildKeymap = () => {
  const h = props.shortcutHandlers
  if (!h) return []
  const bindings = []
  const map = [
    ['Mod-s', h.save],
    ['Mod-Shift-n', h.newNote],
    ['Mod-o', h.openFile],
    ['Mod-p', h.print],
    ['Mod-d', h.duplicate],
    ['Mod-h', h.help],
    ['Mod-Shift-s', h.exportAll],
  ]
  for (const [key, handler] of map) {
    if (handler) {
      bindings.push({ key, run: () => { handler(); return true }, preventDefault: true })
    }
  }
  return cmKeymap.of(bindings)
}

// --- NuxtCodeMirror basicSetup config ---
const cmBasicSetup = computed(() => ({
  lineNumbers: false, foldGutter: false, highlightActiveLine: false,
  highlightActiveLineGutter: false, closeBrackets: false, bracketMatching: true,
  autocompletion: false, highlightSelectionMatches: true, tabSize: false,
  drawSelection: true, rectangularSelection: true, crosshairCursor: false,
  dropCursor: true, allowMultipleSelections: true, indentOnInput: true,
  syntaxHighlighting: false, defaultKeymap: true, historyKeymap: true,
  searchKeymap: true, foldKeymap: true, completionKeymap: false, lintKeymap: false,
}))

const cmThemeMode = 'none'

// --- Helpers for dynamic compartment values ---
const buildLineNumbers = () => {
  const mode = editorLineNumbers.value
  if (mode === 'off') return []
  if (mode === 'relative') {
    return cmLineNumbers({
      formatNumber: (lineNo, state) => {
        const cursorLine = state.doc.lineAt(state.selection.main.head).number
        const diff = Math.abs(lineNo - cursorLine)
        return diff === 0 ? String(lineNo) : String(diff)
      },
    })
  }
  if (mode === 'interval') {
    return cmLineNumbers({ formatNumber: (lineNo) => (lineNo % 10 === 0 ? String(lineNo) : '') })
  }
  return cmLineNumbers()
}

const buildFoldGutter = () => (props.localePreferences?.editorFolding ?? true) ? cmFoldGutter() : []
const buildActiveLine = () => {
  const val = props.localePreferences?.editorRenderLineHighlight ?? 'line'
  return ['line', 'all'].includes(val) ? cmHighlightActiveLine() : []
}
const buildActiveLineGutter = () => {
  const val = props.localePreferences?.editorRenderLineHighlight ?? 'line'
  return val === 'all' ? cmHighlightActiveLineGutter() : []
}
const buildCloseBrackets = () =>
  (props.localePreferences?.editorAutoClosingBrackets ?? 'always') !== 'never' ? cmCloseBrackets() : []
const buildTabSize = () => indentUnit.of(' '.repeat(props.localePreferences?.editorTabSize ?? 2))
const buildWordWrap = () => (props.localePreferences?.editorWordWrap ? EditorView.lineWrapping : [])
const buildScrollPastEnd = () =>
  props.editable && props.localePreferences?.editorScrollPastEnd !== false ? scrollPastEnd() : []
// Read-only gate: blocks both user typing (editable) and programmatic/command
// edits (readOnly). Reconfigured live when `editable` changes (note switch).
// Prec.highest ensures this wins over any editable/readOnly facet the
// underlying nuxt-codemirror set at creation time.
const buildEditable = () =>
  Prec.highest([EditorView.editable.of(props.editable), EditorState.readOnly.of(!props.editable)])

// --- Extensions array ---
const cmExtensions = computed(() => [
  numoriLanguage,
  themeCompartment.of(colorMode.value === 'dark' ? numoriDarkTheme : numoriLightTheme),
  fontThemeCompartment.of(buildFontTheme()),
  lineNumbersCompartment.of(buildLineNumbers()),
  foldGutterCompartment.of(buildFoldGutter()),
  activeLineCompartment.of(buildActiveLine()),
  activeLineGutterCompartment.of(buildActiveLineGutter()),
  closeBracketsCompartment.of(buildCloseBrackets()),
  tabSizeCompartment.of(buildTabSize()),
  wordWrapCompartment.of(buildWordWrap()),
  scrollPastEndCompartment.of(buildScrollPastEnd()),
  editableCompartment.of(buildEditable()),
  inlineResultField,
  mdPreviewField,
  buildKeymap(),
  EditorView.updateListener.of((update) => {
    if (update.selectionSet || update.docChanged) {
      const line = update.state.doc.lineAt(update.state.selection.main.head)
      currentLine.value = line.number - 1
      if (editorLineNumbers.value === 'relative') {
        update.view.dispatch({ effects: lineNumbersCompartment.reconfigure(buildLineNumbers()) })
      }
    }
    if (update.docChanged || update.transactions.some((t) => t.isUserEvent('undo') || t.isUserEvent('redo'))) {
      updateUndoRedoState()
    }
  }),
  EditorView.domEventHandlers({
    focus: () => {
      window.__codemirrorFocused = true
      window.dispatchEvent(new CustomEvent('codemirrorFocus', { detail: true }))

      // On mobile, the virtual keyboard pushes the viewport up.
      // Wait for the keyboard to finish animating, then smoothly
      // nudge the scroll down so the cursor clears the toolbar.
      if (editorView && 'ontouchstart' in window) {
        setTimeout(() => {
          if (!editorView) return
          const scroller = editorView.scrollDOM
          if (scroller) {
            scroller.scrollBy({ top: 10, behavior: 'smooth' })
          }
        }, 400)
      }
    },
    blur: () => {
      window.__codemirrorFocused = false
      window.dispatchEvent(new CustomEvent('codemirrorFocus', { detail: false }))
    },
    click: (event, view) => {
      if (handleMdClick(event, view)) return true
      return handleResultClick(event, view)
    },
    touchstart: (event, view) => {
      handleResultTouchStart(event)
      return handleMdTouchStart(event, view)
    },
    touchmove: (event) => handleMdTouchMove(event),
    touchend: (event, view) => {
      if (handleMdTouchEnd(event, view)) return true
      return handleResultTouch(event, view)
    },
    contextmenu: (event, view) => handleContextMenu(event, view),
  }),
])

// --- Editor lifecycle ---
const initEditor = (view) => {
  if (editorReady.value) return
  editorView = view
  injectInlineStyles()
  updateLines(props.content)
  updateInlineDecorations()
  updateMarkdownPreview()
  editorReady.value = true
}

const onEditorCreate = (payload) => { initEditor(payload.view) }

let initPollTimer = null
const pollForView = () => {
  if (editorReady.value) { clearInterval(initPollTimer); return }
  const view = editorRef.value?.view
  if (view && typeof view.dispatch === 'function') { clearInterval(initPollTimer); initEditor(view) }
}
onMounted(() => {
  initPollTimer = setInterval(pollForView, 50)
  setTimeout(() => clearInterval(initPollTimer), 10000)
})

onBeforeUnmount(() => {
  if (initPollTimer) clearInterval(initPollTimer)
  cleanupTimers()
})

onMounted(() => { updateLines(props.content) })

// --- Watchers ---
watch(() => props.localePreferences, () => {
  reformatDisplay()
  if (editorView) {
    editorView.dispatch({
      effects: [
        fontThemeCompartment.reconfigure(buildFontTheme()),
        lineNumbersCompartment.reconfigure(buildLineNumbers()),
        foldGutterCompartment.reconfigure(buildFoldGutter()),
        activeLineCompartment.reconfigure(buildActiveLine()),
        activeLineGutterCompartment.reconfigure(buildActiveLineGutter()),
        closeBracketsCompartment.reconfigure(buildCloseBrackets()),
        tabSizeCompartment.reconfigure(buildTabSize()),
        wordWrapCompartment.reconfigure(buildWordWrap()),
        scrollPastEndCompartment.reconfigure(buildScrollPastEnd()),
      ],
    })
  }
}, { deep: true })

watch(() => props.localePreferences?.showResultsInCodeBlocks, () => {
  updateLines(localContent.value)
  updateInlineDecorations()
})

// Reconfigure read-only state live when switching between editable and
// archived/binned notes (the editor instance is reused across notes).
watch(() => props.editable, () => {
  if (!editorView) return
  editorView.dispatch({
    effects: [
      editableCompartment.reconfigure(buildEditable()),
      scrollPastEndCompartment.reconfigure(buildScrollPastEnd()),
    ],
  })
})

watch(() => colorMode.value, () => {
  if (!editorView) return
  editorView.dispatch({
    effects: themeCompartment.reconfigure(colorMode.value === 'dark' ? numoriDarkTheme : numoriLightTheme),
  })
})

// Live clock
const tickLiveTime = () => {
  const raw = rawLines.value
  if (!raw.length) return
  const hasLive = raw.some((l) => l.liveTime)
  if (!hasLive) return
  for (const line of raw) {
    if (!line.liveTime) continue
    const now = new Date()
    line.result = line.iana
      ? now.toLocaleString('en-US', { timeZone: line.iana })
      : now.toLocaleString('en-US')
    line.value = now.getTime()
  }
  reformatDisplay()
}
useIntervalFn(tickLiveTime, 1000)

// --- Scroll position memory per note (persisted via Dexie) ---
const scrollPositions = new Map()
let scrollRestoreTimer = null
let scrollSaveTimer = null
let isRestoringScroll = false
const SCROLL_DB_KEY = 'scroll_positions'

// Load persisted scroll positions on mount
const loadScrollPositions = async () => {
  try {
    const { default: db } = await import('~/db.js')
    const row = await db.appState.get(SCROLL_DB_KEY)
    if (row?.value) {
      const entries = JSON.parse(row.value)
      for (const [k, v] of entries) scrollPositions.set(k, v)
    }
  } catch { /* ignore */ }
}
const scrollDbReady = loadScrollPositions()

const persistScrollPositions = () => {
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
  scrollSaveTimer = setTimeout(async () => {
    scrollSaveTimer = null
    try {
      const { default: db } = await import('~/db.js')
      await db.appState.put({ key: SCROLL_DB_KEY, value: JSON.stringify([...scrollPositions]) })
    } catch { /* ignore */ }
  }, 1000)
}

const persistScrollPositionsNow = () => {
  if (editorView && props.noteId) {
    scrollPositions.set(props.noteId, editorView.scrollDOM.scrollTop)
  }
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
  scrollSaveTimer = null
  import('~/db.js').then(({ default: db }) => {
    db.appState.put({ key: SCROLL_DB_KEY, value: JSON.stringify([...scrollPositions]) }).catch(() => {})
  }).catch(() => {})
}

// Save scroll position continuously on scroll events
const onEditorScroll = () => {
  if (!props.noteId || isRestoringScroll) return
  scrollPositions.set(props.noteId, editorView.scrollDOM.scrollTop)
  persistScrollPositions()
}

// Attach scroll listener once editor is ready
watch(editorReady, (ready) => {
  if (ready && editorView) {
    editorView.scrollDOM.addEventListener('scroll', onEditorScroll, { passive: true })
  }
})

onMounted(() => {
  window.addEventListener('beforeunload', persistScrollPositionsNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistScrollPositionsNow()
  })
})
onBeforeUnmount(() => {
  if (editorView) {
    editorView.scrollDOM.removeEventListener('scroll', onEditorScroll)
  }
  window.removeEventListener('beforeunload', persistScrollPositionsNow)
  persistScrollPositionsNow()
})

watch(displayLines, () => {
  nextTick(() => {
    updateInlineDecorations()
    if (props.markdownMode !== 'off') updateMarkdownPreview()
  })
})

// Restore scroll for the initial note once editor + DB are both ready
watch(editorReady, async (ready) => {
  if (!ready || !props.noteId) return
  await scrollDbReady
  isRestoringScroll = true
  setTimeout(() => {
    if (editorView) {
      editorView.scrollDOM.scrollTop = scrollPositions.get(props.noteId) ?? 0
    }
    setTimeout(() => { isRestoringScroll = false }, 200)
  }, 200)
})

watch(() => props.noteId, (newId, oldId) => {
  if (!editorView || newId === oldId) return
  // Cancel any pending restore from a previous rapid switch
  if (scrollRestoreTimer) clearTimeout(scrollRestoreTimer)
  // The scroll position for oldId is already saved by the scroll event listener.
  // Restore after everything settles.
  isRestoringScroll = true
  scrollRestoreTimer = setTimeout(() => {
    scrollRestoreTimer = null
    if (editorView) {
      editorView.scrollDOM.scrollTop = scrollPositions.get(newId) ?? 0
    }
    setTimeout(() => { isRestoringScroll = false }, 200)
  }, 200)
})
watch(() => props.showInline, () => updateInlineDecorations())
watch(() => props.inlineAlign, () => updateInlineDecorations())
watch(() => props.localePreferences?.inlineResultAlign, () => updateInlineDecorations())
watch(() => props.markdownMode, () => nextTick(() => updateMarkdownPreview()))
watch(currentLine, () => {
  if (props.markdownMode === 'edit' && editorView) nextTick(() => updateMarkdownPreview())
})

// External content changes
let suppressEmit = false
watch(() => props.content, (newContent) => {
  if (localContent.value === newContent) return
  if (editorView) {
    const currentDoc = editorView.state.doc.toString()
    if (currentDoc === newContent) {
      suppressEmit = true
      localContent.value = newContent
      nextTick(() => { suppressEmit = false })
      return
    }
    const oldStr = currentDoc
    const newStr = newContent
    let prefixLen = 0
    const minLen = Math.min(oldStr.length, newStr.length)
    while (prefixLen < minLen && oldStr[prefixLen] === newStr[prefixLen]) prefixLen++
    let suffixLen = 0
    const maxSuffix = minLen - prefixLen
    while (suffixLen < maxSuffix && oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]) suffixLen++
    const from = prefixLen
    const to = oldStr.length - suffixLen
    const insert = newStr.slice(prefixLen, newStr.length - suffixLen)
    suppressEmit = true
    localContent.value = newContent
    editorView.dispatch({ changes: { from, to, insert } })
    nextTick(() => { suppressEmit = false })
    updateLines(newContent)
  } else {
    localContent.value = newContent
    updateLines(newContent)
  }
})

const debouncedUpdateLines = useDebounceFn((text) => updateLines(text), 80)
watch(localContent, (newContent) => {
  if (!suppressEmit) emit('update:content', newContent)
  debouncedUpdateLines(newContent)
})

// --- Core logic ---
const updateLines = (text) => {
  if (!text) { rawLines.value = []; displayLines.value = []; return }
  const lines = text.split('\n')
  rawLines.value = evaluateLines(lines, {
    showResultsInCodeBlocks: props.localePreferences?.showResultsInCodeBlocks ?? false,
  })
  reformatDisplay()
}

const reformatDisplay = () => {
  const prefs = props.localePreferences
  if (!prefs || !rawLines.value.length) { displayLines.value = rawLines.value; return }
  displayLines.value = rawLines.value.map((line) => {
    if (!line.result) return line
    return { ...line, result: formatDisplay(line.result, null, prefs) }
  })
}

// --- Expose methods for toolbar actions ---
const insertText = (text) => {
  if (!props.editable) return
  if (!editorView) {
    const newContent = localContent.value + text
    localContent.value = newContent
    emit('update:content', newContent)
    return
  }
  const { from } = editorView.state.selection.main
  editorView.dispatch({ changes: { from, insert: text }, selection: EditorSelection.cursor(from + text.length) })
  editorView.focus()
}

const wrapSelection = (before, after = before) => {
  if (!props.editable) return
  if (!editorView) {
    const newContent = localContent.value + before + after
    localContent.value = newContent
    emit('update:content', newContent)
    return
  }
  const { from, to } = editorView.state.selection.main
  const selectedText = editorView.state.sliceDoc(from, to)
  if (selectedText) {
    const wrapped = before + selectedText + after
    editorView.dispatch({
      changes: { from, to, insert: wrapped },
      selection: EditorSelection.range(from + before.length, from + before.length + selectedText.length),
    })
  } else {
    editorView.dispatch({
      changes: { from, insert: before + after },
      selection: EditorSelection.cursor(from + before.length),
    })
  }
  editorView.focus()
}

const indentLine = () => {
  if (!props.editable || !editorView) return
  const line = editorView.state.doc.lineAt(editorView.state.selection.main.head)
  editorView.dispatch({
    changes: { from: line.from, insert: '  ' },
    selection: EditorSelection.cursor(editorView.state.selection.main.head + 2),
  })
  editorView.focus()
}

const outdentLine = () => {
  if (!props.editable || !editorView) return
  const line = editorView.state.doc.lineAt(editorView.state.selection.main.head)
  const text = line.text
  if (text.startsWith('  ')) {
    editorView.dispatch({
      changes: { from: line.from, to: line.from + 2, insert: '' },
      selection: EditorSelection.cursor(Math.max(line.from, editorView.state.selection.main.head - 2)),
    })
  } else if (text.startsWith('\t')) {
    editorView.dispatch({
      changes: { from: line.from, to: line.from + 1, insert: '' },
      selection: EditorSelection.cursor(Math.max(line.from, editorView.state.selection.main.head - 1)),
    })
  }
  editorView.focus()
}

defineExpose({
  insertText, wrapSelection, indentLine, outdentLine,
  canUndo, canRedo, linkPopup, closeLinkPopup, openLink, copyLinkUrl, copyLinkName,
  undo: () => { if (props.editable && editorView) { cmUndo(editorView); updateUndoRedoState(); editorView.focus() } },
  redo: () => { if (props.editable && editorView) { cmRedo(editorView); updateUndoRedoState(); editorView.focus() } },
  blur: () => { if (editorView) editorView.contentDOM.blur() },
})
</script>
