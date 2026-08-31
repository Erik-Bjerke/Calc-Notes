// CodeMirror 6 language definition for numori
//
// numori is a natural-language calculator notepad — not a programming
// language. Users write plain-English expressions like "price = $120",
// "20% of total", "5 km in miles", "today + 3 days". The highlighting
// should feel like annotating a notebook, not colouring source code.
//
// Token roles (mapped to @lezer/highlight tags):
//   heading        → # markdown headers
//   comment        → // line comments
//   labelName      → "Label:" prefix on a line
//   keyword        → aggregation: sum, sub, total, average, avg, prev
//   operatorKeyword→ conversion glue: in, to, as, into, of, on, off
//   typeName       → date/time words: now, today, tomorrow, yesterday, time, next/last week/month/year
//   name.definition→ functions: sqrt(), round(), sin(), fromunix(), etc.
//   atom           → constants: pi, e, tau, phi, c
//   unit           → currency symbols/codes, %, unit suffixes (km, lb, mpg…)
//   number         → numeric literals (incl. hex, bin, oct) and numbers with units
//   variableName   → user-defined identifiers
//   operator       → arithmetic: + - * / ^ = and word operators
//   bracket        → ( )
//   string         → scale words: k, M, thousand, million, billion, trillion

import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

export const numoriStreamParser = {
  startState() {
    return { inCodeBlock: false }
  },
  token(stream, state) {
    // ── Fenced code block tracking ───────────────────────────────
    if (stream.sol()) {
      if (!state.inCodeBlock && stream.match(/^```[\w+#.-]*$/, false)) {
        state.inCodeBlock = true
        stream.skipToEnd()
        return 'comment'
      }
      if (state.inCodeBlock) {
        if (stream.match(/^```$/, false)) {
          state.inCodeBlock = false
          stream.skipToEnd()
          return 'comment'
        }
        // Inside code block — consume entire line, return null so
        // HighlightStyle does not colour it (highlight.js handles it)
        stream.skipToEnd()
        return null
      }
    } else if (state.inCodeBlock) {
      stream.skipToEnd()
      return null
    }

    // ── Start-of-line constructs ──────────────────────────────────
    if (stream.sol()) {
      if (stream.match(/^#.*$/)) return 'heading'
      if (stream.match(/^\/\/.*$/)) return 'comment'
      if (stream.match(/^[^:\n]+:/)) return 'labelName'
    }

    if (stream.eatSpace()) return null

    // ── Inline comments (// mid-line) ────────────────────────────
    if (stream.match(/\/\/.*$/)) return 'comment'

    // ── Date / time keywords ─────────────────────────────────────
    if (stream.match(/\b(now|time|today|yesterday|tomorrow)\b/)) return 'typeName'
    if (stream.match(/\b(next|last)\s+(week|month|year)\b/)) return 'typeName'

    // ── Aggregation keywords ─────────────────────────────────────
    if (stream.match(/\b(sum|sub|total|average|avg|prev)\b/)) return 'keyword'

    // ── Checkbox filter keywords ─────────────────────────────────
    if (stream.match(/\b(checked|unchecked)\b/)) return 'keyword'

    // ── Conversion glue words ────────────────────────────────────
    if (stream.match(/\b(in|to|as|into|of|on|off|what|is)\b/)) return 'operatorKeyword'

    // ── Word operators (must come before variable catch-all) ─────
    if (stream.match(/\b(multiplied\s+by|divide\s+by)\b/)) return 'operator'
    if (stream.match(/\b(plus|minus|times|divide|mod|and|with|without|subtract|mul|xor)\b/))
      return 'operator'

    // ── Functions (name followed by open paren) ──────────────────
    if (
      stream.match(
        /\b(sqrt|cbrt|abs|log|ln|fact|round|ceil|floor|sin|cos|tan|arcsin|arccos|arctan|sinh|cosh|tanh|fromunix|root)\s*\(/,
      )
    )
      return 'name.definition'
    // log with base: "log 2 ("
    if (stream.match(/\blog\s+\d+\s*\(/)) return 'name.definition'
    // root with degree: "root 3 ("
    if (stream.match(/\broot\s+\d+\s*\(/)) return 'name.definition'

    // ── Constants ────────────────────────────────────────────────
    if (stream.match(/\b(pi|tau|phi)\b/)) return 'atom'
    if (stream.match(/\bc\b/)) return 'atom'
    if (stream.match(/\be\b/)) return 'atom'

    // ── Currency symbols ─────────────────────────────────────────
    if (stream.match(/[$€£¥₹₽]/)) return 'unit'

    // ── Currency codes ───────────────────────────────────────────
    if (
      stream.match(
        /\b(USD|EUR|GBP|JPY|INR|RUB|CAD|AUD|CHF|CNY|NZD|SEK|NOK|DKK|BRL|MXN|ZAR|KRW|SGD|HKD|TRY|PLN|CZK|HUF|THB|MYR|PHP|IDR|TWD|ARS|CLP|COP|PEN|VND|EGP|NGN|KES|GHS|MAD|TND|ILS|SAR|AED|QAR|KWD|BHD|OMR)\b/i,
      )
    )
      return 'unit'

    // ── Percentage with number ───────────────────────────────────
    if (stream.match(/\d+\.?\d*\s*%/)) return 'unit'

    // ── Scale words (after a number, or standalone) ──────────────
    if (
      stream.match(/\b(thousand|thousands|million|millions|billion|billions|trillion|trillions)\b/)
    )
      return 'string'

    // ── Numbers with units (spaceless: 100km, 5kg, 30mpg) ───────
    if (
      stream.match(
        /\d+\.?\d*\s*(km|m|cm|mm|ft|feet|foot|inch|inches|yd|yard|yards|mi|mile|miles|nm|kg|g|mg|lb|lbs|oz|tonne|tonnes|stone|l|ml|gal|gallon|gallons|qt|quart|pint|cup|tablespoon|tablespoons|teaspoon|teaspoons|cbm|sec|second|seconds|min|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|KB|MB|GB|TB|KiB|MiB|GiB|TiB|byte|bytes|bit|bits|px|pt|em|rem|kph|mph|knot|knots|mpg|mpg_uk|kpl|mpl|kpg|kpg_uk|celsius|fahrenheit|kelvin|acre|acres|hectare|hectares|sqm|sqft|degree|degrees|radian|radians)\b/,
      )
    )
      return 'number'

    // ── Hex, binary, octal literals ──────────────────────────────
    if (stream.match(/0[xX][0-9a-fA-F]+/)) return 'number'
    if (stream.match(/0[bB][01]+/)) return 'number'
    if (stream.match(/0[oO][0-7]+/)) return 'number'

    // ── Plain numbers ────────────────────────────────────────────
    if (stream.match(/\d+\.?\d*/)) return 'number'

    // ── Scale suffixes (k, M after a number — caught as identifier) ──
    // These are single-letter scales that follow numbers
    if (stream.match(/\b[kK]\b/)) return 'string'
    if (stream.match(/\bM\b/)) return 'string'

    // ── Arithmetic operators ─────────────────────────────────────
    if (stream.match(/[+\-*/^%]/)) return 'operator'
    if (stream.match(/[=<>!&|]/)) return 'operator'
    if (stream.match(/<<|>>/)) return 'operator'

    // ── Brackets ─────────────────────────────────────────────────
    if (stream.match(/[()]/)) return 'bracket'

    // ── Degree symbol ────────────────────────────────────────────
    if (stream.match(/°/)) return 'unit'

    // ── Unit words (standalone, not attached to numbers) ─────────
    if (
      stream.match(
        /\b(km|m|cm|mm|ft|feet|foot|inch|inches|yd|yard|yards|mi|mile|miles|nm|kg|g|mg|lb|lbs|oz|tonne|tonnes|stone|l|ml|gal|gallon|gallons|qt|quart|pint|cup|tablespoon|tablespoons|teaspoon|teaspoons|tea\s+spoon|tea\s+spoons|cbm|sec|second|seconds|min|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|KB|MB|GB|TB|KiB|MiB|GiB|TiB|byte|bytes|bit|bits|px|pt|em|rem|kph|mph|knot|knots|mpg|mpg_uk|kpl|mpl|kpg|kpg_uk|celsius|fahrenheit|kelvin|acre|acres|hectare|hectares|sqm|sqft|sq|square|cu|cubic|degree|degrees|radian|radians|hex|bin|oct|sci|scientific|per|uk)\b/,
      )
    )
      return 'unit'

    // ── Identifiers (variables) ──────────────────────────────────
    if (stream.match(/\b[a-zA-Z_]\w*\b/)) return 'variableName'

    stream.next()
    return null
  },
}

export const numoriLanguage = StreamLanguage.define(numoriStreamParser)

// ─── Palette ────────────────────────────────────────────────────────
//
// The philosophy: numori is a notepad, not an IDE. Numbers and
// currency are the stars — they're what the user cares about. Variables
// blend with the foreground. Operators and conversion words recede.
// Structure (headers, labels, comments) provides visual rhythm.
//
// Dark                              Light
// bg:        #2D2A2E                bg:        #FCFCFA
// fg:        #FCFCFA                fg:        #2D2A2E
// keyword:   #FF6188                keyword:   #CC2D56
// argument:  #FC9867                argument:  #C4621A
// string:    #FFD866                string:    #A68A1B
// function:  #A9DC76                function:  #4D8C2A
// class:     #78DCE8                class:     #1A8A9A
// constant:  #AB9DF2                constant:  #7B5FC4

// ─────────────────────────────────────────────────────────────────────
// Light highlight — warm paper, muted accents
// ─────────────────────────────────────────────────────────────────────
const lightHighlight = HighlightStyle.define([
  // Structure
  { tag: t.heading, color: '#2D2A2E', fontWeight: '700' },
  { tag: t.comment, color: '#939293', fontStyle: 'italic' },
  { tag: t.labelName, color: '#727072', fontWeight: '600' },

  // Aggregation: sum, total, avg, prev — these are special, stand out
  { tag: t.keyword, color: '#CC2D56', fontWeight: '600' },

  // Conversion glue: in, to, as, of — fade into background
  { tag: t.operatorKeyword, color: '#939293' },

  // Date/time: now, today, tomorrow — informational, cool tone
  { tag: t.typeName, color: '#1A8A9A' },

  // Functions: sqrt(), round() — action words, green
  { tag: t.definition(t.name), color: '#4D8C2A' },

  // Constants: pi, e, tau — special values, purple
  { tag: t.atom, color: '#7B5FC4' },

  // Currency & units & percentages — the "what" of a value, warm orange
  { tag: t.unit, color: '#C4621A' },

  // Numbers — the core data, prominent but not loud
  { tag: t.number, color: '#A68A1B' },

  // Scale words: thousand, million — like units, warm
  { tag: t.string, color: '#C4621A' },

  // Variables — blend with foreground, they're just names
  { tag: t.variableName, color: '#2D2A2E' },

  // Operators: + - * / = — structural, recede
  { tag: t.operator, color: '#C1C0C0' },

  // Brackets — same as operators
  { tag: t.bracket, color: '#C1C0C0' },
])

// ─────────────────────────────────────────────────────────────────────
// Dark highlight — rich warm tones on deep charcoal
// ─────────────────────────────────────────────────────────────────────
const darkHighlight = HighlightStyle.define([
  // Structure
  { tag: t.heading, color: '#FCFCFA', fontWeight: '700' },
  { tag: t.comment, color: '#727072', fontStyle: 'italic' },
  { tag: t.labelName, color: '#C1C0C0', fontWeight: '600' },

  // Aggregation: sum, total, avg, prev
  { tag: t.keyword, color: '#FF6188', fontWeight: '600' },

  // Conversion glue: in, to, as, of
  { tag: t.operatorKeyword, color: '#727072' },

  // Date/time: now, today, tomorrow
  { tag: t.typeName, color: '#78DCE8' },

  // Functions: sqrt(), round()
  { tag: t.definition(t.name), color: '#A9DC76' },

  // Constants: pi, e, tau
  { tag: t.atom, color: '#AB9DF2' },

  // Currency & units & percentages
  { tag: t.unit, color: '#FC9867' },

  // Numbers
  { tag: t.number, color: '#FFD866' },

  // Scale words: thousand, million
  { tag: t.string, color: '#FC9867' },

  // Variables — near-foreground, just slightly dimmer
  { tag: t.variableName, color: '#FCFCFA' },

  // Operators
  { tag: t.operator, color: '#5B595C' },

  // Brackets
  { tag: t.bracket, color: '#5B595C' },
])

// ─────────────────────────────────────────────────────────────────────
// Light editor chrome
// ─────────────────────────────────────────────────────────────────────
const lightEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#FCFCFA',
      color: '#2D2A2E',
    },
    '.cm-gutters': {
      backgroundColor: '#F5F4F2',
      borderRight: '1px solid #ECEAE8',
    },
    '.cm-lineNumbers .cm-gutterElement': { color: '#C1C0C0' },
    '.cm-activeLineGutter .cm-gutterElement': { color: '#727072' },
    '.cm-activeLine': { backgroundColor: '#F5F4F280' },
    '.cm-cursor': { borderLeftColor: '#2D2A2E' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#CC2D5625',
    },
    '.cm-selectionMatch': { backgroundColor: '#CC2D5615' },
    '.cm-matchingBracket': { backgroundColor: '#A9DC7640', color: '#4D8C2A', outline: 'none' },
    '.cm-searchMatch': { backgroundColor: '#FFD86640', outline: '1px solid #A68A1B' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#FFD86660' },
    '.cm-placeholder': { color: '#C1C0C0', fontStyle: 'italic' },
  },
  { dark: false },
)

// ─────────────────────────────────────────────────────────────────────
// Dark editor chrome
// ─────────────────────────────────────────────────────────────────────
const darkEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#2D2A2E',
      color: '#FCFCFA',
    },
    '.cm-gutters': {
      backgroundColor: '#2D2A2E',
      borderRight: '1px solid #403E41',
    },
    '.cm-lineNumbers .cm-gutterElement': { color: '#5B595C' },
    '.cm-activeLineGutter .cm-gutterElement': { color: '#939293' },
    '.cm-activeLine': { backgroundColor: '#403E4180' },
    '.cm-cursor': { borderLeftColor: '#FCFCFA' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#FF618830',
    },
    '.cm-selectionMatch': { backgroundColor: '#FF618818' },
    '.cm-matchingBracket': { backgroundColor: '#AB9DF240', color: '#AB9DF2', outline: 'none' },
    '.cm-searchMatch': { backgroundColor: '#FFD86630', outline: '1px solid #FFD866' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#FFD86650' },
    '.cm-placeholder': { color: '#5B595C', fontStyle: 'italic' },
  },
  { dark: true },
)

export const numoriLightTheme = [lightEditorTheme, syntaxHighlighting(lightHighlight)]
export const numoriDarkTheme = [darkEditorTheme, syntaxHighlighting(darkHighlight)]
