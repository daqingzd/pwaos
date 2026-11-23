# AI Agent Project Rules (AGENTS.md)

## 1. Project Overview
- Stack: Node.js >= 18, C/C++ native addon (N-API), node-gyp
- Package manager: npm
- Build: `node-gyp rebuild` (or prebuilt binaries)
- Publish target: npm registry (`@pwaos.net/*`)

## 2. Required (Do)

### Native addon (C/C++)
- Use C++17 and the Node-API (N-API) interface for all native exports.
- All exported functions must use `NAPI_MODULE` / `napi_*` macros to maintain ABI stability.
- Run `node-gyp rebuild` after modifying `binding.gyp` or any `.cc` / `.h` file.
- Keep platform-specific code isolated behind `#ifdef` guards; do not hardcode absolute paths or library names.
- Follow the project's existing `clang-format` style; no warnings allowed from `node-gyp rebuild`.

### JavaScript / TypeScript wrapper (if present)
- TypeScript strict mode is required for any `.ts` wrapper code; `any` is forbidden.
- All public APIs must be exported through `index.cjs` (CommonJS) and `index.mjs` (ESM), with matching type declarations (`.d.ts`).
- Use `createRequire` in ESM wrappers to load the native `.node` addon; do not use `import` directly on `.node` files.

### Build & test
- Run `npm run build` and `npm test` locally before every commit.
- New native features or exported APIs must include a test (node:test or the project's test runner).
- Never commit build artifacts: `build/`, `*.node`, `*.o`, `*.so`, `*.dll`, `*.dylib`.

### Package hygiene
- `package.json` fields `files`, `publishConfig`, `repository`, and `optionalDependencies` must not be changed without confirmation.
- Do not add or remove dependencies without confirmation.

## 3. Forbidden (Don't)
- Hardcoded colors or sizes
- Calling APIs directly inside components
- Leaving stray `console.log` statements
- Installing or removing dependencies without confirmation
- Running `git push`, deleting files, or publishing packages autonomously

## 4. Execution Permissions

### \u2705 Auto-approved (run without asking)
- Reading files, code search
- Formatting, linting, type-checking
- Running unit tests
- `npm run build` (local build only)
- `npm pack --dry-run` (dry-run inspection only)

### \u26a0\ufe0f Requires confirmation before execution
- `npm install` / `npm uninstall` / `npm update`
- Modifying core config files (`tsconfig.json`, `vite.config.ts`, `.npmrc`, `package.json` beyond dependency bumps)
- Deleting files
- `git commit`
- `git tag` (non-release tags)
- `npm version <patch|minor|major>` (version bump only, no publish)

### \U0001f6ab Human-only actions (agent must not perform, even with confirmation)
- `npm publish` (any package, any registry)
- `npm unpublish` / `npm deprecate`
- `npm dist-tag add|rm`
- `git push` (including force-push and branch deletion on remote)
- `git tag` on release branches
- Changing `publishConfig`, `files`, or `repository` fields in publishable packages
- Any command targeting a registry other than the local dev environment

## 5. Standard Project Structure

## 6. Error Handling
- Ask before proceeding when requirements are unclear
- Iterate in small steps; avoid bulk changes

## Communication

- **Always respond in English, regardless of the language used in the user's prompt or in any source code, comments, or documentation.**
- Do not switch to another language unless explicitly instructed by the user.
