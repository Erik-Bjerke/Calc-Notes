/**
 * Group modal state and handlers for the index page.
 */
export function useGroupManagement({
  notes,
  groups,
  addGroup,
  updateGroup,
  deleteGroupFromDb,
  toggleGroupCollapsed,
  reorderGroups,
  moveNotesToGroup,
  removeNotesFromGroup,
  deleteNote,
  softDeleteNote,
  binEnabled,
  syncNow,
}) {
  const showGroupModal = ref(false)
  const editingGroupId = ref(null)
  const editingGroupName = ref('')
  const editingGroupInternalName = ref('')

  const showDeleteGroupModal = ref(false)
  const pendingDeleteGroupId = ref(null)

  const showAddToGroupModal = ref(false)
  const addToGroupNoteId = ref(null)
  const bulkGroupNoteIds = ref(null)

  // Parent group for a group about to be created (null = top level).
  const pendingParentGroupId = ref(null)

  // Deep set of a group's descendant group ids (excludes the group itself).
  const collectDescendantGroupIds = (groupId) => {
    const out = []
    const walk = (pid) => {
      for (const g of groups.value) {
        if ((g.parentId ?? null) === pid) {
          out.push(g.id)
          walk(g.id)
        }
      }
    }
    walk(groupId)
    return out
  }

  const pendingDeleteGroup = computed(() => {
    return groups.value.find((g) => g.id === pendingDeleteGroupId.value) || null
  })

  // Ids of the group being deleted plus its whole subtree.
  const pendingDeleteSubtreeIds = computed(() => {
    if (!pendingDeleteGroupId.value) return []
    return [pendingDeleteGroupId.value, ...collectDescendantGroupIds(pendingDeleteGroupId.value)]
  })

  const pendingDeleteGroupNoteCount = computed(() => {
    if (!pendingDeleteGroupId.value) return 0
    const subtree = new Set(pendingDeleteSubtreeIds.value)
    return notes.value.filter((n) => subtree.has(n.groupId)).length
  })

  // Groups a note may be moved into when deleting — never the subtree being removed.
  const otherGroupsForDelete = computed(() => {
    const subtree = new Set(pendingDeleteSubtreeIds.value)
    return groups.value.filter((g) => !subtree.has(g.id))
  })

  const handleAddToGroup = (noteId) => {
    addToGroupNoteId.value = noteId
    showAddToGroupModal.value = true
  }

  const handleBulkGroup = (noteIds) => {
    bulkGroupNoteIds.value = noteIds
    addToGroupNoteId.value = null
    showAddToGroupModal.value = true
  }

  const handleAddToGroupSelect = (groupId) => {
    if (bulkGroupNoteIds.value) {
      moveNotesToGroup(bulkGroupNoteIds.value, groupId)
      bulkGroupNoteIds.value.forEach((id) => syncNow(id))
      bulkGroupNoteIds.value = null
    } else if (addToGroupNoteId.value) {
      moveNotesToGroup([addToGroupNoteId.value], groupId)
      syncNow(addToGroupNoteId.value)
    }
    showAddToGroupModal.value = false
    addToGroupNoteId.value = null
  }

  const handleAddToGroupCreateNew = () => {
    showAddToGroupModal.value = false
    editingGroupId.value = null
    editingGroupName.value = ''
    editingGroupInternalName.value = ''
    pendingParentGroupId.value = null
    showGroupModal.value = true
  }

  // Open the group modal to create a new sub-group under `parentId`.
  const handleAddSubgroup = (parentId) => {
    editingGroupId.value = null
    editingGroupName.value = ''
    editingGroupInternalName.value = ''
    pendingParentGroupId.value = parentId ?? null
    showGroupModal.value = true
  }

  const handleGroupModalSave = ({ id, name, internalName }) => {
    if (id) {
      updateGroup(id, { name, internalName })
    } else {
      const group = addGroup(name, pendingParentGroupId.value)
      updateGroup(group.id, { internalName })
      pendingParentGroupId.value = null
      if (bulkGroupNoteIds.value) {
        moveNotesToGroup(bulkGroupNoteIds.value, group.id)
        bulkGroupNoteIds.value.forEach((nid) => syncNow(nid))
        bulkGroupNoteIds.value = null
      } else if (addToGroupNoteId.value) {
        moveNotesToGroup([addToGroupNoteId.value], group.id)
        syncNow(addToGroupNoteId.value)
        addToGroupNoteId.value = null
      }
    }
  }

  const handleEditGroup = (groupId) => {
    const group = groups.value.find((g) => g.id === groupId)
    if (!group) return
    editingGroupId.value = groupId
    editingGroupName.value = group.name
    editingGroupInternalName.value = group.internalName
    pendingParentGroupId.value = null
    showGroupModal.value = true
  }

  const handleDeleteGroup = (groupId) => {
    pendingDeleteGroupId.value = groupId
    showDeleteGroupModal.value = true
  }

  const handleDeleteGroupConfirm = (action, moveToGroupId) => {
    const groupId = pendingDeleteGroupId.value
    if (!groupId) return

    const group = groups.value.find((g) => g.id === groupId)
    const parentId = group ? (group.parentId ?? null) : null
    const subtreeGroupIds = [groupId, ...collectDescendantGroupIds(groupId)]
    const subtreeSet = new Set(subtreeGroupIds)

    if (action === 'keep') {
      // Preserve the group's contents by lifting its direct children up one level.
      for (const g of groups.value) {
        if (g.parentId === groupId) updateGroup(g.id, { parentId })
      }
      const directNoteIds = notes.value.filter((n) => n.groupId === groupId).map((n) => n.id)
      if (directNoteIds.length) moveNotesToGroup(directNoteIds, parentId)
      deleteGroupFromDb(groupId)
    } else if (action === 'move' && moveToGroupId) {
      // Move every note in the subtree into the target, then drop the folders.
      const noteIds = notes.value.filter((n) => subtreeSet.has(n.groupId)).map((n) => n.id)
      if (noteIds.length) moveNotesToGroup(noteIds, moveToGroupId)
      for (const gid of subtreeGroupIds) deleteGroupFromDb(gid)
    } else if (action === 'delete-all') {
      const noteIds = notes.value.filter((n) => subtreeSet.has(n.groupId)).map((n) => n.id)
      const useSoftDelete = binEnabled && binEnabled.value
      for (const id of noteIds) {
        if (useSoftDelete) softDeleteNote(id)
        else deleteNote(id)
      }
      for (const gid of subtreeGroupIds) deleteGroupFromDb(gid)
    } else {
      // Fallback: detach the subtree's notes and remove just this group.
      removeNotesFromGroup(groupId)
      deleteGroupFromDb(groupId)
    }

    showDeleteGroupModal.value = false
    pendingDeleteGroupId.value = null
    syncNow()
  }

  const handleToggleGroupCollapse = (groupId) => {
    toggleGroupCollapsed(groupId)
  }

  const handleMoveNoteToGroup = ({ noteId, groupId }) => {
    moveNotesToGroup([noteId], groupId)
    syncNow(noteId)
  }

  const handleReorderGroups = (orderedIds) => {
    reorderGroups(orderedIds)
    syncNow()
  }

  return {
    showGroupModal,
    editingGroupId,
    editingGroupName,
    editingGroupInternalName,
    showDeleteGroupModal,
    pendingDeleteGroup,
    pendingDeleteGroupNoteCount,
    otherGroupsForDelete,
    showAddToGroupModal,
    addToGroupNoteId,
    bulkGroupNoteIds,
    pendingParentGroupId,
    handleAddToGroup,
    handleBulkGroup,
    handleAddToGroupSelect,
    handleAddToGroupCreateNew,
    handleAddSubgroup,
    handleGroupModalSave,
    handleEditGroup,
    handleDeleteGroup,
    handleDeleteGroupConfirm,
    handleToggleGroupCollapse,
    handleMoveNoteToGroup,
    handleReorderGroups,
  }
}
