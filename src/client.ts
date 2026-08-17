import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { IWorkspaces, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/client'
import { mountDecorations } from './decorations.js'
import { openColorEditor, openLabelEditor, type EditorCopy } from './editor-ui.js'
import { mountFilterUi } from './filter-ui.js'
import { enhanceOpenWorkspaceMenu } from './menu-enhancer.js'
import { mountSessionMenu } from './session-menu.js'
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
    openWorkspace: '打开工作区', copyWorkspacePath: '复制工作区路径', cycleColor: '设置工作区颜色', manageLabels: '管理工作区标签', filterPlaceholder: '筛选：文字或 #标签', saveView: '保存视图', viewName: '视图名称', allViews: '全部', sessionColor: '设置会话颜色', sessionLabels: '管理会话标签', colorTitle: '选择颜色', labelTitle: '管理标签', newLabel: '新建标签', labelName: '标签名称', clear: '清除颜色', cancel: '取消', save: '保存', delete: '删除标签',
  })
  const unregisterEnglish = ctx.locale.register(LOCALE_NS, 'en', {
    openWorkspace: 'Open workspace', copyWorkspacePath: 'Copy workspace path', cycleColor: 'Set workspace color', manageLabels: 'Manage workspace labels', filterPlaceholder: 'Filter: text or #label', saveView: 'Save view', viewName: 'View name', allViews: 'All', sessionColor: 'Set session color', sessionLabels: 'Manage session labels', colorTitle: 'Choose color', labelTitle: 'Manage labels', newLabel: 'New label', labelName: 'Label name', clear: 'Clear color', cancel: 'Cancel', save: 'Save', delete: 'Delete label',
  })
  const t = ctx.locale.bind(LOCALE_NS)
  const scope = ctx.settingsScope.bind<LabelsDocument>({ namespace: 'workspace-labels', decode: decodeDocument }) as SettingsScope<LabelsDocument>
  const store = createLabelsStore(scope, window.localStorage)
  const editorCopy = (): EditorCopy => ({
    colorTitle: t('colorTitle'), labelTitle: t('labelTitle'), newLabel: t('newLabel'), labelName: t('labelName'),
    clear: t('clear'), cancel: t('cancel'), save: t('save'), delete: t('delete'),
  })

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
    const disposeFilter = mountFilterUi({
      document,
      store,
      entities: () => [
        ...workspaceEntities().map((item) => ({ ...item, target: 'workspace' as const })),
        ...sessionEntities().map((item) => ({ ...item, target: 'session' as const })),
      ],
      labels: { placeholder: t('filterPlaceholder'), saveView: t('saveView'), viewName: t('viewName'), all: t('allViews') },
    })
    const editColor = (target: 'workspace' | 'session', id: string, title: string): void => {
      const state = store.getSnapshot()
      const colors = target === 'workspace' ? state.workspaceColors : state.sessionColors
      openColorEditor({
        document, title, current: colors[id], copy: editorCopy(),
        onSave: async (color) => {
          const next = { ...colors }
          if (color === undefined) delete next[id]; else next[id] = color
          await store.patch(target === 'workspace' ? { workspaceColors: next } : { sessionColors: next })
        },
      })
    }
    const editLabels = (target: 'workspace' | 'session', id: string, title: string): void => {
      const state = store.getSnapshot()
      const assignments = target === 'workspace' ? state.workspaceLabels : state.sessionLabels
      openLabelEditor({
        document, title, labels: state.labels, selected: assignments[id] ?? [], copy: editorCopy(),
        onSave: async (labels, selected) => {
          const next = { ...assignments }
          if (selected.length === 0) delete next[id]; else next[id] = selected
          await store.patch(target === 'workspace' ? { labels, workspaceLabels: next } : { labels, sessionLabels: next })
        },
      })
    }
    const disposeSessionMenu = mountSessionMenu({
      document,
      store,
      sessions: sessionEntities,
      labels: { color: t('sessionColor'), manage: t('sessionLabels') },
      onEditColor: (session) => editColor('session', session.id, session.title),
      onEditLabels: (session) => editLabels('session', session.id, session.title),
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
      onCycleColor: (workspace) => editColor('workspace', workspace.workspaceId, workspace.title),
      onManageLabels: (workspace) => editLabels('workspace', workspace.workspaceId, workspace.title),
      logger: ctx.logger,
      label: t('openWorkspace'), copyLabel: t('copyWorkspacePath'), colorLabel: t('cycleColor'), labelsLabel: t('manageLabels'),
    })

    let disposeEnhancer = mount()
    const unsubscribeLocale = ctx.locale.subscribe(() => { disposeEnhancer(); disposeEnhancer = mount() })
    return () => {
      unsubscribeLocale(); disposeEnhancer(); disposeSessionMenu(); disposeFilter(); disposeDecorations(); unregisterEnglish(); unregisterLocale()
    }
  }, 'workspace-labels: workspace and session organization')
}
