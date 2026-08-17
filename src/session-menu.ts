import { titleText } from './decorations.js'

export interface SessionEntity { id: string; title: string }

export interface SessionMenuOptions {
  document: Document
  sessions(): readonly SessionEntity[]
  inline(menu: HTMLElement, session: SessionEntity): void
}

function classContains(element: Element, value: string): boolean {
  return Array.from(element.classList).some((name) => name.includes(value))
}

function titleOf(row: HTMLElement): string {
  const title = Array.from(row.children).find((child): child is HTMLElement => child instanceof HTMLElement && classContains(child, 'title'))
  return title === undefined ? '' : titleText(title)
}

export function mountSessionMenu(options: SessionMenuOptions): () => void {
  const { document } = options
  let disposed = false
  let pending = false
  const sync = (): void => {
    pending = false
    if (disposed) return
    const row = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((candidate) =>
      classContains(candidate, 'sessionRow') && classContains(candidate, 'menuOpen'))
    if (row === undefined) return
    const matches = options.sessions().filter((session) => session.title === titleOf(row))
    if (matches.length !== 1) return
    const button = row.querySelector<HTMLButtonElement>('button[aria-label]')
    if (button === null) return
    const rect = button.getBoundingClientRect()
    const menu = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]'))
      .filter((candidate) => candidate.querySelector('[role="menuitem"]') !== null)
      .sort((a, b) => {
        const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect()
        return Math.abs(ar.left - rect.left) + Math.abs(ar.top - rect.bottom) - Math.abs(br.left - rect.left) - Math.abs(br.top - rect.bottom)
      })[0]
    if (menu === undefined || menu.querySelector('[data-dsh-workspace-labels-inline]') !== null) return
    options.inline(menu, matches[0])
  }
  const schedule = (): void => { if (!disposed && !pending) { pending = true; queueMicrotask(sync) } }
  const Observer = document.defaultView?.MutationObserver
  if (Observer === undefined) throw new Error('dsh-workspace-labels: MutationObserver unavailable')
  const observer = new Observer(schedule)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  document.addEventListener('click', schedule, true)
  return () => {
    disposed = true; observer.disconnect(); document.removeEventListener('click', schedule, true)
    document.querySelectorAll('[data-dsh-workspace-labels-inline]').forEach((entry) => entry.remove())
  }
}
