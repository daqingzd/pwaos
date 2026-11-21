# @pwaos/browser

Runs the PwaOS Browser PWA as an app inside the PwaOS Runtime. The webapp is
loaded from `http://www.pwaos.net/webapps/browser` - no bundling, no local
server.

## Install

```sh
npm install @pwaos/browser
```

Pulls in [`@pwaos.net/runtime-client-api`](https://www.npmjs.com/package/@pwaos.net/runtime-client-api),
which resolves the PwaOS Runtime SDK for your platform (see its platform
support table) and performs the runtime setup at require time.

## Usage

```sh
# Launch the browser PWA in a PwaOS Runtime window:
npx pwaos-browser

# or programmatically:
node -e "require('@pwaos/browser')"
```

`main.js` flow (the client's export surface IS the native addon):
`addon.init()` the runtime -> `addon.createInstance({...})` ->
`instance.createPwa({ type, appType: Pwa, appUrl })` -> poll events until the
app is live -> stay alive until Ctrl+C.

Environment:

| Variable             | Default                                           | Purpose              |
| -------------------- | ------------------------------------------------- | -------------------- |
| `BROWSER_URL`        | `http://www.pwaos.net/webapps/browser/index.html` | page to open         |
| `PWAOS_RUNTIME_PATH` | auto (from the @pwaos.net/runtime platform pkg)   | override runtime dir |

## Platform notes

- Linux x64 is the only platform shipped today. On Windows the runtime is
  32-bit (`@pwaos.net/runtime-win32-x86`, npm `cpu: ia32`; runs on 64-bit
  Windows via WOW64) - install it explicitly.
- The runtime refuses to start without a display; on headless hosts run
  `Xvfb :9 -screen 0 1280x1024x24` and export `DISPLAY=:9`.
- Only ONE runtime instance per process; after `shutDown()` the runtime
  cannot re-init in the same process.

## Single Executable (SEA)

`sea/build.sh` (Linux) and `sea/build-win32.ps1` (Windows) produce a single
executable with the app embedded - see `sea/README.md`. Artifacts land in
`sea/out/<platform>-<arch>/`: the executable plus `node_modules/` beside it
(the PwaOS native addon cannot be embedded in the SEA blob).

## Development (inside this monorepo)

For local development, install the monorepo workspaces once - Node's
resolution walks up to the root `node_modules`, where the workspace links
provide `@pwaos.net/runtime-client-api`, `@pwaos.net/runtime`, and the
platform packages:

```sh
cd /workspace/iop/npmjs/pwaos && npm install --force   # workspace links
cd packages/browser && npm run start
```

`npm pack --dry-run` shows the published artifact: only `main.js`,
`README.md`, and `LICENSE` - no dev files.
