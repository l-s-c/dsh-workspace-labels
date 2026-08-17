import type { Context } from '@deepseek-ai/cordis'
import type { IWorkspaces } from '@deepseek-ai/dsh-client-runtime/client'
import { enhanceOpenWorkspaceMenu } from './menu-enhancer.js'

type ClientContext = Context & { workspaces: IWorkspaces }

export const name = 'workspace-labels'
export const inject = ['workspaces']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => enhanceOpenWorkspaceMenu({
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
    logger: ctx.logger,
    label: document.documentElement.lang.toLowerCase().startsWith('zh') ? '打开工作区' : 'Open workspace',
  }), 'workspace-labels: enhance the existing workspace row menu')
}
