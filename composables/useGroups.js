import { liveQuery } from 'dexie'
import db from '~/db.js'
import { uniqueInternalName } from '~/utils/normaliseName.js'

export const useGroups = () => {
  const groups = ref([])
  const deletedGroupIds = ref([])
  let subscription = null

  const startLiveQuery = () => {
    if (!import.meta.client) return
    const observable = liveQuery(() => db.groups.orderBy('sortOrder').toArray())
    subscription = observable.subscribe({
      next: (rows) => {
        const incoming = new Map(rows.map((r) => [r.id, r]))
        for (let i = groups.value.length - 1; i >= 0; i--) {
          if (!incoming.has(groups.value[i].id)) groups.value.splice(i, 1)
        }
        for (const row of rows) {
          const existing = groups.value.find((g) => g.id === row.id)
          if (existing) {
            for (const key of Object.keys(row)) {
              if (JSON.stringify(existing[key]) !== JSON.stringify(row[key])) {
                existing[key] = row[key]
              }
            }
          } else {
            groups.value.push(row)
          }
        }
        groups.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      },
      error: (err) => console.error('groups liveQuery error:', err),
    })
  }

  const stopLiveQuery = () => {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
  }

  const toRaw = (obj) => JSON.parse(JSON.stringify(obj))

  const loadGroups = async () => {
    if (!import.meta.client) return
    groups.value = await db.groups.orderBy('sortOrder').toArray()
    const row = await db.appState.get('deleted_group_ids')
    if (row?.value) {
      try {
        deletedGroupIds.value = JSON.parse(row.value)
      } catch {
        deletedGroupIds.value = []
      }
    }
    startLiveQuery()
  }

  const saveGroups = async () => {
    if (!import.meta.client) return
    await db.groups.bulkPut(toRaw(groups.value))
  }

  const createGroup = (name = 'New Group') => {
    const now = new Date().toISOString()
    const existingNames = groups.value.map((g) => g.internalName).filter(Boolean)
    return {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      internalName: uniqueInternalName(name, existingNames, 'new_group'),
      sortOrder: 0,
      parentId: null,
      collapsed: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  const addGroup = (name = 'New Group', parentId = null) => {
    const now = new Date().toISOString()
    // Bump only siblings under the same parent so the new group lands first.
    groups.value.forEach((g) => {
      if ((g.parentId ?? null) === (parentId ?? null)) {
        g.sortOrder = (g.sortOrder ?? 0) + 1
        g.updatedAt = now
      }
    })
    const group = createGroup(name)
    group.sortOrder = 0
    group.parentId = parentId ?? null
    groups.value.unshift(group)
    saveGroups()
    return group
  }

  const updateGroup = (id, { name, internalName, parentId }) => {
    const group = groups.value.find((g) => g.id === id)
    if (!group) return
    if (name !== undefined) group.name = name
    if (internalName !== undefined) {
      group.internalName = uniqueInternalName(internalName, [], 'new_group', id, groups.value)
    }
    if (parentId !== undefined) group.parentId = parentId
    group.updatedAt = new Date().toISOString()
    saveGroups()
  }

  // ── Tree helpers ────────────────────────────────────────
  const groupById = (id) => groups.value.find((g) => g.id === id) || null

  /** 1-based nesting level: a root group is level 1. */
  const groupDepth = (id) => {
    let depth = 1
    let cur = groupById(id)
    const seen = new Set()
    while (cur && cur.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId)
      cur = groupById(cur.parentId)
      depth++
    }
    return depth
  }

  /** Max number of group levels contained in this group's subtree (incl. itself). */
  const subtreeGroupHeight = (id) => {
    const children = groups.value.filter((g) => g.parentId === id)
    if (children.length === 0) return 1
    return 1 + Math.max(...children.map((c) => subtreeGroupHeight(c.id)))
  }

  /** All descendant group ids of the given group (deep). */
  const descendantGroupIds = (id) => {
    const out = []
    const walk = (pid) => {
      for (const g of groups.value) {
        if (g.parentId === pid) {
          out.push(g.id)
          walk(g.id)
        }
      }
    }
    walk(id)
    return out
  }

  /**
   * Reparent a group. Guards against cycles and the 3-level depth cap.
   * Returns true when the move was applied.
   */
  const moveGroup = (id, newParentId) => {
    const group = groupById(id)
    if (!group) return false
    newParentId = newParentId ?? null
    if (newParentId === id) return false
    if (newParentId && descendantGroupIds(id).includes(newParentId)) return false
    group.parentId = newParentId
    group.updatedAt = new Date().toISOString()
    saveGroups()
    return true
  }

  const deleteGroup = async (id) => {
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx !== -1) groups.value.splice(idx, 1)
    if (!deletedGroupIds.value.includes(id)) {
      deletedGroupIds.value.push(id)
    }
    await db.groups.delete(id)
    await db.appState.put({
      key: 'deleted_group_ids',
      value: JSON.stringify(deletedGroupIds.value),
    })
    saveGroups()
  }

  // ── Soft delete (bin) ───────────────────────────────────
  // Mark the given group ids as deleted (callers pass the full subtree).
  const softDeleteGroups = (ids) => {
    const now = new Date().toISOString()
    const set = new Set(ids)
    for (const g of groups.value) {
      if (set.has(g.id)) {
        g.deletedAt = now
        g.updatedAt = now
      }
    }
    saveGroups()
  }

  // Restore the given group ids from the bin.
  const restoreGroups = (ids) => {
    const now = new Date().toISOString()
    const set = new Set(ids)
    for (const g of groups.value) {
      if (set.has(g.id)) {
        g.deletedAt = null
        g.updatedAt = now
      }
    }
    saveGroups()
  }

  // Un-delete a group's ancestor chain (used when restoring a note whose
  // containing folder was soft-deleted, so it reappears in place).
  const restoreGroupAncestors = (groupId) => {
    let gid = groupId
    const seen = new Set()
    let changed = false
    const now = new Date().toISOString()
    while (gid && !seen.has(gid)) {
      seen.add(gid)
      const g = groupById(gid)
      if (!g) break
      if (g.deletedAt) {
        g.deletedAt = null
        g.updatedAt = now
        changed = true
      }
      gid = g.parentId
    }
    if (changed) saveGroups()
  }

  // Permanently remove a set of groups (and their subtrees) from the bin.
  const permanentlyDeleteGroups = (ids) => {
    const all = new Set()
    for (const id of ids) {
      all.add(id)
      for (const d of descendantGroupIds(id)) all.add(d)
    }
    for (const id of all) deleteGroup(id)
  }

  const clearDeletedGroupIds = async () => {
    deletedGroupIds.value = []
    if (import.meta.client) {
      await db.appState.delete('deleted_group_ids')
    }
  }

  const toggleGroupCollapsed = (id) => {
    const group = groups.value.find((g) => g.id === id)
    if (group) {
      group.collapsed = !group.collapsed
      saveGroups()
    }
  }

  const reorderGroups = (orderedIds) => {
    orderedIds.forEach((id, index) => {
      const group = groups.value.find((g) => g.id === id)
      if (group) {
        group.sortOrder = index
        group.updatedAt = new Date().toISOString()
      }
    })
    groups.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    saveGroups()
  }

  onMounted(() => {
    loadGroups()
  })
  onBeforeUnmount(() => {
    stopLiveQuery()
  })

  return {
    groups,
    deletedGroupIds,
    addGroup,
    updateGroup,
    deleteGroup,
    toggleGroupCollapsed,
    reorderGroups,
    moveGroup,
    groupDepth,
    subtreeGroupHeight,
    descendantGroupIds,
    softDeleteGroups,
    restoreGroups,
    restoreGroupAncestors,
    permanentlyDeleteGroups,
    loadGroups,
    saveGroups,
    clearDeletedGroupIds,
  }
}
