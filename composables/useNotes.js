import { liveQuery } from 'dexie'
import db from '~/db.js'
import { uniqueInternalName } from '~/utils/normaliseName.js'

export const useNotes = () => {
  const notes = ref([])
  const currentNoteId = ref(null)
  const deletedIds = ref([])
  const notesLoaded = ref(false)

  // ── Reactive liveQuery: auto-updates `notes` when DB changes ──────────
  let subscription = null

  const startLiveQuery = () => {
    if (!import.meta.client) return
    const observable = liveQuery(() => db.notes.orderBy('sortOrder').toArray())
    subscription = observable.subscribe({
      next: (rows) => {
        const incoming = new Map(rows.map((r) => [r.id, r]))
        for (let i = notes.value.length - 1; i >= 0; i--) {
          if (!incoming.has(notes.value[i].id)) notes.value.splice(i, 1)
        }
        for (const row of rows) {
          const existing = notes.value.find((n) => n.id === row.id)
          if (existing) {
            for (const key of Object.keys(row)) {
              const oldVal = existing[key]
              const newVal = row[key]
              if (oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                existing[key] = newVal
              }
            }
          } else {
            notes.value.push(row)
          }
        }
        notes.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      },
      error: (err) => console.error('liveQuery error:', err),
    })
  }

  const stopLiveQuery = () => {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
  }

  // ── Load initial state from Dexie ─────────────────────────────────────
  const loadNotes = async () => {
    if (!import.meta.client) return

    // Load notes
    notes.value = await db.notes.orderBy('sortOrder').toArray()

    // Load deleted IDs
    const row = await db.appState.get('deleted_note_ids')
    if (row?.value) {
      try {
        deletedIds.value = JSON.parse(row.value)
      } catch {
        deletedIds.value = []
      }
    }

    // Rule 1: Create welcome note only on first-ever app open while NOT logged in.
    // The flag persists across sessions so it's only created once per device.
    const welcomeRow = await db.appState.get('welcome_note_created')
    const welcomeAlreadyCreated = !!welcomeRow?.value
    if (notes.value.length === 0 && !welcomeAlreadyCreated) {
      const defaultNote = createNote('Welcome', 'Notes with calculator features')
      await db.notes.put(defaultNote)
      notes.value = [defaultNote]
      await db.appState.put({ key: 'welcome_note_created', value: '1' })
    }

    // Start live reactivity after initial load
    startLiveQuery()
    notesLoaded.value = true
  }

  // ── Persist helpers ───────────────────────────────────────────────────
  // IndexedDB uses structured clone — Vue Proxy objects can't be cloned,
  // so we must unwrap to plain objects before every write.
  const toRaw = (obj) => JSON.parse(JSON.stringify(obj))

  const saveNotes = async () => {
    if (!import.meta.client) return
    await db.notes.bulkPut(toRaw(notes.value))
  }

  const saveDeletedIds = async () => {
    if (!import.meta.client) return
    await db.appState.put({ key: 'deleted_note_ids', value: JSON.stringify(deletedIds.value) })
  }

  const clearDeletedIds = async () => {
    deletedIds.value = []
    if (import.meta.client) {
      await db.appState.delete('deleted_note_ids')
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const allTags = computed(() => {
    const tagSet = new Set()
    notes.value.forEach((n) => {
      if (!n.deletedAt && n.tags) n.tags.forEach((t) => tagSet.add(t))
    })
    return [...tagSet].sort()
  })

  // ── CRUD ──────────────────────────────────────────────────────────────
  // ── Welcome note detection ─────────────────────────────────────────────
  // Hash of the default welcome note content, used to distinguish the
  // auto-generated welcome note from user notes with the same title.
  const WELCOME_CONTENT = `# Welcome to Numori!

Write naturally. Results appear on the right.

## Quick Math
2 + 3
(10 + 5) * 2
17 mod 5
5 plus 3
10 without 3

## Variables
price = $100
tax = 8.5% of price
total = price + tax

## Percentages
200 + 15%
200 - 15%
50 as a % of 200
20% of what is 60

## Currencies
$1000 in EUR
€80 + $450 in GBP
budget = $85k
budget in EUR

## Unit Conversions
100 km in miles
72 fahrenheit in celsius
1 cup in ml
5 lb in kg
1 GB in MB

## Dates & Time
today
tomorrow
today + 2 weeks
next month
time in Tokyo
fromunix(1446587186)

## Sum & Average
Rent: -€800
Food: -€200
Fun: -€100
Monthly costs: sum

## Math Functions
sqrt(144)
pi * 5^2
log(1000)
sin(45°)
fact(5)

## Dev Tools
0xFF + 1
255 in hex
10 in bin
12 & 10
1 << 4
12 pt in px

## Scales
revenue = €3M
costs = €1.5M
profit = revenue - costs

## Labels & Prev
Cost: $20 + $56
Discounted: prev - 10%

// Lines starting with // are comments
// Lines starting with # are headers
// Explore Templates for more ideas!`

  /** Check if a note is the unmodified auto-generated welcome note. */
  const isWelcomeNote = (note) => {
    return (
      note.title === 'Welcome' &&
      note.description === 'Notes with calculator features' &&
      note.content === WELCOME_CONTENT
    )
  }

  /**
   * Remove the auto-generated welcome note if it exists and is unmodified.
   * Matched by exact content hash (title + description + full content body).
   * Adds the note to deletedIds so it gets cleaned up from the server on next sync.
   */
  const removeWelcomeNoteIfNeeded = async () => {
    const welcome = notes.value.find(isWelcomeNote)
    if (!welcome) return
    const idx = notes.value.indexOf(welcome)
    if (idx !== -1) notes.value.splice(idx, 1)
    if (!deletedIds.value.includes(welcome.id)) {
      deletedIds.value.push(welcome.id)
      await db.appState.put({ key: 'deleted_note_ids', value: JSON.stringify(deletedIds.value) })
    }
    await db.notes.delete(welcome.id)
  }

  const createNote = (title = 'Untitled Note', description = '') => {
    const defaultContent = title === 'Welcome' ? WELCOME_CONTENT : ''
    const existingNames = notes.value.map((n) => n.internalName).filter(Boolean)

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title,
      internalName: uniqueInternalName(title, existingNames, 'untitled_note'),
      description,
      tags: [],
      sortOrder: 0,
      groupId: null,
      content: defaultContent,
      archived: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  const addNote = () => {
    const now = new Date().toISOString()
    notes.value.forEach((n) => {
      n.sortOrder = (n.sortOrder ?? 0) + 1
      n.updatedAt = now
    })
    const newNote = createNote()
    newNote.sortOrder = 0
    notes.value.unshift(newNote)
    currentNoteId.value = newNote.id
    saveNotes()
    return newNote
  }

  const deleteNote = (id) => {
    const index = notes.value.findIndex((n) => n.id === id)
    if (index !== -1) {
      notes.value.splice(index, 1)

      if (!deletedIds.value.includes(id)) {
        deletedIds.value.push(id)
        saveDeletedIds()
      }

      if (currentNoteId.value === id) {
        const next = notes.value.find((n) => n.id !== id && !n.archived && !n.deletedAt)
        currentNoteId.value = next ? next.id : notes.value.length > 0 ? notes.value[0].id : null
      }

      // Remove from DB
      db.notes.delete(id)
      saveNotes()
    }
  }

  /** Soft-delete: move note to bin by setting deletedAt timestamp */
  const softDeleteNote = (id) => {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.deletedAt = new Date().toISOString()
      note.updatedAt = new Date().toISOString()
      if (currentNoteId.value === id) {
        const next = notes.value.find((n) => n.id !== id && !n.archived && !n.deletedAt)
        currentNoteId.value = next ? next.id : null
      }
      saveNotes()
    }
  }

  /** Restore a note from the bin */
  const restoreNote = (id) => {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.deletedAt = null
      note.updatedAt = new Date().toISOString()
      saveNotes()
    }
  }

  /** Permanently delete a note from the bin */
  const permanentlyDeleteNote = (id) => {
    deleteNote(id)
  }

  /** Empty the entire bin (permanently delete all soft-deleted notes) */
  const emptyBin = () => {
    const binNotes = notes.value.filter((n) => n.deletedAt)
    for (const note of binNotes) {
      deleteNote(note.id)
    }
  }

  /** Get all notes in the bin */
  const binNotes = computed(() => {
    return notes.value
      .filter((n) => n.deletedAt)
      .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
  })

  const updateNoteContent = (id, content) => {
    const note = notes.value.find((n) => n.id === id)
    // Archived / binned notes are read-only — ignore content writes.
    if (note && !note.archived && !note.deletedAt) {
      note.content = content
      note.updatedAt = new Date().toISOString()
      saveNotes()
    }
  }

  const updateNoteMeta = (id, { title, description, tags, internalName, groupId }) => {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      if (title !== undefined) note.title = title
      if (description !== undefined) note.description = description
      if (tags !== undefined) note.tags = tags
      if (internalName !== undefined) {
        // Ensure uniqueness — exclude self from collision check
        note.internalName = uniqueInternalName(internalName, [], 'untitled_note', id, notes.value)
      }
      if (groupId !== undefined) note.groupId = groupId
      note.updatedAt = new Date().toISOString()
      saveNotes()
    }
  }

  const archiveNote = (id) => {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.archived = true
      note.updatedAt = new Date().toISOString()
      // If archiving the current note, select the next non-archived note
      if (currentNoteId.value === id) {
        const next = notes.value.find((n) => n.id !== id && !n.archived)
        currentNoteId.value = next ? next.id : null
      }
      saveNotes()
    }
  }

  const unarchiveNote = (id) => {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.archived = false
      note.updatedAt = new Date().toISOString()
      saveNotes()
    }
  }

  const bulkArchive = (ids) => {
    const now = new Date().toISOString()
    for (const id of ids) {
      const note = notes.value.find((n) => n.id === id)
      if (note) {
        note.archived = true
        note.updatedAt = now
      }
    }
    // If current note was archived, select next non-archived
    if (ids.includes(currentNoteId.value)) {
      const next = notes.value.find((n) => !ids.includes(n.id) && !n.archived)
      currentNoteId.value = next ? next.id : null
    }
    saveNotes()
  }

  const bulkUnarchive = (ids) => {
    const now = new Date().toISOString()
    for (const id of ids) {
      const note = notes.value.find((n) => n.id === id)
      if (note) {
        note.archived = false
        note.updatedAt = now
      }
    }
    saveNotes()
  }

  const reorderNotes = (orderedIds) => {
    orderedIds.forEach((id, index) => {
      const note = notes.value.find((n) => n.id === id)
      if (note) {
        note.sortOrder = index
        note.updatedAt = new Date().toISOString()
      }
    })
    notes.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    saveNotes()
  }

  const moveNotesToGroup = (noteIds, groupId) => {
    const now = new Date().toISOString()
    for (const id of noteIds) {
      const note = notes.value.find((n) => n.id === id)
      if (note) {
        note.groupId = groupId
        note.updatedAt = now
      }
    }
    saveNotes()
  }

  const removeNotesFromGroup = (groupId) => {
    const now = new Date().toISOString()
    for (const note of notes.value) {
      if (note.groupId === groupId) {
        note.groupId = null
        note.updatedAt = now
      }
    }
    saveNotes()
  }

  const currentNote = computed(() => {
    return notes.value.find((n) => n.id === currentNoteId.value) || null
  })

  onMounted(() => {
    loadNotes()
  })
  onBeforeUnmount(() => {
    stopLiveQuery()
  })

  return {
    notes,
    notesLoaded,
    currentNoteId,
    currentNote,
    allTags,
    deletedIds,
    binNotes,
    addNote,
    deleteNote,
    softDeleteNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyBin,
    updateNoteContent,
    updateNoteMeta,
    loadNotes,
    saveNotes,
    clearDeletedIds,
    reorderNotes,
    moveNotesToGroup,
    removeNotesFromGroup,
    archiveNote,
    unarchiveNote,
    bulkArchive,
    bulkUnarchive,
    removeWelcomeNoteIfNeeded,
  }
}
