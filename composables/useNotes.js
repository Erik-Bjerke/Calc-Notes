export const useNotes = () => {
  const notes = ref([])
  const currentNoteId = ref(null)

  // Load notes from localStorage
  const loadNotes = () => {
    if (process.client) {
      const stored = localStorage.getItem('notes')
      if (stored) {
        try {
          notes.value = JSON.parse(stored)
          // Don't auto-select a note - let user choose
        } catch (e) {
          console.error('Failed to load notes:', e)
          notes.value = []
        }
      }

      // Create a default note if none exist
      if (notes.value.length === 0) {
        const defaultNote = createNote('Welcome', 'Notes with calculator features')
        notes.value.push(defaultNote)
        // Don't auto-select - let user click on it
        saveNotes()
      }
    }
  }

  // Save notes to localStorage
  const saveNotes = () => {
    if (process.client) {
      localStorage.setItem('notes', JSON.stringify(notes.value))
    }
  }

  // Create a new note
  const createNote = (title = 'Untitled Note', description = '') => {
    const defaultContent = title === 'Welcome' ? `# Welcome to Notes with Calculator!

This is a note-taking app with built-in calculator features.

## Try some calculations:
10 + 20
price = 100
tax = price * 0.2
total = price + tax

## Markdown formatting works too:
**Bold text**
*Italic text*
- List items
- [ ] Todo items

## More calculator examples:
100 km in miles
$50 + $30
sqrt(144)
pi * 5^2

Type naturally and see results on the right!` : ''

    return {
      id: Date.now().toString(),
      title,
      description,
      content: defaultContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  // Add a new note
  const addNote = () => {
    const newNote = createNote()
    notes.value.unshift(newNote)
    currentNoteId.value = newNote.id
    saveNotes()
    return newNote
  }

  // Delete a note
  const deleteNote = (id) => {
    const index = notes.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notes.value.splice(index, 1)

      // Select another note if we deleted the current one
      if (currentNoteId.value === id) {
        currentNoteId.value = notes.value.length > 0 ? notes.value[0].id : null
      }

      saveNotes()
    }
  }

  // Update note content
  const updateNoteContent = (id, content) => {
    const note = notes.value.find(n => n.id === id)
    if (note) {
      note.content = content
      note.updatedAt = new Date().toISOString()
      saveNotes()
    }
  }

  // Update note metadata
  const updateNoteMeta = (id, { title, description }) => {
    const note = notes.value.find(n => n.id === id)
    if (note) {
      if (title !== undefined) note.title = title
      if (description !== undefined) note.description = description
      note.updatedAt = new Date().toISOString()
      saveNotes()
    }
  }

  // Get current note
  const currentNote = computed(() => {
    return notes.value.find(n => n.id === currentNoteId.value) || null
  })

  // Initialize on mount
  onMounted(() => {
    loadNotes()
  })

  return {
    notes,
    currentNoteId,
    currentNote,
    addNote,
    deleteNote,
    updateNoteContent,
    updateNoteMeta,
    loadNotes
  }
}
