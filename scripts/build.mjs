import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const lib = resolve(root, 'lib')
const clientBody = resolve(lib, '.client-body.cjs')

await rm(lib, { recursive: true, force: true })
await mkdir(lib, { recursive: true })

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(lib, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
})

await build({
  entryPoints: [resolve(root, 'src/client.ts')],
  outfile: clientBody,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: false,
  external: ['@deepseek-ai/*'],
})

const body = await readFile(clientBody, 'utf8')
const wrapped = `window.__ModuleLoader__.load({ id: "dsh-workspace-labels", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${body}\nreturn module.exports; } });\n`
await writeFile(resolve(lib, 'client.js'), wrapped)
await rm(clientBody, { force: true })

const forbidden = ['@deepseek-ai/', 'node:']
for (const token of forbidden) {
  if (wrapped.includes(`require(\"${token}`) || wrapped.includes(`require('${token}`)) {
    throw new Error(`client bundle leaked forbidden runtime import: ${token}`)
  }
}
const loads = wrapped.split('__ModuleLoader__.load').length - 1
if (loads !== 1) {
  throw new Error(`client bundle must register exactly one module, found ${loads} __ModuleLoader__.load calls (another bundle got inlined?)`)
}

console.log('Built lib/index.js and lib/client.js')
