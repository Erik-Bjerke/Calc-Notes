/**
 * Storage adapter factory for the collab sync service.
 *
 * Task 4: returns `undefined` — an in-memory server where documents live only
 * while a peer is connected. This is enough to prove real-time sync.
 *
 * Task 5 replaces this with a PostgreSQL-backed StorageAdapterInterface so
 * documents survive restarts and late-joining peers can catch up.
 */
export async function createStorage() {
  if (process.env.COLLAB_STORAGE === 'postgres') {
    const { PostgresStorageAdapter } = await import('./postgres.mjs')
    return new PostgresStorageAdapter()
  }
  return undefined
}
