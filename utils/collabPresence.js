/**
 * Collaborative presence: live remote cursors, selections and a participant
 * list, carried over Automerge's ephemeral messages (which are NOT persisted to
 * the document — perfect for transient cursor state).
 *
 * ─ Pure core ─
 * `presenceReducer` and helpers below are framework-agnostic and unit-tested.
 * They maintain a map of remote participants keyed by senderId (one entry per
 * peer/tab) and prune stale entries.
 *
 * ─ CodeMirror integration ─
 * `collabPresenceExtension` wires the core into a CodeMirror 6 editor: it
 * broadcasts the local caret/selection on change and renders remote carets and
 * selection highlights as decorations. It also reports the participant list via
 * an `onParticipants` callback so the surrounding UI (Vue) can show avatars.
 */
import { EditorView, Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

/** How long without an update before a remote participant is considered gone. */
export const PRESENCE_TTL_MS = 8000

/** Deterministically pick a stable colour for a participant key. */
export function colorForKey(key) {
  const palette = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
  ]
  let hash = 0
  for (let i = 0; i < String(key).length; i++) {
    hash = (hash * 31 + String(key).charCodeAt(i)) & 0xffffffff
  }
  return palette[Math.abs(hash) % palette.length]
}

/**
 * Fold a received presence message into the participants map.
 *
 * @param {Record<string, object>} state current participants keyed by senderId
 * @param {object} event { senderId, message, now }
 * @returns {Record<string, object>} new state (input is not mutated)
 */
export function presenceReducer(state, { senderId, message, now = Date.now() }) {
  if (!message || message.type !== 'presence' || !senderId) return state
  const next = { ...state }
  if (message.left) {
    delete next[senderId]
    return next
  }
  next[senderId] = {
    senderId,
    name: typeof message.name === 'string' ? message.name : 'Anonymous',
    color: message.color || colorForKey(senderId),
    anchor: Number.isInteger(message.anchor) ? message.anchor : null,
    head: Number.isInteger(message.head) ? message.head : null,
    ts: now,
  }
  return next
}

/** Drop participants whose last update is older than the TTL. */
export function pruneStale(state, now = Date.now(), ttl = PRESENCE_TTL_MS) {
  const next = {}
  let changed = false
  for (const [key, p] of Object.entries(state)) {
    if (now - p.ts <= ttl) next[key] = p
    else changed = true
  }
  return changed ? next : state
}

/** Clamp a document position into [0, docLength]. */
export function clampPos(pos, docLength) {
  if (!Number.isInteger(pos)) return null
  return Math.max(0, Math.min(pos, docLength))
}

class RemoteCaretWidget extends WidgetType {
  constructor(color, name) {
    super()
    this.color = color
    this.name = name
  }

  eq(other) {
    return other.color === this.color && other.name === this.name
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-collab-caret'
    wrap.style.borderLeftColor = this.color
    const label = document.createElement('span')
    label.className = 'cm-collab-caret-label'
    label.style.backgroundColor = this.color
    label.textContent = this.name
    wrap.appendChild(label)
    return wrap
  }

  ignoreEvent() {
    return true
  }
}

/** Build CodeMirror decorations for the current set of remote participants. */
export function buildPresenceDecorations(participants, docLength) {
  const items = []
  for (const p of Object.values(participants)) {
    const head = clampPos(p.head, docLength)
    if (head == null) continue
    const anchor = clampPos(p.anchor, docLength) ?? head
    const from = Math.min(anchor, head)
    const to = Math.max(anchor, head)
    if (to > from) {
      items.push({
        from,
        to,
        deco: Decoration.mark({
          class: 'cm-collab-selection',
          attributes: { style: `background-color: ${hexToRgba(p.color, 0.25)}` },
        }),
      })
    }
    items.push({
      from: head,
      to: head,
      deco: Decoration.widget({
        widget: new RemoteCaretWidget(p.color, p.name),
        side: 1,
      }),
    })
  }
  // RangeSetBuilder requires ascending order, with points (widgets) after ranges
  // that start at the same position.
  items.sort((a, b) => a.from - b.from || (a.to === a.from ? 1 : -1) - (b.to === b.from ? 1 : -1))
  const builder = new RangeSetBuilder()
  for (const it of items) builder.add(it.from, it.to, it.deco)
  return builder.finish()
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return `rgba(59,130,246,${alpha})`
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16))
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * CodeMirror extension that broadcasts the local selection and renders remote
 * participants' carets/selections.
 *
 * @param {object} opts
 * @param {import('@automerge/automerge-repo').DocHandle} opts.handle
 * @param {string} opts.name local participant display name
 * @param {string} [opts.color] local participant colour
 * @param {(list: object[]) => void} [opts.onParticipants] participant list sink
 * @param {number} [opts.throttleMs]
 * @returns {import('@codemirror/state').Extension}
 */
export function collabPresenceExtension({ handle, name, color, onParticipants, throttleMs = 120 }) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view
        this.color = color || colorForKey(name || Math.random().toString(36))
        this.participants = {}
        this.decorations = buildPresenceDecorations({}, view.state.doc.length)
        this.lastSent = 0
        this.pending = null

        this.onMessage = ({ senderId, message }) => {
          this.participants = presenceReducer(this.participants, { senderId, message })
          this.refresh()
        }
        handle.on('ephemeral-message', this.onMessage)

        // Announce our initial position and start a heartbeat + prune loop.
        this.broadcast()
        this.timer = setInterval(
          () => {
            const before = this.participants
            this.participants = pruneStale(this.participants)
            if (this.participants !== before) this.refresh()
            this.broadcast() // heartbeat keeps us visible to peers
          },
          Math.max(2000, PRESENCE_TTL_MS / 2),
        )
      }

      update(update) {
        if (update.selectionSet || update.docChanged || update.focusChanged) {
          this.scheduleBroadcast()
        }
      }

      scheduleBroadcast() {
        const now = Date.now()
        if (now - this.lastSent >= throttleMs) {
          this.broadcast()
        } else if (!this.pending) {
          this.pending = setTimeout(
            () => {
              this.pending = null
              this.broadcast()
            },
            throttleMs - (now - this.lastSent),
          )
        }
      }

      broadcast() {
        this.lastSent = Date.now()
        const sel = this.view.state.selection.main
        try {
          handle.broadcast({
            type: 'presence',
            name: name || 'Anonymous',
            color: this.color,
            anchor: sel.anchor,
            head: sel.head,
          })
        } catch {
          /* not connected yet */
        }
      }

      refresh() {
        this.decorations = buildPresenceDecorations(this.participants, this.view.state.doc.length)
        // Force a redraw outside of a user transaction.
        this.view.dispatch({})
        if (onParticipants) {
          onParticipants(
            Object.values(this.participants).map((p) => ({
              id: p.senderId,
              name: p.name,
              color: p.color,
            })),
          )
        }
      }

      destroy() {
        handle.off('ephemeral-message', this.onMessage)
        clearInterval(this.timer)
        if (this.pending) clearTimeout(this.pending)
        try {
          handle.broadcast({ type: 'presence', left: true })
        } catch {
          /* ignore */
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  )
}

/** Base theme for remote carets/selections. */
export const collabPresenceTheme = EditorView.baseTheme({
  '.cm-collab-caret': {
    position: 'relative',
    borderLeft: '2px solid',
    marginLeft: '-1px',
  },
  '.cm-collab-caret-label': {
    position: 'absolute',
    top: '-1.2em',
    left: '-2px',
    fontSize: '0.65rem',
    lineHeight: '1',
    padding: '1px 3px',
    borderRadius: '3px',
    color: 'white',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
  },
})
