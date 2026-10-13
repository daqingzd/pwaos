Release notes for pwaos_sdk 0.2.a
===============================
Tested on Ubuntu 18.04, Ubuntu 22.04, and Windows 10.

This release demonstrates:

- Runtime Architecture
  PWAOS Runtime is built on a Service-Oriented Architecture (SOA), implemented as `pwaos_server`. It provides two client interfaces:
  - C ABI: a stable, versioned C ABI for native clients. C/C++ and other languages (via C interop) interact using handles, explicit error codes, extensible struct chains, callbacks, and event polling.
  - Webapp: JavaScript clients access runtime services via Mojo.
  The runtime is language- and backend-neutral, supports flexible threading and optional Mojo integration, and is independent of any specific process model.

- PWA Support
  Easily build various web applications using the runtime's PWA capabilities. Run them as native desktop, browser, console/shell, or headless apps.

- Embedder API support for C++
  C++ host apps can embed the runtime directly into their process, integrating PWA capabilities with custom windowing, input, and rendering pipelines.

- Runtime C ABI (C) highlights:
1. Instance lifecycle: init/shutdown, create/destroy, properties, runtime path, command line, status callbacks.
2. App management: create/destroy PWA apps (native, browser, console, desktop, headless); set URL and size.
3. JavaScript bridge: add/remove JS interfaces, define native methods/properties.
4. Window/input: bounds, pointer/mouse/Android events, execute JS, FPS, density, input method.
5. Developer tools: DevTools URI.
6. User Agent: get/set.
7. Network proxy: DIRECT, AUTO_DETECT, PAC_SCRIPT, FIXED_SERVERS, SYSTEM.
8. Projection API: create/destroy projectors, offscreen/native widget rendering, multiple backends, draw allbacks.
9. Event polling: `pwaosInstance_pollEvent` for status changes and stopping reasons.
10. Cross-platform: Windows, Linux, Android; auto graphics API detection.

Release notes for pwaos_sdk 0.1
===============================
Tested on the ubuntu 18.04,22.04 and windows 10
To demonstrate the following capabilities:

1. Service-Oriented Architecture
2. Client API support C++/javascript, other languages is coming (java, rust, mojo, c#, etc...)
