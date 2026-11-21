#!/usr/bin/env node
'use strict';

/**
 * main.js - launch the PwaOS Shell inside the PwaOS Runtime.
 *
 * Flow (mirrors @pwaos/browser):
 *   1. init() the runtime (PWAOS_RUNTIME_PATH is auto-resolved from the
 *      installed @pwaos/runtime-<platform>-<arch> package).
 *   2. createInstance() - one runtime instance for this process.
 *   3. createPwa({ appType: Console, url: file://...webapp/index.html }) -
 *      the shell UI opens straight from disk, no HTTP server.
 *   4. Pump events; drive the terminal bridge: drain the UI outbox
 *      (executeJavaScript) and write results back via
 *      window.pwaosShellInbox, also through executeJavaScript injection.
 */

const fs = require('fs');
const path = require('path');
const pwaos = require('@pwaos/runtime-client');
const { ShellEngine, VERSION } = require('./lib/engine');

const WEBAPP_INDEX = path.join(__dirname, 'webapp', 'index.html');
const POLL_MS = 100;
const INSTANCE_TIMEOUT_MS = 30_000;
const APP_TIMEOUT_MS = 30_000;
const BRIDGE_POLL_MS = 50;

const addon = pwaos._addon;
const instanceStatusWorking = addon.Instance.instanceStatusWorking;
const appStatusSynchronized = addon.App.appStatusSynchronized;
const appTypeConsole = addon.App.appTypeConsole;
const TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED =
  addon.PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED;
const TYPE_EVENT_DATA_APP_STATUS_CHANGED =
  addon.PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED;

function log(tag, msg) { console.log(`[shell] ${tag.padEnd(10)}: ${msg}`); }

async function main() {
  log('version', VERSION);
  log('runtime', pwaos.PWAOS_RUNTIME_PATH || '(addon default)');
  log('webapp', WEBAPP_INDEX);

  if (!fs.existsSync(WEBAPP_INDEX)) {
    console.error(`[shell] FATAL: webapp missing at ${WEBAPP_INDEX}`);
    process.exit(1);
  }

  const appUrl = 'file://' + WEBAPP_INDEX.replace(/\\/g, '/');
  log('app-url', appUrl);

  let instance = null;
  let app = null;
  let shuttingDown = false;

  // --- bridge (v0.1 protocol) -----------------------------------------------
  // Verified constraint of this runtime build: executeJavaScript is
  // fire-and-forget (a result code only, never the evaluated value) and
  // there is no JS->host callback on the App surface (the native
  // ObjectInterface method callback is a stub). So:
  //
  //   host -> UI : works. executeJavaScript pushes into
  //                window.pwaosShellInbox; the page polls and drains it.
  //   UI -> host : impossible in v0.1. The page queues keystrokes into
  //                window.pwaosShellOutbox for a future two-way build; the
  //                host does NOT read them back.
  //
  // Practical v0.1 input: the HOST terminal owns the keyboard (raw stdin).
  // The PWA window is a full mirror of the session - prompt, colors,
  // history navigation, output - driven by the same engine. When a runtime
  // build lands executeJavaScript return values (or a JS->host channel),
  // draining window.pwaosShellOutbox here is the only change needed.
  const engine = new ShellEngine(process.env.HOME || process.cwd());

  const writeQueue = [];

  const emit = {
    write(text) { writeQueue.push(text); },
    line(text) { writeQueue.push(`${text == null ? '' : text}\r\n`); },
    control(msg) { controlQueue.push(msg); },
    quit() { shutdown(0); },
  };
  let controlQueue = [];

  function flushInbox() {
    if (!writeQueue.length && !controlQueue.length) return;
    const items = [];
    for (const w of writeQueue) {
      items.push(JSON.stringify({ type: 'write', json: JSON.stringify(w) }));
    }
    for (const c of controlQueue) items.push(JSON.stringify(c));
    writeQueue.length = 0;
    controlQueue = [];
    const js = `(function(){ (window.pwaosShellInbox = window.pwaosShellInbox || [])` +
      `.push(${JSON.stringify(items)}); })()`;
    try { app.executeJavaScript(js); } catch (_) { /* app gone */ }
  }

  const stdinIsTTY = process.stdin.isTTY === true;

  function engineEmit() {
    return {
      write: (t) => emit.write(t),
      line: (t) => emit.line(t),
      control: (c) => emit.control(c),
      quit: () => shutdown(0),
    };
  }

  if (stdinIsTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => {
      if (shuttingDown) return;
      engine.handleKey(d, engineEmit());
    });
    log('input', 'host TTY keyboard active (window mirrors the session)');
  } else {
    // Non-interactive launch: piped/redirected stdin executes line by line.
    log('input', 'no TTY - window shows the prompt; pipe commands via stdin');
    process.stdin.resume();
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        emit.line(line);
        engine.execute(line.trim(), engineEmit());
      }
    });
  }

  // Bridge timer: push pending output into the page.
  const bridgeTimer = setInterval(flushInbox, BRIDGE_POLL_MS);

  // --- lifecycle ------------------------------------------------------------
  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(bridgeTimer);
    try {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    } catch (_) {}
    console.log('\n[shell] shutting down...');
    try {
      if (app) { try { app.setCallback(null, null); } catch (_) {} try { await app.close(); } catch (_) {} }
      if (instance) { try { await instance.close(); } catch (_) {} }
      pwaos.shutdown();
    } catch (e) {
      console.error(`[shell] teardown error: ${e.message}`);
    }
    process.exit(code);
  }

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  try {
    const initResult = await pwaos.init();
    log('init', pwaos.resultToString(initResult));

    instance = await pwaos.createInstance({
      url: 'http://localhost',
      dataPath: path.join(__dirname, '.pwaos-data'),
    });
    log('instance', 'created');

    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED &&
        ev.status === instanceStatusWorking,
      INSTANCE_TIMEOUT_MS,
      'instanceStatusWorking'
    );
    log('instance', 'working');

    app = instance.createPwa({
      appType: appTypeConsole,
      url: appUrl,
      width: 900,
      height: 600,
    });
    log('app', `created -> ${appUrl}`);

    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_APP_STATUS_CHANGED &&
        ev.status >= appStatusSynchronized,
      APP_TIMEOUT_MS,
      'appStatusSynchronized'
    );
    log('app', 'synchronized (shell window is live)');

    // Greet the UI once it can hear us, then print the prompt.
    setTimeout(() => {
      emit.control({ type: 'title', text: `PwaOS Shell ${VERSION}` });
      emit.write(engine.prompt());
      flushInbox();
    }, 800);

    // Watch for the user closing the shell window.
    const appStatusStopping = addon.App.appStatusStopping;
    setInterval(() => {
      let ev;
      do {
        try { ev = instance.pollEvent(); } catch (_) { ev = null; }
        if (ev && ev.type === TYPE_EVENT_DATA_APP_STATUS_CHANGED &&
            ev.status === appStatusStopping) {
          log('app', 'window closed - quitting');
          shutdown(0);
          return;
        }
      } while (ev);
    }, POLL_MS);
  } catch (e) {
    console.error(`[shell] FATAL: ${e.message}`);
    await shutdown(1);
  }
}

async function pollUntil(instance, predicate, timeoutMs, what) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let ev = null;
    try { ev = instance.pollEvent(); } catch (_) {}
    if (ev && predicate(ev)) return ev;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`timed out waiting for ${what}`);
}

main();
