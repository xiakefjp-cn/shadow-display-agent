$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$adb = Join-Path $workspace "tools\scrcpy\scrcpy-win64-v3.3.4\adb.exe"

if (-not (Test-Path -LiteralPath $adb)) {
    throw "adb.exe not found: $adb"
}

$ids = @(& $adb shell cmd display get-displays -i) |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^\d+$' } |
    ForEach-Object { [int]$_ }

$virtualIds = @($ids | Where-Object { $_ -gt 0 })
if ($virtualIds.Count -eq 0) {
    throw "No virtual display is active. Start test-xiaomi14-virtual-display.ps1 first."
}
if ($virtualIds.Count -ne 1) {
    throw "Expected exactly one virtual display, found: $($virtualIds -join ', '). Close all scrcpy windows and start one test window."
}

$displayId = $virtualIds[0]
Write-Host "Sending one upward swipe to virtual display $displayId only." -ForegroundColor Cyan
Write-Host "Physical display 0 is explicitly excluded."

& $adb shell input -d $displayId swipe 360 1000 360 400 600
if ($LASTEXITCODE -ne 0) {
    throw "Targeted swipe failed with exit code $LASTEXITCODE"
}

Write-Host "Swipe command completed. Check that only the virtual Settings page moved." -ForegroundColor Green
