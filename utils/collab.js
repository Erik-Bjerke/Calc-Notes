/**
 * Numori — Automerge collaborative document core (framework-agnostic).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ROLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module owns the singleton Automerge `Repo` and the helpers for
 * creating / loading collaborative documents. It is intentionally free of Vue
 * so it can be unit-tested in Node (see utils/__tests__/collab.test.js) and
 * imported from anywhere. The Vue-facing reactive wrapper lives in
 * composables/useCollab.js.
 *
 * A collaborative note's *content* is modelled as a single Automerge document
 * of the shape `{ text: string }`. Metadata (title, tags, group, ordering)
 * continues to travel over the existing last-write-wins encrypted sync — only
 * the free-text body becomes a CRDT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OFFLINE-FIRST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Repo is backed by an IndexedDB storage adapter, so collaborative
 * documents persist locally and survive reloads with no network. A network
 * adapter (WebSocket) is attached later, per collaboration, by useCollab —
 * this module deliberately keeps the offline path self-contained.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Repo } from '@automerge/automerge-repo'
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb'
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import * as A from '@automerge/automerge/slim'
import { initAutomerge } from './automerge.js'

/** IndexedDB database name for locally-persisted Automerge documents. */
export const AUTOMERGE_DB_NAME = 'numori-automerge'

let repoPromise = null
let networkAdapter = null
let connectedUrl = null

async function createRepo() {
  await initAutomerge()
  return new Repo({
    storage: new IndexedDBStorageAdapter(AUTOMERGE_DB_NAME),
  })
}

/**
 * Get the process-wide Automerge Repo, creating it (and initializing WASM)
 * on first use. Cached — every caller shares one Repo and one WASM instance.
 *
 * @returns {Promise<import('@automerge/automerge-repo').Repo>}
 */
export async function getRepo() {
  if (!repoPromise) {
    repoPromise = createRepo()
  }
  return repoPromise
}

/**
 * Create a new collaborative document seeded with `initialText` and persist it
 * to local storage. Returns the DocHandle; use `handle.url` to reference it
 * later (this url is stored on the note/share so every device can find it).
 *
 * @param {string} [initialText] existing plain-text note body to seed the CRDT
 * @returns {Promise<import('@automerge/automerge-repo').DocHandle<{text:string}>>}
 */
export async function createCollabDoc(initialText = '') {
  const repo = await getRepo()
  const handle = repo.create({ text: '' })
  if (initialText) {
    handle.change((doc) => {
      A.splice(doc, ['text'], 0, 0, initialText)
    })
  }
  // Ensure the seed is durably written before the url is handed out.
  await repo.flush([handle.documentId])
  return handle
}

/**
 * Load an existing collaborative document by its Automerge url (or documentId).
 * Resolves once the document is ready for reading/changing — served from local
 * storage when offline, or synced from peers when a network adapter is present.
 *
 * @param {string} url Automerge url (`automerge:...`) or documentId
 * @returns {Promise<import('@automerge/automerge-repo').DocHandle<{text:string}>>}
 */
export async function loadCollabDoc(url) {
  const repo = await getRepo()
  const handle = await repo.find(url)
  await handle.whenReady()
  return handle
}

/**
 * Read the current plain-text body of a collaborative document.
 * @param {import('@automerge/automerge-repo').DocHandle<{text:string}>} handle
 * @returns {string}
 */
export function getDocText(handle) {
  const doc = handle.doc()
  return doc?.text ?? ''
}

/**
 * Flush any pending changes for the given handle to local storage.
 * @param {import('@automerge/automerge-repo').DocHandle} handle
 */
export async function flushDoc(handle) {
  const repo = await getRepo()
  await repo.flush([handle.documentId])
}

/**
 * Attach the WebSocket sync connection to the collab service. Called lazily the
 * first time a user opens a collaborative note, so users who never collaborate
 * never open a socket (keeping server load minimal). Idempotent per url.
 *
 * The collab capability token is passed as a `?token=` query parameter; the
 * sync service validates it on the WebSocket upgrade. A single connection is
 * shared for the session — the first valid token gates it, and the
 * capability-based sharePolicy then admits any document the client can name.
 *
 * @param {string} url ws(s):// url of the collab sync service
 * @param {string} [token] collab capability token (JWT) for the upgrade
 * @returns {Promise<void>}
 */
export async function connectCollabNetwork(url, token) {
  if (!url) {
    throw new Error('Collaboration server URL is not configured')
  }
  const repo = await getRepo()
  const fullUrl = token
    ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : url
  if (networkAdapter && connectedUrl === fullUrl) return
  networkAdapter = new WebSocketClientAdapter(fullUrl)
  repo.networkSubsystem.addNetworkAdapter(networkAdapter)
  connectedUrl = fullUrl
}

/** Whether a collab network connection has been established this session. */
export function isCollabNetworkConnected() {
  return networkAdapter != null
}

/**
 * TEST-ONLY: drop the cached Repo so the next getRepo() rebuilds it.
 * Used to simulate an app reload against the same IndexedDB storage.
 */
export function __resetRepoForTests() {
  repoPromise = null
  networkAdapter = null
  connectedUrl = null
}
