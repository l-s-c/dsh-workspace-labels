import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DOCUMENT } from '../src/state.js'
import { createLabelsStore } from '../src/store.js'

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
    expect(JSON.parse(memory.get('dsh.workspaceLabels.v1') ?? '{}').filterQuery).toBe('#work')
  })
})
