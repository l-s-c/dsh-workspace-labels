export const PLUGIN_ID = 'dsh-workspace-labels'
export const OPEN_ACTION = 'workspace-labels-open'
export const COPY_ACTION = 'workspace-labels-copy-path'
export const MENU_MARKER = 'data-dsh-workspace-labels-menu'
export const ROW_MARKER = 'data-dsh-workspace-labels-workspace-id'

export interface WorkspaceRecord {
  workspaceId: string
  title: string
  path: string
}

export interface WorkspaceSource {
  getSnapshot(): { items: readonly WorkspaceRecord[] }
  subscribe(listener: () => void): () => void
}

export interface WorkspaceOpener {
  openPath(path: string): Promise<void>
}

export interface ClipboardWriter {
  write(text: string): Promise<boolean>
}

export interface EnhancerLogger {
  warn(message: string): void
}

export interface EnhanceOptions {
  document: Document
  workspaces: WorkspaceSource
  opener: WorkspaceOpener
  clipboard?: ClipboardWriter
  logger: EnhancerLogger
  label?: string
  copyLabel?: string
  canOpen?: { getSnapshot(): boolean; subscribe(listener: () => void): () => void }
}

function directChildByClassPart(row: Element, part: string): HTMLElement | undefined {
  return Array.from(row.children).find((child): child is HTMLElement =>
    child instanceof HTMLElement && Array.from(child.classList).some((name) => name.includes(part)),
  )
}

function workspaceRows(document: Document): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]'))
    .filter((row) => directChildByClassPart(row, 'projectText') !== undefined)
}

function rowTitle(row: HTMLElement): string {
  const title = directChildByClassPart(row, 'projectText')?.textContent
  return title?.trim() ?? ''
}

function menuButton(row: HTMLElement): HTMLButtonElement | undefined {
  const actions = directChildByClassPart(row, 'rowActions')
  return actions?.querySelector<HTMLButtonElement>('button[aria-label]') ?? undefined
}

function resolveWorkspace(row: HTMLElement, items: readonly WorkspaceRecord[]): WorkspaceRecord | undefined {
  const title = rowTitle(row)
  if (title === '') {
    row.removeAttribute(ROW_MARKER)
    return undefined
  }

  const knownId = row.getAttribute(ROW_MARKER)
  if (knownId !== null) {
    const known = items.find((item) => item.workspaceId === knownId)
    if (known?.title === title) return known
    row.removeAttribute(ROW_MARKER)
  }

  const matches = items.filter((item) => item.title === title)
  if (matches.length !== 1) return undefined
  row.setAttribute(ROW_MARKER, matches[0].workspaceId)
  return matches[0]
}

function visibleMenus(document: Document): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]')).filter((menu) => {
    const style = document.defaultView?.getComputedStyle(menu)
    return style === undefined || (style.display !== 'none' && style.visibility !== 'hidden')
  })
}

function activeWorkspaceMenu(document: Document): { row: HTMLElement; menu: HTMLElement } | undefined {
  const rows = workspaceRows(document)
  const row = rows.find((candidate) => directChildByClassPart(candidate, 'menuOpen') !== undefined)
    ?? rows.find((candidate) => Array.from(candidate.classList).some((name) => name.includes('menuOpen')))
  if (row === undefined) return undefined

  const button = menuButton(row)
  if (button === undefined) return undefined
  const buttonRect = button.getBoundingClientRect()
  const menus = visibleMenus(document).filter((menu) => menu.querySelector('[role="menuitem"]') !== null)
  if (menus.length === 0) return undefined

  const menu = menus.reduce((best, candidate) => {
    const rect = candidate.getBoundingClientRect()
    const distance = Math.abs(rect.left - buttonRect.left) + Math.abs(rect.top - buttonRect.bottom)
    return best === undefined || distance < best.distance ? { menu: candidate, distance } : best
  }, undefined as { menu: HTMLElement; distance: number } | undefined)?.menu

  return menu === undefined ? undefined : { row, menu }
}

function copyIcon(document: Document): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M5.25 5.25h6.5v6.5h-6.5v-6.5Zm-1 4.5h-1a1 1 0 0 1-1-1v-5.5a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1v1')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.25')
  path.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(path)
  return svg
}

function folderIcon(document: Document): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M1.75 4.25A1.25 1.25 0 0 1 3 3h3l1.25 1.5H13A1.25 1.25 0 0 1 14.25 5.75v6A1.25 1.25 0 0 1 13 13H3a1.25 1.25 0 0 1-1.25-1.25v-7.5Z')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.25')
  path.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(path)
  return svg
}

