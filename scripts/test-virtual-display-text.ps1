param(
    [string]$Text = "AGENT-456"
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$adb = Join-Path $workspace "tools\scrcpy\scrcpy-win64-v3.3.4\adb.exe"

if (-not (Test-Path -LiteralPath $adb)) {
    throw "adb.exe not found: $adb"
}
if ($Text -notmatch '^[\x20-\x7E]+$') {
    throw "This safe test supports printable ASCII only."
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
    throw "Expected exactly one virtual display, found: $($virtualIds -join ', ')."
}

$displayId = $virtualIds[0]
$encodedText = $Text.Replace('%', '%25').Replace(' ', '%s')
Write-Host "Typing '$Text' into the focused field on virtual display $displayId only." -ForegroundColor Cyan
Write-Host "Physical display 0 is explicitly excluded."

& $adb shell input -d $displayId text $encodedText
if ($LASTEXITCODE -ne 0) {
    throw "Targeted text input failed with exit code $LASTEXITCODE"
}

Write-Host "Text command completed. Verify that the physical phone text did not change." -ForegroundColor Green
