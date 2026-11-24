#!/usr/bin/env node
'use strict';

/**
 * fetch-runtime.js - CI/CD binary preparation for the @pwaos packages.
 *
 * The PwaOS SDK is published as git branches on
 * GitHub, one per os/arch target (sdk-<os>-<arch>-v<version>). This script
 * resolves the branch tip live on every run (no sha pins - git is the
 * integrity layer), shallow-fetches exactly that commit, and materializes
 * the Git LFS objects (runtime/pwaos_server is an LFS pointer of ~130MB).
 *
 * Usage:
 *   node scripts/fetch-runtime.js --platform linux-x64 [--version 0.2.a.0]
 *       [--out <dir>] [--repo <url>]
 *
 * Output: <out>/<platform>/ containing the ready-to-package files:
 *   runtime/                     the full runtime bundle (resources the
 *                                executable loads relative to its own path)
 *   include/ + lib/              SDK consumer files (header + client lib)
 *
 * Environment:
 *   PWAOS_SDK_REPO              override the repository URL
 *   PWAOS_SDK_BRANCH            force a branch name (skips discovery)
 *   PWAOS_DISCOVER_TIMEOUT_MS   git discovery timeout (default 45s)
 *   PWAOS_LFS_TIMEOUT_MS        git lfs pull timeout (default 60min)
 *
 *   --resume reuses an existing <out>/.clone/<platform> instead of wiping it,
 *   so an interrupted run's partially downloaded LFS objects are kept.
 */

'use strict';

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO = process.env.PWAOS_SDK_REPO ||
  'https://github.com/daqingzd/pwaos.git';
// 45s is fine on CI; slow networks (TLS setup taking minutes) need more -
// override with PWAOS_DISCOVER_TIMEOUT_MS (milliseconds).
const DISCOVER_TIMEOUT_MS =
  parseInt(process.env.PWAOS_DISCOVER_TIMEOUT_MS, 10) || 45 * 1000;
const FETCH_TIMEOUT_MS = 60 * 60 * 1000;
// git lfs pull on a slow link can outlive the generic fetch timeout; override
// with PWAOS_LFS_TIMEOUT_MS (milliseconds).
const LFS_TIMEOUT_MS =
  parseInt(process.env.PWAOS_LFS_TIMEOUT_MS, 10) || FETCH_TIMEOUT_MS;

// npm platform key -> upstream SDK branch components.
// The branch scheme is fixed by upstream: sdk-<os>-<arch>-v<version>
// (os/arch use the SDK naming: linux/darwin/win + x64/arm64/x86).
const PLATFORMS = {
  'linux-x64': { sdkOs: 'linux', sdkArch: 'x64' },
  // npm cpu for 32-bit x86 Windows is "ia32"; the upstream SDK branch is
  // named win-x86 (32-bit). The runtime runs on 64-bit Windows via WOW64.
  'win32-x86': { sdkOs: 'win', sdkArch: 'x86' },
  // The win32-x64 package carries the same 32-bit upstream payload (x64
  // Windows runs it via WOW64): same SDK branch, shared clone dir, staged
  // under its own platform key.
  'win32-x64': { sdkOs: 'win', sdkArch: 'x86', cloneAs: 'win32-x86' },
  // linux-arm64 and darwin are not supported yet: upstream publishes no
  // sdk-linux-arm64-* / sdk-darwin-* branches
};

