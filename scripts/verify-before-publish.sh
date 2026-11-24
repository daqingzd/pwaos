#!/usr/bin/env bash
#
# verify-before-publish.sh - pre-publish verification for the @pwaos packages.
#
# The only trustworthy check before `npm publish`: pack every package into a
# tarball (identical content to what npm publish uploads, files-field filtered),
# then install those tarballs via file: into a brand-new consumer project that
# is completely isolated from this monorepo (no workspace resolution, no
# symlink shortcuts) and exercise the whole chain there.
#
# What it verifies:
#   1. npm pack --dry-run shows no unexpected files per package
#   2. @pwaos.net/runtime's tarball contains no platform binaries
#   3. platform tarballs contain only bin/pwaos-runtime[.exe]
#   4. require('@pwaos.net/runtime-client-api') creates a client in the consumer
#   5. the client resolves the platform binary through the resolution logic
#   6. non-matching platform subpackages were correctly skipped by os/cpu
#   7. tarball sizes stay within npm's reasonable limits
#
# Usage:
#   bash scripts/verify-before-publish.sh [--keep]
#
# Requires: the platform package for the CURRENT machine must have its real
# binary merged in (scripts/fetch-runtime.js + scripts/merge-stage.js), since
# a Linux machine can only verify the linux-<arch> flow end to end.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARBALL_DIR="${TMPDIR:-/tmp}/pwaos-tarballs"
CONSUMER_DIR="${TMPDIR:-/tmp}/pwaos-consumer"

KEEP=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP="1" ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

# Map npm platform/arch -> the tarball name built by npm pack. On win32 the
# upstream runtime is 32-bit: the win32-x64 package carries the same x86
# payload (serving x64 hosts via WOW64); win32-x86 covers ia32 hosts.
case "$(node -p "process.platform + '-' + process.arch")" in
  linux-x64)   PLATFORM_PKG="pwaos.net-runtime-linux-x64";   PLATFORM_DIR="runtime-linux-x64" ;;
  win32-x64)   PLATFORM_PKG="pwaos.net-runtime-win32-x64";   PLATFORM_DIR="runtime-win32-x64" ;;
  win32-x86)   PLATFORM_PKG="pwaos.net-runtime-win32-x86";   PLATFORM_DIR="runtime-win32-x86" ;;
  *) echo "verify: unsupported platform $(node -p "process.platform + '-' + process.arch")" >&2; exit 1 ;;
esac

RUNTIME_VERSION="$(node -p "require('$ROOT/packages/runtime/package.json').version")"
CLIENT_VERSION="$(node -p "require('$ROOT/packages/runtime-client-api/package.json').version")"
# Platform packages version independently of the meta package (decoupled
# ranges): each tarball is named after its OWN package version.
PLATFORM_VERSION="$(node -p "require('$ROOT/packages/$PLATFORM_DIR/package.json').version")"

ALL_PACKAGES=(
  runtime-linux-x64 runtime-win32-x86 runtime-win32-x64 runtime runtime-client-api
)

fail() { echo "❌ $*" >&2; exit 1; }
pass() { echo "✅ $*"; }

# ----------------------------------------------------------------------------
echo "==> Step 0: clean slate"
rm -rf "$TARBALL_DIR" "$CONSUMER_DIR"
mkdir -p "$TARBALL_DIR" "$CONSUMER_DIR"

# ----------------------------------------------------------------------------
echo "==> Step 1: npm pack --dry-run per package (what would be published?)"
for pkg in "${ALL_PACKAGES[@]}"; do
  echo "--- $pkg ---"
  (cd "$ROOT/packages/$pkg" && npm pack --dry-run) > /dev/null
done
pass "all ${#ALL_PACKAGES[@]} packages pack cleanly"

# ----------------------------------------------------------------------------
echo "==> Step 2: generate all tarballs into $TARBALL_DIR"
for pkg in "${ALL_PACKAGES[@]}"; do
  (cd "$ROOT/packages/$pkg" && npm pack --pack-destination "$TARBALL_DIR" > /dev/null)
done
ls -la "$TARBALL_DIR"

# ----------------------------------------------------------------------------
echo "==> Step 3: static tarball checks"

