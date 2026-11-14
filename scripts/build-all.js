#!/usr/bin/env node
'use strict';

/**
 * build-all.js - build one target package or all of them, from the root.
 *
 *   npm run build                          # all buildable packages, in order
 *   npm run build -- runtime-linux-x64     # a single target (repeatable)
 *   npm run build -- runtime-linux-x64 runtime-client-api
 *   npm run build -- --force               # refetch even when payload exists
 *   npm run build -- --list                # show packages + build status
 *
 * Target names: the directory under packages/ ("runtime-linux-x64"), the
 * npm name ("@pwaos.net/runtime-linux-x64"), or "all". The meta package
 * @pwaos.net/runtime has no build step (it carries no binaries) and is skipped
 * with a note.
 *
 * Build order = publish order: platform packages first, then
 * @pwaos.net/runtime-client-api. The client resolves SDK headers/libs (and the
 * runtime bundle) from the installed @pwaos.net/runtime-<os>-<cpu> package -
 * no download cache involved.
 *
 * Per-package work is delegated to each package's own build script:
 *   platform packages -> scripts/build-platform-pkg.js
 *                        (fetch SDK branch -> stage/ -> merge into the pkg;
 *                        skips when runtime/pwaos_server already exists
 *                        unless --force)
 *   runtime-client-api     -> init the addon/ submodule (if missing) +
 *                        node-gyp configure/build of the native addon
 *                        against the platform package's include/ + lib/
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PKGS_DIR = path.join(ROOT, 'packages');

function parseArgs(argv) {
  const opts = { targets: [], force: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') opts.force = true;
    else if (a === '--list') opts.list = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: npm run build [-- <target> ...] [--force] [--list]\n' +
        'Targets: all (default) | <dir under packages/> | @pwaos.net/<name>');
      process.exit(0);
    } else if (a.startsWith('-')) {
      console.error(`build-all: unknown option '${a}' (--help for usage)`);
      process.exit(1);
    } else {
      opts.targets.push(a);
    }
  }
  return opts;
}

/** All workspace packages: { dir, name, build } (build = script text). */
function enumeratePackages() {
  const out = [];
  for (const entry of fs.readdirSync(PKGS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(PKGS_DIR, entry.name, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      console.error(`build-all: cannot parse ${manifestPath}: ${err.message}`);
      process.exit(1);
    }
    out.push({
      dir: entry.name,
      name: manifest.name || entry.name,
      build: manifest.scripts && manifest.scripts.build || '',
    });
  }
  // Build order: platform packages, then everything else (client), stable.
  const rank = (p) => /^runtime-(linux|win|darwin)/.test(p.dir) ? 0 : 1;
  out.sort((a, b) => rank(a) - rank(b) || a.dir.localeCompare(b.dir));
  return out;
}

/** True when the platform package already carries its fetched payload. */
function payloadPresent(pkg) {
  const server = pkg.dir.startsWith('runtime-win32')
    ? 'pwaos_server.exe' : 'pwaos_server';
  return fs.existsSync(path.join(PKGS_DIR, pkg.dir, 'runtime', server));
}

/** True when the native addon binary already exists. */
function addonBuilt(pkg) {
  return fs.existsSync(path.join(PKGS_DIR, pkg.dir, 'build', 'Release',
    'pwaos_addon.node'));
}

function buildStatus(pkg) {
  if (!pkg.build) return 'no build step';
  if (/^runtime-(linux|win|darwin)/.test(pkg.dir)) {
    return payloadPresent(pkg) ? 'payload present (skip; --force refetches)'
      : 'fetch + merge needed';
  }
  if (pkg.dir === 'runtime-client-api') {
    return addonBuilt(pkg) ? 'addon built (rebuild only on --force or source change)'
      : 'node-gyp needed (uses the platform package payload)';
  }
  return 'build script present';
}

function resolveTargets(tokens, packages) {
  if (!tokens.length || tokens.includes('all')) {
    return packages.filter((p) => p.build);
  }
  const chosen = [];
  for (const token of tokens) {
    const bare = token.replace(/^@pwaos\.net\//, '');
    const hit = packages.find((p) => p.dir === bare || p.name === token);
    if (!hit) {
      console.error(`build-all: unknown target '${token}'. Buildable: ` +
        packages.filter((p) => p.build).map((p) => p.dir).join(', ') +
        ' (or "all")');
      process.exit(1);
    }
    if (!hit.build) {
      console.log(`build-all: ${hit.dir} has no build step - nothing to do`);
      continue;
    }
    if (!chosen.includes(hit)) chosen.push(hit);
  }
  return chosen;
}

function runPlatformBuild(pkg, force) {
  const args = [path.join('scripts', 'build-platform-pkg.js')];
  if (force) args.push('--force');
  const res = spawnSync('node', args, {
    stdio: 'inherit',
    cwd: ROOT,
    // npm_package_name leaks from the root npm run ("pwaos-npm-packages")
    // and would win over PKG_NAME inside build-platform-pkg.js - override
    // it with the actual target so the script resolves the right package.
    env: Object.assign({}, process.env, {
      PKG_NAME: pkg.dir,
      npm_package_name: `@pwaos.net/${pkg.dir}`,
    }),
  });
  return res.status || 0;
}

function runGenericBuild(pkg) {
  // Client (and any future package): run the package's own build script
  // via npm so its npm_package_* context is right. --force has no extra
  // effect here: node-gyp rebuild always recompiles.
  const res = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    cwd: path.join(PKGS_DIR, pkg.dir),
    env: Object.assign({}, process.env),
    shell: process.platform === 'win32',
  });
  return res.status || 0;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const packages = enumeratePackages();

  if (opts.list) {
    console.log('build-all: packages under packages/:');
    for (const p of packages) {
      console.log(`  ${p.dir.padEnd(22)} ${buildStatus(p)}`);
    }
    return 0;
  }

  const targets = resolveTargets(opts.targets, packages);
  if (!targets.length) {
    console.log('build-all: nothing buildable selected');
    return 0;
  }
  console.log(`build-all: building ${targets.map((t) => t.dir).join(', ')}` +
    (opts.force ? ' (--force)' : ''));

  const failed = [];
  for (const pkg of targets) {
    console.log(`\n== build-all: ${pkg.dir} ==`);
    const code = /^runtime-(linux|win|darwin)/.test(pkg.dir)
      ? runPlatformBuild(pkg, opts.force)
      : runGenericBuild(pkg);
    if (code !== 0) {
      console.error(`build-all: ${pkg.dir} FAILED (exit ${code})`);
      failed.push(pkg.dir);
    }
  }

  console.log(`\nbuild-all: ${targets.length - failed.length}/` +
    `${targets.length} target(s) built` +
    (failed.length ? ` - FAILED: ${failed.join(', ')}` : ''));
  return failed.length ? 1 : 0;
}

process.exitCode = main();