/** Dotted-version compare tolerating non-numeric segments ("0.2.a.2"). */
function cmpVersion(a, b) {
  const ka = a.split('.').map((s) => (/^\d+$/.test(s) ? parseInt(s, 10) : s));
  const kb = b.split('.').map((s) => (/^\d+$/.test(s) ? parseInt(s, 10) : s));
  const len = Math.max(ka.length, kb.length);
  for (let i = 0; i < len; i++) {
    const x = ka[i] !== undefined ? ka[i] : 0;
    const y = kb[i] !== undefined ? kb[i] : 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

/**
 * Pick the sdk-<os>-<arch>-v<version> branch from remote branch names.
 * Exact os-arch first; then any arch for the same OS (upstream only ships a
 * 32-bit win SDK). Prerelease suffixes (-rc1, -beta) lose to plain versions.
 */
function pickBranch(branches, sdkOs, sdkArch, wantVersion) {
  const candidates = [
    new RegExp(`^sdk-${sdkOs}-${sdkArch}-v(.+)$`),
    new RegExp(`^sdk-${sdkOs}-([^-]+)-v(.+)$`),
  ];
  for (const re of candidates) {
    for (const stableOnly of [true, false]) {
      const hits = branches
        .map((b) => b.match(re))
        .filter(Boolean)
        .filter((m) => stableOnly === !/-/.test(m[m.length - 1]));
      if (!hits.length) continue;
      if (wantVersion) {
        const hit = hits.find((m) => m[m.length - 1] === wantVersion);
        if (hit) return hit[0];
        continue;
      }
      hits.sort((a, b) => cmpVersion(a[a.length - 1], b[b.length - 1]));
      return hits[hits.length - 1][0];
    }
  }
  return null;
}

function gitOnce(args, opts) {
  const res = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: opts.timeout || FETCH_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    cwd: opts.cwd,                 // REQUIRED: init/fetch/checkout/lfs all run in the clone
    env: Object.assign({}, process.env, {
      GIT_TERMINAL_PROMPT: '0',
      GIT_LFS_SKIP_SMUDGE: opts.lfsSkipSmudge ? '1' : undefined,
    }),
  });
  if (res.error || res.status !== 0) {
    const detail = (res.stderr || res.stdout || '').trim().slice(-500);
    const why = res.error ? res.error.message : `exit ${res.status}`;
    throw new Error(`git ${args.join(' ')} failed (${why}): ${detail}`);
  }
  return res.stdout;
}

/**
 * 5 attempts with exponential backoff (10/30/60/120s): rides out GitHub's
 * intermittent slow/dead phases, which otherwise kill long transfers.
 */
function git(args, opts = {}) {
  const attempts = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return gitOnce(args, opts);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const delay = 10 * (1 << (attempt - 1));
        console.log(`fetch-runtime: git failed (attempt ${attempt}/${attempts}) - retrying in ${delay}s`);
        spawnSync('sleep', [String(delay)]);
      }
    }
  }
  throw lastError;
}

/** Resolve the branch tip on GitHub on every run (force-update semantics). */
function resolveBranchTip(branch) {
  const out = git(['ls-remote', REPO, `refs/heads/${branch}`],
    { timeout: DISCOVER_TIMEOUT_MS });
  const commit = out.trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`branch '${branch}' not found in ${REPO} (got: '${out.trim()}')`);
  }
  return commit;
}

/** Shallow-fetch one commit; idempotent, safe to retry. */
function fetchCommit(dest, commit, { resume = false } = {}) {
  if (!resume || !fs.existsSync(path.join(dest, '.git'))) {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
  }
  git(['-c', 'core.autocrlf=false', 'init'], { cwd: dest, timeout: 60000 });
  const remotes = git(['remote'], { cwd: dest, timeout: 60000 })
    .split(/\s+/).filter(Boolean);
  if (remotes.includes('origin')) {
    git(['remote', 'set-url', 'origin', REPO], { cwd: dest, timeout: 60000 });
  } else {
    git(['remote', 'add', 'origin', REPO], { cwd: dest, timeout: 60000 });
  }
  git(['-c', 'http.lowSpeedLimit=1000', '-c', 'http.lowSpeedTime=120',
    'fetch', '--depth', '1', 'origin', commit],
    { cwd: dest, timeout: FETCH_TIMEOUT_MS, lfsSkipSmudge: true });
  git(['checkout', '--force', '--detach', 'FETCH_HEAD'],
    { cwd: dest, timeout: 120000, lfsSkipSmudge: true });
}

/**
 * Materialize Git LFS objects and verify none survived as pointers.
 *
 * git-lfs never resumes partial downloads: on a flaky link every retry
 * starts a fresh <oid> partial in .git/lfs/incomplete/ and the object can
 * never complete. Fallback: for each object still a pointer, resume the
 * download with HTTP Range (curl -C -) against a fresh signed href from
 * the LFS batch API, seeding from the largest abandoned partial.
 */
function lfsPull(dest) {
  git(['lfs', 'pull'], { cwd: dest, timeout: LFS_TIMEOUT_MS });
  const out = git(['lfs', 'ls-files'], { cwd: dest, timeout: 120000 });
  const pointers = out.split('\n').filter((l) => l.startsWith('-'));
  if (!pointers.length) return;

  console.log('fetch-runtime: git lfs pull left ' + pointers.length +
    ' pointer(s) - falling back to range-resumed downloads');
  for (const line of pointers) {
    const file = line.split('\t').pop();
    const abs = path.join(dest, file);
    const ptr = fs.readFileSync(abs, 'utf8');
    const oid = (ptr.match(/^oid sha256:([0-9a-f]{64})$/m) || [])[1];
    const size = parseInt((ptr.match(/^size (\d+)$/m) || [])[1], 10);
    if (!oid || !size) {
      throw new Error(`cannot parse LFS pointer for ${file}`);
    }
    lfsDownloadResumable(dest, file, oid, size);
  }

  // Verify nothing survived as a pointer (re-check, and fail loudly).
  const out2 = git(['lfs', 'ls-files'], { cwd: dest, timeout: 120000 });
  const pointers2 = out2.split('\n').filter((l) => l.startsWith('-'));
  if (pointers2.length) {
    throw new Error('Git LFS objects were not materialized for: ' +
      pointers2.map((p) => p.split('\t').pop()).join(', '));
  }
}

