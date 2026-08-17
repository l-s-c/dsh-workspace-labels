export const COLOR_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'] as const

export interface LabelDefinition {
  id: string
  name: string
  color: string
}

export interface SavedView {
  id: string
  name: string
  labelIds: string[]
  query: string
  target: 'all' | 'workspace' | 'session'
}

export interface LabelsDocument {
  version: 1
  workspaceColors: Record<string, string>
  sessionColors: Record<string, string>
  labels: LabelDefinition[]
  workspaceLabels: Record<string, string[]>
  sessionLabels: Record<string, string[]>
  views: SavedView[]
  activeViewId: string
  filterQuery: string
}

export const EMPTY_DOCUMENT: LabelsDocument = {
  version: 1,
  workspaceColors: {},
  sessionColors: {},
  labels: [],
  workspaceLabels: {},
  sessionLabels: {},
  views: [],
  activeViewId: '',
  filterQuery: '',
}

function stringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && item !== '') result[key] = item
  }
  return result
}

function arrayRecord(value: unknown): Record<string, string[]> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string[]> = {}
  for (const [key, item] of Object.entries(value)) {
    if (!Array.isArray(item)) continue
    const values = [...new Set(item.filter((entry): entry is string => typeof entry === 'string' && entry !== ''))].slice(0, 8)
    if (values.length > 0) result[key] = values
  }
  return result
}

export function decodeDocument(value: unknown): LabelsDocument | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.version !== 1) return undefined
  const labels = Array.isArray(raw.labels) ? raw.labels.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return []
    const label = item as Record<string, unknown>
    if (typeof label.id !== 'string' || typeof label.name !== 'string' || typeof label.color !== 'string') return []
    return [{ id: label.id.slice(0, 64), name: label.name.trim().slice(0, 24), color: label.color }]
  }).filter((label) => label.name !== '').slice(0, 64) : []
  const views = Array.isArray(raw.views) ? raw.views.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return []
    const view = item as Record<string, unknown>
    if (typeof view.id !== 'string' || typeof view.name !== 'string') return []
    return [{
      id: view.id.slice(0, 64),
      name: view.name.trim().slice(0, 32),
      labelIds: Array.isArray(view.labelIds) ? view.labelIds.filter((id): id is string => typeof id === 'string').slice(0, 16) : [],
      query: typeof view.query === 'string' ? view.query.slice(0, 100) : '',
      target: (view.target === 'workspace' || view.target === 'session' ? view.target : 'all') as SavedView['target'],
    }]
  }).filter((view) => view.name !== '').slice(0, 32) : []
  return {
    version: 1,
    workspaceColors: stringRecord(raw.workspaceColors),
    sessionColors: stringRecord(raw.sessionColors),
    labels,
    workspaceLabels: arrayRecord(raw.workspaceLabels),
    sessionLabels: arrayRecord(raw.sessionLabels),
    views,
    activeViewId: typeof raw.activeViewId === 'string' ? raw.activeViewId : '',
    filterQuery: typeof raw.filterQuery === 'string' ? raw.filterQuery.slice(0, 100) : '',
  }
}

export function nextColor(current: string | undefined): string | undefined {
  if (current === undefined) return COLOR_PALETTE[0]
  const index = COLOR_PALETTE.indexOf(current as typeof COLOR_PALETTE[number])
  return index < 0 || index === COLOR_PALETTE.length - 1 ? undefined : COLOR_PALETTE[index + 1]
}
