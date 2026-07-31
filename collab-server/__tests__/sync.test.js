import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Repo } from '@automerge/automerge-repo'
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import * as A from '@automerge/automerge/slim'
import { createCollabServer } from '../server.mjs'

/**
 * Task 4 verification: two independent client Repos connected to the collab
 * sync service over WebSockets converge on the same document in real time.
 * This exercises the full network path (server adapter + client adapter +
 * Automerge sync protocol) in a single process — the same flow two browser
 * tabs would use.
 */
describe('collab sync service (real-time, no auth)', () => {
  let server
  let port
  const clients = []

  const waitFor = async (predicate, timeout = 3000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (predicate()) return true
      await new Promise((r) => setTimeout(r, 25))
    }
    return predicate()
  }

  const makeClient = () => {
    const adapter = new WebSocketClientAdapter(`ws://localhost:${port}`)
    const repo = new Repo({ network: [adapter] })
    clients.push(adapter)
    return repo
  }

  beforeAll(async () => {
    server = createCollabServer()
    const addr = await server.listen(0, '127.0.0.1') // ephemeral port
    port = addr.port
  })

  afterAll(async () => {
    for (const adapter of clients) {
      try {
        adapter.disconnect()
      } catch {
        /* ignore */
      }
    }
    await server.close()
  })

  it('serves a health endpoint', async () => {
    const res = await fetch(`http://localhost:${port}/health`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.service).toBe('numori-collab')
  })

  it('propagates a document and edits between two clients', async () => {
    const clientA = makeClient()
    const clientB = makeClient()

    // Client A creates a collaborative note body and edits it.
    const handleA = clientA.create({ text: '' })
    handleA.change((d) => A.splice(d, ['text'], 0, 0, 'hello from A'))
    const url = handleA.url

    // Client B opens the same document by url and receives A's content.
    const handleB = await clientB.find(url)
    await handleB.whenReady()
    const gotInitial = await waitFor(() => handleB.doc()?.text === 'hello from A')
    expect(gotInitial).toBe(true)

    // Client B appends text; Client A converges on the merged result.
    handleB.change((d) => A.splice(d, ['text'], d.text.length, 0, ' + B'))
    const converged = await waitFor(() => handleA.doc()?.text === 'hello from A + B')
    expect(converged).toBe(true)
    expect(handleB.doc().text).toBe('hello from A + B')
  })
})
