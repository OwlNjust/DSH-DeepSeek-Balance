// Language resolution, host side.
//
// The panel is browser UI, but the *choice* of language belongs to the host: the
// locale plugin (dsh-client-locale) stores an explicit preference in the settings
// document, and an unset preference means "delegate to the browser", which the
// host cannot observe. So the host reports what it knows (`locale`, possibly
// null) in the state payload and the client combines that with its own fallbacks.
//
// Two hard constraints shape this module:
//   * the plugin has zero dependencies and cannot resolve @deepseek-ai/* — so the
//     namespace/field names below are read from the settings document, with the
//     values copied from @deepseek-ai/dsh-client-locale (verified at 0.2.0-rc.2:
//     LOCALE_SETTINGS_NAMESPACE = 'locale', LOCALE_PREFERENCE_FIELD = 'preference');
//   * `settings.describe()` returns one descriptor per *profile entry* and the
//     live value hangs off `.value` — `settings.get(ns)` was removed in 0.1.7-rc.2
//     and a call reached through optional chaining would silently fall back, so
//     only `describe()` is used and every step is guarded.

/** Languages the widget ships copy for. */
export const SUPPORTED_LOCALES = ['zh', 'en']

/** Language used when nothing explicit is set (unset preference ≈ browser decides). */
export const DEFAULT_LOCALE = 'zh'

/** Settings namespace/entry owned by @deepseek-ai/dsh-client-locale. */
export const LOCALE_SETTINGS_NAMESPACE = 'locale'

/** Field carrying the explicit selection inside that entry's value. */
export const LOCALE_PREFERENCE_FIELD = 'preference'

/**
 * Map a BCP 47-ish tag onto a language this plugin ships.
 * @returns `'zh'`, `'en'`, or undefined when it is neither.
 */
export function normalizeLocale(raw) {
  if (typeof raw !== 'string' || raw === '') return undefined
  const tag = raw.toLowerCase()
  for (const locale of SUPPORTED_LOCALES) {
    if (tag === locale || tag.startsWith(`${locale}-`) || tag.startsWith(`${locale}_`)) return locale
  }
  return undefined
}

/**
 * Read the explicit language preference out of the settings document.
 * @param settings - the host settings service (optional; anything else → undefined).
 * @returns the locale, or undefined when the user has not chosen one.
 */
export function localeFromSettings(settings) {
  if (!settings || typeof settings.describe !== 'function') return undefined
  let descriptors
  try {
    descriptors = settings.describe()
  } catch {
    return undefined
  }
  if (!Array.isArray(descriptors)) return undefined
  const entry = descriptors.find((row) => row && row.ns === LOCALE_SETTINGS_NAMESPACE)
  const value = entry && entry.value
  if (!value || typeof value !== 'object') return undefined
  return normalizeLocale(value[LOCALE_PREFERENCE_FIELD])
}
