import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Repo } from '@automerge/automerge-repo'
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { createCollabServer } from '../server.mjs'
import { presenceReducer } from '../../utils/collabPresence.js'

/**
 * Task 9 verification: ephemeral presence messages (used for cursors) actually
 * traverse the sync service between peers, and fold into the participant map.
 */
describe('presence over the sync service', () => {
  let server
  let port
  const adapters = []

  const waitFor = async (p, ms = 3000) => {
    const s = Date.now()
    while (Date.now() - s < ms) {
      if (p()) return true
      await new Promise((r) => setTimeout(r, 25))
    }
    return p()
  }

  const client = () => {
    const a = new WebSocketClientAdapter(`ws://localhost:${port}`)
    adapters.push(a)
    return new Repo({ network: [a] })
  }

  beforeAll(async () => {
    server = createCollabServer()
    const addr = await server.listen(0, '127.0.0.1')
    port = addr.port
  })

  afterAll(async () => {
    for (const a of adapters) {
      try {
        a.disconnect()
      } catch {
        /* ignore */
      }
    }
    await server.close()
  })

  it('delivers a broadcast presence message to another peer', async () => {
    const repoA = client()
    const repoB = client()

    const handleA = repoA.create({ text: 'hello' })
    const url = handleA.url
    const handleB = await repoB.find(url)
    await handleB.whenReady()

    // B collects presence into a participant map, exactly like the editor does.
    let participants = {}
    handleB.on('ephemeral-message', ({ senderId, message }) => {
      participants = presenceReducer(participants, { senderId, message })
    })

    // A announces its cursor.
    handleA.broadcast({ type: 'presence', name: 'Ada', anchor: 1, head: 3 })

    const got = await waitFor(() => Object.keys(participants).length > 0)
    expect(got).toBe(true)
    const only = Object.values(participants)[0]
    expect(only.name).toBe('Ada')
    expect(only.head).toBe(3)
  })
})
