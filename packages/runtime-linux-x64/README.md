# @pwaos.net/runtime-linux-x64

PwaOS Runtime SDK distribution for **Linux x64**.

This package is installed automatically as an optional dependency of
[@pwaos.net/runtime](https://www.npmjs.com/package/@pwaos.net/runtime). Do not install
it directly unless you are explicitly targeting Linux x64.

## Contents

After installation, the package is available at:

```text
node_modules/@pwaos.net/runtime-linux-x64/
  runtime/
    pwaos_server              main runtime executable
    pwaos.pak                 runtime resource archive
    icudtl.dat                ICU data
    v8_context_snapshot.bin   V8 snapshot
    vk_swiftshader_icd.json   Vulkan ICD configuration
    locales/                  localization resources
    lib*.so                   shared libraries required to run pwaos_server
  include/
    runtime_client_api.h      SDK header
  lib/
    linux/                    SDK library (runtime_client_api.so)

    Keep the entire runtime/ directory together. pwaos_server loads the
    resource files and shared libraries from its own directory at runtime.
    Copying only the executable will cause it to fail to start.

Platform Constraints

OS: Linux
CPU: x64
libc: glibc

On non-matching platforms, npm skips this package automatically.
License

MIT