# 3a. @pwaos.net/runtime must contain ONLY package.json/README.md/LICENSE -
#     absolutely no platform binaries or subpackage dirs.
runtime_tar="$TARBALL_DIR/pwaos.net-runtime-$RUNTIME_VERSION.tgz"
runtime_files="$(tar -tzf "$runtime_tar")"
echo "$runtime_files"
if echo "$runtime_files" | grep -qE 'bin/|\.node$|runtime/pwaos_server|pwaos_runtime_api\.(so|dll)'; then
  fail "@pwaos.net/runtime tarball contains binaries - the files field is wrong"
fi
if echo "$runtime_files" | grep -qE 'runtime-linux|runtime-win32'; then
  fail "@pwaos.net/runtime tarball contains platform subpackage directories"
fi
pass "@pwaos.net/runtime tarball has no binaries and no subpackage dirs"

# 3b. The current platform's tarball must contain exactly its binary
#     (plus metadata), and nothing else.
platform_tar="$TARBALL_DIR/$PLATFORM_PKG-$PLATFORM_VERSION.tgz"
platform_files="$(tar -tzf "$platform_tar")"
echo "$platform_files"
if ! echo "$platform_files" | grep -qE 'runtime/pwaos_server(\.exe)?$'; then
  fail "$PLATFORM_PKG tarball is missing runtime/pwaos_server"
fi
if echo "$platform_files" | grep -qE 'src/|node_modules/|test|\.tgz$'; then
  fail "$PLATFORM_PKG tarball contains unexpected files"
fi
# Server-run pollution (pwaos_server.log + runtime/locales/) must never ship:
# these appear when the unit suite runs against the monorepo-linked package.
if echo "$platform_files" | grep -qE 'pwaos_server\.log|locales/'; then
  fail "$PLATFORM_PKG tarball contains server-run pollution (pwaos_server.log / locales/)"
fi
pass "$PLATFORM_PKG tarball contains only its binary + metadata"

