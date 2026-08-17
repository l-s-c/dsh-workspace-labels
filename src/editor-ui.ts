import { COLOR_PALETTE, type LabelDefinition } from './state.js'

const ROOT_CLASS = 'dsh-label-editor-root'

export interface EditorCopy {
  colorTitle: string
  labelTitle: string
  newLabel: string
  labelName: string
  clear: string
  cancel: string
  save: string
  delete: string
}

export interface ColorEditorOptions {
  document: Document
  title: string
  current?: string
  copy: EditorCopy
  onSave(color: string | undefined): void | Promise<void>
}

export interface LabelEditorOptions {
  document: Document
  title: string
  labels: readonly LabelDefinition[]
  selected: readonly string[]
  copy: EditorCopy
  onSave(labels: LabelDefinition[], selected: string[]): void | Promise<void>
}

function injectStyle(document: Document): () => void {
  const existing = document.querySelector<HTMLStyleElement>('style[data-dsh-label-editor]')
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.dshLabelEditor = 'true'
  style.textContent = `
.${ROOT_CLASS}{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(3px)}
.dsh-label-editor{width:min(440px,calc(100vw - 32px));max-height:min(620px,calc(100vh - 32px));overflow:auto;background:var(--dsw-alias-background-primary,#181818);color:var(--dsw-alias-label-primary,#eee);border:1px solid var(--dsw-alias-stroke-primary,#444);border-radius:14px;box-shadow:0 20px 70px rgba(0,0,0,.45);padding:18px}
.dsh-label-editor h2{font-size:16px;margin:0 0 16px}.dsh-label-editor-subtitle{font-size:12px;color:var(--dsw-alias-label-secondary,#aaa);margin:-10px 0 14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-label-colors{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;margin:12px 0 20px}.dsh-label-color{aspect-ratio:1;border-radius:50%;border:3px solid transparent;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}.dsh-label-color.active{border-color:white;box-shadow:0 0 0 2px var(--dsw-alias-background-primary,#181818),0 0 0 4px currentColor}
.dsh-label-list{display:flex;flex-direction:column;gap:8px}.dsh-label-row{display:grid;grid-template-columns:24px 28px 1fr 30px;align-items:center;gap:8px;padding:7px;border-radius:8px;background:rgba(255,255,255,.04)}.dsh-label-row input[type=text]{min-width:0;background:transparent;color:inherit;border:1px solid var(--dsw-alias-stroke-primary,#555);border-radius:6px;padding:6px 8px}.dsh-label-dot{width:20px;height:20px;border-radius:50%;border:0;cursor:pointer}.dsh-label-delete{border:0;background:transparent;color:#ef4444;cursor:pointer;font-size:16px}
.dsh-label-add{margin-top:10px;border:1px dashed var(--dsw-alias-stroke-primary,#555);background:transparent;color:inherit;border-radius:8px;padding:8px;width:100%;cursor:pointer}.dsh-label-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.dsh-label-actions button{border-radius:7px;padding:7px 14px;cursor:pointer;border:1px solid var(--dsw-alias-stroke-primary,#555);background:transparent;color:inherit}.dsh-label-actions .primary{background:#2563eb;border-color:#2563eb;color:white}
`
  document.head.appendChild(style)
  return () => style.remove()
}

function shell(document: Document, heading: string, subtitle: string): { root: HTMLElement; panel: HTMLElement; close(): void } {
  injectStyle(document)
  document.querySelector(`.${ROOT_CLASS}`)?.remove()
  const root = document.createElement('div')
  root.className = ROOT_CLASS
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  const panel = document.createElement('div')
  panel.className = 'dsh-label-editor'
  const h2 = document.createElement('h2'); h2.textContent = heading
  const sub = document.createElement('div'); sub.className = 'dsh-label-editor-subtitle'; sub.textContent = subtitle
  panel.append(h2, sub); root.appendChild(panel); document.body.appendChild(root)
  const close = (): void => root.remove()
  root.addEventListener('pointerdown', (event) => { if (event.target === root) close() })
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') close() })
  queueMicrotask(() => root.focus())
  root.tabIndex = -1
  return { root, panel, close }
}

