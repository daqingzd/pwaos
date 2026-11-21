# @pwaos/shell

A terminal (shell) PWA that runs inside the [PwaOS Runtime](https://www.pwaos.net).
Modeled on `@pwaos/browser`: a tiny Node launcher opens the shell webapp
(`appTypeConsole`, loaded straight from disk over `file://` - no HTTP server),
while the shell engine runs in the host process.

## Feature provenance (deliberately borrowed)

| Inspiration | What was taken |
| --- | --- |
| busybox | one compact binary-ish builtin set: `ls cd cat echo mkdir rm touch cp mv wc head tail grep stat df ps date uname env which history clear alias hostname whoami sleep pwd version help exit` |
| fish | the prompt: `user@host cwd (git-branch)` with colors |
| bash | persistent history (`~/.pwaos-shell-history`, 1000 lines, up/down arrows, `!n` re-run, dedupe) |
| every modern shell | Tab completion (commands + paths, common-prefix), single-stage pipes (`cat f | grep x` works for `grep/head/tail/wc/sort`) |

## Install

```sh
npm install @pwaos/shell
```

Pulls in [`@pwaos/runtime-client`](https://www.npmjs.com/package/@pwaos/runtime-client),
which resolves the PwaOS Runtime binary for your platform.

## Usage

```sh
# Launch the shell window (host terminal is the keyboard):
npx pwaos-shell

# Pipe a script through it:
echo 'ls -la' | pwaos-shell
```

## v0.1 input model (important)

This shell works over the `file://` protocol with **zero network**, and on the
current runtime build `executeJavaScript` is fire-and-forget (it cannot return
the evaluated value) and there is no JS->host callback on the App surface.
Therefore:

- **host -> page** works: the engine's output is pushed into
  `window.pwaosShellInbox` and the xterm.js window renders everything
  (prompt, colors, history, output).
- **page -> host** is queued (`window.pwaosShellOutbox`) but not yet
  consumable, so **the keyboard is the terminal that launched the shell**
  (raw stdin). The runtime window is a live mirror of the session.

When a future runtime build adds an evaluation return value or a JS->host
channel, the only change needed is draining `window.pwaosShellOutbox` in
`main.js` - the webapp side is already wired for it.

## Environment

| Variable             | Default                                 | Purpose               |
| -------------------- | --------------------------------------- | --------------------- |
| `PWAOS_RUNTIME_PATH` | auto (from @pwaos/runtime platform pkg) | override runtime dir  |
| `HOME`               | -                                       | shell cwd + histfile  |

## Platform notes

- Linux x64 is the platform shipped by `@pwaos` today.
- The runtime refuses to start without a display; on headless hosts run
  `Xvfb :9 -screen 0 1280x1024x24` and export `DISPLAY=:9`.
- Only ONE runtime instance per process; after `shutdown()` the runtime
  cannot re-init in the same process.

## Tests

```sh
npm test   # 30+ engine unit tests - no runtime, no display needed
```

## License

MIT
