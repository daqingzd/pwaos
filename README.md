# pwaos-npm-packages

npm workspaces monorepo for the `@pwaos.net` packages - npm distribution of the
PwaOS Runtime following the platform-subpackage pattern used by esbuild,
Biome, and Sentry CLI.

## Cloning this repository

`packages/runtime-client-api` is a git submodule
(github.com/daqingzd/pwaos-node-addon.git). Clone with submodules in one
step:

```sh
git clone --recurse-submodules git@github.com:daqingzd/pwaos.git
cd pwaos

# ...or, for an existing clone:
git submodule update --init --depth 1 packages/runtime-client-api
```

The submodule is pinned in the monorepo commit (gitlink at
`packages/runtime-client-api`); `git submodule update --init` checks out
exactly that revision. To move the pin to a newer addon commit:

```sh
cd packages/runtime-client-api && git fetch && git checkout <commit-or-main>
cd ../.. && git add packages/runtime-client-api
git commit -m "Bump runtime-client-api submodule"
```

If `packages/runtime-client-api/` is empty after cloning, the gitlink was
not registered in the checked-out commit - run
`git submodule update --init packages/runtime-client-api` (it reads
`.gitmodules` and the gitlink); do NOT create the directory by hand.

## Directory structure

```
pwaos-npm-packages/                    <- repo root
├── package.json                       <- root package.json, declares workspaces
├── .npmrc                             <- optional, unified registry / access config
├── README.md
├── packages/
│   ├── runtime/                       <- @pwaos.net/runtime (main package)
│   │   ├── package.json
│   │   └── README.md
│   ├── runtime-linux-x64/             <- @pwaos.net/runtime-linux-x64
│   │   ├── package.json
│   │   ├── README.md
│   │   └── runtime/                   <- runtime bundle (pwaos_server + resources)
│   ├── runtime-win32-x86/             <- @pwaos.net/runtime-win32-x86
│   └── runtime-client-api/            <- git submodule: pwaos-node-addon.git
│       │                                  IS the @pwaos.net/runtime-client-api package
│       ├── runtime.cjs / runtime.js   <- CJS + ESM entry points (exports the addon)
│       ├── package.json
│       ├── README.md
│       ├── binding.gyp
│       ├── src/                       <- addon C++ sources (built from here)
│       └── scripts/                   <- SDK/runtime resolution helpers
└── scripts/
    ├── build-all.js                   <- root `npm run build`: one target or all
    ├── fetch-runtime.js               <- fetches per-platform binaries from GitHub
    ├── build-platform-pkg.js          <- per-package `npm run build` (fetch+merge, --force)
    ├── merge-stage.js                 <- merges fetched trees into the package dirs
    ├── clean.js                       <- removes fetch/build/temp artifacts (--dry-run first)
    ├── publish-all.sh                 <- publishes in the correct order
    └── verify-before-publish.sh       <- packs tarballs + verifies in an isolated consumer
```

Each subdirectory is an independent npm package: `packages/runtime/` and
`packages/runtime-linux-x64/` are siblings; `@pwaos.net/runtime` contains only its
own `package.json` and README - no platform subpackages inside it.

> **Note:** the platform subpackages carry strict `os`/`cpu` fields, so a
> plain `npm install` at the repo root fails with `EBADPLATFORM` when the
> workspaces graph includes the other platforms' packages. Use
> `npm install --force` for local development; the published packages are
> unaffected (npm applies `os`/`cpu` filtering per consumer install, verified
> by `npm run verify-before-publish`).

npm reads
each subdirectory's `package.json` and uploads independent tarballs; the
relationship between them is declared only in `@pwaos.net/runtime`'s
`optionalDependencies`.

## Key points

1. The root `package.json` is `"private": true` so the root itself is never
   published.
2. `@pwaos.net/runtime` carries no binaries: its `files` is
   `["package.json", "README.md"]`.
3. Platform packages carry exactly their own runtime bundle
   (`files: ["runtime", "include", "lib"]`, plus `os`/`cpu`/`libc`).
4. `optionalDependencies` resolve by registry package name, not by physical
   directory layout - nesting platform packages inside the meta-package
   directory is wrong and breaks `npm pack` / dependency resolution.

## Building

One entry point builds one target or all of them:

```sh
npm run build                          # all buildable packages, in publish order
npm run build -- runtime-linux-x64     # a single target (repeatable)
npm run build -- @pwaos.net/runtime-client-api # same, by npm name
npm run build -- --force               # refetch even when the payload exists
npm run build -- --list                # what is buildable + current status
```

What each target does:

- `runtime-linux-x64`, `runtime-win32-x86` (platform packages): fetch the SDK
  branch from the package.json repository fragment (git + LFS) into `stage/`,
  then merge it into the package. Skips when `runtime/pwaos_server` already
  exists; `--force` refetches.
