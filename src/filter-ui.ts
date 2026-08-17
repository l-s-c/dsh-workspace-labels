import { activeQuery, matchesFilter, saveView, type FilterEntity } from './filter.js'
import type { LabelsStore } from './store.js'

const BAR = 'dsh-workspace-labels-filter'

export interface FilterUiOptions {
  document: Document
  store: LabelsStore
  entities(): readonly FilterEntity[]
  labels: { placeholder: string; saveView: string; viewName: string; all: string }
}

function titleOf(row: HTMLElement): string {
  const candidates = Array.from(row.querySelectorAll<HTMLElement>('span'))
  return candidates.map((item) => item.textContent?.trim() ?? '').find((text) => text !== '') ?? ''
}

export function mountFilterUi(options: FilterUiOptions): () => void {
  const { document, store } = options
  const bar = document.createElement('div')
  bar.className = BAR
  bar.style.cssText = 'display:flex;gap:4px;align-items:center;padding:4px 8px;position:sticky;top:0;z-index:2;background:var(--dsw-alias-background-primary,#111);'
  const input = document.createElement('input')
  input.type = 'search'
  input.placeholder = options.labels.placeholder
  input.style.cssText = 'min-width:0;flex:1;border:1px solid var(--dsw-alias-stroke-primary,#555);border-radius:6px;background:transparent;color:inherit;padding:4px 7px;font-size:11px;'
  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = options.labels.saveView
  save.title = options.labels.saveView
  save.style.cssText = 'border:0;background:transparent;color:inherit;cursor:pointer;font-size:11px;'
  const select = document.createElement('select')
  select.title = options.labels.all
  select.style.cssText = 'max-width:80px;background:transparent;color:inherit;border:0;font-size:11px;'
  bar.append(input, select, save)

  let disposed = false
  const locate = (): HTMLElement | undefined => {
    const row = document.querySelector<HTMLElement>('[role="treeitem"]')
    if (row === null) return undefined
    let parent = row.parentElement
    while (parent !== null && parent.querySelectorAll('[role="treeitem"]').length < 2) parent = parent.parentElement
    return parent ?? undefined
  }
  const renderViews = (): void => {
    const state = store.getSnapshot()
    select.textContent = ''
    const all = document.createElement('option')
    all.value = ''
    all.textContent = options.labels.all
    select.appendChild(all)
    for (const view of state.views) {
      const option = document.createElement('option')
      option.value = view.id
      option.textContent = view.name
      select.appendChild(option)
    }
    select.value = state.activeViewId
    input.value = activeQuery(state)
  }
  const apply = (): void => {
    if (disposed) return
    const host = locate()
    if (host !== undefined && !bar.isConnected) host.prepend(bar)
    renderViews()
    const state = store.getSnapshot()
    const query = activeQuery(state)
    const entities = options.entities()
    for (const row of document.querySelectorAll<HTMLElement>('[role="treeitem"]')) {
      const title = titleOf(row)
      const matches = entities.filter((entity) => entity.title === title)
      if (query === '' || matches.length !== 1) row.style.removeProperty('display')
      else row.style.display = matchesFilter(matches[0], state, query) ? '' : 'none'
    }
  }
  input.addEventListener('input', () => { void store.patch({ filterQuery: input.value, activeViewId: '' }) })
  select.addEventListener('change', () => { void store.patch({ activeViewId: select.value }) })
  save.addEventListener('click', () => {
    const name = window.prompt(options.labels.viewName, input.value)
    if (name === null || name.trim() === '') return
    const state = store.getSnapshot()
    const views = saveView(state, name, input.value)
    void store.patch({ views, activeViewId: views.at(-1)?.id ?? '' })
  })
  const Observer = document.defaultView?.MutationObserver
  if (Observer === undefined) throw new Error('dsh-workspace-labels: MutationObserver unavailable')
  const observer = new Observer(apply)
  observer.observe(document.body, { childList: true, subtree: true })
  const unsubscribe = store.subscribe(apply)
  apply()
  return () => {
    disposed = true
    observer.disconnect()
    unsubscribe()
    bar.remove()
    document.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((row) => row.style.removeProperty('display'))
  }
}
