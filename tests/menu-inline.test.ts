import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { mountInlineEditor } from '../src/menu-inline.js'

function setup(): { window: JSDOM['window']; menu: HTMLElement } {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div role="menu"><div role="presentation"></div></div></body></html>', { pretendToBeVisual: true })
  vi.stubGlobal('HTMLElement', dom.window.HTMLElement)
  return { window: dom.window, menu: dom.window.document.querySelector<HTMLElement>('[role=menu]')! }
}

const copy = { color: '颜色', labels: '标签', addLabel: '添加标签', labelPlaceholder: '新标签名称', clear: '清除', delete: '删除标签' }

describe('inline menu editor', () => {
  it('renders white inline colors and saves directly', () => {
    const { window, menu } = setup(); const onColor = vi.fn()
    mountInlineEditor({ document: window.document, menu, labels: [], selected: [], copy, onColor, onLabels: vi.fn() })
    expect(menu.querySelectorAll('.dsh-wl-color')).toHaveLength(8)
    expect(menu.querySelector('.dsh-wl-inline')).not.toBeNull()
    menu.querySelectorAll<HTMLButtonElement>('.dsh-wl-color')[1].click()
    expect(onColor).toHaveBeenCalledWith('#f97316')
  })

  it('adds, selects, and deletes labels inside the menu', () => {
    const { window, menu } = setup(); const onLabels = vi.fn()
    mountInlineEditor({ document: window.document, menu, labels: [], selected: [], copy, onColor: vi.fn(), onLabels })
    const input = menu.querySelector<HTMLInputElement>('.dsh-wl-add input')!
    input.value = '重要'; menu.querySelector<HTMLButtonElement>('.dsh-wl-add button')!.click()
    expect(onLabels.mock.calls.at(-1)?.[0][0].name).toBe('重要')
    expect(onLabels.mock.calls.at(-1)?.[1]).toHaveLength(1)
    menu.querySelector<HTMLButtonElement>('.dsh-wl-delete')!.click()
    expect(onLabels.mock.calls.at(-1)).toEqual([[], []])
  })
})
