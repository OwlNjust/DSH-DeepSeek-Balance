// Unit tests for lib/store.js — the state file's atomicity, versioning and error
// reporting. These are the properties that make a truncated write survivable
// instead of silently costing the user their keys.
// Run: node test/store.test.mjs

import { chmod, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SCHEMA_VERSION, createStore, emptyState, stateFilePath, writeAtomic } from '../lib/store.js'

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
/** Tests need async bodies; this wrapper keeps the same pass/fail reporting. */
async function okAsync(name, fn) {
  try {
    await fn()
    passed++
  } catch (error) {
    failed++
    console.error(`✗ ${name}\n    ${error.message}`)
  }
}
const dir = () => mkdtemp(join(tmpdir(), 'dsbal-store-'))

// The plugin's own normaliser: keeps the store generic, proves the hook is used.
const normalize = (doc) => ({
  ...emptyState(),
  ...doc,
  apiKey: typeof doc.apiKey === 'string' ? doc.apiKey.trim() : '',
  snapshots: Array.isArray(doc.snapshots) ? doc.snapshots : [],
})

await okAsync('store: 文件不存在 → 空状态且 loadError 为 null（首次运行是正常的）', async () => {
  const file = join(await dir(), 'state.json')
  const store = createStore(file, normalize)
  const state = await store.load()
  assert(state.apiKey === '', 'apiKey 应为空')
  assert(store.loadError === null, `loadError 应为 null，实际 ${store.loadError}`)
  assert(state.schemaVersion === SCHEMA_VERSION, '空状态应带 schemaVersion')
})

await okAsync('store: save → load 往返一致，权限 0600，落盘含 schemaVersion', async () => {
  const file = join(await dir(), 'state.json')
  const store = createStore(file, normalize)
  await store.load()
  const state = { ...emptyState(), apiKey: 'sk-test', snapshots: [{ t: 1, total: 2 }] }
  await store.save(state)
  assert(store.saveError === null, `saveError 应为 null，实际 ${store.saveError}`)
  const mode = (await stat(file)).mode & 0o777
  assert(mode === 0o600, `文件权限应为 0600，实际 ${mode.toString(8)}`)
  const onDisk = JSON.parse(await readFile(file, 'utf8'))
  assert(onDisk.schemaVersion === SCHEMA_VERSION, '落盘应含 schemaVersion')
  const back = await createStore(file, normalize).load()
  assert(back.apiKey === 'sk-test', 'apiKey 未往返')
  assert(back.snapshots.length === 1 && back.snapshots[0].total === 2, 'snapshots 未往返')
})

await okAsync('store: 原子写不留临时文件', async () => {
  const d = await dir()
  const file = join(d, 'state.json')
  const store = createStore(file, normalize)
  await Promise.all([store.save(emptyState()), store.save({ ...emptyState(), apiKey: 'sk-a' }), store.save({ ...emptyState(), apiKey: 'sk-b' })])
  const leftovers = (await readdir(d)).filter((f) => f.includes('.tmp'))
  assert(leftovers.length === 0, `不应残留临时文件：${leftovers.join(', ')}`)
  const onDisk = JSON.parse(await readFile(file, 'utf8'))
  assert(onDisk.apiKey === 'sk-b', `串行写应以最后一次为准，实际 ${onDisk.apiKey}`)
})

await okAsync('store: 损坏 JSON → 报告原因、原文件隔离保留、从空状态开始', async () => {
  const d = await dir()
  const file = join(d, 'state.json')
  await writeFile(file, '{"apiKey":"sk-broken"', { mode: 0o600 })
  const store = createStore(file, normalize)
  const state = await store.load()
  assert(state.apiKey === '', '应从空状态开始')
  assert(typeof store.loadError === 'string' && store.loadError.includes('合法 JSON'), `loadError 应说明原因，实际 ${store.loadError}`)
  const backups = (await readdir(d)).filter((f) => f.includes('.corrupt-'))
  assert(backups.length === 1, `应恰好留下一个隔离备份，实际 ${backups.length}`)
  assert(store.loadError.includes(backups[0]), 'loadError 应告诉用户备份文件名')
  assert((await readFile(join(d, backups[0]), 'utf8')) === '{"apiKey":"sk-broken"', '备份内容必须逐字节保留')
  // 之后正常保存不再毁掉用户数据（备份仍在）。
  await store.save({ ...emptyState(), apiKey: 'sk-new' })
  assert((await readFile(join(d, backups[0]), 'utf8')) === '{"apiKey":"sk-broken"', '后续保存不得影响备份')
})

await okAsync('store: 非对象内容 → 隔离并回退空状态', async () => {
  const file = join(await dir(), 'state.json')
  await writeFile(file, '[1,2,3]', { mode: 0o600 })
  const store = createStore(file, normalize)
  await store.load()
  assert(typeof store.loadError === 'string' && store.loadError.includes('不是对象'), `loadError = ${store.loadError}`)
})

await okAsync('store: 未来版本文件 → 拒绝解读并说明版本', async () => {
  const file = join(await dir(), 'state.json')
  await writeFile(file, JSON.stringify({ schemaVersion: SCHEMA_VERSION + 5, apiKey: 'sk-future' }), { mode: 0o600 })
  const store = createStore(file, normalize)
  const state = await store.load()
  assert(state.apiKey === '', '不应读取未来版本')
  assert(store.loadError.includes(String(SCHEMA_VERSION + 5)), `loadError 应含版本号，实际 ${store.loadError}`)
  assert(store.loadError.includes('.corrupt-'), '未来版本文件也应隔离保留，而不是被覆盖')
})

await okAsync('store: 写入失败（父目录不可写）→ saveError 有内容且不抛异常', async () => {
  const parent = await dir()
  await chmod(parent, 0o500) // 去掉写权限：mkdir 会以 EACCES 快速失败
  try {
    const store = createStore(join(parent, 'sub', 'state.json'), normalize)
    let threw = false
    try {
      await store.save(emptyState())
    } catch {
      threw = true
    }
    assert(!threw, 'save 不应向调用方抛错（轮询是 fire-and-forget）')
    assert(typeof store.saveError === 'string' && store.saveError.includes('保存状态文件失败'), `saveError = ${store.saveError}`)
  } finally {
    await chmod(parent, 0o700)
  }
})

await okAsync('store: stateFilePath 固定在 DSH home 下', async () => {
  assert(stateFilePath('/home/x') === '/home/x/.deepseek-balance.json', `实际 ${stateFilePath('/home/x')}`)
})

await okAsync('store: writeAtomic 覆盖已有文件并保持权限', async () => {
  const file = join(await dir(), 'x.json')
  await writeAtomic(file, '{"a":1}')
  await writeAtomic(file, '{"a":2}')
  assert((await readFile(file, 'utf8')) === '{"a":2}', '第二次写入应覆盖')
  assert(((await stat(file)).mode & 0o777) === 0o600, '权限应为 0600')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