function makeMenuItem(document: Document, menu: HTMLElement, action: string, label: string, iconNode: SVGElement, onSelect: () => void): HTMLElement {
  const reference = menu.querySelector<HTMLElement>('[role="menuitem"]')
  const wrapperReference = reference?.parentElement
  const wrapper = document.createElement(wrapperReference?.tagName.toLowerCase() ?? 'div')
  if (wrapperReference?.className !== undefined) wrapper.className = wrapperReference.className
  wrapper.setAttribute(MENU_MARKER, 'true')

  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('role', 'menuitem')
  button.setAttribute('data-action', action)
  if (reference?.className !== undefined) button.className = reference.className

  const iconReference = reference?.children.item(0)
  const icon = document.createElement('span')
  if (iconReference instanceof HTMLElement) icon.className = iconReference.className
  icon.appendChild(iconNode)

  const labelReference = reference?.children.item(1)
  const text = document.createElement('span')
  if (labelReference instanceof HTMLElement) text.className = labelReference.className
  text.textContent = label

  button.append(icon, text)
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect()
  })
  wrapper.appendChild(button)
  return wrapper
}

export function enhanceOpenWorkspaceMenu(options: EnhanceOptions): () => void {
  const { document, workspaces, opener, logger } = options
  const label = options.label ?? '打开工作区'
  const copyLabel = options.copyLabel ?? '复制工作区路径'
  const canOpen = options.canOpen ?? { getSnapshot: () => true, subscribe: () => () => {} }
  let disposed = false
  let scheduled = false

  const sync = (): void => {
    scheduled = false
    if (disposed) return
    const active = activeWorkspaceMenu(document)
    if (active === undefined || active.menu.querySelector(`[${MENU_MARKER}]`) !== null) return
    if (!canOpen.getSnapshot() && options.clipboard === undefined) return

    const workspace = resolveWorkspace(active.row, workspaces.getSnapshot().items)
    if (workspace === undefined) {
      logger.warn(`${PLUGIN_ID}: could not uniquely resolve the open workspace menu row`)
      return
    }

    const viewport = active.menu.querySelector<HTMLElement>('[role="presentation"]') ?? active.menu
    const closeMenu = (): void => {
      const PointerEventCtor = document.defaultView?.PointerEvent ?? document.defaultView?.MouseEvent
      if (PointerEventCtor !== undefined) document.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true }))
    }
    const entries: HTMLElement[] = []
    if (canOpen.getSnapshot()) {
      entries.push(makeMenuItem(document, active.menu, OPEN_ACTION, label, folderIcon(document), () => {
        void opener.openPath(workspace.path).catch((error: unknown) => {
          logger.warn(`${PLUGIN_ID}: openPath rejected for workspace ${workspace.workspaceId}: ${String(error)}`)
        })
        closeMenu()
      }))
    }
    if (options.clipboard !== undefined) {
      entries.push(makeMenuItem(document, active.menu, COPY_ACTION, copyLabel, copyIcon(document), () => {
        void options.clipboard?.write(workspace.path).then((copied) => {
          if (!copied) logger.warn(`${PLUGIN_ID}: clipboard write was rejected for workspace ${workspace.workspaceId}`)
        }).catch((error: unknown) => {
          logger.warn(`${PLUGIN_ID}: clipboard write failed for workspace ${workspace.workspaceId}: ${String(error)}`)
        })
        closeMenu()
      }))
    }
    viewport.prepend(...entries)
  }

  const schedule = (): void => {
    if (scheduled || disposed) return
    scheduled = true
    queueMicrotask(sync)
  }

  const MutationObserverCtor = document.defaultView?.MutationObserver
  if (MutationObserverCtor === undefined) throw new Error(`${PLUGIN_ID}: MutationObserver is unavailable`)
  const observer = new MutationObserverCtor(schedule)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  const unsubscribe = workspaces.subscribe(schedule)
  const unsubscribeCapability = canOpen.subscribe(schedule)
  document.addEventListener('click', schedule, true)
  schedule()

  return () => {
    disposed = true
    observer.disconnect()
    unsubscribe()
    unsubscribeCapability()
    document.removeEventListener('click', schedule, true)
    document.querySelectorAll(`[${MENU_MARKER}]`).forEach((entry) => entry.remove())
    document.querySelectorAll(`[${ROW_MARKER}]`).forEach((row) => row.removeAttribute(ROW_MARKER))
  }
}
