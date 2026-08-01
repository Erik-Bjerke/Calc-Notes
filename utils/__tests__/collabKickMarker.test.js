import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { markKicked, isKicked, clearKick } from '../collabKickMarker.js'

// Minimal localStorage stub backed by a Map.
function makeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  }
}

beforeEach(() => {
  globalThis.localStorage = makeStorage()
})

afterEach(() => {
  delete globalThis.localStorage
})

describe('collabKickMarker', () => {
  it('is not kicked by default', () => {
    expect(isKicked('h1')).toBe(false)
  })

  it('marks and detects a kicked hash', () => {
    markKicked('h1')
    expect(isKicked('h1')).toBe(true)
    expect(isKicked('h2')).toBe(false)
  })

  it('clears a marker', () => {
    markKicked('h1')
    clearKick('h1')
    expect(isKicked('h1')).toBe(false)
  })

  it('ignores empty hashes', () => {
    markKicked('')
    markKicked(null)
    expect(isKicked('')).toBe(false)
    expect(isKicked(null)).toBe(false)
  })

  it('is inert (no throw) when localStorage is unavailable', () => {
    delete globalThis.localStorage
    expect(() => markKicked('h1')).not.toThrow()
    expect(isKicked('h1')).toBe(false)
    expect(() => clearKick('h1')).not.toThrow()
  })
})
