// dsh-deepseek-balance — host half.
//
// A static Cordis plugin for the deepseek-harness web profile. This file is the
// assembly layer only — configuration, lifecycle (state file, polling timer) and
// the authenticated HTTP surface. Everything else lives in focused modules:
//
//   lib/phase.js     peak/valley price phases + statutory-holiday calendar
//   lib/window.js    window range, snapshot estimation, monthly usage summing
//   lib/deepseek.js  balance/usage HTTP client and payload parsing
//   lib/validate.js  request validation
//   lib/config.js    tunables + validation of the profile's `config:`
//   lib/store.js     state-file load/save (atomic, serialised, versioned)
//   lib/i18n.js      host-side language preference
//   lib/service.js   the operations themselves (one implementation per operation)
//
// Routes: /dsbal/state (GET), /dsbal/refresh, /dsbal/config, /dsbal/window (POST).
// Every one of them passes ctx.connection.admit() first, so the surface is exactly
// as protected as the host's own /api channel.

import { homedir } from 'node:os'

import { apiOptions, resolveConfig } from './config.js'
import { localeFromSettings } from './i18n.js'
import { createService, normalizeState } from './service.js'
import { createStore, stateFilePath } from './store.js'
import { parseConfigRequest, parseWindowRequest } from './validate.js'

/** `connection` is the host's own request gate (Host/Origin fence + browser cookie
 *  auth, the same one the /api RPC channel uses). Injecting it means the plugin
 *  refuses to activate in a profile that cannot authenticate callers, which is the
 *  safe default for a surface that can write credentials. */
export const inject = ['timer', 'webServer', 'connection']

/**
 * @param ctx - plugin context (timer, webServer, connection).
 * @param rawConfig - the profile patch's `config:` object; validated by resolveConfig.
 */
export async function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const timer = ctx.timer
  const webServer = ctx.webServer
  const api = apiOptions(config)
  const file = stateFilePath(process.env.DSH_HOME || homedir())
  const stateStore = createStore(file, (doc) => normalizeState(doc, config))
  const initial = await stateStore.load()
  const service = createService({ config, api, stateStore, initial })

  // The user's explicit language choice lives in the host settings document. This
  // is read through a scoped injection so a profile without a settings service
  // still activates (the client then falls back to its own detection).
  ctx.inject(['settings'], (sctx) => {
    const read = () => service.setLocale(localeFromSettings(sctx.settings))
    read()
    sctx.on('settings/document-updated', read)
  })

  // A corrupt or future-versioned file has already been quarantined by the store
  // (`<name>.corrupt-<time>`) and is reported through state.storageError; if that
  // quarantine failed, skip the startup write so the file survives for the user.
  if (!stateStore.loadError) void stateStore.save(service.state)
  void service.poll()

  // ---- authenticated same-origin HTTP surface --------------------------------
  function sendText(res, status, text, extraHeaders) {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders })
    res.end(text)
  }
  /**
   * The host's own gate: Host/Origin trust fence, then browser authentication.
   * `webServer` knows no harness concepts, so a bare registration would expose
   * account data (and credential writes) to anything that can reach the port.
   * Fail closed: without the gate service nothing is served.
   */
  function guard(req, res) {
    const gate = ctx.connection
    const admission = gate && typeof gate.admit === 'function' ? gate.admit(req) : null
    if (!admission) {
      sendText(res, 401, 'unauthorized')
      return false
    }
    if ('rejection' in admission) {
      sendText(res, admission.rejection, admission.rejection === 401 ? 'unauthorized' : 'forbidden')
      return false
    }
    return true
  }
  function sendJson(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (c) => {
        data += c
        if (data.length > 1024 * 1024) {
          reject(new Error('body too large'))
          req.destroy()
        }
      })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
  }
  /**
   * Register one authenticated exact route. `method` is enforced (HEAD is allowed
   * wherever GET is) so a state-changing route cannot be driven by a cross-site
   * "simple" GET either. `parse` turns the raw body into validated input; a throw
   * from it (or from the handler) answers 400, matching the documented contract
   * that invalid input changes no state.
   */
  function registerRoute(method, path, handler) {
    return webServer.register({
      kind: 'exact',
      path,
      handler: async (req, res) => {
        if (!guard(req, res)) return
        const actual = req.method || 'GET'
        if (actual !== method && !(method === 'GET' && actual === 'HEAD')) {
          sendText(res, 405, 'method not allowed', { allow: method })
          return
        }
        await handler(req, res)
      },
    })
  }
  const bodyRoute = (method, path, parse, run) => registerRoute(method, path, async (req, res) => {
    try {
      sendJson(res, 200, await run(await parse(await readBody(req))))
    } catch (err) {
      sendJson(res, 400, { error: String((err && err.message) || err) })
    }
  })
  const readRoute = (method, path, run) => registerRoute(method, path, async (req, res) => {
    try {
      sendJson(res, 200, await run())
    } catch (err) {
      sendJson(res, 500, { error: String((err && err.message) || err) })
    }
  })

  const disposers = [
    readRoute('GET', '/dsbal/state', () => service.getState()),
    readRoute('POST', '/dsbal/refresh', () => service.refresh()),
    bodyRoute('POST', '/dsbal/config', parseConfigRequest, (input) => service.setConfig(input)),
    bodyRoute('POST', '/dsbal/window', parseWindowRequest, (input) => service.setWindow(input)),
  ]

  ctx.effect(() => () => {
    for (const d of disposers) d()
  })

  timer.interval(() => void service.poll(), config.pollIntervalMs)
}