/** HTTP-Range-resumable download of one LFS object into the local store. */
function lfsDownloadResumable(dest, file, oid, size) {
  const objPath = path.join(dest, '.git', 'lfs', 'objects',
    oid.slice(0, 2), oid.slice(2, 4), oid);
  const partial = path.join(dest, '.git', 'lfs', 'incomplete',
    `${oid}.range-resume`);
  fs.mkdirSync(path.dirname(objPath), { recursive: true });
  fs.mkdirSync(path.dirname(partial), { recursive: true });

  // Seed the resumable target from the largest abandoned partial, if any.
  if (!fs.existsSync(partial)) {
    const incDir = path.dirname(partial);
    const prefix = oid;
    const abandoned = fs.readdirSync(incDir)
      .filter((n) => n.startsWith(prefix))
      .map((n) => path.join(incDir, n))
      .filter((p) => { try { return fs.statSync(p).size > 0; } catch { return false; } })
      .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
    if (abandoned) {
      fs.copyFileSync(abandoned, partial);
      console.log(`fetch-runtime: seeding ${file} from abandoned partial ` +
        `${path.basename(abandoned)} (${fs.statSync(abandoned).size} bytes)`);
    }
  }

  const href = lfsBatchHref(dest, oid, size);
  // 30 attempts x 10min curl cap = worst case 5h; each attempt resumes
  // from where the last one dropped, so typical completion is far sooner.
  for (let attempt = 1; attempt <= 30; attempt++) {
    let have = 0;
    try { have = fs.statSync(partial).size; } catch { /* not yet */ }
    if (have >= size) break;
    console.log(`fetch-runtime: resuming ${file} at ${have}/${size} ` +
      `(attempt ${attempt}/30)`);
    curlRangeResume(href, partial);
  }
  const sha = crypto.createHash('sha256')
    .update(fs.readFileSync(partial)).digest('hex');
  if (sha !== oid || fs.statSync(partial).size !== size) {
    throw new Error(`LFS object ${file}: sha256/size mismatch after resume ` +
      `(${sha}, ${fs.statSync(partial).size} != ${oid}, ${size})`);
  }
  fs.copyFileSync(partial, objPath);
  fs.rmSync(partial, { force: true });
  // Materialize the working-tree file from the now-complete local object
  // (direct copy - no `git lfs checkout` CLI arg quirks), restoring the
  // mode recorded in the git index.
  const abs = path.join(dest, file);
  fs.copyFileSync(objPath, abs);
  const lsOut = git(['ls-files', '-s', file], { cwd: dest, timeout: 60000 });
  const mode = parseInt(lsOut.trim().split(/\s+/)[0], 8);
  if (!Number.isNaN(mode)) {
    fs.chmodSync(abs, (mode & 0o111) ? 0o755 : 0o644);
  }
  console.log(`fetch-runtime: LFS object materialized: ${file} (${size} bytes)`);
}

/** Fresh signed download href from the LFS batch API. */
function lfsBatchHref(dest, oid, size) {
  const res = spawnSync('curl', ['-sS', '--max-time', '300', '-X', 'POST',
    '-H', 'Accept: application/vnd.git-lfs+json',
    '-H', 'Content-type: application/vnd.git-lfs+json',
    '-d', JSON.stringify({
      operation: 'download',
      objects: [{ oid, size }],
      transfer: 'basic',
    }),
    `${REPO.replace(/\.git$/, '')}.git/info/lfs/objects/batch`], {
    encoding: 'utf8',
    timeout: DISCOVER_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
    cwd: dest,
  });
  if (res.error || res.status !== 0) {
    throw new Error(`LFS batch API failed: ${res.error ? res.error.message
      : `exit ${res.status}`}`);
  }
  const body = JSON.parse(res.stdout);
  const obj = body.objects && body.objects[0];
  const href = obj && obj.actions && obj.actions.download &&
    obj.actions.download.href;
  if (!href) {
    throw new Error(`LFS batch API returned no download href for ${oid}` +
      (obj && obj.error ? ` (${obj.error.message})` : ''));
  }
  return href;
}

