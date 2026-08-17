import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DOCUMENT } from '../src/state.js'
import { createHttpLabelsStore } from '../src/http-store.js'
import { LOCAL_STORAGE_KEY } from '../src/store.js'

function response(value: unknown): Response { return new Response(JSON.stringify({ ok: true, value }), { status: 200, headers: { 'content-type': 'application/json' } }) }

describe('HTTP labels store', () => {
  it('does not let a late initial load overwrite a newer local edit', async () => {
    let resolveLoad!: (value: Response) => void
    const load = new Promise<Response>((resolve) => { resolveLoad = resolve })
    const fetch = vi.fn((_: RequestInfo | URL, init?: RequestInit) => init?.method === 'PATCH' ? Promise.resolve(response({ ...EMPTY_DOCUMENT, workspaceColors: { w1: '#ef4444' } })) : load)
    const store = createHttpLabelsStore({ fetch: fetch as typeof globalThis.fetch })
    await store.patch({ workspaceColors: { w1: '#ef4444' } })
    resolveLoad(response(EMPTY_DOCUMENT))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getSnapshot().workspaceColors.w1).toBe('#ef4444')
  })

  it('keeps the browser fallback when Host persistence fails', async () => {
    const memory = new Map<string, string>()
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) }, removeItem: (key: string) => { memory.delete(key) } } as Storage
    const fetch = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => init?.method === 'PATCH' ? new Response('', { status: 500 }) : response(EMPTY_DOCUMENT))
    const store = createHttpLabelsStore({ storage, fetch: fetch as typeof globalThis.fetch })
    await expect(store.patch({ workspaceColors: { w1: '#ef4444' } })).rejects.toThrow('persistence failed')
    expect(JSON.parse(memory.get(LOCAL_STORAGE_KEY) ?? '{}').workspaceColors.w1).toBe('#ef4444')
  })

  it('sends partial patches so independent fields are not replaced', async () => {
    const fetch = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => init?.method === 'PATCH' ? response({ ...EMPTY_DOCUMENT, workspaceColors: { w1: '#ef4444' } }) : response(EMPTY_DOCUMENT))
    const store = createHttpLabelsStore({ fetch: fetch as typeof globalThis.fetch })
    await store.patch({ workspaceColors: { w1: '#ef4444' } })
    const body = JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body))
    expect(body).toEqual({ workspaceColors: { w1: '#ef4444' } })
  })
})
