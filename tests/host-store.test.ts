import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let directory = ''
afterEach(async () => { vi.resetModules(); if (directory !== '') await rm(directory, { recursive: true, force: true }); directory = '' })

describe('Host persistence', () => {
  it('writes and reloads a validated document atomically', async () => {
    directory = await mkdtemp(join(tmpdir(), 'dsh-workspace-labels-'))
    vi.stubEnv('DSH_HOME', directory)
    const { DATA_PATH, loadDocument, saveDocument } = await import('../src/host-store.js')
    await saveDocument({ version: 1, workspaceColors: { w1: '#fff' }, sessionColors: {}, labels: [], workspaceLabels: {}, sessionLabels: {}, views: [], activeViewId: '', filterQuery: '' })
    expect((await loadDocument()).workspaceColors.w1).toBe('#fff')
    expect(JSON.parse(await readFile(DATA_PATH, 'utf8')).workspaceColors.w1).toBe('#fff')
  })
})
