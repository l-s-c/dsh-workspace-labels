import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const temp = await mkdtemp(join(tmpdir(), 'dsh-workspace-labels-pack-'))
const clone = join(temp, 'repo')

try {
  execFileSync('git', ['clone', '--quiet', '--no-local', root, clone], { stdio: 'inherit' })
  await cp(join(root, 'package.json'), join(clone, 'package.json'), { force: true })
  await cp(join(root, 'pnpm-lock.yaml'), join(clone, 'pnpm-lock.yaml'), { force: true })
  execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: clone, stdio: 'inherit' })
  execFileSync('pnpm', ['pack', '--pack-destination', temp], { cwd: clone, stdio: 'inherit' })
  const manifest = JSON.parse(await readFile(join(clone, 'package.json'), 'utf8'))
  const tarball = join(temp, `dsh-workspace-labels-${manifest.version}.tgz`)
  const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n')
  for (const required of ['package/lib/index.js', 'package/lib/client.js', 'package/cordis.patch.yml']) {
    if (!listing.includes(required)) throw new Error(`clean pack omitted ${required}`)
  }
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('clean pack lost dsh.bundle manifest')
  console.log('Clean checkout pack contains executable DSH artifacts')
} finally {
  await rm(temp, { recursive: true, force: true })
}
