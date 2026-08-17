import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'

export interface SettingsScopeLike {
  getSnapshot(): { value: LabelsDocument | undefined; writable: boolean }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

export interface LabelsStore {
  getSnapshot(): LabelsDocument
  subscribe(listener: () => void): () => void
  patch(next: Partial<LabelsDocument>): Promise<void>
  writable(): boolean
}

export function createLabelsStore(scope: SettingsScopeLike, storage?: Storage): LabelsStore {
  const listeners = new Set<() => void>()
  const localKey = 'dsh.workspaceLabels.v1'
  const readLocal = (): LabelsDocument => {
    try {
      const raw = storage?.getItem(localKey)
      return raw === null || raw === undefined ? EMPTY_DOCUMENT : decodeDocument(JSON.parse(raw)) ?? EMPTY_DOCUMENT
    } catch {
      return EMPTY_DOCUMENT
    }
  }
  let snapshot = scope.getSnapshot().value ?? readLocal()
  const publish = (next: LabelsDocument): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const unsubscribe = scope.subscribe(() => {
    const next = scope.getSnapshot().value
    if (next !== undefined) publish(next)
  })
  void unsubscribe
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    writable: () => scope.getSnapshot().writable || storage !== undefined,
    async patch(next) {
      const merged = decodeDocument({ ...snapshot, ...next }) ?? snapshot
      publish(merged)
      if (scope.getSnapshot().writable) {
        await Promise.all(Object.entries(next).map(([field, value]) => scope.set(field, value)))
      } else {
        storage?.setItem(localKey, JSON.stringify(merged))
      }
    },
  }
}
