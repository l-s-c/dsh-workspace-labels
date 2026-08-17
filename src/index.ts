import type { Context } from '@deepseek-ai/cordis'
import { persistenceRoute } from './host-store.js'

export const name = 'workspace-labels'
export const inject = ['webServer']

type HostContext = Context & { webServer: { register(route: ReturnType<typeof persistenceRoute>): () => void } }

export function apply(ctx: HostContext): void {
  ctx.effect(() => ctx.webServer.register(persistenceRoute()), 'workspace-labels: persistent metadata route')
}
