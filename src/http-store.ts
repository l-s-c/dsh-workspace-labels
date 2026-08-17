import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'
import { LOCAL_STORAGE_KEY, type LabelsStore } from './store.js'

interface StoreOptions {
  storage?: Storage
  fetch?: typeof globalThis.fetch
  onError?: (message: string) => void
}

export function createHttpLabelsStore(options: StoreOptions = {}): LabelsStore {
  const storage = options.storage
  const request = options.fetch ?? globalThis.fetch
  const listeners = new Set<() => void>()
  const readLocal = (): LabelsDocument => {
    try { const raw = storage?.getItem(LOCAL_STORAGE_KEY); return raw == null ? EMPTY_DOCUMENT : decodeDocument(JSON.parse(raw)) ?? EMPTY_DOCUMENT }
    catch { return EMPTY_DOCUMENT }
  }
  const same = (left: LabelsDocument, right: LabelsDocument): boolean => JSON.stringify(left) === JSON.stringify(right)
  let snapshot = readLocal()
  let writable = false
  let generation = 0
  let tail = Promise.resolve()
  const publish = (next: LabelsDocument): void => { snapshot = next; for (const listener of listeners) listener() }
  const persist = async (patch: Partial<LabelsDocument>, expected: LabelsDocument, writeGeneration: number): Promise<void> => {
    const response = await request('/workspace-labels/data', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    if (!response.ok) throw new Error(`persistence failed: ${response.status}`)
    const body = await response.json() as { ok?: boolean; value?: unknown }
    const host = body.ok ? decodeDocument(body.value) : undefined
    if (host === undefined) throw new Error('persistence returned invalid data')
    writable = true
    if (generation === writeGeneration && same(host, expected) && same(snapshot, expected)) storage?.removeItem(LOCAL_STORAGE_KEY)
  }
  const load = async (): Promise<void> => {
    const startedAt = generation
    try {
      const response = await request('/workspace-labels/data', { cache: 'no-store' })
      if (!response.ok) throw new Error(`load failed: ${response.status}`)
      const body = await response.json() as { ok?: boolean; value?: unknown }
      const host = body.ok ? decodeDocument(body.value) : undefined
      if (host === undefined) throw new Error('load returned invalid data')
      writable = true
      if (generation !== startedAt) return
      const local = readLocal()
      if (!same(local, EMPTY_DOCUMENT) && same(host, EMPTY_DOCUMENT)) {
        publish(local); generation += 1; await persist(local, local, generation)
      } else { publish(host); storage?.removeItem(LOCAL_STORAGE_KEY) }
    } catch (error) { writable = false; options.onError?.(String(error)) }
  }
  void load()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    writable: () => writable || storage !== undefined,
    async patch(next) {
      const merged = decodeDocument({ ...snapshot, ...next }) ?? snapshot
      generation += 1
      publish(merged)
      try { storage?.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged)) } catch (error) { options.onError?.(String(error)) }
      const expected = merged
      const writeGeneration = generation
      const task = tail.then(() => persist(next, expected, writeGeneration))
      tail = task.then(() => undefined, () => undefined)
      try { await task } catch (error) { writable = false; options.onError?.(String(error)); throw error }
    },
  }
}
