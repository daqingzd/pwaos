#!/usr/bin/env node
'use strict';

/**
 * clean.js - remove downloaded-SDK and build artifacts from the monorepo.
 *
 * Deletes only regenerable output: the fetch staging tree, the merged SDK
 * payload inside the platform packages (re-fetchable via `npm run build`),
 * node-gyp build output, SEA bundle artifacts, npm pack tarballs, and the
 * server-run
 * pollution (pwaos_server.log + runtime/locales/) that must not ship in a
 * tarball.
 *
 * Usage:
 *   node scripts/clean.js [--dry-run] [--all] [--tmp]
 *
 *   --dry-run  list what would be deleted, delete nothing
 *   --all      also remove EVERYTHING regenerable, including the merged
 *              platform payloads (runtime/, include/, lib/ - same as the
 *              default, kept as an explicit alias)
 *   --tmp      also remove pwaos-* temp dirs/files in the system tmpdir
 *              (fetch stage dirs, verify-before-publish tarball/consumer)
 *
 * Safety: nothing that is git-tracked is ever deleted - each target is
 * checked against `git ls-files` first and skipped with a warning if a
 * tracked file would be affected.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = { dryRun: false, all: false, tmp: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '-n') opts.dryRun = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--tmp') opts.tmp = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/clean.js [--dry-run] [--all] [--tmp]');
      process.exit(0);
    } else {
      console.error(`clean: unknown option '${a}' (--help for usage)`);
      process.exit(1);
    }
  }
  return opts;
}

/** All repo-relative paths git tracks; empty when git is unavailable. */
function trackedSet() {
  const res = spawnSync('git', ['ls-files', '-z'], {
    encoding: 'buffer',
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) return null;
  const set = new Set();
  for (const entry of res.stdout.toString().split('\0')) {
    if (entry) set.add(entry);
  }
  return set;
}

function walkFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function sizeOf(p) {
  let total = 0;
  const st = fs.lstatSync(p);
  if (st.isFile() || st.isSymbolicLink()) return st.size;
  const files = [];
  walkFiles(p, files);
  for (const f of files) {
    try { total += fs.lstatSync(f).size; } catch { /* raced */ }
  }
  return total;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/**
 * A target is safe only if NO file under it is git-tracked. Checking the
 * target path itself is not enough for directories - `git ls-files` output
 * lists files, and a dir like runtime/ may contain both tracked and
 * generated entries.
 */
function guardTracked(target, tracked) {
  if (!tracked) return true; // no git info: fall back to path check below
  const rel = path.relative(ROOT, target);
  if (tracked.has(rel)) return false;
  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    const files = [];
    walkFiles(target, files);
    for (const f of files) {
      if (tracked.has(path.relative(ROOT, f))) return false;
    }
  }
  return true;
}

/** npm pack tarballs anywhere in the repo (pruning node_modules/.git). */
function findTarballs() {
  const hits = [];
  const SKIP = new Set(['node_modules', '.git']);
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.tgz')) hits.push(full);
    }
  };
  walk(ROOT);
  return hits;
}

