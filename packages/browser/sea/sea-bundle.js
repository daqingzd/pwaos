"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// ../../runtime-client/lib/runtime-resolver.js
var require_runtime_resolver = __commonJS({
  "../../runtime-client/lib/runtime-resolver.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path2 = require("path");
    var PACKAGE_PREFIX = "@pwaos/runtime-";
    function getPlatformPackageCandidates() {
      const primary = `${PACKAGE_PREFIX}${process.platform}-${process.arch}`;
      if (process.platform === "win32" && process.arch === "x64") {
        return [primary, `${PACKAGE_PREFIX}win32-x86`];
      }
      return [primary];
    }
    function getPlatformPackageName() {
      return getPlatformPackageCandidates()[0];
    }
    function getBinaryName() {
      return process.platform === "win32" ? "pwaos_server.exe" : "pwaos_server";
    }
    function resolveRuntimePath(options = {}) {
      if (options.runtimePath) {
        if (fs.existsSync(options.runtimePath)) {
          return path2.resolve(options.runtimePath);
        }
        throw new Error(
          `PwaOS Runtime not found at the provided runtimePath: ${options.runtimePath}
Check that the path points at the directory containing pwaos_server.`
        );
      }
      let installedWithoutRuntime = null;
      for (const pkg of getPlatformPackageCandidates()) {
        try {
          const pkgJsonPath = require.resolve(`${pkg}/package.json`);
          const candidate = path2.join(path2.dirname(pkgJsonPath), "runtime");
          if (fs.existsSync(path2.join(candidate, getBinaryName()))) {
            return candidate;
          }
          if (pkg !== "@pwaos/runtime") {
            installedWithoutRuntime = { pkg, pkgJsonPath };
            break;
          }
        } catch (_) {
        }
        let dir = __dirname;
        while (true) {
          const candidate = path2.join(dir, "node_modules", pkg, "runtime");
          if (fs.existsSync(path2.join(candidate, getBinaryName()))) {
            return candidate;
          }
          const parent = path2.dirname(dir);
          if (parent === dir) break;
          dir = parent;
        }
      }
      if (installedWithoutRuntime) {
        const { pkg, pkgJsonPath } = installedWithoutRuntime;
        throw new Error(
          `The platform package ${pkg} is installed but has no runtime directory at ${path2.join(path2.dirname(pkgJsonPath), "runtime")}.
The package contents may be corrupted - try reinstalling: npm install ${pkg}`
        );
      }
      throw new Error(
        `PwaOS Runtime not found for ${process.platform}-${process.arch}.

Try installing the Runtime distribution package first:
  npm install @pwaos/runtime

If it still fails, check whether your platform is supported and whether
your package manager has disabled optionalDependencies
(e.g. --no-optional or --omit=optional).`
      );
    }
    module2.exports = {
      resolveRuntimePath,
      getPlatformPackageName,
      getPlatformPackageCandidates,
      getBinaryName
    };
  }
});

// sea-addon:sea-addon-shim
var require_sea_addon_shim = __commonJS({
  "sea-addon:sea-addon-shim"(exports2, module2) {
    var path2 = require("path");
    var addonPath = path2.join(
      path2.dirname(process.execPath),
      "node_modules",
      "@pwaos",
      "runtime-client",
      "build",
      "Release",
      "pwaos_addon.node"
    );
    var Module2 = require("module");
    var mod = new Module2("pwaos_addon");
    mod.filename = addonPath;
    process.dlopen(mod, addonPath);
    module2.exports = mod.exports;
  }
});

