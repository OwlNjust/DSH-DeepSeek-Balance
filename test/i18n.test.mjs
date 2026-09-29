// Unit tests for lib/i18n.js — mapping a host language tag onto the languages the
// widget ships, and reading the explicit preference out of the settings document.
// Run: node test/i18n.test.mjs

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeFromSettings, normalizeLocale } from '../lib/i18n.js'

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
const eq = (got, want, what) => assert(got === want, `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

ok('i18n: 支持 zh/en，缺省 zh（用户未选 = 交给浏览器，宿主无法得知）', () => {
  eq(SUPPORTED_LOCALES.join(','), 'zh,en', 'SUPPORTED_LOCALES')
  eq(DEFAULT_LOCALE, 'zh', 'DEFAULT_LOCALE')
})
ok('i18n: 规范化 BCP 47 标签（zh-CN / en_US / ZH）', () => {
  eq(normalizeLocale('zh'), 'zh', 'zh')
  eq(normalizeLocale('zh-CN'), 'zh', 'zh-CN')
  eq(normalizeLocale('zh-Hans-CN'), 'zh', 'zh-Hans-CN')
  eq(normalizeLocale('en-US'), 'en', 'en-US')
  eq(normalizeLocale('en_GB'), 'en', 'en_GB')
  eq(normalizeLocale('ZH'), 'zh', 'ZH 大写')
  eq(normalizeLocale('ja'), undefined, 'ja 不支持')
  eq(normalizeLocale(''), undefined, '空串')
  eq(normalizeLocale(null), undefined, 'null')
  eq(normalizeLocale(42), undefined, '非字符串')
})
ok('i18n: 从 settings.describe() 读显式偏好', () => {
  const settings = { describe: () => [{ ns: 'locale', value: { preference: 'en-US' } }] }
  eq(localeFromSettings(settings), 'en', 'en-US → en')
})
ok('i18n: 未设置偏好 / 无该命名空间 → undefined（客户端再退回浏览器）', () => {
  eq(localeFromSettings({ describe: () => [{ ns: 'locale', value: { preference: null } }] }), undefined, 'preference=null')
  eq(localeFromSettings({ describe: () => [] }), undefined, '空描述')
  eq(localeFromSettings({ describe: () => [{ ns: 'theme', value: { preference: 'dark' } }] }), undefined, '别的命名空间')
  eq(localeFromSettings({ describe: () => [{ ns: 'locale' }] }), undefined, '无 value')
})
ok('i18n: 缺失/异常的服务一律安全退化，不抛错', () => {
  eq(localeFromSettings(undefined), undefined, 'undefined 服务')
  eq(localeFromSettings({}), undefined, '无 describe')
  eq(localeFromSettings({ describe: () => { throw new Error('boom') } }), undefined, 'describe 抛错')
  eq(localeFromSettings({ describe: () => 'nonsense' }), undefined, 'describe 返回非数组')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
