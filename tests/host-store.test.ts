import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let directory = ''
afterEach(async () => { vi.resetModules(); vi.unstubAllEnvs(); if (directory !== '') await rm(directory, { recursive: true, force: true }); directory = '' })

async function module(): Promise<typeof import('../src/host-store.js')> {
  directory = await mkdtemp(join(tmpdir(), 'dsh-workspace-labels-'))
  vi.stubEnv('DSH_HOME', directory)
  return import('../src/host-store.js')
}

const empty = { version: 1, workspaceColors: {}, sessionColors: {}, labels: [], workspaceLabels: {}, sessionLabels: {}, views: [], activeViewId: '', filterQuery: '' }

describe('Host persistence', () => {
  it('writes and reloads a validated document atomically with private permissions', async () => {
    const { DATA_PATH, loadDocument, replaceDocument } = await module()
    await replaceDocument({ ...empty, workspaceColors: { w1: '#ffffff' } })
    expect((await loadDocument()).workspaceColors.w1).toBe('#ffffff')
    expect(JSON.parse(await readFile(DATA_PATH, 'utf8')).workspaceColors.w1).toBe('#ffffff')
    expect((await stat(DATA_PATH)).mode & 0o777).toBe(0o600)
  })

  it('serializes partial patches without losing unrelated fields', async () => {
    const { loadDocument, patchDocument, replaceDocument } = await module()
    await replaceDocument({ ...empty, workspaceColors: { w1: '#ffffff' } })
    await Promise.all([
      patchDocument({ sessionColors: { s1: '#ef4444' } }),
      patchDocument({ labels: [{ id: 'l1', name: '重要', color: '#3b82f6' }] }),
    ])
    const saved = await loadDocument()
    expect(saved.workspaceColors.w1).toBe('#ffffff')
    expect(saved.sessionColors.s1).toBe('#ef4444')
    expect(saved.labels[0].name).toBe('重要')
  })

  it('rejects malformed documents instead of silently erasing data', async () => {
    const { replaceDocument } = await module()
    await expect(replaceDocument(null)).rejects.toThrow('invalid-document')
  })
})
