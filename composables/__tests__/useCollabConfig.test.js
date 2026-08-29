import { describe, it, expect } from 'vitest'
import { deriveCollabWsUrl, COLLAB_APP_ID } from '../useCollabConfig.js'

/**
 * The collab WebSocket URL is derived correctly across platforms — web (origin),
 * native/Electron (API base) — and gracefully disabled on non-http origins
 * (capacitor://, app://, file://).
 *
 * The derived URL must always end in the app id, because the sync service hosts
 * several applications and refuses a path that names none of them.
 */
describe('deriveCollabWsUrl', () => {
  it('prefers the explicit env override', () => {
    expect(deriveCollabWsUrl('ws://localhost:3030/notes', 'https://api', 'https://web')).toBe(
      'ws://localhost:3030/notes',
    )
  })

  it('derives wss from an https API base (native / Electron)', () => {
    expect(deriveCollabWsUrl('', 'https://notes.numori.app', '')).toBe(
      'wss://notes.numori.app/collab/notes',
    )
  })

  it('derives ws from an http origin (web dev)', () => {
    expect(deriveCollabWsUrl('', '', 'http://localhost:3000')).toBe(
      'ws://localhost:3000/collab/notes',
    )
  })

  it('strips a trailing slash on the base', () => {
    expect(deriveCollabWsUrl('', 'https://x.dev/', '')).toBe('wss://x.dev/collab/notes')
  })

  it('always names an app, since the service refuses an unnamed path', () => {
    expect(deriveCollabWsUrl('', '', 'https://web.dev')).toMatch(new RegExp(`/${COLLAB_APP_ID}$`))
  })

  it('can address a different app id', () => {
    expect(deriveCollabWsUrl('', '', 'https://web.dev', 'notes-staging')).toBe(
      'wss://web.dev/collab/notes-staging',
    )
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
