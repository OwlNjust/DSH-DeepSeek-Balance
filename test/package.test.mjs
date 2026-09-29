// Packaging-contract tests for dsh-deepseek-balance.
//
// The other two suites test behaviour; this one tests the *packaging* facts the
// harness needs in order to activate the plugin at all:
//   * deepseek-harness ≥ 0.2.0 only treats a package as an installable profile
//     layer when it declares `dsh.bundle.patch` — without it the plugin manager
//     answers `not-a-bundle`;
//   * the composition of that bundle layer (this package's cordis.patch.yml)
//     must insert the plugin id exactly ONCE. A second row — most easily a hand
//     written row left in the profile's own cordis.patch.yml — puts the same id
//     into the composed tree twice (the loader collapses identical ids, so it is
//     silent, which is worse for maintenance than a crash).
// Run: node test/package.test.mjs

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const pkg = JSON.parse(read('package.json'))

let failed = 0
let passed = 0

function ok(name, fn) {
  try {
    fn()
    passed++
  } catch (error) {
    failed++
    console.error(`✗ ${name}\n    ${error.message}`)
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

/** Split a small patch file into column-0 rows plus their indented children. */
function topLevelRows(yaml) {
  const rows = []
  let current = null
  for (const raw of yaml.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      current = { head: line, body: [] }
      rows.push(current)
      continue
    }
    if (current) current.body.push(line)
  }
  return rows
}

// ------------------------------------------------------------- package basics
ok('package: 名字/版本合法，main 与 exports 指向真实文件', () => {
  assert(pkg.name === 'dsh-deepseek-balance', `包名应为 dsh-deepseek-balance，实际 ${pkg.name}`)
  assert(/^\d+\.\d+\.\d+/.test(pkg.version), `版本号不像 semver：${pkg.version}`)
  assert(pkg.main === 'lib/index.js', `main 应为 lib/index.js，实际 ${pkg.main}`)
  assert(existsSync(join(ROOT, pkg.main)), `main 文件不存在：${pkg.main}`)
  assert(pkg.exports?.['.']?.default === './lib/index.js', 'exports["."] 应指向 ./lib/index.js')
  assert(pkg.exports?.['./client']?.default === './lib/client.js', 'exports["./client"] 应指向 ./lib/client.js')
  assert(existsSync(join(ROOT, 'lib/client.js')), 'lib/client.js 不存在')
})

ok('package: 声明 dsh.client.platform = web（浏览器半边随包激活）', () => {
  assert(pkg.dsh?.client?.platform === 'web', `dsh.client.platform 应为 web，实际 ${JSON.stringify(pkg.dsh?.client)}`)
})

ok('package: 刻意不声明 peerDependencies（跨 harness 版本零约束）', () => {
  assert(pkg.peerDependencies === undefined, '不要声明 peerDependencies：声明后用户升级 harness 会被判"不兼容"而需豁免')
})

ok('package: files 白名单覆盖运行时与随包文档，且都真实存在', () => {
  const files = pkg.files
  assert(Array.isArray(files), 'files 应为数组')
  for (const need of ['lib', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
    assert(files.includes(need), `files 缺少 ${need}（npm/打包安装会漏文件）`)
    assert(existsSync(join(ROOT, need)), `${need} 在仓库里不存在`)
  }
  assert(existsSync(join(ROOT, 'lib/client.js')) && existsSync(join(ROOT, 'lib/index.js')), 'lib 必须同时含宿主与客户端两半')
})

// ------------------------------------------------- display metadata (P2-4)
ok('metadata: 声明 icon，并随包发布 icon/locale', () => {
  assert(pkg.icon === './icon.svg', `package.json 顶层应声明 icon，实际 ${JSON.stringify(pkg.icon)}`)
  assert(existsSync(join(ROOT, 'icon.svg')), 'icon.svg 不存在')
  assert(pkg.exports?.['./locale/*.json'] === './locale/*.json', 'exports 应导出 ./locale/*.json')
  for (const need of ['locale/*.json', 'icon.svg']) {
    assert(pkg.files.includes(need), `files 缺少 ${need}（插件卡片会缺文字/图标）`)
  }
})

ok('metadata: locale 文件是合法 JSON，且都带 meta.title/description', () => {
  for (const lang of ['zh', 'en']) {
    const file = join(ROOT, 'locale', `${lang}.json`)
    assert(existsSync(file), `locale/${lang}.json 不存在`)
    const doc = JSON.parse(read(`locale/${lang}.json`))
    assert(typeof doc?.meta?.title === 'string' && doc.meta.title.trim() !== '', `${lang}.json 缺少 meta.title`)
    assert(typeof doc?.meta?.description === 'string' && doc.meta.description.trim() !== '', `${lang}.json 缺少 meta.description`)
  }
})

// ------------------------------------------------------ client artefact (i18n)
ok('client: 文案集中在 STRINGS 表，zh/en 键一一对应', () => {
  const client = read('lib/client.js')
  const start = client.indexOf('const STRINGS = {')
  const end = client.indexOf('function fill(')
  assert(start > 0 && end > start, '未找到 STRINGS 表（客户端文案必须集中在该表）')
  const block = client.slice(start, end)
  const zh = [...block.matchAll(/'([a-zA-Z][\w.]*)':/g)].map((m) => m[1])
  const counts = {}
  for (const key of zh) counts[key] = (counts[key] || 0) + 1
  const missing = Object.keys(counts).filter((key) => counts[key] !== 2)
  assert(missing.length === 0, `以下键没有 zh/en 两份：${missing.join(', ')}`)
  assert(zh.length >= 60, `文案表过小（${zh.length} 个键），检查是否漏搬字面量`)
})

ok('client: STRINGS 表之外不再有中文字面量（防回归到硬编码）', () => {
  const client = read('lib/client.js')
  const start = client.indexOf('const STRINGS = {')
  const end = client.indexOf('function fill(')
  const outside = client.slice(0, start) + client.slice(end)
  const offenders = outside
    .split('\n')
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
    .filter(({ line }) => /[\u4e00-\u9fff]/.test(line))
  assert(offenders.length === 0, `表外仍有中文：${offenders.map((o) => o.line.slice(0, 60)).join(' | ')}`)
})

ok('client: 跟随宿主语言（data.locale）+ 本地覆盖 + navigator 兜底', () => {
  const client = read('lib/client.js')
  assert(client.includes('detectLocale'), '缺少 detectLocale()')
  assert(client.includes("localStorage.getItem(LANG_KEY)"), '缺少本地语言覆盖（dsb.lang）')
  assert(client.includes('navigator.language'), '缺少 navigator 兜底')
  assert(client.includes('data.locale') || client.includes('d.locale'), '未使用宿主下发的 locale')
})

ok('client: 请求失败不静默（检查 res.ok 并把原因上屏）', () => {
  const client = read('lib/client.js')
  assert(/res\.ok/.test(client), 'api() 必须检查 res.ok')
  assert(client.includes('err.unauthorized'), '401 必须给出可操作的提示')
  assert(client.includes('storageError'), '必须显示宿主下发的 storageError')
  assert(/visibilityState/.test(client), '轮询必须在标签页隐藏时暂停')
  assert(/pollIntervalMs/.test(client), '轮询周期必须跟随宿主下发的 pollIntervalMs')
})

// ------------------------------------------- bundle declaration (route A gate)
ok('bundle: 声明 dsh.bundle.patch 且补丁文件存在', () => {
  assert(pkg.dsh?.bundle?.patch === './cordis.patch.yml', `dsh.bundle.patch 应为 ./cordis.patch.yml，实际 ${JSON.stringify(pkg.dsh?.bundle)}`)
  assert(existsSync(join(ROOT, 'cordis.patch.yml')), 'cordis.patch.yml 不存在（组合层会解析失败）')
  assert(pkg.exports?.['./cordis.patch.yml'] === './cordis.patch.yml', 'exports 应导出 ./cordis.patch.yml')
})

ok('bundle: 组合层只有一行 insert，且恰好插入本插件一次', () => {
  const yaml = read('cordis.patch.yml')
  const rows = topLevelRows(yaml)
  assert(rows.length === 1, `组合层应只有一条顶层补丁（insert），实际 ${rows.length} 条：${rows.map((r) => r.head).join(' | ')}`)
  assert(rows[0].head === '- insert:', `唯一的顶层补丁应是 insert，实际 ${rows[0].head}`)
  const entries = rows[0].body.filter((line) => /^\s*-\s*id:/.test(line))
  assert(entries.length === 1, `insert 应恰好插入 1 个条目，实际 ${entries.length} 个`)
  const id = rows[0].body.join('\n').match(/^\s*-\s*id:\s*(\S+)/m)?.[1]
  const name = rows[0].body.join('\n').match(/^\s*name:\s*(\S+)/m)?.[1]
  assert(id === pkg.name, `插入的 id 应是包名 ${pkg.name}，实际 ${id}`)
  assert(name === pkg.name, `插入的 name 应是包名 ${pkg.name}（自动解析），实际 ${name}`)
  assert(rows[0].body.length === 2, `条目应恰好两行 id + name，实际：${rows[0].body.join(' / ')}`)
})

ok('bundle: 补丁文件里不存在第二条同 id 行（防手写重复）', () => {
  const yaml = read('cordis.patch.yml')
  const hits = yaml.split('\n').filter((line) => new RegExp(`id:\\s*${pkg.name}\\b`).test(line))
  assert(hits.length === 1, `id: ${pkg.name} 应只出现 1 次，实际 ${hits.length} 次：${hits.join(' | ')}`)
})

// ------------------------------------------------- client artifact contract
ok('client: __ModuleLoader__ 的 id 必须等于包名（组合路由键）', () => {
  const client = read('lib/client.js')
  assert(client.includes('window.__ModuleLoader__.load({'), 'lib/client.js 必须保持 window.__ModuleLoader__.load({...}) 产物格式')
  const id = client.match(/window\.__ModuleLoader__\.load\(\{\s*\n?\s*id:\s*'([^']+)'/)
  assert(id, '未能从 lib/client.js 解析出 load({ id })')
  assert(id[1] === pkg.name, `客户端 id 应等于包名 ${pkg.name}（否则 /plugins/??<包名>/client.js 取不到），实际 ${id[1]}`)
})

ok('client: 保留 exports.inject = [\'slots\']（0.1.2-rc.1 起缺失即静默消失）', () => {
  const client = read('lib/client.js')
  assert(/const inject\s*=\s*\[\s*'slots'\s*\]/.test(client), "缺少 inject = ['slots']：纤程不会等服务就绪，小组件会静默消失")
  assert(client.includes('exports.inject = inject'), '缺少 exports.inject = inject（服务门控读的是模块导出字段）')
  assert(client.includes('exports.apply = apply'), '缺少 exports.apply = apply')
})

// ------------------------------------------------------------ host contract
ok('host: 具名导出 inject/apply，inject 声明 timer/webServer/connection', () => {
  const host = read('lib/index.js')
  assert(!/export default/.test(host), '宿主插件应使用具名导出（export const inject / export async function apply），不再用默认导出对象')
  assert(/export const inject = \[/.test(host), '缺少 export const inject = [...]')
  assert(/export async function apply\s*\(/.test(host), '缺少 export async function apply(...)')
  const m = host.match(/export const inject = \[([^\]]*)\]/)
  for (const svc of ['timer', 'webServer', 'connection']) {
    assert(m[1].includes(`'${svc}'`), `inject 缺少 '${svc}'（connection 缺失 = 无认证门禁，必须拒绝激活）`)
  }
})

ok('host: /dsbal/* 全部走认证门禁，不存在裸注册（安全回归闸门）', () => {
  const host = read('lib/index.js')
  assert(host.includes('ctx.connection'), 'host 必须使用 ctx.connection 作为请求门禁')
  assert(/\.admit\(/.test(host), 'host 必须调用 connection.admit()')
  const registers = [...host.matchAll(/webServer\.register\(/g)]
  assert(registers.length === 1, `webServer.register 只应出现在 registerRoute 内一次，实际 ${registers.length} 次（新增路由必须走 registerRoute）`)
  // Route table: every path must be declared once, with its method, through the
  // readRoute/bodyRoute helpers (which both go through registerRoute -> guard).
  for (const route of ['/dsbal/state', '/dsbal/refresh', '/dsbal/config', '/dsbal/window']) {
    const hits = [...host.matchAll(new RegExp(`'${route.replace('/', '\\/')}'`, 'g'))]
    assert(hits.length === 1, `路由 ${route} 应恰好声明一次，实际 ${hits.length} 次`)
  }
  const table = host.slice(host.indexOf('const disposers'), host.indexOf('ctx.effect('))
  for (const call of ["readRoute('GET', '/dsbal/state'", "readRoute('POST', '/dsbal/refresh'", "bodyRoute('POST', '/dsbal/config'", "bodyRoute('POST', '/dsbal/window'"]) {
    assert(table.includes(call), `路由表缺少 ${call}）`)
  }
  assert((table.match(/dsbal\//g) || []).length === 4, `路由表应恰好 4 条 /dsbal 路由，实际 ${(table.match(/dsbal\//g) || []).length} 条`)
})

ok('host: 算法/客户端/校验都在各自模块里，index.js 只做装配', () => {
  const host = read('lib/index.js')
  const service = read('lib/service.js')
  const modules = {
    'lib/phase.js': ['phaseInfo'],
    'lib/window.js': ['windowOf', 'spentFromSnapshots', 'monthRange', 'sumMonths'],
    'lib/deepseek.js': ['normalizeToken', 'fetchBalance', 'fetchMonthData'],
    'lib/validate.js': ['parseWindowRequest', 'parseConfigRequest'],
    'lib/service.js': ['createService', 'normalizeState'],
  }
  for (const [file, names] of Object.entries(modules)) {
    assert(existsSync(join(ROOT, file)), `${file} 不存在`)
    const src = read(file)
    for (const name of names) {
      assert(new RegExp(`export (async )?function ${name}\\b|export const ${name}\\b`).test(src), `${file} 未导出 ${name}`)
      assert(host.includes(name) || service.includes(name), `${name} 没有被 index.js/service.js 使用`)
    }
  }
  // Neither the assembly layer nor the service may re-implement the algorithms.
  for (const src of [host, service]) {
    for (const dup of ['function phaseInfo', 'function windowOf', 'function spentFromSnapshots', 'async function fetchMonthData', 'function parseWindowRequest']) {
      assert(!src.includes(dup), `不应再自带 ${dup}（会与子模块分叉）`)
    }
  }
  assert(host.split('\n').length < 250, `lib/index.js 应保持为装配层（当前 ${host.split('\n').length} 行）`)
  assert(/from '\.\/service\.js'/.test(host), 'lib/index.js 应通过 ./service.js 调用操作')
})

ok('host: 请求校验已抽到 lib/validate.js，index.js 不再重复实现', () => {
  assert(existsSync(join(ROOT, 'lib/validate.js')), 'lib/validate.js 不存在')
  const host = read('lib/index.js')
  assert(/from '\.\/validate\.js'/.test(host), 'lib/index.js 应从 ./validate.js 导入校验器')
  assert(!host.includes('function parseWindowRequest'), 'lib/index.js 不应再自带 parseWindowRequest（会与 validate.js 分叉）')
  assert(!host.includes('function parseConfigRequest'), 'lib/index.js 不应再自带 parseConfigRequest')
})

ok('host: 客户端半边只依赖 react（不引入额外外部模块）', () => {
  const client = read('lib/client.js')
  const requires = [...client.matchAll(/require\(\s*'([^']+)'\s*\)/g)].map((m) => m[1])
  const allowed = new Set(['react'])
  const extra = requires.filter((r) => !allowed.has(r))
  assert(extra.length === 0, `lib/client.js 出现了额外外部依赖 ${extra.join(', ')}：需同步声明 dsh.client.external 并确认种子表，否则部署会失败`)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
