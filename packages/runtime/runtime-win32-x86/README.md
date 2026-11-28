# @pwaos.net/runtime-win32-x86

PwaOS Runtime SDK distribution for **Windows x86 (32-bit)**.

This package is installed automatically as an optional dependency of
[@pwaos.net/runtime](https://www.npmjs.com/package/@pwaos.net/runtime). Do not install
it directly unless you are explicitly targeting Windows x86 (32-bit).

## Contents

After installation, the package is available at:

```text
node_modules/@pwaos.net/runtime-win32-x86/
  runtime/
    pwaos_server.exe          main runtime executable
    pwaos.pak                 runtime resource archive
    icudtl.dat                ICU data
    v8_context_snapshot.bin   V8 snapshot
    vk_swiftshader_icd.json   Vulkan ICD configuration
    locales/                  localization resources
    *.dll                     shared libraries required to run pwaos_server
  include/
    runtime_client_api.h      SDK header
  lib/
    win32/                    SDK library (runtime_client_api.lib / .dll)

Keep the entire runtime/ directory together. pwaos_server.exe loads the
resource files and shared libraries from its own directory at runtime.
Copying only the executable will cause it to fail to start.
