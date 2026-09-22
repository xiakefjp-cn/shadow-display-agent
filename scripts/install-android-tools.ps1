param(
    [string]$Version = "3.3.4"
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$toolsRoot = Join-Path $workspace "tools"
$archive = Join-Path $toolsRoot "scrcpy.zip"
$extractRoot = Join-Path $toolsRoot "scrcpy"
$url = "https://github.com/Genymobile/scrcpy/releases/download/v$Version/scrcpy-win64-v$Version.zip"

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
Write-Host "Downloading official scrcpy $Version..."
Invoke-WebRequest -Uri $url -OutFile $archive

if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot -Force

$bundle = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
if (-not $bundle) { throw "scrcpy bundle directory was not found" }
$scrcpy = Join-Path $bundle.FullName "scrcpy.exe"
$adb = Join-Path $bundle.FullName "adb.exe"
if (-not (Test-Path -LiteralPath $scrcpy) -or -not (Test-Path -LiteralPath $adb)) {
    throw "Downloaded bundle does not contain scrcpy.exe and adb.exe"
}

$envFile = Join-Path $workspace ".env"
if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $workspace ".env.example") -Destination $envFile
}
$content = Get-Content -LiteralPath $envFile -Raw
$content = $content -replace '(?m)^ADB_PATH=.*$', ('ADB_PATH=' + $adb)
$content = $content -replace '(?m)^SCRCPY_PATH=.*$', ('SCRCPY_PATH=' + $scrcpy)
Set-Content -LiteralPath $envFile -Value $content -Encoding utf8

Write-Host "Installed to $($bundle.FullName)"
Write-Host "Updated .env. Connect an Android phone and run: npm run doctor"
