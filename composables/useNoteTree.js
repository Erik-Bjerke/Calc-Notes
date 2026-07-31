/**
 * useNoteTree — builds the sidebar's nested file-tree model.
 *
 * Given the (already search/tag filtered) visible notes and the full group
 * list, this produces:
 *   • a flattened `displayItems` list (depth-aware, respecting collapsed groups)
 *     that the renderer iterates over, and
 *   • helper functions used by drag-and-drop to resolve valid drop targets.
 *
 * Data model recap:
 *   • group.parentId  → containing group id, or null for a root group
 *   • note.groupId    → containing group id, or null for a root note
 *   • sortOrder       → ordering *among siblings sharing the same parent*.
 *                       Notes and sub-groups share one ordering space so they
 *                       can be freely interleaved inside a group.
 *
 * Groups may nest up to MAX_GROUP_DEPTH levels (a root group is level 1).
 * Notes are always leaves and may live inside a group at any level.
 *
 * When `flatMode` is true (archive / bin / active search), groups are ignored
 * and every visible note is rendered as a flat depth-0 list.
 */
export const MAX_GROUP_DEPTH = 3

export function useNoteTree({ filteredNotes, groups, flatMode }) {
  const groupsById = computed(() => {
    const m = new Map()
    for (const g of groups.value) m.set(g.id, g)
    return m
  })

  /**
   * Ordered children (notes + sub-groups interleaved) directly under `parentId`.
   * `parentId === null` returns the root-level items.
   * Returns `[{ id, kind: 'group'|'note', sortOrder, data }]` sorted by sortOrder.
   */
  const childrenOf = (parentId) => {
    const pid = parentId ?? null
    const items = []
    if (!flatMode.value) {
      for (const g of groups.value) {
        if ((g.parentId ?? null) === pid) {
          items.push({ id: g.id, kind: 'group', sortOrder: g.sortOrder ?? 0, data: g })
        }
      }
    }
    for (const n of filteredNotes.value) {
      let noteParent = flatMode.value ? null : (n.groupId ?? null)
      // A note whose group no longer exists falls back to the root.
      if (noteParent && !groupsById.value.has(noteParent)) noteParent = null
      if (noteParent === pid) {
        items.push({ id: n.id, kind: 'note', sortOrder: n.sortOrder ?? 0, data: n })
      }
    }
    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    return items
  }

  /**
   * Flattened, depth-aware render list. Each entry:
   *   { id, kind: 'group'|'note'|'group-empty', depth, parentId, data }
   * `depth` is 0-based (root items are depth 0). Expanded empty groups emit a
   * single 'group-empty' placeholder so they remain a visible drop target.
   */
  const displayItems = computed(() => {
    const out = []
    const walk = (parentId, depth) => {
      for (const child of childrenOf(parentId)) {
        out.push({
          id: child.id,
          kind: child.kind,
          depth,
          parentId: parentId ?? null,
          data: child.data,
        })
        if (child.kind === 'group' && !child.data.collapsed) {
          const before = out.length
          walk(child.id, depth + 1)
          if (out.length === before) {
            out.push({
              id: `${child.id}__empty`,
              kind: 'group-empty',
              depth: depth + 1,
              parentId: child.id,
              data: null,
            })
          }
        }
      }
    }
    walk(null, 0)
    return out
  })

  // ── Depth / constraint helpers ───────────────────────────

  /** 1-based nesting level of a group (root group = 1). */
  const groupLevel = (groupId) => {
    let level = 1
    let cur = groupsById.value.get(groupId)
    const seen = new Set()
    while (cur && cur.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId)
      cur = groupsById.value.get(cur.parentId)
      level++
    }
    return level
  }

  /** Number of group levels contained in a subtree, including the group itself. */
  const subtreeHeight = (groupId) => {
    const children = groups.value.filter((g) => g.parentId === groupId)
    if (children.length === 0) return 1
    return 1 + Math.max(...children.map((c) => subtreeHeight(c.id)))
  }

  /** Deep set of a group's descendant group ids. */
  const descendantIds = (groupId) => {
    const out = new Set()
    const walk = (pid) => {
      for (const g of groups.value) {
        if (g.parentId === pid && !out.has(g.id)) {
          out.add(g.id)
          walk(g.id)
        }
      }
    }
    walk(groupId)
    return out
  }

  /** Can a *note* be dropped directly inside the target group? Always yes. */
  const canPlaceNoteIn = (targetParentId) =>
    targetParentId === null || groupsById.value.has(targetParentId)

  /**
   * Can group `movingId` (with its whole subtree) become a child of
   * `targetParentId` (null = root) without exceeding MAX_GROUP_DEPTH or
   * creating a cycle?
   */
  const canPlaceGroupIn = (movingId, targetParentId) => {
    targetParentId = targetParentId ?? null
    if (targetParentId === movingId) return false
    if (targetParentId && descendantIds(movingId).has(targetParentId)) return false
    const newLevel = targetParentId ? groupLevel(targetParentId) + 1 : 1
    return newLevel + subtreeHeight(movingId) - 1 <= MAX_GROUP_DEPTH
  }

  /** Whether a new sub-group may be created under `parentId`. */
  const canAddSubgroup = (parentId) =>
    parentId === null || parentId === undefined ? true : groupLevel(parentId) < MAX_GROUP_DEPTH

  return {
    displayItems,
    childrenOf,
    groupsById,
    groupLevel,
    subtreeHeight,
    descendantIds,
    canPlaceNoteIn,
    canPlaceGroupIn,
    canAddSubgroup,
  }
}
