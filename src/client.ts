import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-client-runtime/client'
import { mountDecorations } from './decorations.js'
import { createHttpLabelsStore } from './http-store.js'
import { mountInlineEditor, type InlineCopy } from './menu-inline.js'
import { enhanceOpenWorkspaceMenu } from './menu-enhancer.js'
import { mountSessionMenu } from './session-menu.js'


type ClientContext = Context & {
  workspaces: IWorkspaces
  connection: ConnectionHandle
  locale: LocaleRuntime
  sessions: { list: { getSnapshot(): { byId: Record<string, { displayTitle: string }> }; subscribe(listener: () => void): () => void } }
}

const LOCALE_NS = 'workspace-labels'
export const name = 'workspace-labels'
export const inject = ['workspaces', 'sessions', 'connection', 'locale']

export function apply(ctx: ClientContext): void {
  const unregisterLocale = ctx.locale.register(LOCALE_NS, 'zh', {
    openWorkspace: '打开工作区', copyWorkspacePath: '复制工作区路径', color: '颜色', labels: '标签', addLabel: '添加标签', labelPlaceholder: '新标签名称', clear: '清除', delete: '删除标签',
  })
  const unregisterEnglish = ctx.locale.register(LOCALE_NS, 'en', {
    openWorkspace: 'Open workspace', copyWorkspacePath: 'Copy workspace path', color: 'Color', labels: 'Labels', addLabel: 'Add label', labelPlaceholder: 'New label name', clear: 'Clear', delete: 'Delete label',
  })
  const t = ctx.locale.bind(LOCALE_NS)
  const store = createHttpLabelsStore({ storage: window.localStorage, onError: (message) => ctx.logger.warn(`workspace-labels: persistence: ${message}`) })
  const copy = (): InlineCopy => ({ color: t('color'), labels: t('labels'), addLabel: t('addLabel'), labelPlaceholder: t('labelPlaceholder'), clear: t('clear'), delete: t('delete') })

  ctx.effect(() => {
    const workspaceEntities = () => ctx.workspaces.list.getSnapshot().items.map((item) => ({ id: item.workspaceId, title: item.title }))
    const sessionEntities = () => Object.entries(ctx.sessions.list.getSnapshot().byId).map(([id, item]) => ({ id, title: item.displayTitle }))
    const disposeDecorations = mountDecorations({ document, getDocument: store.getSnapshot, subscribe: store.subscribe, workspaces: workspaceEntities, sessions: sessionEntities })

    const inline = (menu: HTMLElement, target: 'workspace' | 'session', id: string): void => {
      const state = store.getSnapshot()
      const colors = target === 'workspace' ? state.workspaceColors : state.sessionColors
      const assignments = target === 'workspace' ? state.workspaceLabels : state.sessionLabels
      mountInlineEditor({
        document, menu, currentColor: colors[id], labels: state.labels, selected: assignments[id] ?? [], copy: copy(),
        onColor: async (color) => {
          const next = { ...(target === 'workspace' ? store.getSnapshot().workspaceColors : store.getSnapshot().sessionColors) }
          if (color === undefined) delete next[id]; else next[id] = color
          await store.patch(target === 'workspace' ? { workspaceColors: next } : { sessionColors: next })
        },
        onLabels: async (labels, selected) => {
          const current = target === 'workspace' ? store.getSnapshot().workspaceLabels : store.getSnapshot().sessionLabels
          const next = { ...current }
          if (selected.length === 0) delete next[id]; else next[id] = selected
          await store.patch(target === 'workspace' ? { labels, workspaceLabels: next } : { labels, sessionLabels: next })
        },
      })
    }

    const disposeSessionMenu = mountSessionMenu({ document, sessions: sessionEntities, inline: (menu, session) => inline(menu, 'session', session.id) })
    const mount = (): (() => void) => enhanceOpenWorkspaceMenu({
      document,
      workspaces: { getSnapshot: () => ({ items: ctx.workspaces.list.getSnapshot().items.map((workspace) => ({ workspaceId: workspace.workspaceId, title: workspace.title, path: workspace.path })) }), subscribe: (listener) => ctx.workspaces.list.subscribe(listener) },
      opener: { openPath: (path) => ctx.workspaces.openPath(path) },
      clipboard: { write: async (text) => { try { await navigator.clipboard.writeText(text); return true } catch { return false } } },
      canOpen: { getSnapshot: () => ctx.connection.isLoopback && ctx.connection.hostDescription.getSnapshot()?.canOpenPath === true, subscribe: (listener) => ctx.connection.hostDescription.subscribe(listener) },
      inline: (menu, workspace) => {
        inline(menu, 'workspace', workspace.workspaceId)
        const mounted = menu.querySelector<HTMLElement>('[data-dsh-workspace-labels-inline]')
        if (mounted !== null) { mounted.dataset.entityId = workspace.workspaceId; mounted.dataset.entityType = 'workspace' }
      },
      logger: ctx.logger, label: t('openWorkspace'), copyLabel: t('copyWorkspacePath'),
    })
    let disposeEnhancer = mount()
    const unsubscribeLocale = ctx.locale.subscribe(() => { disposeEnhancer(); disposeEnhancer = mount() })
    return () => { unsubscribeLocale(); disposeEnhancer(); disposeSessionMenu(); disposeDecorations(); unregisterEnglish(); unregisterLocale() }
  }, 'workspace-labels: inline workspace and session organization')
}
