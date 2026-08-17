import type { LabelsDocument, SavedView } from './state.js'

export interface FilterEntity {
  id: string
  title: string
  target: 'workspace' | 'session'
}

export function parseFilter(query: string): { text: string; labels: string[] } {
  const labels: string[] = []
  const text: string[] = []
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith('#') && token.length > 1) labels.push(token.slice(1).toLowerCase())
    else text.push(token.toLowerCase())
  }
  return { text: text.join(' '), labels }
}

export function matchesFilter(entity: FilterEntity, document: LabelsDocument, query: string): boolean {
  const parsed = parseFilter(query)
  if (parsed.text !== '' && !entity.title.toLowerCase().includes(parsed.text)) return false
  const assigned = entity.target === 'workspace' ? document.workspaceLabels[entity.id] ?? [] : document.sessionLabels[entity.id] ?? []
  const names = assigned.map((id) => document.labels.find((label) => label.id === id)?.name.toLowerCase()).filter(Boolean)
  return parsed.labels.every((name) => names.includes(name))
}

export function activeQuery(document: LabelsDocument): string {
  const view = document.views.find((item) => item.id === document.activeViewId)
  if (view === undefined) return document.filterQuery
  const labels = view.labelIds.map((id) => document.labels.find((label) => label.id === id)?.name).filter(Boolean).map((name) => `#${name}`)
  return [...labels, view.query].filter(Boolean).join(' ')
}

export function saveView(document: LabelsDocument, name: string, query: string, target: SavedView['target'] = 'all'): SavedView[] {
  const parsed = parseFilter(query)
  const labelIds = parsed.labels.flatMap((name) => {
    const label = document.labels.find((candidate) => candidate.name.toLowerCase() === name)
    return label === undefined ? [] : [label.id]
  })
  const view: SavedView = { id: `view-${Date.now()}`, name: name.trim().slice(0, 32), labelIds, query: parsed.text, target }
  return [...document.views, view].slice(-32)
}
