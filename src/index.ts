import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export const name = 'workspace-labels'
export const inject = ['settings']

const DocumentSchema = z.object({
  version: z.number().default(1),
  workspaceColors: z.dict(z.string()).default({}),
  sessionColors: z.dict(z.string()).default({}),
  labels: z.array(z.any()).default([]),
  workspaceLabels: z.dict(z.array(z.string())).default({}),
  sessionLabels: z.dict(z.array(z.string())).default({}),
  views: z.array(z.any()).default([]),
  activeViewId: z.string().default(''),
  filterQuery: z.string().default(''),
})

export function apply(ctx: Context): void {
  ctx.settings.register(settingsNamespace('workspace-labels'), DocumentSchema, {
    applies: 'live',
    expose: true,
    base: {
      version: 1,
      workspaceColors: {},
      sessionColors: {},
      labels: [],
      workspaceLabels: {},
      sessionLabels: {},
      views: [],
      activeViewId: '',
      filterQuery: '',
    },
  } as never)
}
