// State-file access: one small JSON document under $DSH_HOME.
//
// What this module is responsible for, and why each part exists:
//
//  * **atomic replace** — a plain writeFile can be interrupted, leaving truncated
//    JSON behind; the next boot used to treat that as "brand new state" and
//    silently drop the user's keys. Writing a sibling temp file and renaming it is
//    an atomic commit on the same filesystem.
//  * **serialised writers** — poll(), the config route and the window route can
//    all finish at once; without a queue the last save wins and an earlier change
//    disappears.
//  * **version envelope** — `schemaVersion` makes a future migration possible and
//    lets a corrupt/foreign file be reported instead of half-read.
//  * **diagnosable failures** — `lastError` is exposed to the UI instead of being
//    console.error'd into the void.

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/** Bumped whenever the on-disk shape changes in a way that needs migration. */
export const SCHEMA_VERSION = 1

/** The name is fixed (not configurable) so config can never point outside $DSH_HOME. */
export const STATE_FILE_NAME = '.deepseek-balance.json'

/** Default (empty) document, also the shape every save is normalised to. */
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    apiKey: '',
    platformToken: '',
    snapshots: [],
    settings: { window: 'today', customFromMs: null },
    lastPollAtMs: null,
    lastError: null,
  }
}

/** Absolute path of the state file for a DSH home. */
export function stateFilePath(dshHome, fileName = STATE_FILE_NAME) {
  return join(dshHome, fileName)
}

/**
 * Write `text` to `file` atomically: same-directory temp file, then rename.
 * The directory is created with 0700 and the file with 0600 — the document holds
 * plaintext credentials, so it must not be group/world readable.
 */
export async function writeAtomic(file, text, mode = 0o600) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, text, { mode })
  try {
    await rename(tmp, file)
  } catch (err) {
    try {
      await rm(tmp, { force: true })
    } catch { /* the temp file is best-effort cleanup */ }
    throw err
  }
}

/**
 * Create a store bound to one file.
 * `normalize` is supplied by the caller so the plugin keeps ownership of what a
 * valid in-memory state looks like (window ids, snapshot shape, …).
 */
export function createStore(file, normalize) {
  let chain = Promise.resolve()
  let saveError = null
  let loadError = null

  /** Timestamp suffix for a quarantined file (filesystem-safe, sortable). */
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

  return {
    /** Why the last save failed, or null. Surfaced to the UI. */
    get saveError() {
      return saveError
    },
    /** Why the last load could not be used, or null. Surfaced to the UI. */
    get loadError() {
      return loadError
    },
    /**
     * Read the document.
     * @returns the normalised state; a missing file is a normal first run. A file
     *          that cannot be used is *moved aside* (`<name>.corrupt-<time>`) so
     *          neither this plugin nor the next save can destroy data a user might
     *          still recover by hand, and the reason is recorded in `loadError`.
     */
    async load() {
      let raw
      try {
        raw = await readFile(file, 'utf8')
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          loadError = null
          return normalize(emptyState())
        }
        loadError = `读取状态文件失败：${(err && err.message) || err}`
        return normalize(emptyState())
      }
      const quarantine = async (reason) => {
        const backup = `${file}.corrupt-${stamp()}`
        try {
          await rename(file, backup)
          loadError = `${reason} 已从空状态开始；原文件保留为 ${basename(backup)}。`
        } catch {
          loadError = `${reason} 已从空状态开始（原文件未能改名保留，请自行备份）。`
        }
        return normalize(emptyState())
      }
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        return quarantine('状态文件不是合法 JSON（可能上次写入被中断）。')
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return quarantine('状态文件内容不是对象。')
      }
      const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0
      if (version > SCHEMA_VERSION) {
        return quarantine(`状态文件版本 ${version} 高于本插件支持的 ${SCHEMA_VERSION}，未解读以免损坏数据。`)
      }
      loadError = null
      return normalize(parsed)
    },
    /**
     * Queue an atomic save of `state`. Never rejects (callers are fire-and-forget
     * from the polling loop); the reason is exposed through `saveError`.
     * @returns a promise that settles when this save has been attempted.
     */
    save(state) {
      const text = JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION })
      chain = chain.then(() =>
        writeAtomic(file, text).then(
          () => {
            saveError = null
          },
          (err) => {
            saveError = `保存状态文件失败：${(err && err.message) || err}`
          },
        ),
      )
      return chain
    },
  }
}
