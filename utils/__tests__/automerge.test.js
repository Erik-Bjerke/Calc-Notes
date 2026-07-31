import { describe, it, expect, beforeAll } from 'vitest'
import * as A from '@automerge/automerge/slim'
import { initAutomerge } from '../automerge.js'

/**
 * Task 1 verification: the Automerge WASM core initializes from the inlined
 * base64 build and performs conflict-free text operations. These are the
 * primitives the collaborative `content` field is built on.
 */
describe('automerge bootstrap', () => {
  beforeAll(async () => {
    await initAutomerge()
  })

  it('is idempotent — repeated init returns the same promise', () => {
    expect(initAutomerge()).toBe(initAutomerge())
  })

  it('performs text splice operations on a document', () => {
    let doc = A.init()
    doc = A.change(doc, (d) => {
      d.text = ''
    })
    doc = A.change(doc, (d) => {
      A.splice(d, ['text'], 0, 0, 'hello')
    })
    doc = A.change(doc, (d) => {
      A.splice(d, ['text'], 5, 0, ' world')
    })
    expect(doc.text).toBe('hello world')
    expect(A.getHeads(doc)).toHaveLength(1)
  })

  it('merges concurrent edits without losing either side', () => {
    let base = A.init()
    base = A.change(base, (d) => {
      d.text = 'ab'
    })

    // Two replicas diverge from the same starting point.
    let left = A.clone(base)
    let right = A.clone(base)
    left = A.change(left, (d) => A.splice(d, ['text'], 1, 0, 'X'))
    right = A.change(right, (d) => A.splice(d, ['text'], 2, 0, 'Y'))

    const merged = A.merge(A.clone(left), right)

    // Both concurrent insertions survive the merge (no last-write-wins loss).
    expect(merged.text).toContain('X')
    expect(merged.text).toContain('Y')
    expect(merged.text.length).toBe(4) // 'ab' + 'X' + 'Y'
  })
})
