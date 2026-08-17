import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-client-runtime/client'
import { enhanceOpenWorkspaceMenu } from './menu-enhancer.js'

type ClientContext = Context & {
  workspaces: IWorkspaces
  connection: ConnectionHandle
  locale: LocaleRuntime
}

const LOCALE_NS = 'workspace-labels'

export const name = 'workspace-labels'
export const inject = ['workspaces', 'connection', 'locale']

export function apply(ctx: ClientContext): void {
  const unregisterLocale = ctx.locale.register(LOCALE_NS, 'zh', {
    openWorkspace: '打开工作区',
    copyWorkspacePath: '复制工作区路径',
  })
  const unregisterEnglish = ctx.locale.register(LOCALE_NS, 'en', {
    openWorkspace: 'Open workspace',
    copyWorkspacePath: 'Copy workspace path',
  })
  const t = ctx.locale.bind(LOCALE_NS)
  ctx.effect(() => {
    const mount = (): (() => void) => enhanceOpenWorkspaceMenu({
      document,
      workspaces: {
        getSnapshot: () => ({
          items: ctx.workspaces.list.getSnapshot().items.map((workspace) => ({
            workspaceId: workspace.workspaceId,
            title: workspace.title,
            path: workspace.path,
          })),
        }),
        subscribe: (listener) => ctx.workspaces.list.subscribe(listener),
      },
      opener: {
        openPath: (path) => ctx.workspaces.openPath(path),
      },
      clipboard: {
        write: async (text) => {
          try {
            await navigator.clipboard.writeText(text)
            return true
          } catch {
            return false
          }
        },
      },
      canOpen: {
        getSnapshot: () => ctx.connection.isLoopback && ctx.connection.hostDescription.getSnapshot()?.canOpenPath === true,
        subscribe: (listener) => ctx.connection.hostDescription.subscribe(listener),
      },
      logger: ctx.logger,
      label: t('openWorkspace'),
      copyLabel: t('copyWorkspacePath'),
    })

    let disposeEnhancer = mount()
    const unsubscribeLocale = ctx.locale.subscribe(() => {
      disposeEnhancer()
      disposeEnhancer = mount()
    })
    return () => {
      unsubscribeLocale()
      disposeEnhancer()
      unregisterEnglish()
      unregisterLocale()
    }
  }, 'workspace-labels: enhance the existing workspace row menu')
}
