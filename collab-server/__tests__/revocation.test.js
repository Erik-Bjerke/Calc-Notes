import { describe, it, expect } from 'vitest'
import { matchesRevocation } from '../server.mjs'

const conn = (over = {}) => ({ documentId: 'doc1', userId: 2, sid: null, kind: 'user', ...over })

describe('matchesRevocation', () => {
  it('never matches a null/mismatched-document connection', () => {
    expect(matchesRevocation(null, { documentId: 'doc1' })).toBe(false)
    expect(matchesRevocation(conn(), { documentId: 'other' })).toBe(false)
  })

  it('boots everyone in the room when no target is given', () => {
    expect(matchesRevocation(conn(), { documentId: 'doc1' })).toBe(true)
    expect(
      matchesRevocation(conn({ kind: 'guest', userId: null, sid: 's1' }), { documentId: 'doc1' }),
    ).toBe(true)
  })

  it('targets a specific account by userId', () => {
    expect(matchesRevocation(conn({ userId: 2 }), { documentId: 'doc1', userId: 2 })).toBe(true)
    expect(matchesRevocation(conn({ userId: 3 }), { documentId: 'doc1', userId: 2 })).toBe(false)
  })

  it('targets a specific guest by sid', () => {
    const guest = conn({ kind: 'guest', userId: null, sid: 'abc' })
    expect(matchesRevocation(guest, { documentId: 'doc1', sid: 'abc' })).toBe(true)
    expect(matchesRevocation(guest, { documentId: 'doc1', sid: 'zzz' })).toBe(false)
  })

  it('targets a whole kind', () => {
    const guest = conn({ kind: 'guest', userId: null, sid: 'abc' })
    expect(matchesRevocation(guest, { documentId: 'doc1', kind: 'guest' })).toBe(true)
    expect(matchesRevocation(conn({ kind: 'user' }), { documentId: 'doc1', kind: 'guest' })).toBe(
      false,
    )
  })

  it('does not match a different account even when a userId target is set', () => {
    expect(matchesRevocation(conn({ userId: 5 }), { documentId: 'doc1', userId: 2 })).toBe(false)
  })
})
