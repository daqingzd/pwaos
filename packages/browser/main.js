#!/usr/bin/env node
'use strict';

/**
 * main.js - launch the PwaOS Browser PWA inside the PwaOS Runtime.
 *
 * Uses @pwaos.net/runtime-client-api, whose export surface IS the native
 * addon (module.exports = addon; loading it performs the full setup:
 * dynamic-library search path, addon load, pwaos_setRuntimeExecutablePath).
 *
 * Flow:
 *   1. addon.init() the runtime.
 *   2. addon.createInstance() - one runtime instance for this process.
 *   3. instance.createPwa({ type, appType: Pwa, appUrl }) - open the browser
 *      PWA from www.pwaos.net/webapps/browser.
 *   4. Poll events until the app is live, then keep the process alive
 *      pumping the event loop until SIGINT/SIGTERM.
 */

const path = require('path');
const pwaos = require('@pwaos.net/runtime-client-api');

const DEFAULT_APP_URL = 'http://www.pwaos.net/webapps/browser/index.html';
const START_PAGE = process.env.BROWSER_URL || DEFAULT_APP_URL;

const POLL_MS = 100;
const INSTANCE_TIMEOUT_MS = 30_000;
const APP_TIMEOUT_MS = 30_000;

const instanceStatusWorking = pwaos.Instance.instanceStatusWorking;
const appStatusSynchronized = pwaos.App.appStatusSynchronized;
const appTypePwa = pwaos.App.appTypePwa;
const TYPE_INSTANCE_CREATE_INFO = pwaos.PWAOS_TYPE_INSTANCE_CREATE_INFO;
const TYPE_PWA_CREATE_INFO = pwaos.PWAOS_TYPE_PWA_CREATE_INFO;
const TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED =
  pwaos.PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED;
const TYPE_EVENT_DATA_APP_STATUS_CHANGED =
  pwaos.PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll instance.pollEvent() until predicate fires or timeout. */
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
  console.log(`[browser] runtime path : ${process.env.PWAOS_RUNTIME_PATH}`);
  console.log(`[browser] start page   : ${START_PAGE}`);

  let instance = null;
  let app = null;
  let shuttingDown = false;

  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[browser] shutting down...');
    try {
      if (app && instance) {
        try { app.setCallback(null, null); } catch (_) {}
        try { instance.destroyPwa(app); } catch (_) {}
      }
      if (instance) {
        try { pwaos.destroyInstance(instance); } catch (_) {}
      }
      pwaos.shutDown();
    } catch (e) {
      console.error(`[browser] teardown error: ${e.message}`);
    }
    process.exit(code);
  }

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  try {
    // 1. Init the runtime.
    const initResult = await pwaos.init();
    console.log(`[browser] init         : ${pwaos.resultToString(initResult)}`);

    // 2. Create the (single) runtime instance (native createInfo payload).
    instance = await pwaos.createInstance({
      type: TYPE_INSTANCE_CREATE_INFO,
      runtimeType: pwaos.runtimeTypePwa,
      serverUrl: 'http://localhost',
      dataPath: path.join(__dirname, '.pwaos-data'),
    });
    console.log('[browser] instance     : created');

    // 3. Wait for the instance to come up.
    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED &&
        ev.status === instanceStatusWorking,
      INSTANCE_TIMEOUT_MS,
      'instanceStatusWorking'
    );
    console.log('[browser] instance     : working');

    // 4. Open the browser PWA in a window (native createPwa payload).
    app = instance.createPwa({
      type: TYPE_PWA_CREATE_INFO,
      appType: appTypePwa,
      appUrl: START_PAGE,
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

    // Keep the process alive and pump the event loop.
    console.log('[browser] running - press Ctrl+C to stop');
    const appStatusStopping = pwaos.App.appStatusStopping;
    const appTimer = setInterval(() => {
      // Drain runtime events; an appStatusStopping event means the PWA was
      // closed (e.g. the user closed the window) - shut down and quit.
      let ev;
      do {
        ev = instance.pollEvent();
        if (ev && ev.type === TYPE_EVENT_DATA_APP_STATUS_CHANGED &&
            ev.status === appStatusStopping) {
          console.log('[browser] app          : appStatusStopping - quitting');
          clearInterval(appTimer);
          shutdown(0);
          return;
        }
      } while (ev);
    }, POLL_MS);
  } catch (e) {
    console.error(`[browser] FATAL: ${e.message}`);
    await shutdown(1);
  }
}

main();