// ../../runtime-client/index.js
var require_runtime_client = __commonJS({
  "../../runtime-client/index.js"(exports2, module2) {
    var path2 = require("path");
    var { resolveRuntimePath, getPlatformPackageName, getBinaryName } = require_runtime_resolver();
    var addon = require_sea_addon_shim();
    var SUCCESS = addon.PWAOS_RESULT_SUCCESS;
    function isPromise(value) {
      return value && typeof value.then === "function";
    }
    function result(value) {
      if (isPromise(value)) {
        return value.then(
          (code) => ({ code, success: code === SUCCESS }),
          () => ({ code: -1, success: false })
        );
      }
      return { code: value, success: value === SUCCESS };
    }
    function check(resultObj, message) {
      if (!resultObj.success) {
        const err = new Error(message || `PwaOS error ${resultObj.code}`);
        err.code = resultObj.code;
        throw err;
      }
      return resultObj;
    }
    var Instance = class {
      constructor(native) {
        this._native = native;
      }
      getProperties() {
        return addon.Instance.prototype.getProperties.call(this._native);
      }
      createPwa(options = {}) {
        const url = options.url || options.appUrl || "";
        const appNative = addon.Instance.prototype.createPwa.call(
          this._native,
          {
            url,
            width: options.width || 0,
            height: options.height || 0
          }
        );
        return new App(appNative);
      }
      pollEvent() {
        return addon.Instance.prototype.pollEvent.call(this._native);
      }
      setCallback(callback, userData) {
        return result(addon.Instance.prototype.setCallback.call(this._native, callback, userData));
      }
      async close() {
        check(result(addon.destroyInstance(this._native)), "Failed to destroy instance");
      }
    };
    var App = class {
      constructor(native) {
        this._native = native;
      }
      executeJavaScript(code) {
        return result(addon.App.prototype.executeJavaScript.call(this._native, code));
      }
      setFPS(fps) {
        return result(addon.App.prototype.setFPS.call(this._native, fps));
      }
      getDevToolsUri() {
        return addon.App.prototype.getDevToolsUri.call(this._native);
      }
      setUserAgent(ua) {
        return result(addon.App.prototype.setUserAgent.call(this._native, ua));
      }
      getUserAgent() {
        return addon.App.prototype.getUserAgent.call(this._native);
      }
      setBounds(bounds) {
        return result(addon.App.prototype.setBounds.call(this._native, bounds));
      }
      getDensity() {
        return addon.App.prototype.getDensity.call(this._native);
      }
      setDensity(density) {
        return result(addon.App.prototype.setDensity.call(this._native, density));
      }
      getBounds() {
        return addon.App.prototype.getBounds.call(this._native);
      }
      destroyPwa() {
        return result(addon.App.prototype.destroyPwa.call(this._native));
      }
      setCallback(callback, userData) {
        return result(addon.App.prototype.setCallback.call(this._native, callback, userData));
      }
      async close() {
        check(this.destroyPwa(), "Failed to destroy PWA");
      }
    };
    function init(options) {
      let runtimePath = options && options.runtimePath;
      if (!runtimePath && !addon._runtimePathSet) {
        try {
          runtimePath = resolveRuntimePath();
        } catch (_) {
        }
      }
      if (runtimePath) {
        process.env.PWAOS_RUNTIME_PATH = runtimePath;
        addon.setRuntimeExecutablePath(runtimePath);
        addon._runtimePathSet = true;
      }
      const r = addon.init();
      return isPromise(r) ? r : r;
    }
    function shutdown() {
      const r = addon.shutDown();
      return isPromise(r) ? r : r;
    }
    function getCommandLine() {
      return addon.getCommandLine();
    }
    function resultToString(code) {
      return addon.resultToString(code);
    }
    function createInstance(options = {}) {
      const opts = typeof options === "string" ? { url: options } : options;
      const url = opts.url || opts.serverUrl || "";
      const r = addon.createInstance({
        url,
        dataPath: opts.dataPath || ""
      });
      if (isPromise(r)) {
        return r.then((native) => {
          if (!native) throw new Error("pwaos_createInstance returned no handle");
          return new Instance(native);
        });
      }
      if (!r) throw new Error("pwaos_createInstance returned no handle");
      return new Instance(r);
    }
    function createClient(options = {}) {
      const EventEmitter = require("events");
      const client = new EventEmitter();
      client.ready = false;
      let instance = null;
      client._ensureInstance = async function() {
        if (instance) return instance;
        const rt = options.runtimePath || resolveRuntimePath();
        await init({ runtimePath: rt });
        instance = await createInstance({ url: "http://localhost", dataPath: "" });
        client.ready = true;
        client.emit("ready");
        return instance;
      };
      client.invoke = async function(feature, args = {}) {
        const inst = await client._ensureInstance();
        client.emit("invoking", feature, args);
        const app = inst.createPwa({
          url: typeof feature === "string" && /^https?:/i.test(feature) ? feature : void 0,
          width: args && args.width || 800,
          height: args && args.height || 600
        });
        client.emit("result", feature, app);
        return app;
      };
      client.close = async function() {
        if (instance) await instance.close();
        instance = null;
        await shutdown();
      };
      return client;
    }
    try {
      const defaultRuntimePath = resolveRuntimePath();
      process.env.PWAOS_RUNTIME_PATH = defaultRuntimePath;
      addon.setRuntimeExecutablePath(defaultRuntimePath);
      module2.exports.PWAOS_RUNTIME_PATH = defaultRuntimePath;
    } catch (_) {
    }
    module2.exports = {
      // Ergonomic high-level API
      init,
      shutdown,
      createInstance,
      getCommandLine,
      resultToString,
      // RuntimeClient-style entry point
      createClient,
      // Binary resolution helpers (re-exported from lib/runtime-resolver)
      resolveRuntimePath,
      getPlatformPackageName,
      getBinaryName,
      // Class wrappers
      Instance,
      App,
      // Direct native access (full surface from binding.gyp exports)
      _addon: addon,
      // Re-export native result codes
      PWAOS_RESULT_SUCCESS: SUCCESS,
      PWAOS_RESULT_PENDING: addon.PWAOS_RESULT_PENDING,
      // The runtime directory this client is bound to (set eagerly at load
      // from the installed platform package, or by init()).
      get PWAOS_RUNTIME_PATH() {
        return process.env.PWAOS_RUNTIME_PATH || null;
      }
    };
  }
});

