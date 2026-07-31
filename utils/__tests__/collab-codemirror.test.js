// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { automergeSyncPlugin } from '@automerge/automerge-codemirror'
import { Repo } from '@automerge/automerge-repo'
import { initAutomerge } from '../automerge.js'

/**
 * Task 3 verification: the Automerge codemirror plugin bidirectionally syncs a
 * CodeMirror document with an Automerge text field. Two independent editor
 * views bound to the same DocHandle must converge — this is the exact
 * mechanism the collaborative NoteEditor relies on.
 */
describe('codemirror <-> automerge binding', () => {
  let repo
  beforeAll(async () => {
    await initAutomerge()
    repo = new Repo({})
  })

  const makeView = (handle) =>
    new EditorView({
      state: EditorState.create({
        doc: handle.doc().text,
        extensions: [automergeSyncPlugin({ handle, path: ['text'] })],
      }),
      parent: document.createElement('div'),
    })

  it('propagates typing from one editor to another on the same doc', () => {
    const handle = repo.create({ text: '' })
    const viewA = makeView(handle)
    const viewB = makeView(handle)

    // Type in editor A.
    viewA.dispatch({ changes: { from: 0, insert: 'hello' } })

    // The Automerge document reflects the edit...
    expect(handle.doc().text).toBe('hello')
    // ...and editor B (bound to the same handle) converges to the same text.
    expect(viewB.state.doc.toString()).toBe('hello')

    viewA.destroy()
    viewB.destroy()
  })

  it('merges concurrent edits from both editors', () => {
    const handle = repo.create({ text: 'ab' })
    const viewA = makeView(handle)
    const viewB = makeView(handle)

    viewA.dispatch({ changes: { from: 1, insert: 'X' } }) // a X b
    viewB.dispatch({ changes: { from: viewB.state.doc.length, insert: 'Z' } })

    const finalText = handle.doc().text
    expect(finalText).toContain('X')
    expect(finalText).toContain('Z')
    // Both editors show the same converged document.
    expect(viewA.state.doc.toString()).toBe(finalText)
    expect(viewB.state.doc.toString()).toBe(finalText)

    viewA.destroy()
    viewB.destroy()
  })
})
