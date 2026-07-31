import { describe, it, expect } from 'vitest'
import { deriveCollabWsUrl } from '../useCollabConfig.js'

/**
 * Task 11 verification: the collab WebSocket URL is derived correctly across
 * platforms — web (origin), native/Electron (API base), and gracefully
 * disabled on non-http origins (capacitor://, app://, file://).
 */
describe('deriveCollabWsUrl', () => {
  it('prefers the explicit env override', () => {
    expect(deriveCollabWsUrl('ws://localhost:3030', 'https://api', 'https://web')).toBe(
      'ws://localhost:3030',
    )
  })

  it('derives wss from an https API base (native / Electron)', () => {
    expect(deriveCollabWsUrl('', 'https://notes.numori.app', '')).toBe(
      'wss://notes.numori.app/collab',
    )
  })

  it('derives ws from an http origin (web dev)', () => {
    expect(deriveCollabWsUrl('', '', 'http://localhost:3000')).toBe('ws://localhost:3000/collab')
  })

  it('strips a trailing slash on the base', () => {
    expect(deriveCollabWsUrl('', 'https://x.dev/', '')).toBe('wss://x.dev/collab')
  })

  it('returns empty for capacitor:// origins (must configure API base)', () => {
    expect(deriveCollabWsUrl('', '', 'capacitor://localhost')).toBe('')
  })

  it('returns empty for the Electron app:// origin', () => {
    expect(deriveCollabWsUrl('', '', 'app://.')).toBe('')
  })

  it('returns empty when nothing is configured', () => {
    expect(deriveCollabWsUrl('', '', '')).toBe('')
  })
})