/** One curl -C - attempt against href; returns when the transfer ends. */
function curlRangeResume(href, partial) {
  spawnSync('curl', ['-sS', '--max-time', '600', '-C', '-', '-o',
    partial, href], { encoding: 'utf8', timeout: 11 * 60 * 1000 });
  // Errors are fine - the loop re-checks size and retries.
}

function parseArgs(argv) {
  const opts = { out: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--platform') opts.platform = argv[++i];
    else if (a === '--version') opts.version = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--resume') opts.resume = true;
    else if (a === '--repo') { /* REPO already read from env; CLI override */ }
    else if (a === '--help') {
      console.log('Usage: node fetch-runtime.js --platform <linux-x64|...> ' +
        '[--version v] [--out dir] [--resume]');
      process.exit(0);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const platform = opts.platform;
  const meta = PLATFORMS[platform];
  if (!meta) {
    console.error(`fetch-runtime: unsupported platform '${platform}'. ` +
      `Supported: ${Object.keys(PLATFORMS).join(', ')}`);
    return 1;
  }

  // 1. Branch discovery: newest stable sdk-<os>-<arch>-v* unless pinned.
  //    PWAOS_SDK_VERSION pins the version (branch sdk-<os>-<arch>-v<ver>),
  //    PWAOS_SDK_BRANCH pins the whole branch name.
  let branch = process.env.PWAOS_SDK_BRANCH || null;
  const wantVersion = opts.version || process.env.PWAOS_SDK_VERSION || null;
  if (!branch) {
    const heads = git(['ls-remote', '--heads', REPO],
      { timeout: DISCOVER_TIMEOUT_MS })
      .split('\n')
      .map((l) => l.trim().split('\t').pop())
      .filter((ref) => ref.startsWith('refs/heads/'))
      .map((ref) => ref.slice('refs/heads/'.length));  // pickBranch wants bare names
    branch = pickBranch(heads, meta.sdkOs, meta.sdkArch, wantVersion);
    if (!branch) {
      console.error(`fetch-runtime: no sdk-${meta.sdkOs}-${meta.sdkArch}-v* branch found`);
      return 1;
    }
  }
  const commit = resolveBranchTip(branch);
  console.log(`fetch-runtime: branch ${branch} @ ${commit.slice(0, 12)}`);

  // 2. Shallow-fetch that exact commit.
  //    --resume reuses an existing clone (partially downloaded LFS objects
  //    survive) instead of wiping it; the commit is still re-verified against
  //    the live-resolved tip below.
  const cloneDir = path.join(opts.out, '.clone', meta.cloneAs || platform);
  fetchCommit(cloneDir, commit, { resume: !!opts.resume });

  // 3. LFS objects (the runtime executable).
  lfsPull(cloneDir);

  // 4. Stage the package payload:
  //    <out>/<platform>/runtime/           <- the bundle it loads
  //    include/ + lib/                     <- C ABI header + client lib (SDK consumers)
  const stageDir = path.join(opts.out, platform);
  fs.rmSync(stageDir, { recursive: true, force: true });

  const runtimeSrc = path.join(cloneDir, 'runtime');
  if (fs.existsSync(runtimeSrc)) {
    fs.cpSync(runtimeSrc, path.join(stageDir, 'runtime'),
      { recursive: true, verbatimSymlinks: false });
    // Git LFS checkout does not always restore the executable bit on the
    // server binary; without +x the client's execve fails with EACCES and
    // every connection attempt reports connection-lost (-2).
    if (!platform.startsWith('win32')) {
      const stagedServer = path.join(stageDir, 'runtime', 'pwaos_server');
      if (fs.existsSync(stagedServer)) fs.chmodSync(stagedServer, 0o755);
    }
  }


  // SDK consumer files (header + client lib) for addon builders.
  const includeSrc = path.join(cloneDir, 'include');
  if (fs.existsSync(includeSrc)) {
    fs.cpSync(includeSrc, path.join(stageDir, 'include'), { recursive: true });
  }
  const libSrc = path.join(cloneDir, 'lib');
  if (fs.existsSync(libSrc)) {
    fs.cpSync(libSrc, path.join(stageDir, 'lib'), { recursive: true });
  }

  // Cleanup the clone (keep the staged package only).
  fs.rmSync(path.join(opts.out, '.clone'), { recursive: true, force: true });

  console.log(`fetch-runtime: staged ${platform} -> ${stageDir}`);
  return 0;
}

process.exitCode = main();