- `runtime-client-api`: `node-gyp configure && node-gyp build` inside the
  submodule checkout (https://github.com/daqingzd/pwaos-node-addon.git#main -
  the repo IS the npm package). It compiles its own `src/` against the
  `include/` + `lib/` of the installed `@pwaos.net/runtime-<os>-<cpu>` package -
  the same package that ships the runtime bundle. Build the platform package
  first (build order does).
- `runtime` (meta package): no build step - skipped with a note.

Build order = publish order: platform packages, then `runtime-client-api`.

## CI/CD flow

```sh
# 1+2. Build everything (or a single package) from the root:
npm run build -- --force

#    ...or the manual two-step for one platform:
node scripts/fetch-runtime.js --platform linux-x64 --out stage
node scripts/merge-stage.js --stage stage --platform linux-x64

# 3. Publish in order: 2 platform subpackages -> @pwaos.net/runtime -> @pwaos.net/runtime-client-api
bash scripts/publish-all.sh            # or: npm publish --workspace=... per package
```

## Pre-publish verification

`npm pack` tarballs are byte-identical to what `npm publish` uploads, so the
most reliable validation before publishing is to pack every package, install
the tarballs via `file:` into a brand-new consumer project isolated from this
monorepo, and exercise the chain there. `npm link` cannot do this: symlinks
bypass the `files` filter and never exercise install hooks.

```sh
npm run verify-before-publish
```

The script checks, in order:

1. `npm pack --dry-run` per package - no unexpected files (`src/`,
   `node_modules/`, tests, `.env`);
2. `@pwaos.net/runtime`'s tarball contains no platform binaries;
3. platform tarballs contain only the runtime bundle + SDK files;
4. tarballs install via `file:` into an isolated consumer;
5. `require('@pwaos.net/runtime-client-api')` creates a client;
6. the resolver finds the platform binary;
7. non-matching platform subpackages were correctly skipped (`os`/`cpu`);
8. tarball sizes stay within npm's limits;
9. `publint` runs against the meta-package when available.

Do not trust "local require works" as "published will work" - only a tarball
installed in a clean environment counts as verified.

### Publishing workspaces from the root

```sh
npm publish --workspace=@pwaos.net/runtime-linux-x64
npm publish --workspace=@pwaos.net/runtime-win32-x86
npm publish --workspace=@pwaos.net/runtime
npm publish --workspace=@pwaos.net/runtime-client-api
```

Or per-directory (`cd packages/runtime-linux-x64 && npm publish`). The order
never changes: 2 platform subpackages -> @pwaos.net/runtime -> @pwaos.net/runtime-client-api.
Linux arm64 and macOS (darwin) are not supported yet - upstream publishes no
matching SDK branches; add the platform packages when that changes.

### Workspaces install note

`npm install` at the root validates every workspace's `os`/`cpu` fields
against the current platform and errors with EBADPLATFORM for the others.
Use `npm install --force` for local workspace linking (publishing is
unaffected; the registry filters by os/cpu at consumer install time).

## Cleaning downloaded / build artifacts

The SDK payload (~290MB staged, ~280MB merged per platform) and the build
outputs regenerate locally, so they can be deleted to reclaim disk space:

```sh
npm run clean -- --dry-run   # list what would go (default: no --tmp)
npm run clean                # delete stage/, the merged SDK payload in each
                             #   platform package (runtime/, include/, lib/
                             #   - re-fetch with `npm run build`), node-gyp
                             #   build output, *.tgz, server-run pollution
                             #   (pwaos_server.log, runtime/locales/),
                             #   browser .pwaos-data/
npm run clean -- --all       # same as the default (kept as an explicit alias)
npm run clean -- --tmp       # ALSO remove pwaos-* temp dirs in /tmp (old
                             #   fetch stages, tarball/consumer dirs, probes)
```

`scripts/clean.js` never deletes git-tracked files (each target is checked
against `git ls-files` first).

## Addon sources

`packages/runtime-client-api` IS the pwaos-node-addon git submodule
(https://github.com/daqingzd/pwaos-node-addon.git, branch `main`) - the
npm client package and the addon C++ sources (`src/`) live in the same
repo. The pin (gitlink) lives in the monorepo commits - see
[Cloning this repository](#cloning-this-repository) above for the
clone/update commands.

## Versioning

- `@pwaos.net/runtime` version == PwaOS Runtime version (strict sync).
- Platform subpackages are exact-pinned by the meta-package (no `^`).
- `@pwaos.net/runtime-client-api` versions independently and declares a compatible
  `@pwaos.net/runtime` range.

## License

All packages are MIT licensed.
