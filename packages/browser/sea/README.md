# SEA (Single Executable Application) build

Builds `@pwaos/browser` into a single executable with the Node.js SEA
mechanism (node >= 20; tested on v26).

## Layout

```
sea-entry.js        source entry (addon loaded via a dlopen shim)
build-sea.js        esbuild bundling (plugin maps the .node require -> dlopen shim)
sea-bundle.js       generated bundle (input to the SEA blob)
sea-config.json     SEA config (main: sea-bundle.js)
sea-prep.blob       generated SEA blob (platform-independent - JS only)
build.sh            linux/darwin build (runs on the host)
build-win32.ps1     windows build (run ON Windows; needs MSVC for node-gyp)
out/<platform>-<arch>/   the distributable:
    pwaos-browser(.exe)      single executable (Node + embedded app)
    node_modules/@pwaos/     runtime-client (+ native addon), runtime,
                             runtime-<platform>-<arch> (pwaos_server + resources)
```

## Why node_modules ships beside the executable

The PwaOS native addon (`pwaos_addon.node`) cannot be embedded in the SEA
blob - native addons must be loaded from disk (`process.dlopen`). The client
wrapper and the runtime binaries are therefore shipped as real files next to
the executable; the SEA entry loads the addon via an absolute path derived
from `process.execPath`.

## Linux x64 (verified)

```sh
./sea/build.sh
cd sea/out/linux-x64 && DISPLAY=:9 ./pwaos-browser
```

Verified end-to-end against the 0.2.a.2 runtime: init RESULT_SUCCESS ->
instance working -> app synchronized (PWA loaded from
http://www.pwaos.net/webapps/browser).

## Windows x64 (prepared, needs one Windows step)

`out/win32-x64/pwaos-browser.exe` is already injected with the SEA blob (done
from Linux with postject; the Authenticode signature warning is expected).
The remaining gap is the native addon: `pwaos_addon.node` for win32 must be
compiled with node-gyp on a Windows host (MSVC) against
`@pwaos/runtime-win32-x86/lib/win/pwaos_runtime_api.dll` - run
`sea/build-win32.ps1` on Windows to finish the bundle.

Distribution: zip `out/win32-x64/` (exe + node_modules); the runtime needs
`pwaos_server.exe` + its resources from `@pwaos/runtime-win32-x86/runtime/`
and `pwaos_runtime_api.dll` beside the addon.