// sea-entry.js
var path = require("path");
var Module = require("module");
var exeDir = path.dirname(process.execPath);
var ADDON_PATH = path.join(
  exeDir,
  "node_modules",
  "@pwaos",
  "runtime-client",
  "build",
  "Release",
  "pwaos_addon.node"
);
var origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...rest) {
  if (request === "./build/Release/pwaos_addon.node") {
    return ADDON_PATH;
  }
  return origResolve.call(this, request, ...rest);
};
var pwaos = require_runtime_client();
var DEFAULT_APP_URL = "http://www.pwaos.net/webapps/browser/index.html";
var START_PAGE = process.env.BROWSER_URL || DEFAULT_APP_URL;
var POLL_MS = 100;
var INSTANCE_TIMEOUT_MS = 3e4;
var APP_TIMEOUT_MS = 3e4;
var instanceStatusWorking = pwaos._addon.Instance.instanceStatusWorking;
var appStatusSynchronized = pwaos._addon.App.appStatusSynchronized;
var appTypePwa = pwaos._addon.App.appTypePwa;
var TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED = pwaos._addon.PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED;
var TYPE_EVENT_DATA_APP_STATUS_CHANGED = pwaos._addon.PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED;
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
    console.log("\n[browser] shutting down...");
    try {
      if (app) {
        try {
          app.setCallback(null, null);
        } catch (_) {
        }
        try {
          await app.close();
        } catch (_) {
        }
      }
      if (instance) {
        try {
          await instance.close();
        } catch (_) {
        }
      }
      pwaos.shutdown();
    } catch (e) {
      console.error(`[browser] teardown error: ${e.message}`);
    }
    process.exit(code);
  }
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  try {
    const initResult = await pwaos.init();
    console.log(`[browser] init         : ${pwaos.resultToString(initResult)}`);
    instance = await pwaos.createInstance({
      url: "http://localhost",
      dataPath: path.join(exeDir, ".pwaos-data")
    });
    console.log("[browser] instance     : created");
    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED && ev.status === instanceStatusWorking,
      INSTANCE_TIMEOUT_MS,
      "instanceStatusWorking"
    );
    console.log("[browser] instance     : working");
    app = instance.createPwa({
      appType: appTypePwa,
      url: START_PAGE,
      width: 1280,
      height: 800
    });
    console.log(`[browser] app          : created -> ${START_PAGE}`);
    await pollUntil(
      instance,
      (ev) => ev.type === TYPE_EVENT_DATA_APP_STATUS_CHANGED && ev.status >= appStatusSynchronized,
      APP_TIMEOUT_MS,
      "appStatusSynchronized"
    );
    console.log("[browser] app          : synchronized (browser PWA is live)");
    console.log("[browser] running - press Ctrl+C to stop");
    setInterval(() => {
      let ev;
      do {
        ev = instance.pollEvent();
      } while (ev);
    }, POLL_MS);
  } catch (e) {
    console.error(`[browser] FATAL: ${e.message}`);
    await shutdown(1);
  }
}
main();