function actionButton(document: Document, text: string, primary = false): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = text
  if (primary) button.className = 'primary'
  return button
}

export function openColorEditor(options: ColorEditorOptions): () => void {
  const { document } = options
  const modal = shell(document, options.copy.colorTitle, options.title)
  let selected = options.current
  const colors = document.createElement('div'); colors.className = 'dsh-label-colors'
  const render = (): void => {
    colors.textContent = ''
    for (const color of COLOR_PALETTE) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `dsh-label-color${selected === color ? ' active' : ''}`
      button.style.background = color; button.style.color = color; button.title = color
      button.addEventListener('click', () => { selected = color; render() })
      colors.appendChild(button)
    }
  }
  render(); modal.panel.appendChild(colors)
  const actions = document.createElement('div'); actions.className = 'dsh-label-actions'
  const clear = actionButton(document, options.copy.clear); clear.addEventListener('click', () => { selected = undefined; render() })
  const cancel = actionButton(document, options.copy.cancel); cancel.addEventListener('click', modal.close)
  const save = actionButton(document, options.copy.save, true); save.addEventListener('click', () => { void options.onSave(selected); modal.close() })
  actions.append(clear, cancel, save); modal.panel.appendChild(actions)
  return modal.close
}

export function openLabelEditor(options: LabelEditorOptions): () => void {
  const { document } = options
  const modal = shell(document, options.copy.labelTitle, options.title)
  let labels = options.labels.map((label) => ({ ...label }))
  const selected = new Set(options.selected)
  const list = document.createElement('div'); list.className = 'dsh-label-list'; modal.panel.appendChild(list)
  const render = (): void => {
    list.textContent = ''
    labels.forEach((label, index) => {
      const row = document.createElement('div'); row.className = 'dsh-label-row'
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(label.id)
      check.addEventListener('change', () => { check.checked ? selected.add(label.id) : selected.delete(label.id) })
      const color = document.createElement('button'); color.type = 'button'; color.className = 'dsh-label-dot'; color.style.background = label.color
      color.addEventListener('click', () => { const i = COLOR_PALETTE.indexOf(label.color as typeof COLOR_PALETTE[number]); label.color = COLOR_PALETTE[(i + 1 + COLOR_PALETTE.length) % COLOR_PALETTE.length]; render() })
      const input = document.createElement('input'); input.type = 'text'; input.value = label.name; input.placeholder = options.copy.labelName
      input.addEventListener('input', () => { label.name = input.value.slice(0, 24) })
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'dsh-label-delete'; remove.textContent = '×'; remove.title = options.copy.delete
      remove.addEventListener('click', () => { selected.delete(label.id); labels.splice(index, 1); render() })
      row.append(check, color, input, remove); list.appendChild(row)
    })
  }
  render()
  const add = document.createElement('button'); add.type = 'button'; add.className = 'dsh-label-add'; add.textContent = `+ ${options.copy.newLabel}`
  add.addEventListener('click', () => { const id = `label-${Date.now()}-${labels.length}`; labels.push({ id, name: options.copy.newLabel, color: COLOR_PALETTE[labels.length % COLOR_PALETTE.length] }); selected.add(id); render() })
  modal.panel.appendChild(add)
  const actions = document.createElement('div'); actions.className = 'dsh-label-actions'
  const cancel = actionButton(document, options.copy.cancel); cancel.addEventListener('click', modal.close)
  const save = actionButton(document, options.copy.save, true); save.addEventListener('click', () => { labels = labels.filter((label) => label.name.trim() !== '').map((label) => ({ ...label, name: label.name.trim() })); void options.onSave(labels, [...selected].filter((id) => labels.some((label) => label.id === id))); modal.close() })
  actions.append(cancel, save); modal.panel.appendChild(actions)
  return modal.close
}
