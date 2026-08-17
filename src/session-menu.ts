import type { LabelsStore } from './store.js'
import { nextColor } from './state.js'

export interface SessionEntity { id: string; title: string }

export interface SessionMenuOptions {
  document: Document
  store: LabelsStore
  sessions(): readonly SessionEntity[]
  labels: { color: string; manage: string; prompt: string }
}

function classContains(element: Element, value: string): boolean {
  return Array.from(element.classList).some((name) => name.includes(value))
}

function titleOf(row: HTMLElement): string {
  const title = Array.from(row.children).find((child) => classContains(child, 'title'))
  return title?.textContent?.trim() ?? ''
}

function menuItem(document: Document, menu: HTMLElement, action: string, label: string, select: () => void): HTMLElement {
  const reference = menu.querySelector<HTMLElement>('[role="menuitem"]')
  const wrapper = document.createElement(reference?.parentElement?.tagName.toLowerCase() ?? 'div')
  if (reference?.parentElement instanceof HTMLElement) wrapper.className = reference.parentElement.className
  wrapper.dataset.dshWorkspaceLabelsSessionMenu = 'true'
  const button = document.createElement('button')
  button.type = 'button'; button.role = 'menuitem'; button.dataset.action = action
  if (reference !== null) button.className = reference.className
  const icon = document.createElement('span')
  if (reference?.children[0] instanceof HTMLElement) icon.className = reference.children[0].className
  icon.textContent = action.endsWith('color') ? '●' : '🏷'
  const text = document.createElement('span')
  if (reference?.children[1] instanceof HTMLElement) text.className = reference.children[1].className
  text.textContent = label
  button.append(icon, text)
  button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); select() })
  wrapper.appendChild(button)
  return wrapper
}

export function mountSessionMenu(options: SessionMenuOptions): () => void {
  const { document, store } = options
  let disposed = false
  let pending = false
  const sync = (): void => {
    pending = false
    if (disposed) return
    const row = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((candidate) =>
      classContains(candidate, 'sessionRow') && classContains(candidate, 'menuOpen'))
    if (row === undefined) return
    const title = titleOf(row)
    const matches = options.sessions().filter((session) => session.title === title)
    if (matches.length !== 1) return
    const session = matches[0]
    const button = row.querySelector<HTMLButtonElement>('button[aria-label]')
    if (button === null) return
    const rect = button.getBoundingClientRect()
    const menus = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]')).filter((menu) => menu.querySelector('[role="menuitem"]') !== null)
    const menu = menus.sort((a, b) => {
      const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect()
      return Math.abs(ar.left - rect.left) + Math.abs(ar.top - rect.bottom) - Math.abs(br.left - rect.left) - Math.abs(br.top - rect.bottom)
    })[0]
    if (menu === undefined || menu.querySelector('[data-dsh-workspace-labels-session-menu]') !== null) return
    const viewport = menu.querySelector<HTMLElement>('[role="presentation"]') ?? menu
    const close = (): void => { document.dispatchEvent(new (document.defaultView?.MouseEvent ?? MouseEvent)('pointerdown', { bubbles: true })) }
    const color = menuItem(document, menu, 'workspace-labels-session-color', options.labels.color, () => {
      const state = store.getSnapshot(); const colors = { ...state.sessionColors }; const value = nextColor(colors[session.id])
      if (value === undefined) delete colors[session.id]; else colors[session.id] = value
      void store.patch({ sessionColors: colors }); close()
    })
    const labels = menuItem(document, menu, 'workspace-labels-session-labels', options.labels.manage, () => {
      const state = store.getSnapshot()
      const existing = (state.sessionLabels[session.id] ?? []).map((id) => state.labels.find((label) => label.id === id)?.name).filter(Boolean).join(', ')
      const input = window.prompt(options.labels.prompt, existing)
      if (input !== null) {
        const names = [...new Set(input.split(',').map((name) => name.trim()).filter(Boolean))].slice(0, 8)
        const definitions = [...state.labels]
        const ids = names.map((name) => {
          const found = definitions.find((item) => item.name.toLowerCase() === name.toLowerCase())
          if (found !== undefined) return found.id
          const id = `label-${Date.now()}-${definitions.length}`
          definitions.push({ id, name: name.slice(0, 24), color: nextColor(definitions.at(-1)?.color) ?? '#3b82f6' })
          return id
        })
        void store.patch({ labels: definitions, sessionLabels: { ...state.sessionLabels, [session.id]: ids } })
      }
      close()
    })
    viewport.prepend(color, labels)
  }
  const schedule = (): void => { if (!disposed && !pending) { pending = true; queueMicrotask(sync) } }
  const Observer = document.defaultView?.MutationObserver
  if (Observer === undefined) throw new Error('dsh-workspace-labels: MutationObserver unavailable')
  const observer = new Observer(schedule)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  document.addEventListener('click', schedule, true)
  return () => {
    disposed = true; observer.disconnect(); document.removeEventListener('click', schedule, true)
    document.querySelectorAll('[data-dsh-workspace-labels-session-menu]').forEach((entry) => entry.remove())
  }
}
