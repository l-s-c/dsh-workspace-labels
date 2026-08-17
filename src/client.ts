import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { IWorkspaces, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/client'
import { mountDecorations, nextColor } from './decorations.js'
import { enhanceOpenWorkspaceMenu } from './menu-enhancer.js'
import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'
import { createLabelsStore } from './store.js'

type ClientContext = Context & {
  workspaces: IWorkspaces
  connection: ConnectionHandle
  locale: LocaleRuntime
  settingsScope: SettingsScopeBinder
  sessions: { list: { getSnapshot(): { byId: Record<string, { displayTitle: string }> }; subscribe(listener: () => void): () => void } }
}

const LOCALE_NS = 'workspace-labels'

export const name = 'workspace-labels'
export const inject = ['workspaces', 'sessions', 'connection', 'locale', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const unregisterLocale = ctx.locale.register(LOCALE_NS, 'zh', {
    openWorkspace: '打开工作区', copyWorkspacePath: '复制工作区路径', cycleColor: '切换工作区颜色', manageLabels: '管理工作区标签', promptLabels: '输入标签，使用英文逗号分隔',
  })
  const unregisterEnglish = ctx.locale.register(LOCALE_NS, 'en', {
    openWorkspace: 'Open workspace', copyWorkspacePath: 'Copy workspace path', cycleColor: 'Cycle workspace color', manageLabels: 'Manage workspace labels', promptLabels: 'Enter labels separated by commas',
  })
  const t = ctx.locale.bind(LOCALE_NS)
  const scope = ctx.settingsScope.bind<LabelsDocument>({ namespace: 'workspace-labels', decode: decodeDocument }) as SettingsScope<LabelsDocument>
  const store = createLabelsStore(scope, window.localStorage)

  ctx.effect(() => {
    const workspaceEntities = () => ctx.workspaces.list.getSnapshot().items.map((item) => ({ id: item.workspaceId, title: item.title }))
    const sessionEntities = () => Object.entries(ctx.sessions.list.getSnapshot().byId).map(([id, item]) => ({ id, title: item.displayTitle }))
    const disposeDecorations = mountDecorations({
      document,
      getDocument: store.getSnapshot,
      subscribe: store.subscribe,
      workspaces: workspaceEntities,
      sessions: sessionEntities,
    })

    const mount = (): (() => void) => enhanceOpenWorkspaceMenu({
      document,
      workspaces: {
        getSnapshot: () => ({ items: ctx.workspaces.list.getSnapshot().items.map((workspace) => ({ workspaceId: workspace.workspaceId, title: workspace.title, path: workspace.path })) }),
        subscribe: (listener) => ctx.workspaces.list.subscribe(listener),
      },
      opener: { openPath: (path) => ctx.workspaces.openPath(path) },
      clipboard: { write: async (text) => { try { await navigator.clipboard.writeText(text); return true } catch { return false } } },
      canOpen: {
        getSnapshot: () => ctx.connection.isLoopback && ctx.connection.hostDescription.getSnapshot()?.canOpenPath === true,
        subscribe: (listener) => ctx.connection.hostDescription.subscribe(listener),
      },
      onCycleColor: async (workspace) => {
        const current = store.getSnapshot().workspaceColors
        const color = nextColor(current[workspace.workspaceId])
        const workspaceColors = { ...current }
        if (color === undefined) delete workspaceColors[workspace.workspaceId]
        else workspaceColors[workspace.workspaceId] = color
        await store.patch({ workspaceColors })
      },
      onManageLabels: async (workspace) => {
        const state = store.getSnapshot()
        const existing = (state.workspaceLabels[workspace.workspaceId] ?? []).map((id) => state.labels.find((label) => label.id === id)?.name).filter(Boolean).join(', ')
        const input = window.prompt(t('promptLabels'), existing)
        if (input === null) return
        const names = [...new Set(input.split(',').map((name) => name.trim()).filter(Boolean))].slice(0, 8)
        const labels = [...state.labels]
        const ids = names.map((name) => {
          const found = labels.find((label) => label.name.toLowerCase() === name.toLowerCase())
          if (found !== undefined) return found.id
          const id = `label-${Date.now()}-${labels.length}`
          labels.push({ id, name: name.slice(0, 24), color: nextColor(labels.at(-1)?.color) ?? '#3b82f6' })
          return id
        })
        await store.patch({ labels, workspaceLabels: { ...state.workspaceLabels, [workspace.workspaceId]: ids } })
      },
      logger: ctx.logger,
      label: t('openWorkspace'), copyLabel: t('copyWorkspacePath'), colorLabel: t('cycleColor'), labelsLabel: t('manageLabels'),
    })

    let disposeEnhancer = mount()
    const unsubscribeLocale = ctx.locale.subscribe(() => { disposeEnhancer(); disposeEnhancer = mount() })
    return () => {
      unsubscribeLocale(); disposeEnhancer(); disposeDecorations(); unregisterEnglish(); unregisterLocale()
    }
  }, 'workspace-labels: workspace and session organization')
}
