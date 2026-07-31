/**
 * Numori — Automerge collaborative sync service (core).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A SEPARATE SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Real-time collaboration runs over a long-lived WebSocket using Automerge's
 * sync protocol (compact change deltas, not whole documents). We run it as a
 * small standalone process rather than inside the Nitro API so the realtime
 * workload scales independently and a burst of editing never degrades the REST
 * API. The sync protocol keeps bandwidth and CPU low, matching the project's
 * "low server usage" goal.
 *
 * This module is deliberately transport/auth/storage-agnostic so it can be
 * unit-tested in-process (see collab-server/__tests__). The CLI entrypoint
 * (index.mjs) wires in real configuration.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Side-effect import: on Node this resolves to Automerge's fullfat build, which
// initializes the WASM core at import time. automerge-repo uses the *slim*
// build which shares that same initialized low-level singleton, so no explicit
// initializeWasm() call is needed on the server.
import '@automerge/automerge'

import http from 'node:http'
import { WebSocketServer } from 'ws'
import { Repo } from '@automerge/automerge-repo'
import { WebSocketServerAdapter } from '@automerge/automerge-repo-network-websocket'

/**
 * Create (but do not start) a collaborative sync server.
 *
 * @param {object} [options]
 * @param {import('@automerge/automerge-repo').StorageAdapterInterface} [options.storage]
 *   Durable storage for documents. Omit for an in-memory server (docs live
 *   only while at least one peer is connected). Task 5 supplies a Postgres
 *   adapter here.
 * @param {import('@automerge/automerge-repo').SharePolicy} [options.sharePolicy]
 *   Authorization gate deciding which documents a connected peer may sync.
 *   Defaults to "share everything" (open); Task 7 replaces this with a
 *   token/room-based policy.
 * @param {(req: http.IncomingMessage) => Promise<boolean> | boolean} [options.authenticate]
 *   Optional per-connection gate run during the WebSocket upgrade. Return false
 *   to reject the socket before it joins the repo. Defaults to allow-all.
 * @returns {{ httpServer: http.Server, wss: WebSocketServer, repo: Repo, listen: Function, close: Function }}
 */
export function createCollabServer(options = {}) {
  const {
    storage,
    sharePolicy = async () => true,
    authenticate = () => true,
    // Evict documents from memory after this many ms with no activity (edits or
    // presence). 0 disables. Keeps server memory bounded: idle rooms are
    // dropped from RAM but remain durable in storage and reload on next access.
    evictIdleAfterMs = 0,
  } = options

  const httpServer = http.createServer((req, res) => {
    // Respond OK to any plain HTTP GET so health checks pass regardless of the
    // path the reverse proxy uses (e.g. same-domain path routing at /collab).
    // Real collaboration traffic arrives as WebSocket upgrades, handled below.
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', service: 'numori-collab' }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  // We handle the upgrade manually so a connection can be rejected (auth)
  // before it is handed to the Automerge network adapter.
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', async (req, socket, head) => {
    try {
      const ok = await authenticate(req)
      if (!ok) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })

  const repo = new Repo({
    network: [new WebSocketServerAdapter(wss)],
    storage,
    sharePolicy,
    // A sync server is a hub, not an editor — it should not gossip remote heads
    // it doesn't need, keeping per-connection work minimal.
    enableRemoteHeadsGossiping: false,
  })

  // ── Idle document eviction (bounded memory) ────────────────────────────
  // Track last activity per document. Editors emit presence heartbeats and
  // change events which keep their room "warm"; rooms with no connected peers
  // go quiet and are evicted from the in-memory cache after the TTL. Evicting
  // is safe: storage retains the document and the repo reloads it on the next
  // sync request.
  let evictTimer = null
  if (evictIdleAfterMs > 0) {
    const lastActive = new Map()
    const touch = (id) => lastActive.set(id, Date.now())
    repo.on('document', ({ handle }) => {
      touch(handle.documentId)
      handle.on('change', () => touch(handle.documentId))
      handle.on('ephemeral-message', () => touch(handle.documentId))
    })
    evictTimer = setInterval(
      async () => {
        const now = Date.now()
        for (const [id, handle] of Object.entries(repo.handles)) {
          const seen = lastActive.get(id) ?? 0
          if (now - seen > evictIdleAfterMs) {
            try {
              if (handle.isReady?.()) await repo.flush([id])
              await repo.removeFromCache(id)
            } catch {
              /* ignore */
            }
            lastActive.delete(id)
          }
        }
      },
      Math.max(1000, Math.floor(evictIdleAfterMs / 2)),
    )
    if (evictTimer.unref) evictTimer.unref()
  }

  const listen = async (port, host = '0.0.0.0') => {
    // The WebSocketServerAdapter only attaches its "connection" handler once the
    // repo's peerMetadata resolves — and with a storage backend that resolution
    // awaits a `storageId` read from the database. If we started accepting
    // sockets before that, the first client(s) to connect would be dropped
    // (their upgrade fires before the adapter is listening). Wait for the
    // network subsystem to be wired up before opening the port.
    await repo.networkSubsystem.peerMetadata
    // Let the microtask that calls adapter.connect() (attaching the "connection"
    // listener) run before we accept sockets.
    await new Promise((r) => setImmediate(r))
    return new Promise((resolve) => {
      httpServer.listen(port, host, () => resolve(httpServer.address()))
    })
  }

  const close = () =>
    new Promise((resolve) => {
      if (evictTimer) clearInterval(evictTimer)
      // Terminate any live sockets so httpServer.close() can drain promptly.
      for (const ws of wss.clients) {
        try {
          ws.terminate()
        } catch {
          /* already closed */
        }
      }
      wss.close(() => {
        httpServer.close(() => resolve())
      })
    })

  return { httpServer, wss, repo, listen, close }
}
