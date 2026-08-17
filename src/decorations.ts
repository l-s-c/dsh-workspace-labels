import type { LabelsDocument } from './state.js'
import { nextColor } from './state.js'

const STYLE_ID = 'dsh-workspace-labels-style'
const WORKSPACE_ID = 'data-dsh-workspace-labels-workspace-id'
const SESSION_ID = 'data-dsh-workspace-labels-session-id'
const BADGE_CLASS = 'dsh-workspace-labels-badges'

export interface RowEntity {
  id: string
  title: string
}

export interface DecorationOptions {
  document: Document
  getDocument(): LabelsDocument
  subscribe(listener: () => void): () => void
  workspaces(): readonly RowEntity[]
  sessions(): readonly RowEntity[]
}

function childByClass(row: Element, part: string): HTMLElement | undefined {
  return Array.from(row.children).find((child): child is HTMLElement =>
    child instanceof HTMLElement && Array.from(child.classList).some((name) => name.includes(part)),
  )
}

export function titleText(element: Element): string {
  let text = ''
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 1 && (node as Element).classList.contains(BADGE_CLASS)) continue
    text += node.textContent ?? ''
  }
  return text.trim()
}

function rgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (match === null) return 'transparent'
  const value = Number.parseInt(match[1], 16)
  return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`
}

function resolveByTitle(row: HTMLElement, entities: readonly RowEntity[], marker: string, titlePart: string): RowEntity | undefined {
  const titleElement = childByClass(row, titlePart)
  const title = titleElement === undefined ? '' : titleText(titleElement)
  const knownId = row.getAttribute(marker)
  if (knownId !== null) {
    const known = entities.find((item) => item.id === knownId)
    if (known?.title === title) return known
    row.removeAttribute(marker)
  }
  const matches = entities.filter((item) => item.title === title)
  if (matches.length !== 1) return undefined
  row.setAttribute(marker, matches[0].id)
  return matches[0]
}

function labelsFor(document: LabelsDocument, ids: readonly string[]): { name: string; color: string }[] {
  const selected = new Set(ids)
  return document.labels.filter((label) => selected.has(label.id))
}

function decorate(row: HTMLElement, entity: RowEntity, titleElement: HTMLElement, color: string | undefined, labels: { name: string; color: string }[]): void {
  if (color === undefined) {
    if (row.classList.contains('dsh-workspace-labels-colored')) {
      row.style.removeProperty('--dsh-workspace-label-color')
      row.style.removeProperty('--dsh-workspace-label-tint')
      row.classList.remove('dsh-workspace-labels-colored')
    }
  } else if (row.style.getPropertyValue('--dsh-workspace-label-color') !== color || !row.classList.contains('dsh-workspace-labels-colored')) {
    row.style.setProperty('--dsh-workspace-label-color', color)
    row.style.setProperty('--dsh-workspace-label-tint', rgba(color, 0.1))
    row.classList.add('dsh-workspace-labels-colored')
  }
  const existing = titleElement.querySelector<HTMLElement>(`.${BADGE_CLASS}`)
  const shown = labels.slice(0, 3)
  const signature = shown.map((label) => `${label.name}\u0000${label.color}`).join('\u0001')
  if (existing !== null && existing.dataset.signature === signature && existing.dataset.entityId === entity.id) return
  existing?.remove()
  if (shown.length === 0) return
  const badges = row.ownerDocument.createElement('span')
  badges.className = BADGE_CLASS
  badges.dataset.entityId = entity.id
  badges.dataset.signature = signature
  for (const label of shown) {
    const badge = row.ownerDocument.createElement('span')
    badge.className = 'dsh-workspace-labels-badge'
    badge.textContent = label.name
    badge.style.borderColor = label.color
    badge.style.color = label.color
    badges.appendChild(badge)
  }
  titleElement.appendChild(badges)
}

function styleText(): string {
  return `
.dsh-workspace-labels-colored { box-shadow: inset 3px 0 0 var(--dsh-workspace-label-color); background: var(--dsh-workspace-label-tint) !important; }
.dsh-workspace-labels-badges { display:inline-flex; gap:3px; margin-left:5px; vertical-align:middle; max-width:48%; overflow:hidden; }
.dsh-workspace-labels-badge { display:inline-block; border:1px solid; border-radius:999px; padding:0 5px; font-size:9px; line-height:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:72px; }
`
}

export function mountDecorations(options: DecorationOptions): () => void {
  const { document } = options
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = styleText()
  document.head.appendChild(style)
  let disposed = false
  let pending = false
  const sync = (): void => {
    pending = false
    if (disposed) return
    const state = options.getDocument()
    const workspaces = options.workspaces()
    for (const row of document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]')) {
      const title = childByClass(row, 'projectText')
      if (title === undefined) continue
      const entity = resolveByTitle(row, workspaces, WORKSPACE_ID, 'projectText')
      if (entity === undefined) continue
      decorate(row, entity, title, state.workspaceColors[entity.id], labelsFor(state, state.workspaceLabels[entity.id] ?? []))
    }
    const sessions = options.sessions()
    for (const row of document.querySelectorAll<HTMLElement>('[role="treeitem"]')) {
      const title = childByClass(row, 'sessionText') ?? childByClass(row, 'title')
      if (title === undefined || childByClass(row, 'projectText') !== undefined) continue
      const entity = resolveByTitle(row, sessions, SESSION_ID, title.className.includes('sessionText') ? 'sessionText' : 'title')
      if (entity === undefined) continue
      decorate(row, entity, title, state.sessionColors[entity.id], labelsFor(state, state.sessionLabels[entity.id] ?? []))
    }
    observer.takeRecords()
  }
  const schedule = (): void => {
    if (pending || disposed) return
    pending = true
    queueMicrotask(sync)
  }
  const Observer = document.defaultView?.MutationObserver
  if (Observer === undefined) throw new Error('dsh-workspace-labels: MutationObserver unavailable')
  const observer = new Observer(schedule)
  observer.observe(document.body, { subtree: true, childList: true })
  const unsubscribe = options.subscribe(schedule)
  schedule()
  return () => {
    disposed = true
    observer.disconnect()
    unsubscribe()
    style.remove()
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((node) => node.remove())
    document.querySelectorAll<HTMLElement>('.dsh-workspace-labels-colored').forEach((row) => {
      row.classList.remove('dsh-workspace-labels-colored')
      row.style.removeProperty('--dsh-workspace-label-color')
      row.style.removeProperty('--dsh-workspace-label-tint')
    })
  }
}

export { nextColor }