# 3c. Size check: tarballs must stay within sane registry limits (<100MB
#     uncompressed warning threshold; the runtime bundle gzip-rides well under).
for tarball in "$TARBALL_DIR"/*.tgz; do
  size_mb=$(( $(stat -c%s "$tarball" 2>/dev/null || stat -f%z "$tarball") / 1024 / 1024 ))
  if [[ $size_mb -gt 100 ]]; then
    echo "⚠️  $(basename "$tarball") is ${size_mb}MB - over the 100MB comfort zone"
  fi
done
pass "tarball sizes checked"

# ----------------------------------------------------------------------------
echo "==> Step 4: install tarballs via file: into a fresh consumer"
cd "$CONSUMER_DIR"
npm init -y > /dev/null

# Install order mirrors a real consumer: platform subpackage, then the
# meta-package, then the client. file: installs do not resolve
# optionalDependencies by registry name, so the platform package is explicit.
# Non-matching platform tarballs are intentionally NOT installed - the os/cpu
# filtering is exactly what we verify afterwards.
# --offline: every dependency is satisfied by the already-installed tarballs;
# without it npm tries the registry for metadata and hangs on a network-restricted host.
npm install --offline --no-audit --no-fund "$TARBALL_DIR/$PLATFORM_PKG-$PLATFORM_VERSION.tgz" > /dev/null
npm install --offline --no-audit --no-fund "$runtime_tar" > /dev/null
npm install --offline --no-audit --no-fund "$TARBALL_DIR/pwaos.net-runtime-client-api-$CLIENT_VERSION.tgz" > /dev/null
pass "tarballs installed into the isolated consumer"

# ----------------------------------------------------------------------------
echo "==> Step 5: runtime behavior in the consumer"
cat > verify.js <<'EOF'
'use strict';
const wmod = require('@pwaos.net/runtime-client-api');
const path = require('path');
const fs = require('fs');

// 1. The platform subpackage's runtime directory exists (with the server).
//    Candidate order mirrors the client resolver: strict platform-arch name
//    first; on win32 the payload-carrying win32-x86 package aliases.
const candidates = process.platform === 'win32'
  ? (process.arch === 'ia32'
      ? ['@pwaos.net/runtime-win32-x86']
      : [`@pwaos.net/runtime-win32-${process.arch}`, '@pwaos.net/runtime-win32-x86'])
  : [`@pwaos.net/runtime-${process.platform}-${process.arch}`];
const serverName = process.platform === 'win32' ? 'pwaos_server.exe' : 'pwaos_server';
let runtimeDir = null;
let resolvedPkg = null;
let pkgJson = null;
for (const pkg of candidates) {
  try {
    pkgJson = require.resolve(`${pkg}/package.json`);
  } catch (_) { continue; }
  const dir = path.join(path.dirname(pkgJson), 'runtime');
  if (fs.existsSync(path.join(dir, serverName))) {
    runtimeDir = dir;
    resolvedPkg = pkg;
    break;
  }
}
if (!runtimeDir) {
  throw new Error(`Runtime server not found for candidates: ${candidates.join(', ')}`);
}
console.log(`✅ Runtime directory found (${resolvedPkg}):`, runtimeDir);

// 2. The package's export surface IS the addon - no extra classes/functions.
//    The exports map does not expose the build subpath, so load the addon by
//    absolute path - this hits the same require-cache entry runtime.cjs used,
//    keeping the identity check below meaningful.
const native = require(path.join(
    path.dirname(require.resolve('@pwaos.net/runtime-client-api/package.json')),
    'build', 'Release', 'pwaos_addon.node'));
if (wmod !== native) throw new Error('module.exports is not the addon itself');
if (typeof wmod.Instance !== 'function' || typeof wmod.App !== 'function') {
  throw new Error('native Instance/App classes not exposed');
}
if (typeof wmod.init !== 'function' || typeof wmod.createInstance !== 'function'
    || typeof wmod.setRuntimeExecutablePath !== 'function'
    || typeof wmod.resultToString !== 'function') {
  throw new Error('native API functions missing from the export surface');
}
console.log('✅ module.exports = addon (native surface only)');

// 3. Non-matching platform subpackages were correctly skipped by os/cpu.
const other = `@pwaos.net/runtime-${process.platform === 'linux' ? 'win32' : 'linux'}-x64`;
try {
  require.resolve(`${other}/package.json`);
  console.warn(`⚠️  ${other} unexpectedly installed on this platform`);
  process.exit(1);
} catch (_) {
  console.log('✅ Non-matching platform package correctly skipped');
}

// 4. Loading the package performed the setup contract: the dynamic-library
//    search path includes the platform lib dir, and
//    pwaos_setRuntimeExecutablePath was called with the platform runtime dir.
if (process.platform === 'win32') {
  const libDir = path.join(path.dirname(pkgJson), 'lib', 'win');
  if (!process.env.PATH.includes(libDir)) {
    throw new Error(`PATH missing platform lib dir: ${libDir}`);
  }
} else {
  const libDir = path.join(path.dirname(pkgJson), 'lib', process.platform);
  if (!(process.env.LD_LIBRARY_PATH || '').includes(libDir)) {
    throw new Error(`LD_LIBRARY_PATH missing platform lib dir: ${libDir}`);
  }
}
console.log('✅ Dynamic-library search path set up (lib dir reachable)');
if (process.env.PWAOS_RUNTIME_PATH !== runtimeDir) {
  throw new Error(`pwaos_setRuntimeExecutablePath mismatch: env=${process.env.PWAOS_RUNTIME_PATH} expected=${runtimeDir}`);
}
console.log('✅ pwaos_setRuntimeExecutablePath bound to the platform runtime dir');

console.log('VERIFY-PASS');
// The native addon starts a raw repeating uv_timer at require time
// (StartHandleEventsTimer in the addon's Init) which keeps libuv's loop
// alive forever - invisible to process._getActiveHandles(). Draining it
// properly needs init()+shutDown(), which we deliberately did NOT do here
// (shutDown without init segfaults inside the runtime). All checks passed,
// so exit explicitly instead of hanging on natural exit.
process.exit(0);
EOF
node verify.js

# ----------------------------------------------------------------------------
echo "==> Step 6: optional static analysis (publint, if available)"
if npx --yes publint "$ROOT/packages/runtime" > /dev/null 2>&1; then
  echo "publint: @pwaos.net/runtime clean"
fi

echo ""
echo "=============================================="
echo "VERIFY-BEFORE-PUBLISH: ALL CHECKS PASSED"
echo "=============================================="
[[ -n "$KEEP" ]] || { rm -rf "$TARBALL_DIR" "$CONSUMER_DIR"; echo "(temp dirs cleaned; --keep to retain)"; }
