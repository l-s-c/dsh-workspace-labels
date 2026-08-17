import { describe, expect, it, vi } from 'vitest'
import { activeQuery, matchesFilter, parseFilter, saveView } from '../src/filter.js'
import { EMPTY_DOCUMENT } from '../src/state.js'

describe('filtering and saved views', () => {
  const document = {
    ...EMPTY_DOCUMENT,
    labels: [{ id: 'work', name: 'Work', color: '#3b82f6' }],
    workspaceLabels: { w1: ['work'] },
  }

  it('parses text and hashtag filters', () => {
    expect(parseFilter('project #Work')).toEqual({ text: 'project', labels: ['work'] })
  })

  it('matches both title and assigned labels', () => {
    expect(matchesFilter({ id: 'w1', title: 'Project Alpha', target: 'workspace' }, document, 'alpha #work')).toBe(true)
    expect(matchesFilter({ id: 'w2', title: 'Project Beta', target: 'workspace' }, document, '#work')).toBe(false)
  })

  it('saves and resolves a label-backed view', () => {
    vi.spyOn(Date, 'now').mockReturnValue(7)
    const views = saveView(document, 'Work projects', '#work', 'workspace')
    const next = { ...document, views, activeViewId: 'view-7' }
    expect(activeQuery(next)).toBe('#Work')
  })
})
