import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { decodeDocument, EMPTY_DOCUMENT, type LabelsDocument } from './state.js'

export const DATA_PATH = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'workspace-labels.json')

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 256 * 1024) throw new Error('body-too-large')
    chunks.push(buffer)
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export async function loadDocument(): Promise<LabelsDocument> {
  try { return decodeDocument(JSON.parse(await readFile(DATA_PATH, 'utf8'))) ?? EMPTY_DOCUMENT }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_DOCUMENT; throw error }
}

export async function saveDocument(value: unknown): Promise<LabelsDocument> {
  const document = decodeDocument(value)
  if (document === undefined) throw new Error('invalid-document')
  await mkdir(dirname(DATA_PATH), { recursive: true, mode: 0o700 })
  const temporary = `${DATA_PATH}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, DATA_PATH)
  return document
}

export function persistenceRoute(): { kind: 'exact'; path: string; handler(req: IncomingMessage, res: ServerResponse): void } {
  return {
    kind: 'exact', path: '/workspace-labels/data',
    handler(req, res) {
      if (req.method === 'GET') { void loadDocument().then((value) => json(res, 200, { ok: true, value }), (error) => json(res, 500, { ok: false, error: String(error) })); return }
      if (req.method === 'PUT') { void readBody(req).then(saveDocument).then((value) => json(res, 200, { ok: true, value }), (error) => json(res, 400, { ok: false, error: String(error) })); return }
      json(res, 405, { ok: false, error: 'method-not-allowed' })
    },
  }
}
