#!/usr/bin/env bash
#
# publish-all.sh - publish the @pwaos packages in the correct order.
#
# ORDER MATTERS: all 3 platform subpackages must be on the registry before
# the meta-package @pwaos.net/runtime, otherwise a fresh
# `npm install @pwaos.net/runtime` resolves its optionalDependencies against
# versions that do not exist yet. @pwaos.net/runtime-client-api goes last.
#
# Usage:
#   ./scripts/publish-all.sh [--dry-run] [--skip-client] [--tag <tag>]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="latest"
DRY_RUN=""
SKIP_CLIENT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="--dry-run" ;;
    --skip-client) SKIP_CLIENT="1" ;;
    --tag) TAG="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

PLATFORMS=(
  runtime-linux-x64
  runtime-win32-x86
  runtime-win32-x64
)

publish() {
  local dir="$1"
  local pkgdir name version published
  # Platform packages are NESTED inside packages/runtime/ (2026-11-27);
  # meta + client + anything else stay directly under packages/.
  pkgdir="$ROOT/packages/$dir"
  if [[ -f "$ROOT/packages/runtime/$dir/package.json" ]]; then
    pkgdir="$ROOT/packages/runtime/$dir"
  fi
  name="$(node -p "require('$pkgdir/package.json').name")"
  version="$(node -p "require('$pkgdir/package.json').version")"
  published="$(npm view "$name@$version" version 2>/dev/null || true)"
  if [[ "$published" == "$version" ]]; then
    echo "publish: $name@$version already on the registry - skipping"
    return 0
  fi
  echo "publish: $name@$version"
  (cd "$pkgdir" && npm publish --access public --tag "$TAG" $DRY_RUN)
}

echo "== 1/3 platform subpackages =="
for p in "${PLATFORMS[@]}"; do
  publish "$p"
done

echo "== 2/3 meta package =="
publish runtime

if [[ -z "$SKIP_CLIENT" ]]; then
  echo "== 3/3 client =="
  publish runtime-client-api
fi

echo "publish-all: done (platforms -> meta -> client)"
