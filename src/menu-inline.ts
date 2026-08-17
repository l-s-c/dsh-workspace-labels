import { COLOR_PALETTE, type LabelDefinition } from './state.js'

const MARKER = 'data-dsh-workspace-labels-inline'

export interface InlineCopy {
  color: string
  labels: string
  addLabel: string
  labelPlaceholder: string
  clear: string
  delete: string
}

export interface InlineEditorOptions {
  document: Document
  menu: HTMLElement
  currentColor?: string
  labels: readonly LabelDefinition[]
  selected: readonly string[]
  copy: InlineCopy
  onColor(color: string | undefined): void | Promise<void>
  onLabels(labels: LabelDefinition[], selected: string[]): void | Promise<void>
}

function ensureStyle(document: Document): void {
  if (document.querySelector('style[data-dsh-inline-labels]') !== null) return
  const style = document.createElement('style')
  style.dataset.dshInlineLabels = 'true'
  style.textContent = `
.dsh-wl-menu{background:#fff!important;color:#151515!important;min-width:236px}.dsh-wl-menu [role=menuitem]{color:#151515!important}.dsh-wl-menu [role=menuitem]:hover{background:#f5f5f5!important}.dsh-wl-inline{background:#fff;color:#151515;border-top:1px solid #ececec;padding:10px 11px;width:236px;box-sizing:border-box;font-family:inherit}
.dsh-wl-section+.dsh-wl-section{border-top:1px solid #eee;margin-top:9px;padding-top:9px}.dsh-wl-heading{font-size:11px;font-weight:600;color:#555;margin:0 0 7px}
.dsh-wl-colors{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.dsh-wl-color{width:19px;height:19px;border-radius:50%;border:2px solid #fff;padding:0;cursor:pointer;box-shadow:0 0 0 1px #d5d5d5}.dsh-wl-color:hover{transform:scale(1.1)}.dsh-wl-color.active{box-shadow:0 0 0 2px #fff,0 0 0 4px #222}.dsh-wl-clear{border:0;background:#f3f3f3;color:#555;border-radius:5px;padding:3px 6px;font-size:10px;cursor:pointer}
.dsh-wl-list{display:flex;flex-direction:column;gap:3px;max-height:150px;overflow:auto}.dsh-wl-label{display:grid;grid-template-columns:18px 12px minmax(0,1fr) 20px;align-items:center;gap:5px;border-radius:5px;padding:4px 3px}.dsh-wl-label:hover{background:#f5f5f5}.dsh-wl-label input{accent-color:#222}.dsh-wl-dot{width:9px;height:9px;border-radius:50%}.dsh-wl-name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-wl-delete{border:0;background:transparent;color:#aaa;cursor:pointer;font-size:15px;line-height:16px;padding:0}.dsh-wl-delete:hover{color:#e5484d}
.dsh-wl-add{display:flex;gap:5px;margin-top:7px}.dsh-wl-add input{min-width:0;flex:1;border:1px solid #ddd;background:#fff;color:#151515;border-radius:5px;padding:5px 7px;font:inherit;font-size:11px;outline:none}.dsh-wl-add input:focus{border-color:#999}.dsh-wl-add button{border:0;background:#151515;color:#fff;border-radius:5px;padding:0 9px;cursor:pointer;font-size:14px}
@media(prefers-color-scheme:dark){.dsh-wl-inline{background:#fff;color:#151515}.dsh-wl-inline *{color-scheme:light}}
`
  document.head.appendChild(style)
}

export function mountInlineEditor(options: InlineEditorOptions): () => void {
  const { document, menu } = options
  ensureStyle(document)
  menu.querySelector(`[${MARKER}]`)?.remove()
  menu.classList.add('dsh-wl-menu')
  const root = document.createElement('div')
  root.className = 'dsh-wl-inline'
  root.setAttribute(MARKER, 'true')
  root.addEventListener('pointerdown', (event) => event.stopPropagation())
  root.addEventListener('click', (event) => event.stopPropagation())

  let labels = options.labels.map((label) => ({ ...label }))
  const selected = new Set(options.selected)

  const colorSection = document.createElement('div'); colorSection.className = 'dsh-wl-section'
  const colorHeading = document.createElement('div'); colorHeading.className = 'dsh-wl-heading'; colorHeading.textContent = options.copy.color
  const colors = document.createElement('div'); colors.className = 'dsh-wl-colors'
  const renderColors = (current = options.currentColor): void => {
    colors.textContent = ''
    for (const color of COLOR_PALETTE) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `dsh-wl-color${current === color ? ' active' : ''}`; button.style.background = color; button.title = color
      button.addEventListener('click', () => { void options.onColor(color); renderColors(color) })
      colors.appendChild(button)
    }
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'dsh-wl-clear'; clear.textContent = options.copy.clear
    clear.addEventListener('click', () => { void options.onColor(undefined); renderColors(undefined) })
    colors.appendChild(clear)
  }
  renderColors(); colorSection.append(colorHeading, colors)

  const labelSection = document.createElement('div'); labelSection.className = 'dsh-wl-section'
  const labelHeading = document.createElement('div'); labelHeading.className = 'dsh-wl-heading'; labelHeading.textContent = options.copy.labels
  const list = document.createElement('div'); list.className = 'dsh-wl-list'
  const commit = (): void => { void options.onLabels(labels, [...selected].filter((id) => labels.some((label) => label.id === id))) }
  const renderLabels = (): void => {
    list.textContent = ''
    for (const label of labels) {
      const row = document.createElement('label'); row.className = 'dsh-wl-label'
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(label.id)
      check.addEventListener('change', () => { check.checked ? selected.add(label.id) : selected.delete(label.id); commit() })
      const dot = document.createElement('span'); dot.className = 'dsh-wl-dot'; dot.style.background = label.color
      const name = document.createElement('span'); name.className = 'dsh-wl-name'; name.textContent = label.name
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'dsh-wl-delete'; remove.textContent = '×'; remove.title = options.copy.delete
      remove.addEventListener('click', (event) => { event.preventDefault(); selected.delete(label.id); labels = labels.filter((item) => item.id !== label.id); commit(); renderLabels() })
      row.append(check, dot, name, remove); list.appendChild(row)
    }
  }
  renderLabels()
  const add = document.createElement('div'); add.className = 'dsh-wl-add'
  const input = document.createElement('input'); input.placeholder = options.copy.labelPlaceholder; input.maxLength = 24
  const addButton = document.createElement('button'); addButton.type = 'button'; addButton.textContent = '+'; addButton.title = options.copy.addLabel
  const addLabel = (): void => {
    const value = input.value.trim(); if (value === '') return
    const existing = labels.find((label) => label.name.toLowerCase() === value.toLowerCase())
    if (existing !== undefined) selected.add(existing.id)
    else { const id = `label-${Date.now()}-${labels.length}`; labels.push({ id, name: value, color: COLOR_PALETTE[labels.length % COLOR_PALETTE.length] }); selected.add(id) }
    input.value = ''; commit(); renderLabels()
  }
  addButton.addEventListener('click', addLabel); input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addLabel() } })
  add.append(input, addButton); labelSection.append(labelHeading, list, add)
  root.append(colorSection, labelSection)

  const viewport = menu.querySelector<HTMLElement>('[role="presentation"]') ?? menu
  viewport.appendChild(root)
  return () => { root.remove(); menu.classList.remove('dsh-wl-menu') }
}
