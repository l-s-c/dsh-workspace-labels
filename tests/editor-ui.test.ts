import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { openColorEditor, openLabelEditor } from '../src/editor-ui.js'

const copy = { colorTitle: '选择颜色', labelTitle: '管理标签', newLabel: '新建标签', labelName: '标签名称', clear: '清除颜色', cancel: '取消', save: '保存', delete: '删除标签' }

function dom(): JSDOM { return new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true }) }

describe('custom editors', () => {
  it('selects a color without a native prompt', async () => {
    const window = dom().window
    vi.stubGlobal('HTMLElement', window.HTMLElement)
    const save = vi.fn()
    openColorEditor({ document: window.document, title: 'Project', copy, onSave: save })
    const colors = window.document.querySelectorAll<HTMLButtonElement>('.dsh-label-color')
    expect(colors).toHaveLength(8)
    colors[2].click()
    Array.from(window.document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === '保存')?.click()
    expect(save).toHaveBeenCalledWith('#eab308')
  })

  it('creates and assigns a label in the custom dialog', () => {
    const window = dom().window
    vi.stubGlobal('HTMLElement', window.HTMLElement)
    const save = vi.fn()
    openLabelEditor({ document: window.document, title: 'Project', labels: [], selected: [], copy, onSave: save })
    window.document.querySelector<HTMLButtonElement>('.dsh-label-add')?.click()
    const input = window.document.querySelector<HTMLInputElement>('.dsh-label-row input[type=text]')
    if (input !== null) { input.value = '重要'; input.dispatchEvent(new window.Event('input')) }
    Array.from(window.document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === '保存')?.click()
    expect(save.mock.calls[0][0][0].name).toBe('重要')
    expect(save.mock.calls[0][1]).toHaveLength(1)
  })
})
