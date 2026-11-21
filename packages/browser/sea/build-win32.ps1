# build-win32.ps1 - build the @pwaos/browser SEA executable on Windows.
# Requires: Node.js >= 20 (v26 tested), Visual Studio Build Tools (for node-gyp),
#           the pwaos win32 SDK files (pwaos_runtime_api.dll/.lib) via @pwaos/runtime-win32-x86.
# Usage:  powershell -ExecutionPolicy Bypass -File sea\build-win32.ps1
$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pkg  = Resolve-Path (Join-Path $Here '..')
$Arch = 'x64'   # or 'x86' for 32-bit Node (the runtime itself is 32-bit and works via WOW64)
$Out  = Join-Path $Here "out\win32-$Arch"

Write-Host '==> [1/5] bundle JS (esbuild)'
Push-Location $Here
if (-not (Test-Path (Join-Path $Here 'node_modules\esbuild'))) {
  npm install --no-save --no-audit --no-fund esbuild
}
node build-sea.js

Write-Host '==> [2/5] SEA blob'
node --experimental-sea-config sea-config.json

Write-Host '==> [3/5] stage runtime files next to the executable'
New-Item -ItemType Directory -Force -Path (Join-Path $Out 'node_modules\@pwaos') | Out-Null
foreach ($pkg in 'runtime-client', 'runtime', 'runtime-win32-x86') {
  $dst = Join-Path $Out "node_modules\@pwaos\$pkg"
  Copy-Item -Recurse -Force (Join-Path $Pkg $pkg) $dst
  Remove-Item -Recurse -Force (Join-Path $dst 'node_modules') -ErrorAction SilentlyContinue
}

Write-Host '==> [4/5] build the native addon (node-gyp, needs MSVC)'
Push-Location (Join-Path $Pkg '..\runtime-client')
npx node-gyp configure --arch=$Arch
npx node-gyp build --arch=$Arch
Copy-Item -Force 'build\Release\pwaos_addon.node' (Join-Path $Out 'node_modules\@pwaos\runtime-client\build\Release\')
Copy-Item -Force 'node_modules\@pwaos\runtime-win32-x86\lib\win\pwaos_runtime_api.dll' (Join-Path $Out 'node_modules\@pwaos\runtime-client\build\Release\')
Pop-Location

Write-Host '==> [5/5] inject SEA blob into node.exe'
$NodeExe = (Get-Command node).Source
Copy-Item -Force $NodeExe (Join-Path $Out 'pwaos-browser.exe')
Set-Location $Out
npx --yes postject pwaos-browser.exe NODE_SEA_BLOB (Join-Path $Here 'sea-prep.blob') `
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

Write-Host "==> done: $Out"
Pop-Location
