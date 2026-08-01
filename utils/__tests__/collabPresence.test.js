import { describe, it, expect } from 'vitest'
import {
  presenceReducer,
  pruneStale,
  clampPos,
  colorForKey,
  withDisplayNames,
  PRESENCE_TTL_MS,
} from '../collabPresence.js'

/**
 * Task 9 verification: the presence state core folds incoming ephemeral
 * messages into a participant map, prunes stale peers, and clamps positions.
 */
describe('presence reducer', () => {
  it('adds a participant from a presence message', () => {
    const s = presenceReducer(
      {},
      {
        senderId: 'peer-1',
        message: { type: 'presence', name: 'Ada', anchor: 2, head: 5 },
        now: 100,
      },
    )
    expect(s['peer-1']).toMatchObject({ name: 'Ada', anchor: 2, head: 5, ts: 100 })
    expect(s['peer-1'].color).toBeTruthy()
  })

  it('ignores non-presence messages', () => {
    const s = presenceReducer({}, { senderId: 'p', message: { type: 'other' } })
    expect(s).toEqual({})
  })

  it('updates an existing participant in place (keyed by senderId)', () => {
    let s = presenceReducer(
      {},
      { senderId: 'p', message: { type: 'presence', name: 'A', head: 1 }, now: 1 },
    )
    s = presenceReducer(s, {
      senderId: 'p',
      message: { type: 'presence', name: 'A', head: 9 },
      now: 2,
    })
    expect(Object.keys(s)).toHaveLength(1)
    expect(s['p'].head).toBe(9)
    expect(s['p'].ts).toBe(2)
  })

  it('removes a participant on a leave message', () => {
    let s = presenceReducer(
      {},
      { senderId: 'p', message: { type: 'presence', name: 'A', head: 1 } },
    )
    s = presenceReducer(s, { senderId: 'p', message: { type: 'presence', left: true } })
    expect(s['p']).toBeUndefined()
  })

  it('does not mutate the input state', () => {
    const input = {}
    const out = presenceReducer(input, { senderId: 'p', message: { type: 'presence', head: 0 } })
    expect(input).toEqual({})
    expect(out).not.toBe(input)
  })
})

describe('pruneStale', () => {
  it('drops participants older than the TTL', () => {
    const now = 100000
    const state = {
      fresh: { senderId: 'fresh', ts: now - 1000 },
      stale: { senderId: 'stale', ts: now - PRESENCE_TTL_MS - 1 },
    }
    const pruned = pruneStale(state, now)
    expect(pruned.fresh).toBeTruthy()
    expect(pruned.stale).toBeUndefined()
  })

  it('returns the same reference when nothing is stale', () => {
    const now = 100000
    const state = { a: { senderId: 'a', ts: now } }
    expect(pruneStale(state, now)).toBe(state)
  })
})

describe('clampPos', () => {
  it('clamps into [0, docLength]', () => {
    expect(clampPos(-5, 10)).toBe(0)
    expect(clampPos(50, 10)).toBe(10)
    expect(clampPos(4, 10)).toBe(4)
  })
  it('returns null for non-integers', () => {
    expect(clampPos(null, 10)).toBeNull()
    expect(clampPos(undefined, 10)).toBeNull()
  })
})

describe('colorForKey', () => {
  it('is deterministic and returns a hex colour', () => {
    expect(colorForKey('peer-1')).toBe(colorForKey('peer-1'))
    expect(colorForKey('peer-1')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('withDisplayNames', () => {
  it('leaves a lone anonymous participant as a bare "Anonymous"', () => {
    const out = withDisplayNames({
      'peer-1': { senderId: 'peer-1', name: 'Anonymous', color: '#000' },
    })
    expect(out['peer-1'].name).toBe('Anonymous')
  })

  it('numbers 2+ anonymous participants by ascending senderId', () => {
    const out = withDisplayNames({
      'peer-b': { senderId: 'peer-b', name: 'Anonymous' },
      'peer-a': { senderId: 'peer-a', name: 'Anonymous' },
    })
    expect(out['peer-a'].name).toBe('Anonymous 1')
    expect(out['peer-b'].name).toBe('Anonymous 2')
  })

  it('treats a missing name as anonymous', () => {
    const out = withDisplayNames({
      'peer-a': { senderId: 'peer-a' },
      'peer-b': { senderId: 'peer-b', name: 'Anonymous' },
    })
    expect(out['peer-a'].name).toBe('Anonymous 1')
    expect(out['peer-b'].name).toBe('Anonymous 2')
  })

  it('passes named participants through and only numbers the anonymous ones', () => {
    const out = withDisplayNames({
      'peer-1': { senderId: 'peer-1', name: 'Ada' },
      'peer-a': { senderId: 'peer-a', name: 'Anonymous' },
      'peer-b': { senderId: 'peer-b', name: 'Anonymous' },
    })
    expect(out['peer-1'].name).toBe('Ada')
    expect(out['peer-a'].name).toBe('Anonymous 1')
    expect(out['peer-b'].name).toBe('Anonymous 2')
  })

  it('does not mutate the input map', () => {
    const input = {
      'peer-a': { senderId: 'peer-a', name: 'Anonymous' },
      'peer-b': { senderId: 'peer-b', name: 'Anonymous' },
    }
    withDisplayNames(input)
    expect(input['peer-a'].name).toBe('Anonymous')
    expect(input['peer-b'].name).toBe('Anonymous')
  })

  it('preserves other participant fields (color, anchor, head)', () => {
    const out = withDisplayNames({
      'peer-a': { senderId: 'peer-a', name: 'Anonymous', color: '#abc', anchor: 3, head: 7 },
    })
    expect(out['peer-a']).toMatchObject({ color: '#abc', anchor: 3, head: 7 })
  })
})
