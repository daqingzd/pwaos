# @pwaos.net/runtime

**PwaOS Runtime distribution package — installs the PwaOS Runtime SDK
(pwaos_server executable, its resources, the shared libraries it needs, and
the runtime_client_api SDK library) for your platform.**

> **Most Node.js developers do not need to install this package manually.**
> Install [`@pwaos.net/runtime-client-api`](https://www.npmjs.com/package/@pwaos.net/runtime-client-api) instead.
> It automatically pulls in this package, resolves the correct Runtime SDK for
> your platform, and performs the runtime setup for you.

## Installation

```sh
npm install @pwaos.net/runtime
```

npm installs only the platform subpackage that matches your operating system
and CPU architecture. After installation, the Runtime SDK for your platform
is available at:

```text
node_modules/@pwaos.net/runtime-<platform>-<arch>/
|-- runtime/                  the runtime directory (must stay intact)
|   |-- pwaos_server          (pwaos_server.exe on Windows)
|   |-- pwaos.pak, icudtl.dat, v8_context_snapshot.bin,
|   |-- vk_swiftshader_icd.json, locales/
|   `-- *.so / *.dll          shared libraries pwaos_server needs next to it
|-- include/runtime_client_api.h
`-- lib/<os>/                 SDK library
                              (libpwaos_runtime_api.so on Linux,
                               pwaos_runtime_api.dll + .lib on Windows)
```

**Keep the entire `runtime/` directory together.** `pwaos_server` depends on
the resource files and shared libraries sitting next to it — copying the
executable alone is the most common deployment mistake.

No manual downloads: npm uses the `os` / `cpu` fields to install only the
subpackage matching your platform; all other platform packages are skipped
automatically.

## Platform Support

| OS      | Architecture | npm `cpu` | Package                        |
| ------- | ------------ | --------- | ------------------------------ |
| Linux   | x64          | `x64`     | `@pwaos.net/runtime-linux-x64` |
| Windows | x86 (32-bit) | `ia32`    | `@pwaos.net/runtime-win32-x86` |

The Windows upstream runtime is 32-bit, so its npm `cpu` field is `ia32`
(npm's name for x86 32-bit) — not `x86`. Consequently, on 64-bit Windows
(`win32-x64`) npm will not auto-install it: run
`npm install @pwaos.net/runtime-win32-x86` explicitly; the 32-bit runtime
runs on 64-bit Windows via WOW64, and `@pwaos.net/runtime-client-api`
detects and uses it automatically.

If your platform is not listed, `@pwaos.net/runtime-client-api` will not be
able to load the Runtime. Request a distribution for other platforms from
daqingzd@pwaos.net.

## Troubleshooting

### Runtime not found / pwaos_server fails to start

- No platform payload installed: check that `optionalDependencies` are not
  disabled (`--no-optional`, `--omit=optional`) — this package distributes
  the platform payloads through them. In CI, allow them, or install the
  platform package explicitly, e.g. `npm install @pwaos.net/runtime-linux-x64`.
- `pwaos_server` exits immediately: the `runtime/` directory was not kept
  intact (missing `*.pak` / `*.dat` / shared libraries next to the
  executable). Redeploy the whole directory.
- The runtime is somewhere else on disk: point your client at the Runtime
  **directory** (the one containing `pwaos_server`) via
  [`@pwaos.net/runtime-client-api`](https://www.npmjs.com/package/@pwaos.net/runtime-client-api)'s
  `setRuntimeExecutablePath(dir)` — never at the executable itself.

The package exposes no JavaScript API; `@pwaos.net/runtime-client-api` is
the layer that locates and sets up the runtime for you.

The version of `@pwaos.net/runtime` is kept in strict sync with the PwaOS
Runtime version, and all platform subpackages are exact-pinned (no `^`) for
ABI consistency; `@pwaos.net/runtime-client-api` declares a compatible
Runtime version range.

## License

MIT
