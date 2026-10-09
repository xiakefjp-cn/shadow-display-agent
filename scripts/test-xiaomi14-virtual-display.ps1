param(
    [int]$DurationSeconds = 30
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$bundle = Join-Path $workspace "tools\scrcpy\scrcpy-win64-v3.3.4"
$adb = Join-Path $bundle "adb.exe"
$scrcpy = Join-Path $bundle "scrcpy.exe"

if (-not (Test-Path -LiteralPath $adb)) {
    throw "adb.exe not found: $adb"
}
if (-not (Test-Path -LiteralPath $scrcpy)) {
    throw "scrcpy.exe not found: $scrcpy"
}

$deviceLines = & $adb devices -l
$authorized = @($deviceLines | Select-String -Pattern '\sdevice\s')
if ($authorized.Count -ne 1) {
    Write-Host "Connected devices:" -ForegroundColor Yellow
    $deviceLines | ForEach-Object { Write-Host $_ }
    throw "Expected exactly one authorized Android device. Unlock the phone and accept the USB debugging prompt."
}

$model = (& $adb shell getprop ro.product.model).Trim()
$android = (& $adb shell getprop ro.build.version.release).Trim()
$hyperOs = (& $adb shell getprop ro.mi.os.version.name).Trim()

Write-Host "Device connected: $model" -ForegroundColor Green
Write-Host "Android: $android   HyperOS: $hyperOs"
Write-Host ""
Write-Host "This test will:" -ForegroundColor Cyan
Write-Host "  - create a 720x1280 virtual display"
Write-Host "  - open Android Settings only on that display"
Write-Host "  - disable clipboard synchronization and audio"
Write-Host "  - limit rendering to 15 FPS and 2 Mbps"
Write-Host ""
Write-Host "For the first $DurationSeconds seconds, DO NOT click inside the scrcpy window." -ForegroundColor Yellow
Write-Host "Check that the physical phone screen stays on its current app."
Write-Host "Close the scrcpy window or press Ctrl+C to stop."
Write-Host ""

$scrcpyArgs = @(
    "--new-display=720x1280/240",
    "--start-app=com.android.settings",
    "--display-ime-policy=local",
    "--no-clipboard-autosync",
    "--no-audio",
    "--max-fps=15",
    "--video-bit-rate=2M",
    "--window-title=Xiaomi 14 - Agent Virtual Display Test"
)

& $scrcpy @scrcpyArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    throw "scrcpy exited with code $exitCode"
}

Write-Host "Virtual display closed. No persistent virtual display was left running." -ForegroundColor Green
