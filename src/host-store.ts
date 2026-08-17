import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'

export const DATA_PATH = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'workspace-labels.json')
const MAX_BODY_BYTES = 256 * 1024
let writes = Promise.resolve()

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers })
  res.end(JSON.stringify(body))
}

function trusted(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === req.headers.host } catch { return false }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new Error('unsupported-media-type')
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('body-too-large')
    chunks.push(buffer)
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export async function loadDocument(): Promise<LabelsDocument> {
  try {
    const decoded = decodeDocument(JSON.parse(await readFile(DATA_PATH, 'utf8')))
    if (decoded === undefined) throw new Error('invalid persisted document')
    return decoded
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_DOCUMENT
    throw error
  }
}

async function writeDocument(document: LabelsDocument): Promise<void> {
  await mkdir(dirname(DATA_PATH), { recursive: true, mode: 0o700 })
  const temporary = `${DATA_PATH}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, DATA_PATH)
  } finally { await rm(temporary, { force: true }) }
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = writes.then(operation)
  writes = task.then(() => undefined, () => undefined)
  return task
}

export function replaceDocument(value: unknown): Promise<LabelsDocument> {
  const document = decodeDocument(value)
  if (document === undefined) return Promise.reject(new Error('invalid-document'))
  return enqueue(async () => { await writeDocument(document); return document })
}

export function patchDocument(value: unknown): Promise<LabelsDocument> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return Promise.reject(new Error('invalid-patch'))
  return enqueue(async () => {
    const current = await loadDocument()
    const document = decodeDocument({ ...current, ...(value as Record<string, unknown>) })
    if (document === undefined) throw new Error('invalid-patch')
    await writeDocument(document)
    return document
  })
}

export function persistenceRoute(): { kind: 'exact'; path: string; handler(req: IncomingMessage, res: ServerResponse): void } {
  return {
    kind: 'exact', path: '/workspace-labels/data',
    handler(req, res) {
      if (!trusted(req)) { json(res, 403, { ok: false, error: 'forbidden' }); return }
      if (req.method === 'GET') { void writes.then(loadDocument).then((value) => json(res, 200, { ok: true, value }), () => json(res, 500, { ok: false, error: 'read-failed' })); return }
      const operation = req.method === 'PUT' ? replaceDocument : req.method === 'PATCH' ? patchDocument : undefined
      if (operation !== undefined) {
        void readBody(req).then(operation).then((value) => json(res, 200, { ok: true, value }), (error) => {
          const message = error instanceof Error && ['body-too-large', 'unsupported-media-type', 'invalid-document', 'invalid-patch'].includes(error.message) ? error.message : 'write-failed'
          const status = message === 'write-failed' ? 500 : message === 'body-too-large' ? 413 : message === 'unsupported-media-type' ? 415 : 400
          json(res, status, { ok: false, error: message })
        })
        return
      }
      json(res, 405, { ok: false, error: 'method-not-allowed' }, { allow: 'GET, PUT, PATCH' })
    },
  }
}
