import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountDecorations, titleText } from '../src/decorations.js'
import { mountFilterUi } from '../src/filter-ui.js'
import { EMPTY_DOCUMENT, type LabelsDocument } from '../src/state.js'
import type { LabelsStore } from '../src/store.js'

function fixture(): JSDOM {
  return new JSDOM(`<!doctype html><html lang="zh-CN"><body>
    <div role="tree">
      <div class="hash_projectRow" role="treeitem" aria-expanded="true">
        <span class="hash_projectText">测试项目</span>
      </div>
      <div class="hash_sessionRow" role="treeitem">
        <span class="hash_title">测试会话</span>
      </div>
    </div>
  </body></html>`, { pretendToBeVisual: true })
}

function memoryStore(initial: LabelsDocument): LabelsStore {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    writable: () => true,
    async patch(next) {
      snapshot = { ...snapshot, ...next }
      for (const listener of listeners) listener()
    },
  }
}

async function settle(dom: JSDOM, turns = 20): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0))
  }
}

function stubDomGlobals(dom: JSDOM): void {
  vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
  vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
}

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
})

describe('mutation observer re-entrancy', () => {
  it('decorations settle instead of re-triggering their own observer', async () => {
    const dom = fixture()
    stubDomGlobals(dom)
    const state: LabelsDocument = {
      ...EMPTY_DOCUMENT,
      labels: [{ id: 'l1', name: '重点', color: '#ef4444' }],
      workspaceColors: { w1: '#3b82f6' },
      workspaceLabels: { w1: ['l1'] },
      sessionLabels: { s1: ['l1'] },
    }
    const workspaces = vi.fn(() => [{ id: 'w1', title: '测试项目' }])
    dispose = mountDecorations({
      document: dom.window.document,
      getDocument: () => state,
      subscribe: () => () => {},
      workspaces,
      sessions: () => [{ id: 's1', title: '测试会话' }],
    })
    await settle(dom)
    const settled = workspaces.mock.calls.length
    await settle(dom)
    expect(workspaces.mock.calls.length).toBe(settled)
    expect(dom.window.document.querySelectorAll('.dsh-workspace-labels-badges').length).toBe(2)
  })

  it('keeps title matching stable after badges are injected', async () => {
    const dom = fixture()
    stubDomGlobals(dom)
    const state: LabelsDocument = {
      ...EMPTY_DOCUMENT,
      labels: [{ id: 'l1', name: '重点', color: '#ef4444' }],
      workspaceLabels: { w1: ['l1'] },
    }
    dispose = mountDecorations({
      document: dom.window.document,
      getDocument: () => state,
      subscribe: () => () => {},
      workspaces: () => [{ id: 'w1', title: '测试项目' }],
      sessions: () => [],
    })
    await settle(dom)
    const title = dom.window.document.querySelector('.hash_projectText')
    expect(title).not.toBeNull()
    expect(title?.textContent).toContain('重点')
    expect(titleText(title as Element)).toBe('测试项目')
  })

  it('filter bar settles instead of re-triggering its own observer', async () => {
    const dom = fixture()
    stubDomGlobals(dom)
    const store = memoryStore({
      ...EMPTY_DOCUMENT,
      views: [{ id: 'v1', name: '视图', labelIds: [], query: '', target: 'all' }],
    })
    const entities = vi.fn(() => [
      { id: 'w1', title: '测试项目', target: 'workspace' as const },
      { id: 's1', title: '测试会话', target: 'session' as const },
    ])
    dispose = mountFilterUi({
      document: dom.window.document,
      store,
      entities,
      labels: { placeholder: '筛选', saveView: '保存视图', viewName: '视图名称', all: '全部' },
    })
    await settle(dom)
    expect(dom.window.document.querySelector('.dsh-workspace-labels-filter')).not.toBeNull()
    const settled = entities.mock.calls.length
    await settle(dom)
    expect(entities.mock.calls.length).toBe(settled)
  })
})
