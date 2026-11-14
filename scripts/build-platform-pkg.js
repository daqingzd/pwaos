#!/usr/bin/env node
'use strict';

/**
 * build-platform-pkg.js - per-package `npm run build` for the platform
 * packages: fetch the SDK payload (runtime/ + include/ + lib/) from git at
 * the branch encoded in this package's repository fragment
 * (git+https://github.com/daqingzd/pwaos.git#sdk-linux-x64-v0.2.1) and merge
 * it into the package directory.
 *
 * Usage (from the package dir):
 *   npm run build            # skip if runtime/pwaos_server already present
 *   npm run build -- --force # always fetch + merge, even when populated
 *
 * Env knobs (forwarded to scripts/fetch-runtime.js):
 *   PWAOS_SDK_REPO  PWAOS_SDK_BRANCH  PWAOS_SDK_VERSION
 *   PWAOS_DISCOVER_TIMEOUT_MS  PWAOS_LFS_TIMEOUT_MS
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// npm sets npm_package_name when run via `npm run build` in the package
// ("@pwaos.net/runtime-linux-x64"); PKG_NAME env is the manual override.
const PKG_NAME = (process.env.npm_package_name || '')
  .replace(/^@pwaos\.net\//, '') || process.env.PKG_NAME || '';
const PKG_DIR = path.resolve(ROOT, 'packages', PKG_NAME);
if (!PKG_DIR.startsWith(path.resolve(ROOT, 'packages') + path.sep) ||
    !fs.existsSync(path.join(PKG_DIR, 'package.json'))) {
  console.error('build-platform-pkg: run via `npm run build` inside a ' +
    'platform package under packages/ (got name: \'' + PKG_NAME + '\')');
  process.exit(1);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));

// Repo + branch from the package.json repository fragment:
//   git+https://github.com/daqingzd/pwaos.git#sdk-linux-x64-v0.2.1
const repoUrlRaw = manifest.repository && manifest.repository.url || '';
const hashIdx = repoUrlRaw.indexOf('#');
const repoUrl = (hashIdx >= 0 ? repoUrlRaw.slice(0, hashIdx) : repoUrlRaw)
  .replace(/^git\+/, '');
const ref = hashIdx >= 0 ? repoUrlRaw.slice(hashIdx + 1) : '';
let branch = process.env.PWAOS_SDK_BRANCH || null;
let wantVersion = process.env.PWAOS_SDK_VERSION || null;
if (!branch && /^v?\d/.test(ref)) {
  // Version fragment (sdk-linux-x64-v0.2.1): pin the branch by version so a
  // force-fetched tip can't silently drift to a newer 0.2.x.
  const m = ref.match(/^(.*)-v([^v]+)$/);
  if (m) {
    branch = m[1];              // e.g. sdk-linux-x64
    wantVersion = m[2];         // e.g. 0.2.1
  }
} else if (!branch && ref) {
  branch = ref;
}
if (branch) {
  process.env.PWAOS_SDK_BRANCH = branch;
}
if (wantVersion) {
  process.env.PWAOS_SDK_VERSION = wantVersion;
}
if (repoUrl) {
  process.env.PWAOS_SDK_REPO = process.env.PWAOS_SDK_REPO || repoUrl;
}

// --force refetches even when the payload exists; default skips if present.
// Both `npm run build -- --force` (argv) and `npm run build --force`
// (npm swallows the flag but exposes it as npm_config_force=true) work.
const force = process.argv.includes('--force') ||
  ['true', ''].includes(process.env.npm_config_force);
const serverName = PKG_NAME.startsWith('runtime-win32')
  ? 'pwaos_server.exe' : 'pwaos_server';
const serverPath = path.join(PKG_DIR, 'runtime', serverName);
if (!force && fs.existsSync(serverPath)) {
  console.log(`build-platform-pkg: ${PKG_NAME} already has ` +
    `runtime/${serverName} - skipping (use -- --force to refetch)`);
  process.exit(0);
}

// fetch-runtime: the platform key is the package dir name minus 'runtime-'.
const platform = PKG_NAME.replace(/^runtime-/, '');
const stage = path.join(ROOT, 'stage');
fs.mkdirSync(stage, { recursive: true });
// Reuse an existing clone (partially downloaded LFS objects survive a
// re-fetch); the commit is still re-verified against the live branch tip.
const cloneDir = path.join(stage, '.clone', platform);
const resumeArgs = fs.existsSync(path.join(cloneDir, '.git'))
  ? ['--resume'] : [];

function run(cmd, args, env) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT,
    env: Object.assign({}, process.env, env || {}),
  });
  if (res.error || res.status !== 0) {
    console.error(`build-platform-pkg: ${cmd} ${args.join(' ')} failed` +
      (res.error ? ` (${res.error.message})` : ''));
    process.exit(res.status || 1);
  }
}

run('node', [path.join('scripts', 'fetch-runtime.js'),
  '--platform', platform, '--out', stage, ...resumeArgs], {
  PWAOS_DISCOVER_TIMEOUT_MS: process.env.PWAOS_DISCOVER_TIMEOUT_MS || '600000',
  PWAOS_LFS_TIMEOUT_MS: process.env.PWAOS_LFS_TIMEOUT_MS || '10800000',
});
run('node', [path.join('scripts', 'merge-stage.js'),
  '--stage', stage, '--platform', platform]);

console.log(`build-platform-pkg: ${PKG_NAME} ready ` +
  `(from ${repoUrl}${branch ? '#' + branch : ''})`);
