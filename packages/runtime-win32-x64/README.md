# @pwaos.net/runtime-win32-x64

PwaOS Runtime SDK distribution for **Windows x64**.

This package is installed automatically as an optional dependency of
[@pwaos.net/runtime](https://www.npmjs.com/package/@pwaos.net/runtime) on
`win32` + `x64` hosts. Do not install it directly unless you are explicitly
targeting Windows x64.

## 32-bit payload note

The upstream PwaOS Runtime SDK currently ships only a 32-bit (x86) Windows
payload. This package carries **that same 32-bit payload** — the binaries in
`runtime/` and `lib/win/` are byte-identical to
[@pwaos.net/runtime-win32-x86](https://www.npmjs.com/package/@pwaos.net/runtime-win32-x86)
— and it runs on x64 Windows through **WOW64** (verified on a real
win32-x64 machine). The package exists so npm's `os`/`cpu` filtering installs
the runtime automatically on x64 Windows hosts; the sibling
`runtime-win32-x86` package (declared `cpu: ia32`) is never auto-installed
there and must be installed explicitly.

When upstream publishes a native 64-bit win-x64 SDK, this package switches
to it; the directory layout and the resolver contract stay unchanged.

## Contents

After installation, the package is available at:

```text
node_modules/@pwaos.net/runtime-win32-x64/
  runtime/
    pwaos_server.exe          main runtime executable (32-bit, WOW64)
    pwaos.pak                 runtime resource archive
    icudtl.dat                ICU data
    v8_context_snapshot.bin   V8 snapshot
    vk_swiftshader_icd.json   Vulkan ICD configuration
    *.dll                     shared libraries required to run pwaos_server
  include/
    runtime_client_api.h      SDK header
  lib/
    win/                      SDK library (pwaos_runtime_api.lib / .dll)
```

Keep the entire runtime/ directory together. pwaos_server.exe loads the
resource files and shared libraries from its own directory at runtime.
Copying only the executable will cause it to fail to start.

## License

MIT
