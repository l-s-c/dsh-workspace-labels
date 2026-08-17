import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'
import { LOCAL_STORAGE_KEY, type LabelsStore } from './store.js'

export function createHttpLabelsStore(storage?: Storage): LabelsStore {
  const listeners = new Set<() => void>()
  const readLocal = (): LabelsDocument => {
    try { const raw = storage?.getItem(LOCAL_STORAGE_KEY); return raw == null ? EMPTY_DOCUMENT : decodeDocument(JSON.parse(raw)) ?? EMPTY_DOCUMENT }
    catch { return EMPTY_DOCUMENT }
  }
  let snapshot = readLocal()
  let writable = false
  let tail = Promise.resolve()
  const publish = (next: LabelsDocument): void => { snapshot = next; for (const listener of listeners) listener() }
  const load = async (): Promise<void> => {
    try {
      const response = await fetch('/workspace-labels/data', { cache: 'no-store' })
      const body = await response.json() as { ok?: boolean; value?: unknown }
      const host = body.ok ? decodeDocument(body.value) : undefined
      if (host === undefined) return
      writable = true
      const local = readLocal()
      const hasLocal = JSON.stringify(local) !== JSON.stringify(EMPTY_DOCUMENT)
      if (hasLocal && JSON.stringify(host) === JSON.stringify(EMPTY_DOCUMENT)) {
        publish(local); await persist(local)
      } else { publish(host); storage?.removeItem(LOCAL_STORAGE_KEY) }
    } catch { writable = false }
  }
  const persist = async (document: LabelsDocument): Promise<void> => {
    const response = await fetch('/workspace-labels/data', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(document) })
    if (!response.ok) throw new Error(`persistence failed: ${response.status}`)
    writable = true; storage?.removeItem(LOCAL_STORAGE_KEY)
  }
  void load()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    writable: () => writable || storage !== undefined,
    async patch(next) {
      const merged = decodeDocument({ ...snapshot, ...next }) ?? snapshot
      publish(merged); storage?.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
      tail = tail.then(() => persist(merged)).catch(() => { writable = false })
      await tail
    },
  }
}
