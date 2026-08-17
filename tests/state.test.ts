import { describe, expect, it } from 'vitest'
import { COLOR_PALETTE, decodeDocument, EMPTY_DOCUMENT, nextColor } from '../src/state.js'

describe('metadata state', () => {
  it('cycles through the palette and clears after the last color', () => {
    expect(nextColor(undefined)).toBe(COLOR_PALETTE[0])
    expect(nextColor(COLOR_PALETTE[0])).toBe(COLOR_PALETTE[1])
    expect(nextColor(COLOR_PALETTE.at(-1))).toBeUndefined()
  })

  it('rejects documents without a supported version', () => {
    expect(decodeDocument({})).toBeUndefined()
    expect(decodeDocument({ ...EMPTY_DOCUMENT, version: 2 })).toBeUndefined()
  })

  it('normalizes labels, assignments and views', () => {
    const result = decodeDocument({
      ...EMPTY_DOCUMENT,
      labels: [{ id: 'a', name: ' Important ', color: '#ef4444' }],
      workspaceLabels: { w1: ['a', 'a'] },
      views: [{ id: 'v1', name: ' Work ', labelIds: ['a'], query: '#important', target: 'workspace' }],
    })
    expect(result?.labels[0].name).toBe('Important')
    expect(result?.workspaceLabels.w1).toEqual(['a'])
    expect(result?.views[0].target).toBe('workspace')
  })
})
