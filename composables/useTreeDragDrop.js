/**
 * useTreeDragDrop — hand-rolled, depth-aware drag & drop for the note file-tree.
 *
 * Supports both mouse (HTML5 drag) and touch (long-press) dragging with no
 * external libraries. It resolves a drop into a single high-level operation:
 *
 *   onMove({ id, kind, newParentId, orderedIds, keepParent })
 *
 *   • id           — dragged item id (note or group)
 *   • kind         — 'note' | 'group'
 *   • newParentId  — the group the item should now live in (null = root)
 *   • orderedIds   — full ordered list of sibling ids under newParentId
 *                    (mixed notes + sub-groups) after the move; the caller
 *                    reassigns sortOrder from this.
 *   • keepParent   — true in flat mode (archive/bin/search): reorder only,
 *                    never change the parent.
 *
 * Drop resolution and all visual indicators are derived from the reactive
 * `displayItems`, so they stay correct as the tree changes.
 */
export function useTreeDragDrop({
  displayItems,
  childrenOf,
  groupsById,
  canPlaceNoteIn,
  canPlaceGroupIn,
  listRef,
  canReorder,
  flatMode,
  onToggleCollapse,
  onMove,
}) {
  const draggingId = ref(null)
  const draggingType = ref(null) // 'note' | 'group'
  const dropTarget = ref(null) // { id, position: 'before'|'after'|'inside' }
  const hasDragMoved = ref(false)
  const touchDragActive = ref(false)

  const GROUP_DROP_THRESHOLD = 0.3

  const isTouchDevice = ref(false)
  if (typeof window !== 'undefined') {
    isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  // ── Auto-expand collapsed groups while hovering over them ────
  let hoverExpandTimer = null
  const HOVER_EXPAND_MS = 500
  const dragExpandedGroupIds = ref(new Set())

  const startHoverExpand = (groupId) => {
    clearHoverExpand()
    const group = groupsById.value.get(groupId)
    if (!group || !group.collapsed) return
    hoverExpandTimer = setTimeout(() => {
      onToggleCollapse(groupId)
      dragExpandedGroupIds.value = new Set([...dragExpandedGroupIds.value, groupId])
    }, HOVER_EXPAND_MS)
  }
  const clearHoverExpand = () => {
    clearTimeout(hoverExpandTimer)
    hoverExpandTimer = null
  }

  // ── Hidden items (the dragged item + its whole subtree) ──────
  const hiddenIds = computed(() => {
    const set = new Set()
    if (draggingId.value === null || !hasDragMoved.value) return set
    set.add(draggingId.value)
    if (draggingType.value !== 'group') return set
    const items = displayItems.value
    const idx = items.findIndex((i) => i.id === draggingId.value)
    if (idx === -1) return set
    const d = items[idx].depth
    for (let j = idx + 1; j < items.length && items[j].depth > d; j++) {
      set.add(items[j].id)
    }
    return set
  })
  const isHidden = (id) => hiddenIds.value.has(id)

  /** Ids belonging to the dragged group's subtree — invalid drop zones. */
  const draggedSubtreeIds = computed(() => {
    const set = new Set()
    if (draggingId.value === null || draggingType.value !== 'group') return set
    const items = displayItems.value
    const idx = items.findIndex((i) => i.id === draggingId.value)
    if (idx === -1) return set
    const d = items[idx].depth
    set.add(draggingId.value)
    for (let j = idx + 1; j < items.length && items[j].depth > d; j++) {
      set.add(items[j].id)
    }
    return set
  })

  // ── Visual indicators ────────────────────────────────────────
  const dropInsideId = computed(() => {
    const dt = dropTarget.value
    if (!dt || draggingId.value === null || !hasDragMoved.value) return null
    if (dt.position !== 'inside') return null
    const item = displayItems.value.find((i) => i.id === dt.id)
    if (!item) return null
    return item.kind === 'group-empty' ? item.parentId : item.id
  })

  const insertion = computed(() => {
    const dt = dropTarget.value
    if (!dt || draggingId.value === null || !hasDragMoved.value) return null
    if (dt.position === 'inside') return null
    const items = displayItems.value
    if (dt.id === '__bottom__') return { index: items.length, depth: 0 }
    const tIdx = items.findIndex((i) => i.id === dt.id)
    if (tIdx === -1) return null
    const T = items[tIdx]
    if (dt.position === 'before') return { index: tIdx, depth: T.depth }
    // 'after': skip past the target's whole subtree so the line sits correctly.
    let j = tIdx + 1
    while (j < items.length && items[j].depth > T.depth) j++
    return { index: j, depth: T.depth }
  })

  const insertionIndex = computed(() => (insertion.value ? insertion.value.index : -1))
  const insertionDepth = computed(() => (insertion.value ? insertion.value.depth : 0))

  const dragActive = computed(() => draggingId.value !== null && hasDragMoved.value)

  // ── Resolve the current drop into a move operation ───────────
  const resolveTarget = () => {
    const dt = dropTarget.value
    if (!dt || draggingId.value === null) return null
    const dragId = draggingId.value
    const kind = draggingType.value

    const buildOrder = (parentId, insertAt) => {
      const sibs = childrenOf(parentId)
        .map((c) => c.id)
        .filter((id) => id !== dragId)
      let at = insertAt
      if (at < 0 || at > sibs.length) at = sibs.length
      sibs.splice(at, 0, dragId)
      return sibs
    }

    // Flat mode (archive / bin / search): reorder root notes only.
    if (flatMode.value) {
      const sibs = childrenOf(null)
        .map((c) => c.id)
        .filter((id) => id !== dragId)
      if (dt.id === '__bottom__') {
        return { newParentId: null, orderedIds: buildOrder(null, sibs.length), keepParent: true }
      }
      const ti = sibs.indexOf(dt.id)
      const insertAt = (ti === -1 ? sibs.length : ti) + (dt.position === 'after' ? 1 : 0)
      return { newParentId: null, orderedIds: buildOrder(null, insertAt), keepParent: true }
    }

    if (dt.id === '__bottom__') {
      if (kind === 'group' && !canPlaceGroupIn(dragId, null)) return null
      return { newParentId: null, orderedIds: buildOrder(null, childrenOf(null).length) }
    }

    const targetItem = displayItems.value.find((i) => i.id === dt.id)
    if (!targetItem) return null

    if (dt.position === 'inside') {
      const gid = targetItem.kind === 'group-empty' ? targetItem.parentId : targetItem.id
      const ok = kind === 'note' ? canPlaceNoteIn(gid) : canPlaceGroupIn(dragId, gid)
      if (!ok) return null
      return { newParentId: gid, orderedIds: buildOrder(gid, childrenOf(gid).length) }
    }

    // before / after a sibling
    const parentId = targetItem.parentId
    const ok = kind === 'group' ? canPlaceGroupIn(dragId, parentId) : canPlaceNoteIn(parentId)
    if (!ok) return null
    const sibs = childrenOf(parentId)
      .map((c) => c.id)
      .filter((id) => id !== dragId)
    const ti = sibs.indexOf(dt.id)
    const insertAt = (ti === -1 ? sibs.length : ti) + (dt.position === 'after' ? 1 : 0)
    return { newParentId: parentId, orderedIds: buildOrder(parentId, insertAt) }
  }

  // ── Hit testing ──────────────────────────────────────────────
  const getItemAtY = (y) => {
    if (!listRef.value) return null
    const els = listRef.value.querySelectorAll('[data-item-id]')
    let closest = null
    let closestDist = Infinity
    for (const el of els) {
      if (el.style.display === 'none') continue
      const rect = el.getBoundingClientRect()
      if (rect.height === 0) continue
      const info = {
        id: el.dataset.itemId,
        kind: el.dataset.kind, // 'group' | 'note' | 'empty'
        rect,
      }
      if (y >= rect.top && y <= rect.bottom) return info
      const dist = Math.min(Math.abs(y - rect.top), Math.abs(y - rect.bottom))
      if (dist < closestDist) {
        closestDist = dist
        closest = info
      }
    }
    if (closest && closestDist < 60) return closest
    return null
  }

  const updateDropTarget = (clientY) => {
    const hit = getItemAtY(clientY)

    if (!hit) {
      dropTarget.value = listRef.value ? { id: '__bottom__', position: 'after' } : null
      clearHoverExpand()
      return
    }
    if (hit.id === draggingId.value || draggedSubtreeIds.value.has(hit.id)) {
      // Over the dragged item or its own subtree — not a valid target.
      dropTarget.value = null
      clearHoverExpand()
      return
    }

    const hy = clientY - hit.rect.top
    const hh = hit.rect.height

    if (hit.kind === 'empty') {
      dropTarget.value = { id: hit.id, position: 'inside' }
      clearHoverExpand()
      return
    }

    if (hit.kind === 'group') {
      const allowedInside =
        draggingType.value === 'note'
          ? canPlaceNoteIn(hit.id)
          : canPlaceGroupIn(draggingId.value, hit.id)

      if (!allowedInside) {
        dropTarget.value = { id: hit.id, position: hy < hh / 2 ? 'before' : 'after' }
        clearHoverExpand()
        return
      }
      if (hy < hh * GROUP_DROP_THRESHOLD) {
        dropTarget.value = { id: hit.id, position: 'before' }
        clearHoverExpand()
      } else if (hy > hh * (1 - GROUP_DROP_THRESHOLD)) {
        dropTarget.value = { id: hit.id, position: 'after' }
        clearHoverExpand()
      } else {
        dropTarget.value = { id: hit.id, position: 'inside' }
        const g = groupsById.value.get(hit.id)
        if (g && g.collapsed) startHoverExpand(hit.id)
        else clearHoverExpand()
      }
      return
    }

    // note
    dropTarget.value = { id: hit.id, position: hy < hh / 2 ? 'before' : 'after' }
    clearHoverExpand()
  }

  // ── Custom drag images ───────────────────────────────────────
  const listBg = () => {
    if (!listRef.value) return '#ffffff'
    const bg = getComputedStyle(listRef.value).backgroundColor
    return bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff'
  }

  const createDragImage = (el) => {
    const clone = el.cloneNode(true)
    clone.style.position = 'absolute'
    clone.style.top = '-9999px'
    clone.style.left = '-9999px'
    clone.style.width = el.offsetWidth + 'px'
    clone.style.background = listBg()
    clone.style.opacity = '0.9'
    clone.style.borderRadius = '6px'
    clone.style.boxShadow = '0 12px 32px rgba(0,0,0,0.18)'
    clone.style.pointerEvents = 'none'
    clone.style.zIndex = '9999'
    clone.style.transform = 'rotate(1deg) scale(1.02)'
    document.body.appendChild(clone)
    return clone
  }
  let dragImageEl = null

  // ── Mouse (HTML5 drag) ───────────────────────────────────────
  const onDragStart = (e, id, type) => {
    if (!canReorder.value) return
    draggingId.value = id
    draggingType.value = type
    dragExpandedGroupIds.value = new Set()
    e.dataTransfer.effectAllowed = 'move'

    const el = e.currentTarget
    dragImageEl = createDragImage(el)
    e.dataTransfer.setDragImage(dragImageEl, el.offsetWidth / 2, 20)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (dragImageEl) {
          dragImageEl.remove()
          dragImageEl = null
        }
      })
    })
  }

  const onDragOverList = (e) => {
    if (draggingId.value === null) return
    hasDragMoved.value = true
    updateDropTarget(e.clientY)
  }

  const restoreAutoExpanded = (keepGroupId = null) => {
    for (const gid of dragExpandedGroupIds.value) {
      if (gid !== keepGroupId) onToggleCollapse(gid)
    }
    dragExpandedGroupIds.value = new Set()
  }

  const resetDrag = () => {
    draggingId.value = null
    draggingType.value = null
    dropTarget.value = null
    hasDragMoved.value = false
    touchDragActive.value = false
  }

  const onDragEnd = () => {
    clearHoverExpand()
    if (draggingId.value !== null) {
      restoreAutoExpanded()
      resetDrag()
    }
  }

  const commit = () => {
    clearHoverExpand()
    const resolved =
      draggingId.value !== null && dropTarget.value && hasDragMoved.value ? resolveTarget() : null
    restoreAutoExpanded(resolved ? resolved.newParentId : null)
    if (resolved) {
      onMove({
        id: draggingId.value,
        kind: draggingType.value,
        newParentId: resolved.newParentId,
        orderedIds: resolved.orderedIds,
        keepParent: !!resolved.keepParent,
      })
    }
    nextTick(resetDrag)
  }

  const onDrop = () => {
    commit()
  }

  // ── Touch (long-press to drag) ───────────────────────────────
  let touchHoldTimer = null
  let touchCloneEl = null
  const TOUCH_HOLD_MS = 400
  const TOUCH_MOVE_THRESHOLD = 8

  const createTouchClone = (el) => {
    const clone = el.cloneNode(true)
    const rect = el.getBoundingClientRect()
    clone.style.cssText = `
      position: fixed; left: 8px; width: ${rect.width - 16}px;
      background: ${listBg()};
      opacity: 0.95; border-radius: 6px; pointer-events: none; z-index: 9999;
      box-shadow: 0 12px 32px rgba(0,0,0,0.22); transform: scale(1.02);
    `
    document.body.appendChild(clone)
    return clone
  }

  const cleanupTouchClone = () => {
    clearTimeout(touchHoldTimer)
    touchHoldTimer = null
    if (touchCloneEl) {
      touchCloneEl.remove()
      touchCloneEl = null
    }
  }

  const onTouchStart = (e, id, type) => {
    if (!canReorder.value) return

    const el = e.currentTarget
    const t0 = e.touches[0]
    const startX = t0.clientX
    const startY = t0.clientY
    let phase = 'waiting' // 'waiting' | 'dragging' | 'cancelled'

    const onContextMenu = (ev) => ev.preventDefault()
    el.addEventListener('contextmenu', onContextMenu)

    const cleanupWaiting = () => {
      el.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('touchmove', onWaitingMove)
      document.removeEventListener('touchend', onWaitingEnd)
      document.removeEventListener('touchcancel', onWaitingEnd)
    }
    const cancelHold = () => {
      if (phase === 'cancelled') return
      phase = 'cancelled'
      clearTimeout(touchHoldTimer)
      cleanupWaiting()
    }
    const onWaitingMove = (ev) => {
      const t = ev.touches[0]
      if (
        Math.abs(t.clientX - startX) > TOUCH_MOVE_THRESHOLD ||
        Math.abs(t.clientY - startY) > TOUCH_MOVE_THRESHOLD
      ) {
        cancelHold()
      }
    }
    const onWaitingEnd = () => cancelHold()

    document.addEventListener('touchmove', onWaitingMove, { passive: true })
    document.addEventListener('touchend', onWaitingEnd)
    document.addEventListener('touchcancel', onWaitingEnd)

    touchHoldTimer = setTimeout(() => {
      if (phase !== 'waiting') return
      phase = 'dragging'
      document.removeEventListener('touchmove', onWaitingMove)
      document.removeEventListener('touchend', onWaitingEnd)
      document.removeEventListener('touchcancel', onWaitingEnd)

      touchDragActive.value = true
      draggingId.value = id
      draggingType.value = type
      dragExpandedGroupIds.value = new Set()

      try {
        window.navigator?.vibrate?.(30)
      } catch {
        /* ignore */
      }

      touchCloneEl = createTouchClone(el)
      touchCloneEl.style.top = startY - 26 + 'px'

      const onDragMove = (ev) => {
        ev.preventDefault()
        const touch = ev.touches[0]
        if (touchCloneEl) touchCloneEl.style.top = touch.clientY - 26 + 'px'

        if (listRef.value) {
          const listRect = listRef.value.getBoundingClientRect()
          const SCROLL_ZONE = 50
          const SCROLL_SPEED = 6
          if (touch.clientY < listRect.top + SCROLL_ZONE) {
            listRef.value.scrollTop = Math.max(0, listRef.value.scrollTop - SCROLL_SPEED)
          } else if (touch.clientY > listRect.bottom - SCROLL_ZONE) {
            listRef.value.scrollTop += SCROLL_SPEED
          }
        }

        hasDragMoved.value = true
        updateDropTarget(touch.clientY)
      }

      const onTouchDragEnd = () => {
        document.removeEventListener('touchmove', onDragMove)
        document.removeEventListener('touchend', onTouchDragEnd)
        document.removeEventListener('touchcancel', onTouchDragEnd)
        el.removeEventListener('contextmenu', onContextMenu)
        cleanupTouchClone()
        commit()
      }

      document.addEventListener('touchmove', onDragMove, { passive: false })
      document.addEventListener('touchend', onTouchDragEnd)
      document.addEventListener('touchcancel', onTouchDragEnd)
    }, TOUCH_HOLD_MS)
  }

  onBeforeUnmount(() => {
    clearHoverExpand()
    cleanupTouchClone()
  })

  return {
    // state
    draggingId,
    draggingType,
    touchDragActive,
    dropTarget,
    isTouchDevice,
    dragActive,
    // visual
    isHidden,
    dropInsideId,
    insertionIndex,
    insertionDepth,
    // handlers
    onDragStart,
    onDragOverList,
    onDragEnd,
    onDrop,
    onTouchStart,
  }
}
