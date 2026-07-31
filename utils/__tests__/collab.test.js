import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import * as A from '@automerge/automerge/slim'
import {
  createCollabDoc,
  loadCollabDoc,
  getDocText,
  flushDoc,
  __resetRepoForTests,
} from '../collab.js'

/**
 * Task 2 verification: a collaborative document persists to IndexedDB and can
 * be recovered by a *fresh* Repo (i.e. after an app reload) with no network.
 * fake-indexeddb provides an in-memory IndexedDB that survives across the two
 * Repo instances within this process, exactly like a browser reload.
 */
describe('collab offline persistence', () => {
  beforeEach(() => {
    __resetRepoForTests()
  })

  it('creates a document seeded with existing note content', async () => {
    const handle = await createCollabDoc('# Budget\n2 + 2')
    expect(getDocText(handle)).toBe('# Budget\n2 + 2')
    expect(handle.url).toMatch(/^automerge:/)
  })

  it('recovers document content from storage after a simulated reload', async () => {
    const handle = await createCollabDoc('persist me')
    const url = handle.url

    // Simulate closing the app: drop the in-memory Repo. IndexedDB (fake)
    // keeps the persisted document.
    __resetRepoForTests()

    const reloaded = await loadCollabDoc(url)
    expect(getDocText(reloaded)).toBe('persist me')
  })

  it('persists edits made after creation', async () => {
    const handle = await createCollabDoc('start')
    handle.change((doc) => {
      A.splice(doc, ['text'], 5, 0, ' end')
    })
    expect(getDocText(handle)).toBe('start end')
    await flushDoc(handle)
    const url = handle.url

    __resetRepoForTests()
    const reloaded = await loadCollabDoc(url)
    expect(getDocText(reloaded)).toBe('start end')
  })
})
