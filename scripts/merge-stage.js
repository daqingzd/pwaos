#!/usr/bin/env node
'use strict';

/**
 * merge-stage.js - copy the staged fetch output into the package directories.
 *
 * After `fetch-runtime.js --platform <p>` has staged a tree under
 * <stage>/<p>/, this script merges it into the matching npm package
 * directory so it can be published:
 *
 *   runtime-<platform>/runtime/            <- staged runtime bundle
 *   runtime-<platform>/runtime/            <- staged runtime bundle
 *   runtime-<platform>/include/, lib/      <- SDK consumer files
 *
 * The binary size is the dominant cost (pwaos_server is ~118MB; the full
 * bundle ~143MB, ~61MB gzipped inside the npm tarball - well under the
 * registry's per-package limits). The meta-package and the client stay tiny.
 *
 * Usage:
 *   node scripts/merge-stage.js --stage <dir> [--platform <p>] [--root <dir>]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLATFORM_PACKAGES = new Set([
  'runtime-linux-x64',
  'runtime-win32-x86',
  'runtime-win32-x64',
  // linux-arm64 and darwin are not supported yet (no matching upstream branches)
]);

// Platform packages are NESTED inside packages/runtime/ (2026-11-27).
function pkgDirFor(root, name) {
  const nested = path.join(root, 'runtime', name);
  if (fs.existsSync(path.join(nested, 'package.json'))) return nested;
  return path.join(root, name);
}

function parseArgs(argv) {
  const opts = { root: path.resolve(__dirname, '..', 'packages'), all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stage') opts.stage = argv[++i];
    else if (a === '--platform') opts.platforms = (opts.platforms || []).concat(argv[++i]);
    else if (a === '--all') opts.all = true;
    else if (a === '--root') opts.root = argv[++i];
  }
  if (!opts.stage) {
    console.error('merge-stage: --stage <dir> is required');
    process.exit(1);
  }
  if (opts.all) opts.platforms = [...PLATFORM_PACKAGES];
  if (!opts.platforms || !opts.platforms.length) {
    console.error('merge-stage: --platform <p> (repeatable) or --all is required');
    process.exit(1);
  }
  return opts;
}

function copyMerge(srcDir, dstDir) {
  // file(INSTALL)-style merge: copy the tree over an existing directory
  // without deleting unrelated files.
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyMerge(src, dst);
    } else {
      fs.copyFileSync(src, dst);
      if (entry.mode & 0o111) fs.chmodSync(dst, 0o755);
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  for (const platform of opts.platforms) {
    if (!PLATFORM_PACKAGES.has(`runtime-${platform}`)) {
      throw new Error(`unknown platform '${platform}'`);
    }
    const staged = path.join(opts.stage, platform);
    const pkgDir = pkgDirFor(opts.root, `runtime-${platform}`);
    if (!fs.existsSync(staged)) {
      throw new Error(`no staged tree at ${staged} - run fetch-runtime.js first`);
    }
    if (!fs.existsSync(path.join(pkgDir, 'package.json'))) {
      throw new Error(`not a package dir: ${pkgDir}`);
    }

    copyMerge(staged, pkgDir);

    // The executable lives inside runtime/ (pwaos_server + its resources);
    // there is no separate bin/pwaos-runtime: consumers resolve the runtime
    // DIRECTORY via @pwaos.net/runtime-client-api's resolver.
    const binDir = path.join(pkgDir, 'bin');
    if (fs.existsSync(binDir)) fs.rmSync(binDir, { recursive: true, force: true });

    // npm must include the binary + bundle: extend "files" if needed.
    const manifestPath = path.join(pkgDir, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const needed = ['runtime', 'include', 'lib'];
    const files = new Set(manifest.files || []);
    for (const n of needed) {
      if (fs.existsSync(path.join(pkgDir, n))) files.add(n);
    }
    manifest.files = [...files];
    jsonWrite(manifestPath, manifest);

    const serverName = platform.startsWith('win32')
      ? 'pwaos_server.exe' : 'pwaos_server';
    const serverPath = path.join(pkgDir, 'runtime', serverName);
    if (!fs.existsSync(serverPath)) {
      throw new Error(`no bundled runtime executable at runtime/${serverName}`);
    }
    // The server must be executable: git/npm tarballs strip the +x bit on
    // some pipelines, and without it execve fails with EACCES and the
    // client reports connection-lost (-2).
    fs.chmodSync(serverPath, 0o755);

    const sizeOf = (p) => {
      let total = 0;
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) walk(full);
          else total += fs.statSync(full).size;
        }
      };
      walk(p);
      return total;
    };
    console.log(`merge-stage: ${platform} merged. ` +
      `bundle=${(sizeOf(path.join(pkgDir, 'runtime')) / 1e6).toFixed(1)}MB, ` +
      `total pkg ~${(sizeOf(pkgDir) / 1e6).toFixed(1)}MB on disk ` +
      `(npm tarball gzips to roughly 40-45% of that)`);
  }
  return 0;
}

function jsonWrite(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

try {
  process.exitCode = main();
} catch (err) {
  console.error('merge-stage: FAILED -', err.message);
  process.exitCode = 1;
}