function collectTargets(opts) {
  const targets = [];
  const add = (label, p) => targets.push({ label, path: p });
  const pkg = (...seg) => path.join(ROOT, 'packages', ...seg);
  // Platform packages are NESTED inside packages/runtime/ (2026-11-27);
  // a legacy packages/<name> layout is still scanned for compatibility.
  const platformPkgs = [];
  for (const base of ['runtime', '']) {
    for (const e of fs.readdirSync(pkg(base), { withFileTypes: true })) {
      if (!e.isDirectory() || !e.name.startsWith('runtime-')) continue;
      if (e.name === 'runtime-client-api') continue;
      // 'runtime' itself is the meta package, not a platform pkg.
      if (e.name === 'runtime') continue;
      platformPkgs.push(base ? `${base}/${e.name}` : e.name);
    }
  }

  // 1. Downloaded SDK: fetch staging tree (stage/<p>/ + stage/.clone/<p>/).
  add('fetch staging + LFS clone cache (stage/)', path.join(ROOT, 'stage'));

  // 2. The merged SDK payload inside the platform packages: downloaded
  //    from upstream git by fetch-runtime, re-fetchable via
  //    `npm run build` (per-package or via build-all). NOT runtime-client-api/
  //    src - that is addon SOURCE, not an artifact.
  for (const name of platformPkgs) {
    for (const sub of ['runtime', 'include', 'lib']) {
      const p = pkg(name, sub);
      if (fs.existsSync(p)) {
        add(`merged SDK payload (packages/${name}/${sub}/)`, p);
      }
    }
  }

  // 3. runtime-client-api addon sources now live in the addon/ git
  //    submodule (pwaos-node-addon#main) - never deleted, restored with
  //    `git submodule update --init addon`.

  // 4. Build outputs.
  add('node-gyp build output (runtime-client-api/build/)',
    pkg('runtime-client-api', 'build'));
  for (const f of ['pwaos_addon.node', 'pwaos_runtime_client.node']) {
    const pf = pkg('runtime-client-api', 'prebuilds', f);
    if (fs.existsSync(pf)) add('generated prebuild (runtime-client-api/prebuilds/)', pf);
  }
  add('SEA bundle artifacts (browser/sea/out/)', pkg('browser', 'sea', 'out'));
  add('SEA prep blob (browser/sea/sea-prep.blob)',
    pkg('browser', 'sea', 'sea-prep.blob'));

  // 4. npm pack tarballs.
  for (const t of findTarballs()) add('npm pack tarball', t);

  // 6. Server-run pollution inside platform packages (must not ship in the
  //    tarball: files includes runtime/).
  for (const name of platformPkgs) {
    const log = pkg(name, 'runtime', 'pwaos_server.log');
    if (fs.existsSync(log)) add('server log (runtime/pwaos_server.log)', log);
    const locales = pkg(name, 'runtime', 'locales');
    if (fs.existsSync(locales)) add('server-run locales/ (runtime/locales)', locales);
  }

  // 7. Browser app run-state.
  add('browser app data (browser/.pwaos-data/)', pkg('browser', '.pwaos-data'));

  return targets;
}

/**
 * pwaos-* temp dirs/files left by fetch/verify/test runs. Scans /tmp even
 * when TMPDIR points elsewhere (agents/sandboxes often override TMPDIR, but
 * git, curl and the shell still write to /tmp).
 */
function tmpTargets() {
  const seen = new Set(['/tmp', os.tmpdir()]);
  const names = new Set();
  for (const tmp of seen) {
    let entries = [];
    try {
      entries = fs.readdirSync(tmp);
    } catch {
      continue;
    }
    for (const n of entries) {
      if (/^pwaos/i.test(n)) names.add(n);
    }
  }
  return [...names].map((n) => ({
    label: `system tmp: ${n}`,
    // Prefer /tmp; if only TMPDIR has it, that path is used by the dedupe.
    path: fs.existsSync(path.join('/tmp', n))
      ? path.join('/tmp', n) : path.join(os.tmpdir(), n),
  }));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tracked = trackedSet();

  const targets = collectTargets(opts);
  if (opts.tmp) targets.push(...tmpTargets());

  let freed = 0;
  let count = 0;
  for (const target of targets) {
    if (!fs.existsSync(target.path) &&
        !fs.lstatSync(target.path, { throwIfNoEntry: false })) continue;
    if (!guardTracked(target.path, tracked)) {
      console.log(`clean: SKIP (contains git-tracked files) ${target.path}`);
      continue;
    }
    const bytes = sizeOf(target.path);
    if (opts.dryRun) {
      console.log(`clean: would delete ${target.label} - ` +
        `${target.path} (${(bytes / 1e6).toFixed(1)}MB)`);
    } else {
      rmrf(target.path);
      console.log(`clean: deleted ${target.label} ` +
        `(${(bytes / 1e6).toFixed(1)}MB)`);
    }
    freed += bytes;
    count++;
  }

  const tag = opts.dryRun ? 'would free' : 'freed';
  console.log(`clean: ${count} target(s), ${tag} ` +
    `${(freed / 1e6).toFixed(1)}MB (${(freed / 2 ** 20).toFixed(0)}MiB)` +
    (opts.dryRun ? ' [dry run - pass no flags to delete]' : ''));
  return 0;
}

process.exitCode = main();
