#!/usr/bin/env bash
# build.sh - build the @pwaos/browser SEA executable for the CURRENT platform.
# Usage: ./sea/build.sh          (run from anywhere; paths are script-relative)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PKG="$(cd "$HERE/.." && pwd)"
MONO="$(cd "$PKG/../.." && pwd)"
OUT="$HERE/out/$(node -p "process.platform + '-' + process.arch")"

echo "==> [1/5] bundle JS (esbuild; native addon externalized to a dlopen shim)"
cd "$HERE"
[ -d node_modules/esbuild ] || npm install --no-save --no-audit --no-fund esbuild
node build-sea.js

echo "==> [2/5] SEA blob"
node --experimental-sea-config sea-config.json

echo "==> [3/5] stage runtime files next to the executable"
rm -rf "$OUT"
mkdir -p "$OUT/node_modules/@pwaos"
for pkg in runtime-client runtime runtime-linux-x64 runtime-win32-x86; do
  [ -d "$PKG/$pkg" ] || continue
  cp -r "$PKG/$pkg" "$OUT/node_modules/@pwaos/$pkg"
  rm -rf "$OUT/node_modules/@pwaos/$pkg/node_modules" "$OUT/node_modules/@pwaos/$pkg/build/obj.target"
done
# native addon: linux builds here; on win32 see README (needs MSVC node-gyp build)
if [ -f "$PKG/../runtime-client/build/Release/pwaos_addon.node" ]; then
  mkdir -p "$OUT/node_modules/@pwaos/runtime-client/build/Release"
  cp "$PKG/../runtime-client/build/Release/pwaos_addon.node" \
     "$OUT/node_modules/@pwaos/runtime-client/build/Release/"
fi

echo "==> [4/5] inject SEA blob into the Node binary"
case "$(node -p "process.platform")" in
  linux)  cp "$(command which node)" "$OUT/pwaos-browser" ;;
  darwin) cp "$(command which node)" "$OUT/pwaos-browser" ;;
  win32)  cp "$(command -v node).exe" "$OUT/pwaos-browser.exe" 2>/dev/null || cp "$(node -p "process.execPath")" "$OUT/pwaos-browser.exe" ;;
esac
cd "$OUT"
npx --yes postject "$(ls pwaos-browser*)" NODE_SEA_BLOB "$HERE/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo "==> [5/5] done: $OUT"
ls -la "$OUT"
