'use strict';

/**
 * SEA entry for @pwaos/browser.
 *
 * Everything is bundled into this single file EXCEPT the native addon
 * (pwaos_addon.node), which cannot be embedded - it ships beside the
 * executable at node_modules/@pwaos/runtime-client/build/Release/ and is
 * loaded via an absolute path derived from process.execPath.
 */

const path = require('path');

// The runtime-client wrapper requires its native addon relative to its own
// module file. In a SEA bundle the wrapper is inlined, so point the addon
// require at the copy shipped beside the executable by patching Module
// resolution for that one specifier BEFORE requiring the wrapper.
const Module = require('module');
const exeDir = path.dirname(process.execPath);
const ADDON_PATH = path.join(exeDir, 'node_modules', '@pwaos', 'runtime-client',
  'build', 'Release', 'pwaos_addon.node');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === './build/Release/pwaos_addon.node') {
    return ADDON_PATH;
  }
  return origResolve.call(this, request, ...rest);
};

const pwaos = require('@pwaos/runtime-client');

const DEFAULT_APP_URL = 'http://www.pwaos.net/webapps/browser/index.html';
const START_PAGE = process.env.BROWSER_URL || DEFAULT_APP_URL;

const POLL_MS = 100;
const INSTANCE_TIMEOUT_MS = 30_000;
const APP_TIMEOUT_MS = 30_000;

const instanceStatusWorking = pwaos._addon.Instance.instanceStatusWorking;
const appStatusSynchronized = pwaos._addon.App.appStatusSynchronized;
const appTypePwa = pwaos._addon.App.appTypePwa;
const TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED =
  pwaos._addon.PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED;
const TYPE_EVENT_DATA_APP_STATUS_CHANGED =
  pwaos._addon.PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollUntil(instance, predicate, timeoutMs, what) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ev = instance.pollEvent();
    if (ev && predicate(ev)) return ev;
    await sleep(POLL_MS);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function main() {
  console.log(`[browser] runtime path : ${pwaos.PWAOS_RUNTIME_PATH}`);
  console.log(`[browser] addon        : ${ADDON_PATH}`);
  console.log(`[browser] start page   : ${START_PAGE}`);

  let instance = null;
  let app = null;
  let shuttingDown = false;

  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[browser] shutting down...');
    try {
      if (app) {
        try { app.setCallback(null, null); } catch (_) {}
        try { await app.close(); } catch (_) {}
      }
      if (instance) {
        try { await instance.close(); } catch (_) {}
      }
      pwaos.shutdown();
    } catch (e) {
      console.error(`[browser] teardown error: ${e.message}`);
    }
    process.exit(code);
  }

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  try {
    const initResult = await pwaos.init();
    console.log(`[browser] init         : ${pwaos.resultToString(initResult)}`);

    instance = await pwaos.createInstance({
      url: 'http://localhost',
      dataPath: path.join(exeDir, '.pwaos-data'),
    });
    console.log('[browser] instance     : created');

    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED &&
        ev.status === instanceStatusWorking,
      INSTANCE_TIMEOUT_MS,
      'instanceStatusWorking'
    );
    console.log('[browser] instance     : working');

    app = instance.createPwa({
      appType: appTypePwa,
      url: START_PAGE,
      width: 1280,
      height: 800,
    });
    console.log(`[browser] app          : created -> ${START_PAGE}`);

    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_APP_STATUS_CHANGED &&
        ev.status >= appStatusSynchronized,
      APP_TIMEOUT_MS,
      'appStatusSynchronized'
    );
    console.log('[browser] app          : synchronized (browser PWA is live)');

    console.log('[browser] running - press Ctrl+C to stop');
    setInterval(() => {
      let ev;
      do { ev = instance.pollEvent(); } while (ev);
    }, POLL_MS);
  } catch (e) {
    console.error(`[browser] FATAL: ${e.message}`);
    await shutdown(1);
  }
}

main();
