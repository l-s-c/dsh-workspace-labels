import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'

export interface SettingsScopeLike {
  getSnapshot(): { value: LabelsDocument | undefined; writable: boolean; status?: 'loading' | 'ready' | 'unavailable'; mode?: 'host' | 'memory' }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

export interface LabelsStore {
  getSnapshot(): LabelsDocument
  subscribe(listener: () => void): () => void
  patch(next: Partial<LabelsDocument>): Promise<void>
  writable(): boolean
}

export const LOCAL_STORAGE_KEY = 'dsh.workspaceLabels.v1'

function isEmpty(document: LabelsDocument): boolean {
  return Object.keys(document.workspaceColors).length === 0 && Object.keys(document.sessionColors).length === 0 && document.labels.length === 0 && Object.keys(document.workspaceLabels).length === 0 && Object.keys(document.sessionLabels).length === 0
}

function sameDocument(left: LabelsDocument, right: LabelsDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createLabelsStore(scope: SettingsScopeLike, storage?: Storage): LabelsStore {
  const listeners = new Set<() => void>()
  const readLocal = (): LabelsDocument => {
    try {
      const raw = storage?.getItem(LOCAL_STORAGE_KEY)
      return raw === null || raw === undefined ? EMPTY_DOCUMENT : decodeDocument(JSON.parse(raw)) ?? EMPTY_DOCUMENT
    } catch { return EMPTY_DOCUMENT }
  }
  const local = readLocal()
  let snapshot = scope.getSnapshot().value ?? local
  let migrationStarted = false
  let pendingHost: LabelsDocument | undefined
  const publish = (next: LabelsDocument): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const persistFields = async (document: LabelsDocument): Promise<void> => {
    for (const [field, value] of Object.entries(document)) await scope.set(field, value)
  }
  const sync = (): void => {
    const host = scope.getSnapshot()
    if (host.status === 'loading') return
    if (host.value === undefined) return
    if (pendingHost !== undefined) {
      if (sameDocument(host.value, pendingHost)) {
        pendingHost = undefined
        storage?.removeItem(LOCAL_STORAGE_KEY)
        publish(host.value)
      }
      return
    }
    if (!migrationStarted && host.writable && host.mode !== 'memory' && !isEmpty(local) && isEmpty(host.value)) {
      migrationStarted = true
      pendingHost = local
      publish(local)
      void persistFields(local)
      return
    }
    migrationStarted = true
    publish(host.value)
  }
  const unsubscribe = scope.subscribe(sync)
  void unsubscribe
  sync()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    writable: () => scope.getSnapshot().writable || storage !== undefined,
    async patch(next) {
      const merged = decodeDocument({ ...snapshot, ...next }) ?? snapshot
      publish(merged)
      storage?.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
      const host = scope.getSnapshot()
      if (host.writable && host.mode !== 'memory') {
        pendingHost = merged
        for (const [field, value] of Object.entries(next)) await scope.set(field, value)
      }
    },
  }
}
