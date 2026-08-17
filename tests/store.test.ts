import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DOCUMENT } from '../src/state.js'
import { createLabelsStore, LOCAL_STORAGE_KEY } from '../src/store.js'

describe('labels store', () => {
  it('persists individual host-backed fields', async () => {
    const set = vi.fn(async () => {})
    const scope = {
      getSnapshot: () => ({ value: EMPTY_DOCUMENT, writable: true }),
      subscribe: () => () => {},
      set,
    }
    const store = createLabelsStore(scope)
    await store.patch({ workspaceColors: { w1: '#ef4444' } })
    expect(store.getSnapshot().workspaceColors.w1).toBe('#ef4444')
    expect(set).toHaveBeenCalledWith('workspaceColors', { w1: '#ef4444' })
  })

  it('falls back to browser storage when host settings are unavailable', async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
    } as Storage
    const scope = {
      getSnapshot: () => ({ value: undefined, writable: false }),
      subscribe: () => () => {},
      set: async () => {},
    }
    const store = createLabelsStore(scope, storage)
    await store.patch({ filterQuery: '#work' })
    expect(JSON.parse(memory.get(LOCAL_STORAGE_KEY) ?? '{}').filterQuery).toBe('#work')
  })

  it('migrates browser data into writable host settings after the initial load', async () => {
    const local = { ...EMPTY_DOCUMENT, workspaceColors: { w1: '#ef4444' } }
    const memory = new Map([[LOCAL_STORAGE_KEY, JSON.stringify(local)]])
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
      removeItem: (key: string) => { memory.delete(key) },
    } as Storage
    let value = EMPTY_DOCUMENT
    let listener = (): void => {}
    const set = vi.fn(async (field: string, fieldValue: unknown) => { value = { ...value, [field]: fieldValue }; listener() })
    const scope = {
      getSnapshot: () => ({ value, writable: true, status: 'ready' as const, mode: 'host' as const }),
      subscribe: (next: () => void) => { listener = next; return () => {} },
      set,
    }
    const store = createLabelsStore(scope, storage)
    await vi.waitFor(() => expect(set).toHaveBeenCalledWith('workspaceColors', { w1: '#ef4444' }))
    await vi.waitFor(() => expect(memory.has(LOCAL_STORAGE_KEY)).toBe(false))
    expect(store.getSnapshot().workspaceColors.w1).toBe('#ef4444')
  })
})
