$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not (Test-Path -LiteralPath (Join-Path $workspace ".env"))) {
    throw ".env not found. Run scripts/install-android-tools.ps1 first."
}

Get-Content -LiteralPath (Join-Path $workspace ".env") | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}

$userApk = Get-ChildItem -LiteralPath (Join-Path $workspace "demo-app\app\build\outputs\apk\user\debug") -Filter "*.apk" | Select-Object -First 1
$agentApk = Get-ChildItem -LiteralPath (Join-Path $workspace "demo-app\app\build\outputs\apk\agent\debug") -Filter "*.apk" | Select-Object -First 1
if (-not $userApk -or -not $agentApk) { throw "Demo APKs not found. Run scripts/build-demo-app.ps1 first." }

& $env:ADB_PATH install -r $userApk.FullName
& $env:ADB_PATH install -r $agentApk.FullName
& $env:ADB_PATH reverse tcp:8787 tcp:8787
