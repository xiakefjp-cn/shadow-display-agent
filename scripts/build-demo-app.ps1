$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$appRoot = Join-Path $workspace "demo-app"

if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) {
    throw "Gradle was not found. Open demo-app in Android Studio, or install Gradle and Android SDK 35."
}

Push-Location $appRoot
try {
    gradle assembleUserDebug assembleAgentDebug
} finally {
    Pop-Location
}

Write-Host "Built APKs:"
Get-ChildItem -LiteralPath (Join-Path $appRoot "app\build\outputs\apk") -Recurse -Filter "*.apk" | Select-Object -ExpandProperty FullName
