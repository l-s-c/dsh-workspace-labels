import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enhanceOpenWorkspaceMenu, MENU_MARKER, ROW_MARKER } from '../src/menu-enhancer.js'

function fixture(): JSDOM {
  return new JSDOM(`<!doctype html><html lang="zh-CN"><body>
    <div role="tree">
      <div class="hash_projectRow hash_menuOpen" role="treeitem" aria-expanded="true">
        <span class="hash_projectText"><span>测试项目</span></span>
        <span class="hash_rowActions"><button aria-label="测试项目操作">...</button></span>
      </div>
    </div>
    <div class="menu_list" role="menu">
      <div class="menu_wrap"><button class="menu_item" role="menuitem"><span class="menu_icon"></span><span class="menu_label">重命名</span></button></div>
      <div class="menu_wrap"><button class="menu_item" role="menuitem"><span class="menu_icon"></span><span class="menu_label">删除</span></button></div>
    </div>
  </body></html>`, { pretendToBeVisual: true })
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
})

describe('enhanceOpenWorkspaceMenu', () => {
  it('adds the open action to the active workspace menu and opens its path', async () => {
    const dom = fixture()
    vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
    vi.stubGlobal('PointerEvent', dom.window.PointerEvent ?? dom.window.MouseEvent)
    const openPath = vi.fn(async () => {})
    const warn = vi.fn()
    const source = {
      getSnapshot: () => ({ items: [{ workspaceId: 'w1', title: '测试项目', path: '/tmp/project' }] }),
      subscribe: () => () => {},
    }

    dispose = enhanceOpenWorkspaceMenu({ document: dom.window.document, workspaces: source, opener: { openPath }, logger: { warn } })
    await flush()

    const action = dom.window.document.querySelector<HTMLButtonElement>('[data-action="workspace-labels-open"]')
    expect(action?.textContent).toContain('打开工作区')
    expect(dom.window.document.querySelector(`[${MENU_MARKER}]`)).not.toBeNull()
    action?.click()
    await flush()
    expect(openPath).toHaveBeenCalledWith('/tmp/project')
    expect(warn).not.toHaveBeenCalled()
  })

  it('copies the canonical workspace path when the copy action is selected', async () => {
    const dom = fixture()
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
    const write = vi.fn(async () => true)
    const source = {
      getSnapshot: () => ({ items: [{ workspaceId: 'w1', title: '测试项目', path: '/tmp/project' }] }),
      subscribe: () => () => {},
    }

    dispose = enhanceOpenWorkspaceMenu({
      document: dom.window.document,
      workspaces: source,
      opener: { openPath: async () => {} },
      clipboard: { write },
      logger: { warn: () => {} },
    })
    await flush()

    const action = dom.window.document.querySelector<HTMLButtonElement>('[data-action="workspace-labels-copy-path"]')
    expect(action?.textContent).toContain('复制工作区路径')
    action?.click()
    await flush()
    expect(write).toHaveBeenCalledWith('/tmp/project')
  })

  it('hides open when the host cannot open paths but keeps copy available', async () => {
    const dom = fixture()
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
    const source = {
      getSnapshot: () => ({ items: [{ workspaceId: 'w1', title: '测试项目', path: '/tmp/project' }] }),
      subscribe: () => () => {},
    }

    dispose = enhanceOpenWorkspaceMenu({
      document: dom.window.document,
      workspaces: source,
      opener: { openPath: async () => {} },
      clipboard: { write: async () => true },
      canOpen: { getSnapshot: () => false, subscribe: () => () => {} },
      logger: { warn: () => {} },
    })
    await flush()

    expect(dom.window.document.querySelector('[data-action="workspace-labels-open"]')).toBeNull()
    expect(dom.window.document.querySelector('[data-action="workspace-labels-copy-path"]')).not.toBeNull()
  })

  it('does not guess when workspace titles are duplicated', async () => {
    const dom = fixture()
    vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
    const warn = vi.fn()
    const source = {
      getSnapshot: () => ({ items: [
        { workspaceId: 'w1', title: '测试项目', path: '/tmp/one' },
        { workspaceId: 'w2', title: '测试项目', path: '/tmp/two' },
      ] }),
      subscribe: () => () => {},
    }

    dispose = enhanceOpenWorkspaceMenu({ document: dom.window.document, workspaces: source, opener: { openPath: async () => {} }, logger: { warn } })
    await flush()

    expect(dom.window.document.querySelector(`[${MENU_MARKER}]`)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('invalidates cached row identity when React reuses the row for another workspace', async () => {
    const dom = fixture()
    vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
    const openPath = vi.fn(async () => {})
    let items = [{ workspaceId: 'w1', title: '测试项目', path: '/tmp/one' }]
    let notify = (): void => {}
    const source = {
      getSnapshot: () => ({ items }),
      subscribe: (listener: () => void) => {
        notify = listener
        return () => {}
      },
    }

    dispose = enhanceOpenWorkspaceMenu({ document: dom.window.document, workspaces: source, opener: { openPath }, logger: { warn: () => {} } })
    await flush()
    dom.window.document.querySelector(`[${MENU_MARKER}]`)?.remove()
    const row = dom.window.document.querySelector<HTMLElement>('[role="treeitem"]')
    const title = row?.querySelector<HTMLElement>('.hash_projectText')
    if (title !== null && title !== undefined) title.textContent = '另一个项目'
    items = [{ workspaceId: 'w2', title: '另一个项目', path: '/tmp/two' }]
    notify()
    await flush()

    dom.window.document.querySelector<HTMLButtonElement>('[data-action="workspace-labels-open"]')?.click()
    await flush()
    expect(openPath).toHaveBeenCalledWith('/tmp/two')
    expect(row?.getAttribute(ROW_MARKER)).toBe('w2')
  })

  it('cleans up injected nodes and row metadata', async () => {
    const dom = fixture()
    vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
    const source = {
      getSnapshot: () => ({ items: [{ workspaceId: 'w1', title: '测试项目', path: '/tmp/project' }] }),
      subscribe: () => () => {},
    }

    dispose = enhanceOpenWorkspaceMenu({ document: dom.window.document, workspaces: source, opener: { openPath: async () => {} }, logger: { warn: () => {} } })
    await flush()
    dispose()
    dispose = undefined

    expect(dom.window.document.querySelector(`[${MENU_MARKER}]`)).toBeNull()
    expect(dom.window.document.querySelector(`[${ROW_MARKER}]`)).toBeNull()
  })
})
